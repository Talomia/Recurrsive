/**
 * @module __tests__/migrations/schema
 *
 * Tests for the migration module — both the 001_initial_schema
 * implementation and the barrel export (migrations/index.ts).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  migrate,
  getMigrationStatements,
  MIGRATION_NAME,
  DEFAULT_AGE_GRAPH,
  assertSafeGraphName,
} from '../../migrations/001_initial_schema.js';
import * as migrationsBarrel from '../../migrations/index.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('migrations/001_initial_schema', () => {
  // ── MIGRATION_NAME ───────────────────────────────────────────────────────

  describe('MIGRATION_NAME', () => {
    it('is a non-empty string', () => {
      expect(typeof MIGRATION_NAME).toBe('string');
      expect(MIGRATION_NAME.length).toBeGreaterThan(0);
    });

    it('equals "001_initial_schema"', () => {
      expect(MIGRATION_NAME).toBe('001_initial_schema');
    });
  });

  // ── getMigrationStatements ─────────────────────────────────────────────

  describe('getMigrationStatements', () => {
    // ── PostgreSQL + AGE ─────────────────────────────────────────────────

    describe('postgresql_age provider', () => {
      const stmts = getMigrationStatements('postgresql_age');

      it('returns a non-empty array of SQL statements', () => {
        expect(Array.isArray(stmts)).toBe(true);
        expect(stmts.length).toBeGreaterThan(0);
      });

      it('creates the AGE extension', () => {
        expect(stmts.some((s) => s.includes('CREATE EXTENSION IF NOT EXISTS age'))).toBe(true);
      });

      it('loads the AGE extension', () => {
        expect(stmts.some((s) => s.includes("LOAD 'age'"))).toBe(true);
      });

      it('creates the recurrsive graph', () => {
        expect(stmts.some((s) => s.includes("create_graph('recurrsive')"))).toBe(true);
      });

      it('creates vertex labels for entity types', () => {
        expect(stmts.some((s) => s.includes('create_vlabel'))).toBe(true);
      });

      it('creates edge labels for relation types', () => {
        expect(stmts.some((s) => s.includes('create_elabel'))).toBe(true);
      });

      it('creates the migration tracking table', () => {
        expect(stmts.some((s) => s.includes('recurrsive_migrations'))).toBe(true);
      });

      it('all statements are strings', () => {
        for (const s of stmts) {
          expect(typeof s).toBe('string');
        }
      });
    });

    // ── SQLite ───────────────────────────────────────────────────────────

    describe('sqlite provider', () => {
      const stmts = getMigrationStatements('sqlite');

      it('returns a non-empty array of SQL statements', () => {
        expect(Array.isArray(stmts)).toBe(true);
        expect(stmts.length).toBeGreaterThan(0);
      });

      it('creates the entities table', () => {
        expect(stmts.some((s) => s.includes('CREATE TABLE IF NOT EXISTS entities'))).toBe(true);
      });

      it('creates the relationships table', () => {
        expect(stmts.some((s) => s.includes('CREATE TABLE IF NOT EXISTS relationships'))).toBe(true);
      });

      it('creates indexes for fast lookups', () => {
        expect(stmts.some((s) => s.includes('CREATE INDEX IF NOT EXISTS'))).toBe(true);
      });

      it('creates entities index on type', () => {
        expect(stmts.some((s) => s.includes('idx_entities_type'))).toBe(true);
      });

      it('creates relationships index on source_id', () => {
        expect(stmts.some((s) => s.includes('idx_relationships_source_id'))).toBe(true);
      });

      it('creates the migration tracking table', () => {
        expect(stmts.some((s) => s.includes('recurrsive_migrations'))).toBe(true);
      });

      it('creates FTS5 virtual table', () => {
        expect(stmts.some((s) => s.includes('entities_fts'))).toBe(true);
      });

      it('creates FTS sync triggers', () => {
        expect(stmts.some((s) => s.includes('entities_fts_insert'))).toBe(true);
        expect(stmts.some((s) => s.includes('entities_fts_update'))).toBe(true);
        expect(stmts.some((s) => s.includes('entities_fts_delete'))).toBe(true);
      });

      it('enables WAL mode', () => {
        expect(stmts.some((s) => s.includes('PRAGMA journal_mode = WAL'))).toBe(true);
      });

      it('enables foreign keys', () => {
        expect(stmts.some((s) => s.includes('PRAGMA foreign_keys = ON'))).toBe(true);
      });

      it('all statements are strings', () => {
        for (const s of stmts) {
          expect(typeof s).toBe('string');
        }
      });
    });
  });

  // ── migrate ────────────────────────────────────────────────────────────

  describe('migrate', () => {
    it('executes all statements for sqlite', async () => {
      const executed: string[] = [];
      const exec = vi.fn((sql: string) => { executed.push(sql); });

      const result = await migrate(exec, 'sqlite');

      expect(result.applied).toBe(true);
      expect(result.summary).toContain('001_initial_schema');
      expect(result.summary).toContain('sqlite');

      // Should have executed the generated statements + the migration record
      const stmts = getMigrationStatements('sqlite');
      expect(executed.length).toBe(stmts.length + 1); // +1 for INSERT migration record
    });

    it('executes all statements for postgresql_age', async () => {
      const executed: string[] = [];
      const exec = vi.fn((sql: string) => { executed.push(sql); });

      const result = await migrate(exec, 'postgresql_age');

      expect(result.applied).toBe(true);
      expect(result.summary).toContain('postgresql_age');
    });

    it('records the migration with INSERT OR IGNORE for sqlite', async () => {
      const executed: string[] = [];
      const exec = vi.fn((sql: string) => { executed.push(sql); });

      await migrate(exec, 'sqlite');

      const insertStmt = executed.find((s) => s.includes(MIGRATION_NAME));
      expect(insertStmt).toBeDefined();
      expect(insertStmt).toContain('INSERT OR IGNORE');
    });

    it('records the migration with ON CONFLICT for postgresql_age', async () => {
      const executed: string[] = [];
      const exec = vi.fn((sql: string) => { executed.push(sql); });

      await migrate(exec, 'postgresql_age');

      const insertStmt = executed.find((s) => s.includes(MIGRATION_NAME));
      expect(insertStmt).toBeDefined();
      expect(insertStmt).toContain('ON CONFLICT');
    });

    it('propagates exec errors', async () => {
      const exec = vi.fn(() => {
        throw new Error('SQL execution failed');
      });

      await expect(migrate(exec, 'sqlite')).rejects.toThrow(
        'SQL execution failed',
      );
    });

    it('works with async exec callbacks', async () => {
      const exec = vi.fn(async (_sql: string) => {
        // simulate async delay
        await new Promise((r) => setTimeout(r, 1));
      });

      const result = await migrate(exec, 'sqlite');
      expect(result.applied).toBe(true);
    });
  });
});

// ── Barrel export ────────────────────────────────────────────────────────────

describe('migrations/index barrel export', () => {
  it('re-exports migrate', () => {
    expect(migrationsBarrel.migrate).toBe(migrate);
  });

  it('re-exports getMigrationStatements', () => {
    expect(migrationsBarrel.getMigrationStatements).toBe(getMigrationStatements);
  });

  it('re-exports MIGRATION_NAME', () => {
    expect(migrationsBarrel.MIGRATION_NAME).toBe(MIGRATION_NAME);
  });
});

// ─── Per-project graph name scoping + injection guard ──────────────────────────

describe('per-project AGE graph scoping', () => {
  describe('assertSafeGraphName', () => {
    it('accepts safe identifiers', () => {
      expect(() => assertSafeGraphName('recurrsive')).not.toThrow();
      expect(() => assertSafeGraphName(DEFAULT_AGE_GRAPH)).not.toThrow();
      expect(() => assertSafeGraphName('recurrsive_acme_web_ab12cd34')).not.toThrow();
      expect(() => assertSafeGraphName('_x')).not.toThrow();
    });

    it('rejects unsafe identifiers (SQL-injection surface)', () => {
      for (const bad of [
        'acme-web',                       // hyphen
        'a b',                            // space
        "x'); DROP GRAPH; --",            // injection attempt
        '1graph',                         // leading digit
        'Recurrsive',                     // uppercase
        '',                               // empty
        'x'.repeat(64),                   // too long
      ]) {
        expect(() => assertSafeGraphName(bad), `expected "${bad}" to be rejected`).toThrow();
      }
    });
  });

  describe('getMigrationStatements graph name', () => {
    it('defaults to the "recurrsive" graph', () => {
      const sql = getMigrationStatements('postgresql_age').join('\n');
      expect(sql).toContain("create_graph('recurrsive')");
    });

    it('targets the provided graph name for every graph/label/index statement', () => {
      const name = 'recurrsive_proj_deadbeef00';
      const sql = getMigrationStatements('postgresql_age', name).join('\n');
      expect(sql).toContain(`create_graph('${name}')`);
      expect(sql).toContain(`create_vlabel('${name}',`);
      expect(sql).toContain(`create_elabel('${name}',`);
      expect(sql).toContain(`ON ${name}.`);
      // Must NOT leak the default graph name when a custom one is requested.
      expect(sql).not.toContain("create_graph('recurrsive')");
    });

    it('rejects an unsafe graph name before emitting any SQL', () => {
      expect(() => getMigrationStatements('postgresql_age', "x'); DROP GRAPH; --")).toThrow();
    });

    it('ignores graph name for the sqlite provider (table-scoped)', () => {
      const sql = getMigrationStatements('sqlite', 'anything_here').join('\n');
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS entities');
    });
  });
});

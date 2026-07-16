/**
 * Tests for DataAnalyzer.
 *
 * Covers the 4 rules that evaluate data the database collector actually
 * produces: schema anti-patterns (no primary key), wide tables, missing
 * timestamps, and inconsistent naming. Also tests finalize() and asserts that
 * the removed rules (missing indexes, unused tables, missing foreign keys) no
 * longer fire on inputs that previously triggered them.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataAnalyzer } from '../../data/analyzer.js';
import type { AnalysisContext, Entity, Relationship, Finding } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();
let _idCounter = 0;
function nextId(): string {
  _idCounter++;
  const hex = _idCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

function makeEntity(overrides: Partial<Entity> & Pick<Entity, 'type' | 'name'>): Entity {
  return {
    id: nextId(),
    qualified_name: `test:${overrides.name}`,
    source: 'test-collector',
    properties: {},
    tags: [],
    created_at: NOW,
    updated_at: NOW,
    last_seen_at: NOW,
    ...overrides,
  };
}

function makeRel(overrides: Partial<Relationship> & Pick<Relationship, 'type' | 'source_id' | 'target_id'>): Relationship {
  return {
    id: nextId(),
    properties: {},
    confidence: 1,
    source: 'test',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

type GetRelsFn = (id: string, dir: string) => Relationship[];

function makeContext(
  entitiesByType: Record<string, Entity[]> = {},
  relsFn: GetRelsFn = () => [],
): AnalysisContext {
  return {
    graph: {
      getEntity: vi.fn(),
      getEntities: vi.fn().mockImplementation((type: string) =>
        Promise.resolve(entitiesByType[type] ?? []),
      ),
      getRelationships: vi.fn().mockImplementation((id: string, dir: string) =>
        Promise.resolve(relsFn(id, dir)),
      ),
      query: vi.fn(),
      getNeighbors: vi.fn(),
    },
    config: { enabled: true, severity_threshold: 'low', custom: {} },
    history: {
      getPreviousFindings: vi.fn().mockResolvedValue([]),
      getAcceptedOpportunities: vi.fn().mockResolvedValue([]),
      getRejectedOpportunities: vi.fn().mockResolvedValue([]),
    },
    project: {
      name: 'test-project',
      root_path: '/tmp/test',
      languages: ['typescript'],
      frameworks: [],
      ai_providers: [],
    },
    emit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DataAnalyzer', () => {
  let analyzer: DataAnalyzer;

  beforeEach(() => {
    analyzer = new DataAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('data.schema-quality');
    expect(analyzer.name).toBe('Data Analyzer');
    expect(analyzer.categories).toContain('data');
  });

  // ── Removed rule: Missing Indexes ───────────────────────────────────
  // No collector produces `index` or `query` entities, so this rule could
  // never fire. It was removed; the former input must now produce nothing.

  describe('missing indexes (removed)', () => {
    it('does not emit a missing-index finding even when a query targets an unindexed table', async () => {
      const table = makeEntity({ type: 'table', name: 'users' });
      const query = makeEntity({ type: 'query', name: 'findUserByEmail' });
      const queryRel = makeRel({
        type: 'queries_table',
        source_id: query.id,
        target_id: table.id,
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [query] },
        (id, dir) => {
          if (id === query.id && dir === 'out') return [queryRel];
          return [];
        },
      );

      const findings = await analyzer.analyze(ctx);
      const indexFindings = findings.filter((f) => f.title.includes('Missing index'));
      expect(indexFindings).toHaveLength(0);
    });
  });

  // ── Rule 1: Schema Anti-Patterns ────────────────────────────────────

  describe('schema anti-patterns', () => {
    it('detects table without primary key', async () => {
      const table = makeEntity({ type: 'table', name: 'events' });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const pkFindings = findings.filter((f) => f.title.includes('Table without primary key'));
      expect(pkFindings).toHaveLength(1);
      expect(pkFindings[0]!.severity).toBe('high');
    });

    it('skips table with has_primary_key property', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'events',
        properties: { has_primary_key: true },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const pkFindings = findings.filter((f) => f.title.includes('Table without primary key'));
      expect(pkFindings).toHaveLength(0);
    });

    it('skips table with has-primary-key tag', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'events',
        tags: ['has-primary-key'],
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const pkFindings = findings.filter((f) => f.title.includes('Table without primary key'));
      expect(pkFindings).toHaveLength(0);
    });

    it('does not flag missing foreign keys — the sub-check was removed', async () => {
      // A table with a foreign-key `references` relationship used to always
      // false-positive because `has_foreign_keys` is never set by the
      // collector. The collector only creates a `references` relationship FOR
      // foreign-key columns, so the check was self-contradictory.
      const table = makeEntity({
        type: 'table',
        name: 'orders',
        properties: { has_primary_key: true },
      });
      const otherTable = makeEntity({
        type: 'table',
        name: 'users',
        properties: { has_primary_key: true },
      });
      const rel = makeRel({ type: 'references', source_id: table.id, target_id: otherTable.id });

      const ctx = makeContext(
        { table: [table, otherTable], index: [], query: [] },
        (id, dir) => {
          if (id === table.id && dir === 'out') return [rel];
          return [];
        },
      );

      const findings = await analyzer.analyze(ctx);
      const fkFindings = findings.filter((f) => f.title.includes('Missing foreign keys'));
      expect(fkFindings).toHaveLength(0);
    });
  });

  // ── Removed rule: Unused Tables ─────────────────────────────────────
  // Usage relationships (queries_table/reads_from/writes_to) are never
  // produced, so "unused" could not be determined honestly — the rule flagged
  // every leaf table. Removed; the former input must now produce nothing.

  describe('unused tables (removed)', () => {
    it('does not flag a table with no inbound usage relationships as unused', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'legacy_data',
        properties: { has_primary_key: true },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const unusedFindings = findings.filter((f) => f.title.includes('Unused table'));
      expect(unusedFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Wide Tables ─────────────────────────────────────────────

  describe('wide tables', () => {
    it('detects table with more than 20 columns', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'mega_table',
        properties: {
          has_primary_key: true,
          column_count: 25,
        },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const wideFindings = findings.filter((f) => f.title.includes('Wide table'));
      expect(wideFindings).toHaveLength(1);
      expect(wideFindings[0]!.severity).toBe('medium');
      expect(wideFindings[0]!.title).toContain('25');
    });

    it('detects wide table from columns array length', async () => {
      const columns = Array.from({ length: 22 }, (_, i) => ({ name: `col_${i}` }));
      const table = makeEntity({
        type: 'table',
        name: 'wide_table',
        properties: { has_primary_key: true, columns },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const wideFindings = findings.filter((f) => f.title.includes('Wide table'));
      expect(wideFindings).toHaveLength(1);
    });

    it('skips tables within the threshold', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'normal_table',
        properties: { has_primary_key: true, column_count: 10 },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const wideFindings = findings.filter((f) => f.title.includes('Wide table'));
      expect(wideFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Missing Timestamps ──────────────────────────────────────

  describe('missing timestamps', () => {
    it('detects missing created_at and updated_at columns', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'products',
        properties: {
          has_primary_key: true,
          columns: [{ name: 'id' }, { name: 'name' }, { name: 'price' }],
        },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const tsFindings = findings.filter((f) => f.title.includes('Missing timestamps'));
      expect(tsFindings).toHaveLength(1);
      expect(tsFindings[0]!.description).toContain('created_at');
      expect(tsFindings[0]!.description).toContain('updated_at');
    });

    it('detects only missing updated_at when created_at exists', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'products',
        properties: {
          has_primary_key: true,
          columns: [{ name: 'id' }, { name: 'created_at' }],
        },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const tsFindings = findings.filter((f) => f.title.includes('Missing timestamps'));
      expect(tsFindings).toHaveLength(1);
      expect(tsFindings[0]!.description).not.toContain('created_at,');
      expect(tsFindings[0]!.description).toContain('updated_at');
    });

    it('skips table with both timestamp columns', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'products',
        properties: {
          has_primary_key: true,
          columns: [{ name: 'id' }, { name: 'created_at' }, { name: 'updated_at' }],
        },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const tsFindings = findings.filter((f) => f.title.includes('Missing timestamps'));
      expect(tsFindings).toHaveLength(0);
    });

    it('skips table when has_created_at and has_updated_at properties set', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'products',
        properties: {
          has_primary_key: true,
          has_created_at: true,
          has_updated_at: true,
        },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const tsFindings = findings.filter((f) => f.title.includes('Missing timestamps'));
      expect(tsFindings).toHaveLength(0);
    });

    it('skips table with no column info', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'unknown_schema',
        properties: { has_primary_key: true },
      });

      const ctx = makeContext(
        { table: [table], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const tsFindings = findings.filter((f) => f.title.includes('Missing timestamps'));
      expect(tsFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: Inconsistent Naming ─────────────────────────────────────

  describe('inconsistent naming', () => {
    it('detects mixed naming conventions', async () => {
      const t1 = makeEntity({
        type: 'table',
        name: 'user_accounts',
        properties: { has_primary_key: true },
      });
      const t2 = makeEntity({
        type: 'table',
        name: 'order_items',
        properties: { has_primary_key: true },
      });
      const t3 = makeEntity({
        type: 'table',
        name: 'ProductCatalog',
        properties: { has_primary_key: true },
      });

      const ctx = makeContext(
        { table: [t1, t2, t3], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const namingFindings = findings.filter((f) => f.title.includes('Inconsistent table naming'));
      expect(namingFindings).toHaveLength(1);
      expect(namingFindings[0]!.severity).toBe('info');
    });

    it('skips when all tables use same convention', async () => {
      const t1 = makeEntity({
        type: 'table',
        name: 'user_accounts',
        properties: { has_primary_key: true },
      });
      const t2 = makeEntity({
        type: 'table',
        name: 'order_items',
        properties: { has_primary_key: true },
      });

      const ctx = makeContext(
        { table: [t1, t2], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const namingFindings = findings.filter((f) => f.title.includes('Inconsistent table naming'));
      expect(namingFindings).toHaveLength(0);
    });

    it('skips when fewer than 2 tables', async () => {
      const t1 = makeEntity({
        type: 'table',
        name: 'users',
        properties: { has_primary_key: true },
      });

      const ctx = makeContext(
        { table: [t1], index: [], query: [] },
        () => [],
      );

      const findings = await analyzer.analyze(ctx);
      const namingFindings = findings.filter((f) => f.title.includes('Inconsistent table naming'));
      expect(namingFindings).toHaveLength(0);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────

  it('initialize is a no-op', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
  });

  describe('finalize', () => {
    it('detects tables without migration files', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'users',
        properties: { has_primary_key: true },
      });

      const ctx = makeContext({
        table: [table],
        file: [],
        index: [],
        query: [],
      });

      const finalized = await analyzer.finalize(ctx);
      const migrationFindings = finalized.filter((f) =>
        f.title.includes('Database schema without migration management'),
      );
      expect(migrationFindings).toHaveLength(1);
      expect(migrationFindings[0]!.severity).toBe('medium');
    });

    it('skips when migration files exist', async () => {
      const table = makeEntity({
        type: 'table',
        name: 'users',
        properties: { has_primary_key: true },
      });
      const migrationFile = makeEntity({
        type: 'file',
        name: '001_create_users.migration.sql',
      });

      const ctx = makeContext({
        table: [table],
        file: [migrationFile],
        index: [],
        query: [],
      });

      const finalized = await analyzer.finalize(ctx);
      const migrationFindings = finalized.filter((f) =>
        f.title.includes('Database schema without migration management'),
      );
      expect(migrationFindings).toHaveLength(0);
    });

    it('returns empty findings when no tables exist', async () => {
      const ctx = makeContext({ table: [], file: [] });
      const finalized = await analyzer.finalize(ctx);
      expect(finalized).toEqual([]);
    });

    it('detects multiple databases without cross-database relationships', async () => {
      const t1 = makeEntity({
        type: 'table',
        name: 'users',
        properties: { has_primary_key: true, database: 'auth_db' },
      });
      const t2 = makeEntity({
        type: 'table',
        name: 'products',
        properties: { has_primary_key: true, database: 'catalog_db' },
      });
      const t3 = makeEntity({
        type: 'table',
        name: 'analytics',
        properties: { has_primary_key: true, database: 'analytics_db' },
      });
      const migrationFile = makeEntity({
        type: 'file',
        name: '001_init.migration.sql',
      });

      const ctx = makeContext(
        {
          table: [t1, t2, t3],
          file: [migrationFile],
          index: [],
          query: [],
        },
        () => [],
      );

      const finalized = await analyzer.finalize(ctx);
      const dbFindings = finalized.filter((f) =>
        f.title.includes('Multiple databases without documented relationships'),
      );
      expect(dbFindings).toHaveLength(1);
      expect(dbFindings[0]!.severity).toBe('low');
    });
  });
});

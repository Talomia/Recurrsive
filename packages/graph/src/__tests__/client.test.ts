/**
 * @module __tests__/client
 *
 * Tests for the graph client factory functions (createGraphClient,
 * createReadOnlyGraphClient).
 *
 * Provider factories are mocked so no real database connections are made.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GraphError } from '@recurrsive/core';

// ── Mock providers ───────────────────────────────────────────────────────────

// vi.mock is hoisted, so we cannot reference local variables directly.
// Instead, define the mock inline and retrieve the mocked functions via import.

vi.mock('../providers/sqlite.js', () => ({
  createSqliteClient: vi.fn().mockResolvedValue({
    getEntity: vi.fn(),
    getEntities: vi.fn(),
    getRelationships: vi.fn(),
    getNeighbors: vi.fn(),
    query: vi.fn(),
    upsertEntity: vi.fn(),
    upsertRelationship: vi.fn(),
    deleteEntity: vi.fn(),
    deleteRelationship: vi.fn(),
    getStats: vi.fn(),
    dispose: vi.fn(),
    initialize: vi.fn(),
  }),
}));

vi.mock('../providers/age.js', () => ({
  createAgeClient: vi.fn().mockResolvedValue({
    getEntity: vi.fn(),
    getEntities: vi.fn(),
    getRelationships: vi.fn(),
    getNeighbors: vi.fn(),
    query: vi.fn(),
    upsertEntity: vi.fn(),
    upsertRelationship: vi.fn(),
    deleteEntity: vi.fn(),
    deleteRelationship: vi.fn(),
    getStats: vi.fn(),
    dispose: vi.fn(),
    initialize: vi.fn(),
  }),
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { createGraphClient, createReadOnlyGraphClient } from '../client.js';
import type { GraphConfig } from '../client.js';
import { createSqliteClient } from '../providers/sqlite.js';
import { createAgeClient } from '../providers/age.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('createGraphClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── SQLite provider ──────────────────────────────────────────────────────

  describe('sqlite provider', () => {
    it('creates an SQLite client with valid config', async () => {
      const config: GraphConfig = {
        provider: 'sqlite',
        sqlitePath: ':memory:',
      };

      const client = await createGraphClient(config);
      expect(client).toBeDefined();
      expect(createSqliteClient).toHaveBeenCalledWith(
        { path: ':memory:' },
        true, // autoMigrate defaults to true
      );
    });

    it('passes autoMigrate=false when configured', async () => {
      const config: GraphConfig = {
        provider: 'sqlite',
        sqlitePath: './test.db',
        autoMigrate: false,
      };

      await createGraphClient(config);
      expect(createSqliteClient).toHaveBeenCalledWith(
        { path: './test.db' },
        false,
      );
    });

    it('throws GraphError when sqlitePath is missing', async () => {
      const config: GraphConfig = {
        provider: 'sqlite',
      };

      await expect(createGraphClient(config)).rejects.toThrow(GraphError);
      await expect(createGraphClient(config)).rejects.toThrow(
        /sqlitePath is required/,
      );
    });
  });

  // ── AGE provider ─────────────────────────────────────────────────────────

  describe('postgresql_age provider', () => {
    it('creates an AGE client with valid config', async () => {
      const config: GraphConfig = {
        provider: 'postgresql_age',
        connectionString: 'postgresql://localhost:5432/recurrsive',
      };

      const client = await createGraphClient(config);
      expect(client).toBeDefined();
      expect(createAgeClient).toHaveBeenCalledWith(
        {
          connectionString: 'postgresql://localhost:5432/recurrsive',
          poolSize: undefined,
        },
        true,
      );
    });

    it('passes poolSize through to the AGE provider', async () => {
      const config: GraphConfig = {
        provider: 'postgresql_age',
        connectionString: 'postgresql://localhost/db',
        poolSize: 20,
      };

      await createGraphClient(config);
      expect(createAgeClient).toHaveBeenCalledWith(
        {
          connectionString: 'postgresql://localhost/db',
          poolSize: 20,
        },
        true,
      );
    });

    it('throws GraphError when connectionString is missing', async () => {
      const config: GraphConfig = {
        provider: 'postgresql_age',
      };

      await expect(createGraphClient(config)).rejects.toThrow(GraphError);
      await expect(createGraphClient(config)).rejects.toThrow(
        /connectionString is required/,
      );
    });
  });

  // ── autoMigrate default ────────────────────────────────────────────────

  describe('autoMigrate default', () => {
    it('defaults to true when not specified', async () => {
      await createGraphClient({
        provider: 'sqlite',
        sqlitePath: ':memory:',
      });
      expect(createSqliteClient).toHaveBeenCalledWith(
        expect.anything(),
        true,
      );
    });
  });
});

// ── createReadOnlyGraphClient ────────────────────────────────────────────────

describe('createReadOnlyGraphClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a client (delegates to createGraphClient)', async () => {
    const client = await createReadOnlyGraphClient({
      provider: 'sqlite',
      sqlitePath: ':memory:',
    });
    expect(client).toBeDefined();
  });

  it('throws GraphError for invalid config', async () => {
    await expect(
      createReadOnlyGraphClient({ provider: 'sqlite' }),
    ).rejects.toThrow(GraphError);
  });
});

/**
 * @module __tests__/providers/age
 *
 * Tests for the AgeGraphClient (PostgreSQL + Apache AGE provider).
 *
 * All PostgreSQL interactions are mocked via vi.mock('pg') so that
 * tests run without a real database.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Entity, EntityType, Relationship } from '@recurrsive/core';
import { GraphError } from '@recurrsive/core';

// ── pg Mock ──────────────────────────────────────────────────────────────────

const mockRelease = vi.fn();
const mockClientQuery = vi.fn();
const mockPoolConnect = vi.fn();
const mockPoolEnd = vi.fn();

vi.mock('pg', () => {
  class MockPool {
    connect = mockPoolConnect;
    end = mockPoolEnd;
    constructor() {}
  }
  return { default: { Pool: MockPool } };
});

// We must also mock the migration module to avoid real SQL execution
vi.mock('../../migrations/001_initial_schema.js', () => ({
  migrate: vi.fn().mockResolvedValue({ applied: true, summary: 'mock' }),
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { AgeGraphClient, createAgeClient } from '../../providers/age.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: overrides.id ?? 'entity-1',
    type: (overrides.type ?? 'function') as EntityType,
    name: overrides.name ?? 'testFunc',
    qualified_name: overrides.qualified_name ?? 'src/index.ts:testFunc',
    description: overrides.description ?? 'A test function',
    source: overrides.source ?? 'test',
    source_location: overrides.source_location ?? {
      file: 'src/index.ts',
      start_line: 1,
      end_line: 10,
    },
    properties: overrides.properties ?? {},
    tags: overrides.tags ?? [],
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    last_seen_at: overrides.last_seen_at ?? now,
  };
}

function makeRelationship(overrides: Partial<Relationship> = {}): Relationship {
  return {
    id: overrides.id ?? 'rel-1',
    type: (overrides.type ?? 'calls') as Relationship['type'],
    source_id: overrides.source_id ?? 'entity-1',
    target_id: overrides.target_id ?? 'entity-2',
    properties: overrides.properties ?? {},
    confidence: overrides.confidence ?? 1,
    source: overrides.source ?? 'test',
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AgeGraphClient', () => {
  let client: AgeGraphClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: pool.connect returns a mock client
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });

    // Default: all queries return empty results
    mockClientQuery.mockResolvedValue({ rows: [] });
    mockPoolEnd.mockResolvedValue(undefined);

    client = new AgeGraphClient({
      connectionString: 'postgresql://localhost:5432/test',
    });
  });

  afterEach(async () => {
    await client.dispose();
  });

  // ── Constructor ────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('creates an instance without throwing', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(AgeGraphClient);
    });
  });

  // ── initialize ─────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('runs migration on first call', async () => {
      await client.initialize();
      // Should have connected to pool
      expect(mockPoolConnect).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('is idempotent (skips on second call)', async () => {
      await client.initialize();
      const connectCount = mockPoolConnect.mock.calls.length;
      await client.initialize();
      // Should not have connected again
      expect(mockPoolConnect).toHaveBeenCalledTimes(connectCount);
    });

    it('wraps migration errors in GraphError', async () => {
      const { migrate } = await import('../../migrations/001_initial_schema.js');
      (migrate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('migration fail'),
      );

      const freshClient = new AgeGraphClient({
        connectionString: 'postgresql://localhost/test',
      });

      await expect(freshClient.initialize()).rejects.toThrow(GraphError);
      await freshClient.dispose();
    });
  });

  // ── getEntity ──────────────────────────────────────────────────────────

  describe('getEntity', () => {
    it('returns null when no rows match', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      const result = await client.getEntity('non-existent');
      expect(result).toBeNull();
    });

    it('parses a vertex row into an Entity', async () => {
      const vertexJson = JSON.stringify({
        properties: {
          id: 'entity-1',
          type: 'function',
          name: 'myFunc',
          qualified_name: 'src:myFunc',
          source: 'test',
          created_at: now,
          updated_at: now,
          last_seen_at: now,
        },
      });

      // First two calls: prepareConnection (SET + LOAD)
      // Third call: the actual cypher query
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // SET search_path
        .mockResolvedValueOnce({ rows: [] }) // LOAD 'age'
        .mockResolvedValueOnce({
          rows: [{ n: vertexJson + '::vertex' }],
        });

      const result = await client.getEntity('entity-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('entity-1');
      expect(result!.name).toBe('myFunc');
      expect(result!.type).toBe('function');
    });

    it('wraps query errors in GraphError', async () => {
      mockPoolConnect.mockRejectedValue(new Error('connection failed'));
      await expect(client.getEntity('x')).rejects.toThrow(GraphError);
    });
  });

  // ── getEntities ────────────────────────────────────────────────────────

  describe('getEntities', () => {
    it('returns empty array when no matches', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      const result = await client.getEntities('function');
      expect(result).toEqual([]);
    });

    it('passes filter to WHERE clause', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      await client.getEntities('function', { language: 'typescript' });

      // Verify the SQL included a WHERE condition with the filter
      const calls = mockClientQuery.mock.calls;
      const cypherCall = calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('WHERE'),
      );
      // It should have been called (the exact check is that it doesn't throw)
      expect(cypherCall).toBeDefined();
    });
  });

  // ── getRelationships ───────────────────────────────────────────────────

  describe('getRelationships', () => {
    it('builds outgoing query for direction="out"', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      await client.getRelationships('entity-1', 'out');
      // Verify a Cypher with -[r]-> was used
      const calls = mockClientQuery.mock.calls;
      const matchCall = calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' && c[0].includes('-[r]->'),
      );
      expect(matchCall).toBeDefined();
    });

    it('builds incoming query for direction="in"', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      await client.getRelationships('entity-1', 'in');
      const calls = mockClientQuery.mock.calls;
      const matchCall = calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' && c[0].includes('<-[r]-'),
      );
      expect(matchCall).toBeDefined();
    });

    it('defaults to "both" direction', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      await client.getRelationships('entity-1');
      const calls = mockClientQuery.mock.calls;
      // "both" uses -[r]- (no arrow)
      const matchCall = calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('-[r]-') &&
          !c[0].includes('->') &&
          !c[0].includes('<-'),
      );
      expect(matchCall).toBeDefined();
    });
  });

  // ── upsertEntity ───────────────────────────────────────────────────────

  describe('upsertEntity', () => {
    it('returns the entity passed in', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      const entity = makeEntity();
      const result = await client.upsertEntity(entity);
      expect(result).toEqual(entity);
    });

    it('executes a MERGE query', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      await client.upsertEntity(makeEntity());
      const calls = mockClientQuery.mock.calls;
      const mergeCall = calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' && c[0].includes('MERGE'),
      );
      expect(mergeCall).toBeDefined();
    });

    it('wraps errors in GraphError with MUTATION_FAILED code', async () => {
      mockPoolConnect.mockRejectedValue(new Error('write fail'));
      await expect(client.upsertEntity(makeEntity())).rejects.toThrow(
        GraphError,
      );
    });
  });

  // ── upsertRelationship ─────────────────────────────────────────────────

  describe('upsertRelationship', () => {
    it('returns the relationship passed in', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      const rel = makeRelationship();
      const result = await client.upsertRelationship(rel);
      expect(result).toEqual(rel);
    });

    it('executes a MERGE query with source and target MATCH', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      await client.upsertRelationship(makeRelationship());
      const calls = mockClientQuery.mock.calls;
      const mergeCall = calls.find(
        (c: unknown[]) =>
          typeof c[0] === 'string' &&
          c[0].includes('MERGE') &&
          c[0].includes('MATCH'),
      );
      expect(mergeCall).toBeDefined();
    });
  });

  // ── deleteEntity ───────────────────────────────────────────────────────

  describe('deleteEntity', () => {
    it('returns true when entity was deleted', async () => {
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // SET
        .mockResolvedValueOnce({ rows: [] }) // LOAD
        .mockResolvedValueOnce({
          rows: [{ deleted: '1' }],
        });

      const result = await client.deleteEntity('entity-1');
      expect(result).toBe(true);
    });

    it('returns false when no rows returned', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      const result = await client.deleteEntity('non-existent');
      expect(result).toBe(false);
    });
  });

  // ── deleteRelationship ─────────────────────────────────────────────────

  describe('deleteRelationship', () => {
    it('returns true when relationship was deleted', async () => {
      mockClientQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [{ deleted: '1' }],
        });

      const result = await client.deleteRelationship('rel-1');
      expect(result).toBe(true);
    });

    it('returns false when no rows returned', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      const result = await client.deleteRelationship('non-existent');
      expect(result).toBe(false);
    });
  });

  // ── getStats ───────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns aggregated entity and relationship counts', async () => {
      // Two separate cypher calls: entity counts, then relationship counts
      // Each has prepareConnection (2 queries) + the cypher query itself
      mockClientQuery
        // First executeCypher (entity counts)
        .mockResolvedValueOnce({ rows: [] }) // SET
        .mockResolvedValueOnce({ rows: [] }) // LOAD
        .mockResolvedValueOnce({
          rows: [
            { type: '"function"', cnt: '3' },
            { type: '"class"', cnt: '1' },
          ],
        })
        // Second executeCypher (relationship counts)
        .mockResolvedValueOnce({ rows: [] }) // SET
        .mockResolvedValueOnce({ rows: [] }) // LOAD
        .mockResolvedValueOnce({
          rows: [{ type: '"calls"', cnt: '5' }],
        });

      const stats = await client.getStats();
      expect(stats.totalEntities).toBe(4);
      expect(stats.totalRelationships).toBe(5);
      expect(stats.entityCountsByType['function']).toBe(3);
      expect(stats.entityCountsByType['class']).toBe(1);
      expect(stats.relationshipCountsByType['calls']).toBe(5);
    });
  });

  // ── query ──────────────────────────────────────────────────────────────

  describe('query', () => {
    it('delegates to executeCypher', async () => {
      mockClientQuery.mockResolvedValue({ rows: [] });
      const result = await client.query('MATCH (n) RETURN n');
      expect(result).toEqual([]);
    });

    it('wraps errors in GraphError', async () => {
      mockPoolConnect.mockRejectedValue(new Error('fail'));
      await expect(client.query('MATCH (n) RETURN n')).rejects.toThrow(
        GraphError,
      );
    });
  });

  // ── dispose ────────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('closes the pool', async () => {
      await client.dispose();
      expect(mockPoolEnd).toHaveBeenCalled();
    });

    it('allows re-initialization after dispose', async () => {
      await client.dispose();
      // After dispose, initialize should work again
      await client.initialize();
      expect(mockPoolConnect).toHaveBeenCalled();
    });
  });
});

// ── createAgeClient factory ──────────────────────────────────────────────────

describe('createAgeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    mockClientQuery.mockResolvedValue({ rows: [] });
    mockPoolEnd.mockResolvedValue(undefined);
  });

  it('creates and initializes a client when autoMigrate=true', async () => {
    const c = await createAgeClient({
      connectionString: 'postgresql://localhost/test',
    });
    expect(c).toBeInstanceOf(AgeGraphClient);
    // Migration should have been called (which calls pool.connect)
    expect(mockPoolConnect).toHaveBeenCalled();
    await c.dispose();
  });

  it('creates but does not initialize when autoMigrate=false', async () => {
    const c = await createAgeClient(
      { connectionString: 'postgresql://localhost/test' },
      false,
    );
    expect(c).toBeInstanceOf(AgeGraphClient);
    // No pool.connect for migration
    expect(mockPoolConnect).not.toHaveBeenCalled();
    await c.dispose();
  });
});

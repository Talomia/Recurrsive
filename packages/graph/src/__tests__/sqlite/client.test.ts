/**
 * @module __tests__/sqlite/client
 *
 * Comprehensive tests for the SqliteGraphClient using in-memory SQLite.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SqliteGraphClient, createSqliteClient } from '../../providers/sqlite.js';
import type { Entity, Relationship, EntityType } from '@recurrsive/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: (overrides.type ?? 'function') as EntityType,
    name: overrides.name ?? 'testFunc',
    qualified_name: overrides.qualified_name ?? 'src/index.ts:testFunc',
    description: overrides.description ?? 'A test function',
    source: overrides.source ?? 'test-collector',
    source_location: overrides.source_location ?? { file: 'src/index.ts', start_line: 1, end_line: 10 },
    properties: overrides.properties ?? {},
    tags: overrides.tags ?? [],
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    last_seen_at: overrides.last_seen_at ?? now,
  };
}

function makeRelationship(overrides: Partial<Relationship> = {}): Relationship {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: (overrides.type ?? 'calls') as Relationship['type'],
    source_id: overrides.source_id ?? '',
    target_id: overrides.target_id ?? '',
    properties: overrides.properties ?? {},
    confidence: overrides.confidence ?? 1,
    source: overrides.source ?? 'test-collector',
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SqliteGraphClient', () => {
  let client: SqliteGraphClient;

  beforeEach(async () => {
    client = await createSqliteClient({ path: ':memory:' }, true);
  });

  afterEach(async () => {
    await client.dispose();
  });

  // ── Constructor & Initialization ──────────────────────────────────────

  describe('constructor and initialization', () => {
    it('creates tables via initialize()', async () => {
      // The client is already initialized in beforeEach.
      // Verify tables exist by running a query.
      const result = await client.query(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('entities', 'relationships') ORDER BY name",
      );
      const names = (result as Array<{ name: string }>).map((r) => r.name);
      expect(names).toContain('entities');
      expect(names).toContain('relationships');
    });

    it('createSqliteClient with autoMigrate=false does not create tables', async () => {
      const noMigrate = await createSqliteClient({ path: ':memory:' }, false);
      // Trying to upsert should fail because tables don't exist
      const entity = makeEntity();
      await expect(noMigrate.upsertEntity(entity)).rejects.toThrow();
      await noMigrate.dispose();
    });
  });

  // ── upsertEntity (addEntity) ──────────────────────────────────────────

  describe('upsertEntity', () => {
    it('stores and retrieves an entity', async () => {
      const entity = makeEntity({ name: 'myFunction' });
      const result = await client.upsertEntity(entity);
      expect(result).toEqual(entity);

      const retrieved = await client.getEntity(entity.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe(entity.id);
      expect(retrieved!.name).toBe('myFunction');
      expect(retrieved!.type).toBe('function');
    });

    it('upserts (updates) an existing entity', async () => {
      const entity = makeEntity();
      await client.upsertEntity(entity);

      const updated = { ...entity, name: 'updatedName', updated_at: new Date().toISOString() };
      await client.upsertEntity(updated);

      const retrieved = await client.getEntity(entity.id);
      expect(retrieved!.name).toBe('updatedName');
    });
  });

  // ── upsertRelationship (addRelationship) ──────────────────────────────

  describe('upsertRelationship', () => {
    it('stores and retrieves a relationship', async () => {
      const e1 = makeEntity({ id: crypto.randomUUID(), name: 'funcA' });
      const e2 = makeEntity({ id: crypto.randomUUID(), name: 'funcB' });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);

      const rel = makeRelationship({
        source_id: e1.id,
        target_id: e2.id,
        type: 'calls',
      });
      const result = await client.upsertRelationship(rel);
      expect(result).toEqual(rel);

      const rels = await client.getRelationships(e1.id, 'out');
      expect(rels).toHaveLength(1);
      expect(rels[0]!.id).toBe(rel.id);
      expect(rels[0]!.source_id).toBe(e1.id);
      expect(rels[0]!.target_id).toBe(e2.id);
    });

    it('upserts (updates) an existing relationship', async () => {
      const e1 = makeEntity({ id: crypto.randomUUID() });
      const e2 = makeEntity({ id: crypto.randomUUID() });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);

      const rel = makeRelationship({ source_id: e1.id, target_id: e2.id, confidence: 0.5 });
      await client.upsertRelationship(rel);

      const updated = { ...rel, confidence: 0.9, updated_at: new Date().toISOString() };
      await client.upsertRelationship(updated);

      const rels = await client.getRelationships(e1.id, 'out');
      expect(rels).toHaveLength(1);
      expect(rels[0]!.confidence).toBe(0.9);
    });
  });

  // ── getEntity ─────────────────────────────────────────────────────────

  describe('getEntity', () => {
    it('returns entity when found', async () => {
      const entity = makeEntity();
      await client.upsertEntity(entity);

      const result = await client.getEntity(entity.id);
      expect(result).not.toBeNull();
      expect(result!.id).toBe(entity.id);
    });

    it('returns null when not found', async () => {
      const result = await client.getEntity('non-existent-id');
      expect(result).toBeNull();
    });
  });

  // ── getEntities ───────────────────────────────────────────────────────

  describe('getEntities', () => {
    it('returns entities filtered by type', async () => {
      const fn1 = makeEntity({ id: crypto.randomUUID(), type: 'function', name: 'fn1' });
      const fn2 = makeEntity({ id: crypto.randomUUID(), type: 'function', name: 'fn2' });
      const cls = makeEntity({ id: crypto.randomUUID(), type: 'class', name: 'MyClass' });
      await client.upsertEntity(fn1);
      await client.upsertEntity(fn2);
      await client.upsertEntity(cls);

      const functions = await client.getEntities('function');
      expect(functions).toHaveLength(2);
      expect(functions.map((e) => e.name).sort()).toEqual(['fn1', 'fn2']);

      const classes = await client.getEntities('class');
      expect(classes).toHaveLength(1);
      expect(classes[0]!.name).toBe('MyClass');
    });

    it('returns empty array when no entities match type', async () => {
      const entity = makeEntity({ type: 'function' });
      await client.upsertEntity(entity);

      const result = await client.getEntities('class');
      expect(result).toEqual([]);
    });

    it('filters by properties when provided', async () => {
      const e1 = makeEntity({
        id: crypto.randomUUID(),
        type: 'function',
        name: 'fn1',
        properties: { language: 'typescript' },
      });
      const e2 = makeEntity({
        id: crypto.randomUUID(),
        type: 'function',
        name: 'fn2',
        properties: { language: 'python' },
      });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);

      const tsFns = await client.getEntities('function', { language: 'typescript' });
      expect(tsFns).toHaveLength(1);
      expect(tsFns[0]!.name).toBe('fn1');
    });
  });

  // ── getRelationships ──────────────────────────────────────────────────

  describe('getRelationships', () => {
    let entityA: Entity;
    let entityB: Entity;
    let entityC: Entity;

    beforeEach(async () => {
      entityA = makeEntity({ id: crypto.randomUUID(), name: 'A' });
      entityB = makeEntity({ id: crypto.randomUUID(), name: 'B' });
      entityC = makeEntity({ id: crypto.randomUUID(), name: 'C' });
      await client.upsertEntity(entityA);
      await client.upsertEntity(entityB);
      await client.upsertEntity(entityC);

      // A -> B (calls), C -> A (imports)
      await client.upsertRelationship(
        makeRelationship({ source_id: entityA.id, target_id: entityB.id, type: 'calls' }),
      );
      await client.upsertRelationship(
        makeRelationship({ source_id: entityC.id, target_id: entityA.id, type: 'imports' }),
      );
    });

    it('returns outgoing relationships with direction="out"', async () => {
      const rels = await client.getRelationships(entityA.id, 'out');
      expect(rels).toHaveLength(1);
      expect(rels[0]!.type).toBe('calls');
      expect(rels[0]!.target_id).toBe(entityB.id);
    });

    it('returns incoming relationships with direction="in"', async () => {
      const rels = await client.getRelationships(entityA.id, 'in');
      expect(rels).toHaveLength(1);
      expect(rels[0]!.type).toBe('imports');
      expect(rels[0]!.source_id).toBe(entityC.id);
    });

    it('returns all relationships with direction="both"', async () => {
      const rels = await client.getRelationships(entityA.id, 'both');
      expect(rels).toHaveLength(2);
    });

    it('defaults to "both" when no direction provided', async () => {
      const rels = await client.getRelationships(entityA.id);
      expect(rels).toHaveLength(2);
    });
  });

  // ── getNeighbors ──────────────────────────────────────────────────────

  describe('getNeighbors', () => {
    it('returns connected entities at depth 1', async () => {
      const eA = makeEntity({ id: crypto.randomUUID(), name: 'A' });
      const eB = makeEntity({ id: crypto.randomUUID(), name: 'B' });
      const eC = makeEntity({ id: crypto.randomUUID(), name: 'C' });
      await client.upsertEntity(eA);
      await client.upsertEntity(eB);
      await client.upsertEntity(eC);

      await client.upsertRelationship(
        makeRelationship({ source_id: eA.id, target_id: eB.id, type: 'calls' }),
      );
      await client.upsertRelationship(
        makeRelationship({ source_id: eB.id, target_id: eC.id, type: 'calls' }),
      );

      const result = await client.getNeighbors(eA.id, 1);
      const entityNames = result.entities.map((e) => e.name).sort();
      expect(entityNames).toContain('A');
      expect(entityNames).toContain('B');
      // C is 2 hops away, should not be included at depth 1
      expect(entityNames).not.toContain('C');
    });

    it('returns deeper entities at depth 2', async () => {
      const eA = makeEntity({ id: crypto.randomUUID(), name: 'A' });
      const eB = makeEntity({ id: crypto.randomUUID(), name: 'B' });
      const eC = makeEntity({ id: crypto.randomUUID(), name: 'C' });
      await client.upsertEntity(eA);
      await client.upsertEntity(eB);
      await client.upsertEntity(eC);

      await client.upsertRelationship(
        makeRelationship({ source_id: eA.id, target_id: eB.id, type: 'calls' }),
      );
      await client.upsertRelationship(
        makeRelationship({ source_id: eB.id, target_id: eC.id, type: 'calls' }),
      );

      const result = await client.getNeighbors(eA.id, 2);
      const entityNames = result.entities.map((e) => e.name).sort();
      expect(entityNames).toContain('A');
      expect(entityNames).toContain('B');
      expect(entityNames).toContain('C');
    });

    it('returns empty for entity with no connections', async () => {
      const lonely = makeEntity({ id: crypto.randomUUID(), name: 'Lonely' });
      await client.upsertEntity(lonely);

      const result = await client.getNeighbors(lonely.id, 1);
      // Should contain at least the starting entity
      expect(result.entities.length).toBeGreaterThanOrEqual(1);
      expect(result.relationships).toHaveLength(0);
    });
  });

  // ── searchEntities (via query) ────────────────────────────────────────

  describe('search entities via query', () => {
    it('finds entities by name pattern with SQL LIKE', async () => {
      const e1 = makeEntity({ id: crypto.randomUUID(), name: 'getUserById', qualified_name: 'api:getUserById' });
      const e2 = makeEntity({ id: crypto.randomUUID(), name: 'getProducts', qualified_name: 'api:getProducts' });
      const e3 = makeEntity({ id: crypto.randomUUID(), name: 'setPassword', qualified_name: 'auth:setPassword' });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);
      await client.upsertEntity(e3);

      const results = await client.query(
        "SELECT * FROM entities WHERE name LIKE '%get%'",
      );
      expect(results).toHaveLength(2);
    });

    it('finds entities by qualified name pattern', async () => {
      const e1 = makeEntity({ id: crypto.randomUUID(), name: 'handler', qualified_name: 'api/users:handler' });
      const e2 = makeEntity({ id: crypto.randomUUID(), name: 'handler', qualified_name: 'api/products:handler' });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);

      const results = await client.query(
        "SELECT * FROM entities WHERE qualified_name LIKE '%users%'",
      );
      expect(results).toHaveLength(1);
    });
  });

  // ── deleteEntity ──────────────────────────────────────────────────────

  describe('deleteEntity', () => {
    it('removes entity and returns true', async () => {
      const entity = makeEntity();
      await client.upsertEntity(entity);

      const deleted = await client.deleteEntity(entity.id);
      expect(deleted).toBe(true);

      const retrieved = await client.getEntity(entity.id);
      expect(retrieved).toBeNull();
    });

    it('returns false when entity does not exist', async () => {
      const deleted = await client.deleteEntity('non-existent-id');
      expect(deleted).toBe(false);
    });

    it('removes associated relationships when entity is deleted', async () => {
      const e1 = makeEntity({ id: crypto.randomUUID(), name: 'A' });
      const e2 = makeEntity({ id: crypto.randomUUID(), name: 'B' });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);

      const rel = makeRelationship({ source_id: e1.id, target_id: e2.id });
      await client.upsertRelationship(rel);

      await client.deleteEntity(e1.id);

      // Relationship should be gone
      const rels = await client.getRelationships(e2.id);
      expect(rels).toHaveLength(0);
    });
  });

  // ── deleteRelationship ────────────────────────────────────────────────

  describe('deleteRelationship', () => {
    it('removes a specific relationship', async () => {
      const e1 = makeEntity({ id: crypto.randomUUID() });
      const e2 = makeEntity({ id: crypto.randomUUID() });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);

      const rel = makeRelationship({ source_id: e1.id, target_id: e2.id });
      await client.upsertRelationship(rel);

      const deleted = await client.deleteRelationship(rel.id);
      expect(deleted).toBe(true);

      const rels = await client.getRelationships(e1.id, 'out');
      expect(rels).toHaveLength(0);
    });

    it('returns false for non-existent relationship', async () => {
      const deleted = await client.deleteRelationship('non-existent');
      expect(deleted).toBe(false);
    });
  });

  // ── getStats ──────────────────────────────────────────────────────────

  describe('getStats', () => {
    it('returns entity and relationship counts', async () => {
      const e1 = makeEntity({ id: crypto.randomUUID(), type: 'function' });
      const e2 = makeEntity({ id: crypto.randomUUID(), type: 'function' });
      const e3 = makeEntity({ id: crypto.randomUUID(), type: 'class' });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);
      await client.upsertEntity(e3);

      await client.upsertRelationship(
        makeRelationship({ source_id: e1.id, target_id: e2.id, type: 'calls' }),
      );
      await client.upsertRelationship(
        makeRelationship({ source_id: e3.id, target_id: e1.id, type: 'contains' }),
      );

      const stats = await client.getStats();
      expect(stats.totalEntities).toBe(3);
      expect(stats.totalRelationships).toBe(2);
      expect(stats.entityCountsByType['function']).toBe(2);
      expect(stats.entityCountsByType['class']).toBe(1);
      expect(stats.relationshipCountsByType['calls']).toBe(1);
      expect(stats.relationshipCountsByType['contains']).toBe(1);
    });

    it('returns zero counts for empty database', async () => {
      const stats = await client.getStats();
      expect(stats.totalEntities).toBe(0);
      expect(stats.totalRelationships).toBe(0);
      expect(stats.entityCountsByType).toEqual({});
      expect(stats.relationshipCountsByType).toEqual({});
    });
  });

  // ── clear (via query) ─────────────────────────────────────────────────

  describe('clear database', () => {
    it('empties all data with DELETE queries', async () => {
      const e1 = makeEntity({ id: crypto.randomUUID() });
      const e2 = makeEntity({ id: crypto.randomUUID() });
      await client.upsertEntity(e1);
      await client.upsertEntity(e2);
      await client.upsertRelationship(
        makeRelationship({ source_id: e1.id, target_id: e2.id }),
      );

      // Clear relationships first (foreign key constraints)
      await client.query('DELETE FROM relationships');
      await client.query('DELETE FROM entities');

      const stats = await client.getStats();
      expect(stats.totalEntities).toBe(0);
      expect(stats.totalRelationships).toBe(0);
    });
  });

  // ── dispose ───────────────────────────────────────────────────────────

  describe('dispose', () => {
    it('closes the connection', async () => {
      const disposable = await createSqliteClient({ path: ':memory:' }, true);
      await disposable.dispose();

      // After dispose, any operation should fail because it tries to reopen
      // (which for :memory: creates a new empty database)
      // Let's verify dispose is idempotent
      await disposable.dispose(); // should not throw
    });
  });

  // ── Entity with properties (serialization) ────────────────────────────

  describe('entity properties serialization', () => {
    it('correctly serializes and deserializes complex properties', async () => {
      const entity = makeEntity({
        properties: {
          parameters: [{ name: 'id', type: 'string' }],
          return_type: 'Promise<User>',
          is_async: true,
          nested: { a: { b: { c: 42 } } },
          array: [1, 2, 3],
        },
      });
      await client.upsertEntity(entity);

      const retrieved = await client.getEntity(entity.id);
      expect(retrieved!.properties).toEqual(entity.properties);
      expect((retrieved!.properties as any).parameters).toEqual([{ name: 'id', type: 'string' }]);
      expect((retrieved!.properties as any).is_async).toBe(true);
      expect((retrieved!.properties as any).nested.a.b.c).toBe(42);
    });

    it('handles empty properties object', async () => {
      const entity = makeEntity({ properties: {} });
      await client.upsertEntity(entity);

      const retrieved = await client.getEntity(entity.id);
      expect(retrieved!.properties).toEqual({});
    });
  });

  // ── Entity with tags ──────────────────────────────────────────────────

  describe('entity tags serialization', () => {
    it('correctly stores and retrieves tags array', async () => {
      const entity = makeEntity({ tags: ['api', 'authenticated', 'v2'] });
      await client.upsertEntity(entity);

      const retrieved = await client.getEntity(entity.id);
      expect(retrieved!.tags).toEqual(['api', 'authenticated', 'v2']);
    });

    it('handles empty tags array', async () => {
      const entity = makeEntity({ tags: [] });
      await client.upsertEntity(entity);

      const retrieved = await client.getEntity(entity.id);
      expect(retrieved!.tags).toEqual([]);
    });
  });

  // ── source_location serialization ─────────────────────────────────────

  describe('source_location serialization', () => {
    it('correctly round-trips source_location', async () => {
      const entity = makeEntity({
        source_location: {
          file: 'src/handler.ts',
          start_line: 10,
          end_line: 25,
          start_column: 0,
          end_column: 1,
          repository: 'my-repo',
          commit: 'abc123',
        },
      });
      await client.upsertEntity(entity);

      const retrieved = await client.getEntity(entity.id);
      expect(retrieved!.source_location).toEqual(entity.source_location);
    });

    it('handles null/missing source_location', async () => {
      // Create an entity explicitly without source_location
      const entity: Entity = {
        ...makeEntity(),
        id: crypto.randomUUID(),
        source_location: undefined,
      };
      await client.upsertEntity(entity);

      const retrieved = await client.getEntity(entity.id);
      // When source_location is stored as null, rowToEntity returns undefined
      expect(retrieved!.source_location).toBeUndefined();
    });
  });

  // ── query method ──────────────────────────────────────────────────────

  describe('query', () => {
    it('executes SELECT queries and returns rows', async () => {
      const e = makeEntity({ id: crypto.randomUUID(), name: 'test' });
      await client.upsertEntity(e);

      const rows = await client.query('SELECT id, name FROM entities');
      expect(rows).toHaveLength(1);
      expect((rows[0] as any).name).toBe('test');
    });

    it('executes mutation queries and returns changes info', async () => {
      const e = makeEntity({ id: crypto.randomUUID(), name: 'toDelete' });
      await client.upsertEntity(e);

      const result = await client.query(`DELETE FROM entities WHERE id = '${e.id}'`);
      expect(result).toHaveLength(1);
      expect((result[0] as any).changes).toBe(1);
    });
  });
});

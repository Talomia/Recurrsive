/**
 * @module __tests__/providers/parity
 *
 * Backend-equivalence tests: for the same `getEntities(type, filter)`
 * call, the SQLite provider (real in-memory database) and the AGE
 * provider (mocked PostgreSQL returning the same stored entities in
 * agtype format) must return exactly the same set of entities.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Entity, EntityType } from '@recurrsive/core';

// ── pg mock (AGE provider) ───────────────────────────────────────────────────

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

import { AgeGraphClient } from '../../providers/age.js';
import { createSqliteClient } from '../../providers/sqlite.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

function makeEntity(id: string, properties: Record<string, unknown>): Entity {
  return {
    id,
    type: 'function' as EntityType,
    name: id,
    qualified_name: `src:${id}`,
    description: undefined,
    source: 'test',
    source_location: undefined,
    properties,
    tags: [],
    created_at: now,
    updated_at: now,
    last_seen_at: now,
  };
}

const ENTITIES: Entity[] = [
  makeEntity('e1', { language: 'typescript' }),
  makeEntity('e2', { is_source: true }),
  makeEntity('e3', { count: 5 }),
  makeEntity('e4', { language: 'typescript', count: 5, is_source: false }),
];

/** Encode an entity the way the AGE backend stores it (agtype vertex). */
function toAgtypeVertex(e: Entity): string {
  return JSON.stringify({
    id: 1,
    label: e.type,
    properties: {
      id: e.id,
      type: e.type,
      name: e.name,
      qualified_name: e.qualified_name,
      source: e.source,
      properties: JSON.stringify(e.properties),
      tags: JSON.stringify(e.tags),
      created_at: e.created_at,
      updated_at: e.updated_at,
      last_seen_at: e.last_seen_at,
    },
  }) + '::vertex';
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getEntities filter parity between SQLite and AGE backends', () => {
  let age: AgeGraphClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPoolConnect.mockResolvedValue({ query: mockClientQuery, release: mockRelease });
    mockPoolEnd.mockResolvedValue(undefined);
    // AGE stores the same four entities; the MATCH query returns all of
    // them and filtering happens per the shared nested-properties contract.
    mockClientQuery.mockImplementation((sql: unknown) => {
      if (typeof sql === 'string' && sql.includes('MATCH (n:function)')) {
        return Promise.resolve({ rows: ENTITIES.map((e) => ({ n: toAgtypeVertex(e) })) });
      }
      return Promise.resolve({ rows: [] });
    });
    age = new AgeGraphClient({ connectionString: 'postgresql://localhost/test' });
  });

  const CASES: Array<{ name: string; filter: Record<string, unknown> | undefined; expected: string[] }> = [
    { name: 'no filter returns everything', filter: undefined, expected: ['e1', 'e2', 'e3', 'e4'] },
    { name: 'string value', filter: { language: 'typescript' }, expected: ['e1', 'e4'] },
    { name: 'boolean true (not the string "true")', filter: { is_source: true }, expected: ['e2'] },
    { name: 'boolean false', filter: { is_source: false }, expected: ['e4'] },
    { name: 'number (not the string "5")', filter: { count: 5 }, expected: ['e3', 'e4'] },
    { name: 'multiple keys AND-combined', filter: { language: 'typescript', count: 5 }, expected: ['e4'] },
    { name: 'no match', filter: { language: 'rust' }, expected: [] },
  ];

  for (const { name, filter, expected } of CASES) {
    it(`both backends agree: ${name}`, async () => {
      const sqlite = await createSqliteClient({ path: ':memory:' }, true);
      try {
        for (const e of ENTITIES) await sqlite.upsertEntity(e);

        const sqliteIds = (await sqlite.getEntities('function', filter))
          .map((e) => e.id)
          .sort();
        const ageIds = (await age.getEntities('function', filter))
          .map((e) => e.id)
          .sort();

        expect(sqliteIds).toEqual(expected);
        expect(ageIds).toEqual(expected);
        expect(ageIds).toEqual(sqliteIds);
      } finally {
        await sqlite.dispose();
      }
    });
  }

  it('both backends reject invalid filter keys with INVALID_FILTER', async () => {
    const sqlite = await createSqliteClient({ path: ':memory:' }, true);
    try {
      await expect(
        sqlite.getEntities('function', { 'bad-key!': 1 }),
      ).rejects.toMatchObject({ code: 'INVALID_FILTER' });
      await expect(
        age.getEntities('function', { 'bad-key!': 1 }),
      ).rejects.toMatchObject({ code: 'INVALID_FILTER' });
    } finally {
      await sqlite.dispose();
    }
  });
});

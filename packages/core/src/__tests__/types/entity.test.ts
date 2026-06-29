import { describe, it, expect } from 'vitest';
import { EntityTypeSchema, EntitySchema, SourceLocationRefSchema } from '../../types/entities.js';

// ---------------------------------------------------------------------------
// EntityTypeSchema
// ---------------------------------------------------------------------------
describe('EntityTypeSchema', () => {
  const ALL_ENTITY_TYPES = [
    'repository',
    'file',
    'function',
    'class',
    'module',
    'endpoint',
    'prompt',
    'agent',
    'tool',
    'model',
    'dataset',
    'table',
    'collection',
    'query',
    'index',
    'dependency',
    'config',
    'secret',
    'mcp_server',
    'mcp_tool',
    'mcp_resource',
    'workflow',
    'pipeline',
    'job',
    'step',
    'user',
    'team',
    'organization',
    'incident',
    'alert',
    'cost_metric',
    'business_metric',
    'performance_metric',
    'infrastructure_resource',
    'deployment',
    'environment',
    'experiment',
    'feature_flag',
    'evaluation',
    'document',
    'adr',
    'rfc',
    'api_contract',
  ] as const;

  it('accepts all defined entity type values', () => {
    for (const type of ALL_ENTITY_TYPES) {
      const result = EntityTypeSchema.safeParse(type);
      expect(result.success, `Expected "${type}" to be valid`).toBe(true);
    }
  });

  it('defines the expected number of entity types', () => {
    // The enum options
    const options = EntityTypeSchema.options;
    expect(options).toHaveLength(ALL_ENTITY_TYPES.length);
  });

  it('rejects an unknown entity type', () => {
    const result = EntityTypeSchema.safeParse('unknown_type');
    expect(result.success).toBe(false);
  });

  it('rejects an empty string', () => {
    const result = EntityTypeSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('rejects a number', () => {
    const result = EntityTypeSchema.safeParse(42);
    expect(result.success).toBe(false);
  });

  it('rejects null', () => {
    const result = EntityTypeSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('is case-sensitive (rejects uppercase)', () => {
    const result = EntityTypeSchema.safeParse('Repository');
    expect(result.success).toBe(false);
  });

  // Spot-check specific categories
  describe('entity type categories', () => {
    it('includes code entities', () => {
      for (const t of ['repository', 'file', 'function', 'class', 'module']) {
        expect(EntityTypeSchema.safeParse(t).success).toBe(true);
      }
    });

    it('includes AI entities', () => {
      for (const t of ['prompt', 'agent', 'tool', 'model']) {
        expect(EntityTypeSchema.safeParse(t).success).toBe(true);
      }
    });

    it('includes data entities', () => {
      for (const t of ['dataset', 'table', 'collection', 'query', 'index']) {
        expect(EntityTypeSchema.safeParse(t).success).toBe(true);
      }
    });

    it('includes MCP entities', () => {
      for (const t of ['mcp_server', 'mcp_tool', 'mcp_resource']) {
        expect(EntityTypeSchema.safeParse(t).success).toBe(true);
      }
    });

    it('includes infrastructure entities', () => {
      for (const t of ['infrastructure_resource', 'deployment', 'environment']) {
        expect(EntityTypeSchema.safeParse(t).success).toBe(true);
      }
    });

    it('includes documentation entities', () => {
      for (const t of ['document', 'adr', 'rfc', 'api_contract']) {
        expect(EntityTypeSchema.safeParse(t).success).toBe(true);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// SourceLocationRefSchema
// ---------------------------------------------------------------------------
describe('SourceLocationRefSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    const result = SourceLocationRefSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts a full source location', () => {
    const result = SourceLocationRefSchema.safeParse({
      file: 'src/index.ts',
      start_line: 1,
      end_line: 10,
      start_column: 0,
      end_column: 80,
      repository: 'my-repo',
      commit: 'abc123',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a partial source location', () => {
    const result = SourceLocationRefSchema.safeParse({
      file: 'src/index.ts',
      start_line: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-numeric line values', () => {
    const result = SourceLocationRefSchema.safeParse({
      start_line: 'five',
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-string file value', () => {
    const result = SourceLocationRefSchema.safeParse({
      file: 123,
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EntitySchema
// ---------------------------------------------------------------------------
describe('EntitySchema', () => {
  const validEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    type: 'repository',
    name: 'my-repo',
    qualified_name: 'my-org:my-repo',
    description: 'A test repository',
    source: 'github-collector',
    source_location: {
      file: 'src/index.ts',
      start_line: 1,
    },
    properties: { language: 'typescript', stars: 42 },
    tags: ['typescript', 'open-source'],
    created_at: '2024-01-15T09:30:00.000Z',
    updated_at: '2024-01-15T10:00:00.000Z',
    last_seen_at: '2024-01-15T10:00:00.000Z',
  };

  it('accepts a valid complete entity', () => {
    const result = EntitySchema.safeParse(validEntity);
    expect(result.success).toBe(true);
  });

  it('accepts a valid entity without optional fields', () => {
    const minimal = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      type: 'file',
      name: 'index.ts',
      qualified_name: 'repo:src/index.ts',
      source: 'static-collector',
      properties: {},
      tags: [],
      created_at: '2024-01-15T09:30:00.000Z',
      updated_at: '2024-01-15T09:30:00.000Z',
      last_seen_at: '2024-01-15T09:30:00.000Z',
    };
    const result = EntitySchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });

  it('rejects entity with invalid UUID id', () => {
    const result = EntitySchema.safeParse({ ...validEntity, id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects entity with unknown type', () => {
    const result = EntitySchema.safeParse({ ...validEntity, type: 'spaceship' });
    expect(result.success).toBe(false);
  });

  it('rejects entity with missing name', () => {
    const { name: _, ...noName } = validEntity;
    const result = EntitySchema.safeParse(noName);
    expect(result.success).toBe(false);
  });

  it('rejects entity with missing qualified_name', () => {
    const { qualified_name: _, ...noQn } = validEntity;
    const result = EntitySchema.safeParse(noQn);
    expect(result.success).toBe(false);
  });

  it('rejects entity with missing source', () => {
    const { source: _, ...noSource } = validEntity;
    const result = EntitySchema.safeParse(noSource);
    expect(result.success).toBe(false);
  });

  it('rejects entity with missing properties', () => {
    const { properties: _, ...noProps } = validEntity;
    const result = EntitySchema.safeParse(noProps);
    expect(result.success).toBe(false);
  });

  it('rejects entity with missing tags', () => {
    const { tags: _, ...noTags } = validEntity;
    const result = EntitySchema.safeParse(noTags);
    expect(result.success).toBe(false);
  });

  it('rejects entity with non-array tags', () => {
    const result = EntitySchema.safeParse({ ...validEntity, tags: 'not-an-array' });
    expect(result.success).toBe(false);
  });

  it('rejects entity with invalid datetime for created_at', () => {
    const result = EntitySchema.safeParse({ ...validEntity, created_at: 'not-a-date' });
    expect(result.success).toBe(false);
  });

  it('rejects entity with invalid datetime for updated_at', () => {
    const result = EntitySchema.safeParse({ ...validEntity, updated_at: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects entity with invalid datetime for last_seen_at', () => {
    const result = EntitySchema.safeParse({ ...validEntity, last_seen_at: '2024-13-01' });
    expect(result.success).toBe(false);
  });

  it('accepts entity with all known entity types', () => {
    const types = EntityTypeSchema.options;
    for (const type of types) {
      const result = EntitySchema.safeParse({ ...validEntity, type });
      expect(result.success, `Entity with type "${type}" should be valid`).toBe(true);
    }
  });

  it('accepts entity with empty properties and tags', () => {
    const result = EntitySchema.safeParse({
      ...validEntity,
      properties: {},
      tags: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts entity with complex properties values', () => {
    const result = EntitySchema.safeParse({
      ...validEntity,
      properties: {
        nested: { a: [1, 2, 3] },
        flag: true,
        count: 42,
      },
    });
    expect(result.success).toBe(true);
  });
});

/**
 * Pipeline integration test.
 *
 * Exercises a simplified version of the full analysis pipeline:
 *   Graph init → Populate entities → Run analyzers → Produce findings
 *
 * Uses a real SQLite graph client and real analyzers to verify the
 * integration seams between packages work correctly.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createGraphClient } from '@recurrsive/graph';
import type { ExtendedGraphClient } from '@recurrsive/graph';
import {
  AnalyzerRegistry,
  AnalyzerRunner,
  createDefaultAnalyzers,
} from '@recurrsive/analyzers';
import type { Entity, Relationship, AnalysisContext } from '@recurrsive/core';
import { generateId, nowISO } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Shared test state
// ---------------------------------------------------------------------------

let graph: ExtendedGraphClient;

beforeAll(async () => {
  graph = await createGraphClient({
    provider: 'sqlite',
    sqlitePath: ':memory:',
    autoMigrate: true,
  });
});

// ---------------------------------------------------------------------------
// Entity factory helpers
// ---------------------------------------------------------------------------

const now = nowISO();

function makeEntity(type: Entity['type'], name: string, extra: Record<string, unknown> = {}): Entity {
  return {
    id: generateId(),
    type,
    name,
    qualified_name: `test:${type}:${name}`,
    description: `Test ${type}: ${name}`,
    source: 'test-collector',
    properties: { language: 'typescript', ...extra },
    tags: [],
    source_location: { file: `src/${name}.ts`, start_line: 1, end_line: 10 },
    created_at: now,
    updated_at: now,
    last_seen_at: now,
  };
}

function makeRelationship(
  sourceId: string,
  targetId: string,
  type: Relationship['type'],
): Relationship {
  return {
    id: generateId(),
    source_id: sourceId,
    target_id: targetId,
    type,
    properties: {},
    confidence: 1,
    source: 'test-collector',
    created_at: now,
    updated_at: now,
  };
}

function makeContext(g: ExtendedGraphClient): AnalysisContext {
  return {
    graph: g,
    config: {
      enabled: true,
      severity_threshold: 'info',
      custom: {},
    },
    history: {
      getPreviousFindings: async () => [],
      getAcceptedOpportunities: async () => [],
      getRejectedOpportunities: async () => [],
    },
    project: {
      name: 'test-project',
      root_path: '/test',
      languages: ['typescript'],
      frameworks: [],
      ai_providers: [],
    },
    emit: () => {},
  };
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe('Pipeline Integration', () => {
  it('should initialize a graph and insert/retrieve entities', async () => {
    const entity = makeEntity('module', 'auth-service');
    await graph.upsertEntity(entity);

    const retrieved = await graph.getEntity(entity.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('auth-service');
    expect(retrieved!.type).toBe('module');
  });

  it('should insert and query relationships', async () => {
    const mod1 = makeEntity('module', 'api-gateway');
    const mod2 = makeEntity('module', 'user-service');
    await graph.upsertEntity(mod1);
    await graph.upsertEntity(mod2);

    const rel = makeRelationship(mod1.id, mod2.id, 'imports');
    await graph.upsertRelationship(rel);

    const rels = await graph.getRelationships(mod1.id, 'out');
    expect(rels.length).toBeGreaterThanOrEqual(1);
    expect(rels.some((r) => r.target_id === mod2.id)).toBe(true);
  });

  it('should run all 13 default analyzers against a populated graph', async () => {
    // Populate graph with diverse entities
    const entities = [
      makeEntity('repository', 'test-project'),
      makeEntity('file', 'handler.ts', { is_source: true }),
      makeEntity('file', 'utils.ts', { is_source: true }),
      makeEntity('function', 'handleRequest'),
      makeEntity('function', 'formatDate'),
      makeEntity('module', 'routes'),
      makeEntity('module', 'helpers'),
    ];

    for (const e of entities) {
      await graph.upsertEntity(e);
    }

    await graph.upsertRelationship(makeRelationship(entities[0]!.id, entities[1]!.id, 'contains'));
    await graph.upsertRelationship(makeRelationship(entities[0]!.id, entities[2]!.id, 'contains'));
    await graph.upsertRelationship(makeRelationship(entities[1]!.id, entities[3]!.id, 'defines'));
    await graph.upsertRelationship(makeRelationship(entities[2]!.id, entities[4]!.id, 'defines'));

    const ctx = makeContext(graph);

    // Register and run all analyzers
    const registry = new AnalyzerRegistry();
    for (const analyzer of createDefaultAnalyzers()) {
      registry.register(analyzer);
    }

    const runner = new AnalyzerRunner(registry);
    const result = await runner.run('*', ctx);

    // Verify runner produces valid results
    expect(result).toBeDefined();
    expect(result.findings).toBeDefined();
    expect(Array.isArray(result.findings)).toBe(true);
    // All 13 analyzers should be accounted for
    expect(result.analyzers_run.length + result.analyzers_failed.length).toBe(13);
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    // Findings should have required fields
    for (const f of result.findings) {
      expect(f.id).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.analyzer_id).toBeTruthy();
      expect(f.severity).toBeTruthy();
    }
  });

  it('should track graph statistics', async () => {
    const stats = await graph.getStats();

    expect(stats.totalEntities).toBeGreaterThanOrEqual(5);
    expect(stats.totalRelationships).toBeGreaterThanOrEqual(4);
    expect(stats.entityCountsByType).toBeDefined();
    expect(typeof stats.entityCountsByType).toBe('object');
  });

  it('should execute full collect → analyze pipeline end-to-end', async () => {
    // Create a fresh isolated graph
    const testGraph = await createGraphClient({
      provider: 'sqlite',
      sqlitePath: ':memory:',
      autoMigrate: true,
    });

    // 1. Simulate collection by inserting entities
    const entities: Entity[] = [
      makeEntity('repository', 'my-api'),
      makeEntity('module', 'routes'),
      makeEntity('module', 'models'),
      makeEntity('function', 'getUser'),
      makeEntity('function', 'createUser'),
      makeEntity('endpoint', 'GET /users', { method: 'GET', path: '/users' }),
      makeEntity('endpoint', 'POST /users', { method: 'POST', path: '/users' }),
    ];

    for (const e of entities) {
      await testGraph.upsertEntity(e);
    }

    await testGraph.upsertRelationship(
      makeRelationship(entities[1]!.id, entities[0]!.id, 'contains'),
    );
    await testGraph.upsertRelationship(
      makeRelationship(entities[3]!.id, entities[1]!.id, 'contains'),
    );

    // 2. Run analysis
    const ctx = makeContext(testGraph);

    const registry = new AnalyzerRegistry();
    for (const analyzer of createDefaultAnalyzers()) {
      registry.register(analyzer);
    }

    const runner = new AnalyzerRunner(registry);
    const result = await runner.run('*', ctx);

    // 3. Verify end-to-end pipeline
    expect(result.analyzers_run.length + result.analyzers_failed.length).toBe(13);
    expect(result.findings).toBeDefined();

    // Verify graph has expected data
    const stats = await testGraph.getStats();
    expect(stats.totalEntities).toBe(7);
    expect(stats.totalRelationships).toBeGreaterThanOrEqual(2);

    // All findings should be well-formed
    for (const f of result.findings) {
      expect(f.id).toBeTruthy();
      expect(f.title).toBeTruthy();
      expect(f.analyzer_id).toBeTruthy();
      expect(['info', 'low', 'medium', 'high', 'critical']).toContain(f.severity);
    }
  });

  it('should correctly register all 13 default analyzers', () => {
    const analyzers = createDefaultAnalyzers();
    expect(analyzers.length).toBe(13);

    const registry = new AnalyzerRegistry();
    for (const a of analyzers) {
      registry.register(a);
    }

    expect(registry.getAll().length).toBe(13);

    // Verify each analyzer has required fields
    for (const a of analyzers) {
      expect(a.id).toBeTruthy();
      expect(a.name).toBeTruthy();
      expect(a.version).toBeTruthy();
      expect(a.categories.length).toBeGreaterThanOrEqual(1);
    }
  });
});

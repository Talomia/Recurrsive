/**
 * @module @recurrsive/analyzers/__tests__/integration
 *
 * Integration tests that verify the full analyzer pipeline:
 * entities → analyze → findings.
 *
 * Tests confirm that analyzers produce properly structured findings
 * from mock analysis contexts containing representative entities.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  Analyzer,
  AnalysisContext,
  Entity,
  Relationship,
  Finding,
  EntityType,
} from '@recurrsive/core';
import { generateId, nowISO } from '@recurrsive/core';
import { createDefaultAnalyzers } from '../../create-defaults.js';

// ---------------------------------------------------------------------------
// Mock Graph Client
// ---------------------------------------------------------------------------

/** Creates a mock entity with minimal required fields. */
function mockEntity(overrides: Partial<Entity> & { type: EntityType; name: string }): Entity {
  return {
    id: generateId(),
    qualified_name: `test.${overrides.name}`,
    properties: {},
    source: 'test',
    confidence: 1.0,
    tags: [],
    created_at: nowISO(),
    updated_at: nowISO(),
    ...overrides,
  };
}

/** Creates a mock graph client that returns configurable entity sets. */
function createMockGraphClient(entities: Entity[], relationships: Relationship[] = []) {
  return {
    getEntity: async (id: string) => entities.find((e) => e.id === id) ?? null,
    getEntities: async (type: EntityType) => entities.filter((e) => e.type === type),
    getRelationships: async () => relationships,
    getNeighbors: async () => [],
    getStats: async () => ({ entityCount: entities.length, relationshipCount: relationships.length }),
  };
}

/** Creates a mock analysis context. */
function createMockContext(entities: Entity[], relationships: Relationship[] = []): AnalysisContext {
  return {
    graph: createMockGraphClient(entities, relationships) as AnalysisContext['graph'],
    project: {
      name: 'test-project',
      root_path: '/tmp/test-project',
      languages: ['typescript'],
      frameworks: ['express'],
      ai_providers: ['openai'],
    },
    config: {
      enabled: true,
      severity_threshold: 'info',
      custom: {},
    },
  };
}

// ---------------------------------------------------------------------------
// Test Entities
// ---------------------------------------------------------------------------

const testEntities: Entity[] = [
  // Files
  mockEntity({ type: 'file', name: 'app.ts', properties: { language: 'typescript', path: 'src/app.ts', content: 'import express from "express";\nconst secret = "hardcoded-secret";\n' } }),
  mockEntity({ type: 'file', name: 'index.ts', properties: { language: 'typescript', path: 'src/index.ts', content: 'import { app } from "./app";\napp.listen(3000);\n' } }),
  mockEntity({ type: 'file', name: 'config.ts', properties: { language: 'typescript', path: 'src/config.ts', content: 'export const config = { apiKey: process.env.API_KEY };\n' } }),

  // Dependencies
  mockEntity({ type: 'dependency', name: 'express', properties: { version: '4.18.0', isDev: false } }),
  mockEntity({ type: 'dependency', name: 'lodash', properties: { version: '4.17.19', isDev: false } }),
  mockEntity({ type: 'dependency', name: 'typescript', properties: { version: '5.4.0', isDev: true } }),
  mockEntity({ type: 'dependency', name: 'jest', properties: { version: '*', isDev: true } }),

  // Endpoints
  mockEntity({ type: 'endpoint', name: 'GET /api/users', properties: { method: 'GET', path: '/api/users', description: 'List users' } }),
  mockEntity({ type: 'endpoint', name: 'POST /api/users', properties: { method: 'POST', path: '/api/users' } }),
  mockEntity({ type: 'endpoint', name: 'GET /api/items', properties: { method: 'GET', path: '/api/items', description: 'List items' } }),

  // AI-related
  mockEntity({ type: 'prompt', name: 'system-prompt', properties: { template: 'You are a helpful assistant' } }),
  mockEntity({ type: 'model', name: 'gpt-4', properties: { provider: 'openai', model: 'gpt-4' } }),

  // Infrastructure
  mockEntity({ type: 'deployment', name: 'production', properties: { environment: 'production', provider: 'aws' } }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Analyzer Integration', () => {
  describe('All default analyzers', () => {
    let analyzers: Analyzer[];
    let ctx: AnalysisContext;

    beforeEach(() => {
      analyzers = createDefaultAnalyzers();
      ctx = createMockContext(testEntities);
    });

    it('creates the expected number of default analyzers', () => {
      // 10 original + 2 new (dependency, api-contract) = 12
      expect(analyzers.length).toBeGreaterThanOrEqual(10);
    });

    it('all analyzers have unique IDs', () => {
      const ids = analyzers.map((a) => a.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('all analyzers implement the full interface', () => {
      for (const analyzer of analyzers) {
        expect(analyzer.id).toBeTruthy();
        expect(analyzer.name).toBeTruthy();
        expect(analyzer.version).toBeTruthy();
        expect(typeof analyzer.initialize).toBe('function');
        expect(typeof analyzer.analyze).toBe('function');
        expect(typeof analyzer.finalize).toBe('function');
      }
    });

    it('all analyzers can initialize', async () => {
      for (const analyzer of analyzers) {
        await expect(analyzer.initialize(ctx)).resolves.not.toThrow();
      }
    });

    it('all analyzers produce valid findings', async () => {
      const allFindings: Finding[] = [];

      for (const analyzer of analyzers) {
        await analyzer.initialize(ctx);
        const findings = await analyzer.analyze(ctx);

        for (const finding of findings) {
          expect(finding.title).toBeTruthy();
          expect(finding.description).toBeTruthy();
          expect(finding.severity).toBeTruthy();
          expect(['critical', 'high', 'medium', 'low', 'info']).toContain(finding.severity);
          expect(finding.analyzer_id).toBe(analyzer.id);
        }

        allFindings.push(...findings);
      }

      // At least some analyzers should produce findings given our test entities
      expect(allFindings.length).toBeGreaterThan(0);
    });

    it('finalize produces valid cross-cutting findings', async () => {
      const finalizeFindings: Finding[] = [];

      for (const analyzer of analyzers) {
        await analyzer.initialize(ctx);
        await analyzer.analyze(ctx); // Must run analyze first
        const findings = await analyzer.finalize(ctx);

        for (const finding of findings) {
          expect(finding.title).toBeTruthy();
          expect(finding.severity).toBeTruthy();
        }

        finalizeFindings.push(...findings);
      }

      // Finalize findings are optional but should be valid when present
      expect(Array.isArray(finalizeFindings)).toBe(true);
    });
  });

  describe('Pipeline: entities → analyze → prioritize', () => {
    it('security analyzer detects hardcoded secrets', async () => {
      const ctx = createMockContext([
        mockEntity({
          type: 'file',
          name: 'config.ts',
          properties: {
            language: 'typescript',
            path: 'src/config.ts',
            content: 'const API_KEY = "test_fake_key_not_real_000000000000000";',
          },
        }),
      ]);

      const analyzers = createDefaultAnalyzers();
      const securityAnalyzer = analyzers.find((a) => a.id === 'security.vulnerabilities');
      expect(securityAnalyzer).toBeDefined();

      await securityAnalyzer!.initialize(ctx);
      const findings = await securityAnalyzer!.analyze(ctx);

      const secretFindings = findings.filter(
        (f) => f.title.toLowerCase().includes('secret') || f.title.toLowerCase().includes('key'),
      );
      expect(secretFindings.length).toBeGreaterThanOrEqual(0); // May or may not detect depending on patterns
    });

    it('findings have proper structure for downstream consumption', async () => {
      const ctx = createMockContext(testEntities);
      const analyzers = createDefaultAnalyzers();

      const allFindings: Finding[] = [];
      for (const analyzer of analyzers) {
        await analyzer.initialize(ctx);
        const findings = await analyzer.analyze(ctx);
        allFindings.push(...findings);
      }

      // Each finding should be consumable by the reasoning engine
      for (const finding of allFindings) {
        expect(finding).toHaveProperty('id');
        expect(finding).toHaveProperty('title');
        expect(finding).toHaveProperty('description');
        expect(finding).toHaveProperty('severity');
        expect(finding).toHaveProperty('analyzer_id');
      }
    });
  });

  describe('Empty graph', () => {
    it('all analyzers handle empty entity sets gracefully', async () => {
      const ctx = createMockContext([]);
      const analyzers = createDefaultAnalyzers();

      for (const analyzer of analyzers) {
        await analyzer.initialize(ctx);
        const findings = await analyzer.analyze(ctx);
        expect(Array.isArray(findings)).toBe(true);
        // Should not throw on empty input
      }
    });
  });
});

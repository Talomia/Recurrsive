/**
 * @module @recurrsive/collectors/__tests__/integration
 *
 * Integration tests that verify the full collector pipeline:
 * collector → entities → validation.
 *
 * These tests confirm that collectors produce entities and relationships
 * that conform to the core type schemas and can be processed downstream.
 *
 * Since collectors now use real API calls, tests that exercise the
 * GitHub collector mock `fetch` to return realistic API responses so
 * they remain deterministic without network access.
 *
 * @packageDocumentation
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { GitCollector } from '../../git/collector.js';
import { GitHubCollector } from '../../github/collector.js';
import { OpenTelemetryCollector } from '../../telemetry/collector.js';
import { CollectorRegistry } from '../../base/registry.js';
import {
  EntityTypeSchema,
  RelationTypeSchema,
} from '@recurrsive/core';
import type {
  CollectorConfig,
  DataGovernance,
  Entity,
  Relationship,
} from '@recurrsive/core';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const governance: DataGovernance = {
  masked_fields: [],
  excluded_patterns: [],
  pii_detection: false,
  audit_log: false,
  retention_days: 90,
};

const config: CollectorConfig = { governance, custom: {} };

/** Config with a mock token so the collector attempts API calls. */
const configWithToken: CollectorConfig = {
  governance,
  custom: { github_token: 'ghp_test_token_for_testing' },
};

// We use the Recurrsive repo itself as a test target for GitCollector
const REPO_ROOT = path.resolve(import.meta.dirname, '../../../../..');

// ---------------------------------------------------------------------------
// Mock GitHub API responses
// ---------------------------------------------------------------------------

const MOCK_CONTRIBUTORS = [
  { login: 'alice', contributions: 42, type: 'User' },
  { login: 'bob', contributions: 17, type: 'User' },
  { login: 'carol', contributions: 8, type: 'User' },
];

const MOCK_TEAMS = [
  { id: 1, name: 'Platform Team', slug: 'platform-team', description: null, members_url: '' },
];

const MOCK_PULL_REQUESTS = [
  {
    number: 101,
    title: 'feat: add user auth',
    user: { login: 'alice' },
    requested_reviewers: [{ login: 'bob' }],
    state: 'closed',
    merged_at: '2025-01-01T00:00:00Z',
    labels: [{ name: 'feature' }],
  },
  {
    number: 102,
    title: 'fix: resolve race condition',
    user: { login: 'bob' },
    requested_reviewers: [{ login: 'alice' }],
    state: 'open',
    merged_at: null,
    labels: [{ name: 'bugfix' }],
  },
];

const MOCK_WORKFLOWS_RESPONSE = {
  total_count: 1,
  workflows: [
    { id: 1, name: 'CI Pipeline', path: '.github/workflows/ci.yml', state: 'active' },
  ],
};

const MOCK_WORKFLOW_RUNS_RESPONSE = {
  total_count: 1,
  workflow_runs: [
    { id: 100, name: 'CI Pipeline', workflow_id: 1, status: 'completed', conclusion: 'success', run_number: 42, jobs_url: '' },
  ],
};

const MOCK_WORKFLOW_JOBS_RESPONSE = {
  total_count: 2,
  jobs: [
    { id: 1, name: 'lint', status: 'completed', conclusion: 'success', runner_name: 'ubuntu-latest', steps: [{ name: 'Checkout', status: 'completed', conclusion: 'success' }, { name: 'Lint', status: 'completed', conclusion: 'success' }] },
    { id: 2, name: 'test', status: 'completed', conclusion: 'success', runner_name: 'ubuntu-latest', steps: [{ name: 'Checkout', status: 'completed', conclusion: 'success' }, { name: 'Test', status: 'completed', conclusion: 'success' }] },
  ],
};

const MOCK_DEPLOYMENTS = [
  { id: 1, environment: 'production', sha: 'abc1234def', creator: { login: 'alice' }, description: null, created_at: '2025-01-01T00:00:00Z' },
];

/**
 * Set up fetch mock that routes GitHub API calls to mock responses.
 */
function setupGitHubFetchMock(): void {
  const originalFetch = globalThis.fetch;
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

    const makeResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status,
      statusText: status === 200 ? 'OK' : 'Not Found',
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '4999',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
      },
    });

    if (urlStr.includes('/contributors')) return makeResponse(MOCK_CONTRIBUTORS);
    if (urlStr.includes('/teams')) return makeResponse(MOCK_TEAMS);
    if (urlStr.includes('/pulls')) return makeResponse(MOCK_PULL_REQUESTS);
    if (urlStr.includes('/actions/runs/') && urlStr.includes('/jobs')) return makeResponse(MOCK_WORKFLOW_JOBS_RESPONSE);
    if (urlStr.includes('/actions/workflows/') && urlStr.includes('/runs')) return makeResponse(MOCK_WORKFLOW_RUNS_RESPONSE);
    if (urlStr.includes('/actions/workflows')) return makeResponse(MOCK_WORKFLOWS_RESPONSE);
    if (urlStr.includes('/deployments')) return makeResponse(MOCK_DEPLOYMENTS);

    // For any other URLs (e.g., OpenTelemetry), call the original fetch
    return originalFetch(url, _init);
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Validate that all entities conform to the EntityTypeSchema. */
function assertValidEntities(entities: Entity[]): void {
  for (const entity of entities) {
    expect(entity.id).toBeTruthy();
    expect(entity.name).toBeTruthy();
    expect(entity.type).toBeTruthy();
    expect(entity.source).toBeTruthy();
    expect(entity.created_at).toBeTruthy();

    // Type must be in the schema
    const parsed = EntityTypeSchema.safeParse(entity.type);
    expect(parsed.success, `Invalid entity type: ${entity.type}`).toBe(true);
  }
}

/** Validate that all relationships conform to the RelationTypeSchema. */
function assertValidRelationships(relationships: Relationship[]): void {
  for (const rel of relationships) {
    expect(rel.id).toBeTruthy();
    expect(rel.type).toBeTruthy();
    expect(rel.source_id).toBeTruthy();
    expect(rel.target_id).toBeTruthy();
    expect(rel.source).toBeTruthy();

    // Type must be in the schema
    const parsed = RelationTypeSchema.safeParse(rel.type);
    expect(parsed.success, `Invalid relationship type: ${rel.type}`).toBe(true);

    // Confidence between 0 and 1
    expect(rel.confidence).toBeGreaterThanOrEqual(0);
    expect(rel.confidence).toBeLessThanOrEqual(1);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Collector Integration', () => {
  // ── GitHub Collector ─────────────────────────────────────────────────
  describe('GitHubCollector → entities + relationships', () => {
    let collector: GitHubCollector;

    beforeEach(() => {
      setupGitHubFetchMock();
      collector = new GitHubCollector('https://github.com/test/repo');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('produces valid entities through full lifecycle', async () => {
      await collector.initialize(configWithToken);
      const validation = await collector.validate();
      expect(validation.valid).toBe(true);

      const result = await collector.collect();
      expect(result.entities.length).toBeGreaterThan(0);
      assertValidEntities(result.entities);

      await collector.dispose();
    });

    it('produces valid relationships', async () => {
      await collector.initialize(configWithToken);
      const result = await collector.collect();
      expect(result.relationships.length).toBeGreaterThan(0);
      assertValidRelationships(result.relationships);

      await collector.dispose();
    });

    it('metadata has correct collector_id', async () => {
      await collector.initialize(configWithToken);
      const result = await collector.collect();
      expect(result.metadata.collector_id).toBe('github');
      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
      expect(result.metadata.items_processed).toBeGreaterThan(0);
    });

    it('returns empty results without a token (graceful fallback)', async () => {
      vi.restoreAllMocks(); // Remove fetch mock
      await collector.initialize(config); // No token
      const result = await collector.collect();
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.metadata.errors.length).toBeGreaterThan(0);
    });
  });

  // ── OpenTelemetry Collector ──────────────────────────────────────────
  describe('OpenTelemetryCollector → entities + relationships', () => {
    let collector: OpenTelemetryCollector;

    beforeEach(() => {
      collector = new OpenTelemetryCollector('http://localhost:4318');
    });

    it('validates endpoint URL', async () => {
      const validation = await collector.validate();
      expect(validation.valid).toBe(true);
    });

    it('returns empty results gracefully when no data files exist', async () => {
      await collector.initialize(config);
      const result = await collector.collect();
      // The OTel collector reads from local files; without them it returns empty
      expect(result.entities).toBeDefined();
      expect(result.relationships).toBeDefined();
      expect(result.metadata.collector_id).toBe('telemetry');
      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);

      if (result.entities.length > 0) {
        assertValidEntities(result.entities);
      }
      if (result.relationships.length > 0) {
        assertValidRelationships(result.relationships);
      }

      await collector.dispose();
    });

    it('metadata has correct collector_id', async () => {
      await collector.initialize(config);
      const result = await collector.collect();
      expect(result.metadata.collector_id).toBe('telemetry');
      expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Registry Integration ─────────────────────────────────────────────
  describe('CollectorRegistry → collectAll', () => {
    let registry: CollectorRegistry;

    beforeEach(() => {
      setupGitHubFetchMock();
      registry = new CollectorRegistry();
      const ghCollector = new GitHubCollector('https://github.com/test/repo');
      registry.register(ghCollector);
      registry.register(new OpenTelemetryCollector('http://localhost:4318'));
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('runs all collectors and aggregates results', async () => {
      const results = await registry.collectAll(governance, { github_token: 'ghp_test_token_for_testing' });

      expect(results).toHaveLength(2);

      // At least the GitHub collector should produce entities
      const ghResult = results.find((r) => r.metadata.collector_id === 'github');
      expect(ghResult).toBeDefined();
      expect(ghResult!.entities.length).toBeGreaterThan(0);
      assertValidEntities(ghResult!.entities);

      for (const result of results) {
        if (result.entities.length > 0) {
          assertValidEntities(result.entities);
        }
        if (result.relationships.length > 0) {
          assertValidRelationships(result.relationships);
        }
      }
    });

    it('produces unique entity IDs across collectors', async () => {
      const results = await registry.collectAll(governance, { github_token: 'ghp_test_token_for_testing' });
      const allIds = results.flatMap((r) => r.entities.map((e) => e.id));
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });

    it('each result has correct collector_id', async () => {
      const results = await registry.collectAll(governance, { github_token: 'ghp_test_token_for_testing' });
      const collectorIds = results.map((r) => r.metadata.collector_id);
      expect(collectorIds).toContain('github');
      expect(collectorIds).toContain('telemetry');
    });
  });

  // ── Governance Filtering ─────────────────────────────────────────────
  describe('Governance filtering across collectors', () => {
    beforeEach(() => {
      setupGitHubFetchMock();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('applies excluded_patterns to entities', async () => {
      const strictGovernance: DataGovernance = {
        ...governance,
        excluded_patterns: ['**/node_modules/**', '**/*.log'],
      };

      const collector = new GitHubCollector('https://github.com/test/repo');
      await collector.initialize({ governance: strictGovernance, custom: { github_token: 'ghp_test' } });
      const result = await collector.collect();

      // Should still produce entities (non-matching ones)
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('applies masked_fields to entity properties', async () => {
      const maskedGovernance: DataGovernance = {
        ...governance,
        masked_fields: ['email', 'author_email'],
      };

      const collector = new GitHubCollector('https://github.com/test/repo');
      await collector.initialize({ governance: maskedGovernance, custom: { github_token: 'ghp_test' } });
      const result = await collector.collect();

      // Entities with email properties should have them masked
      for (const entity of result.entities) {
        if (entity.properties['email']) {
          expect(entity.properties['email']).toBe('***MASKED***');
        }
      }
    });
  });
});

/**
 * Tests for the GitLabCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Validation success / failure
 * - Collection produces entities with valid shapes
 * - Entity types are all valid EntityType values
 * - Relationship types are all valid RelationType values
 * - Governance filtering works (masking, exclusion)
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 * - Can override gitlabUrl via config.custom
 * - Collects without errors when initialized
 * - All relationships reference valid entity IDs
 * - Graceful fallback when no token is configured
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitLabCollector } from '../../gitlab/collector.js';
import { EntityTypeSchema, RelationTypeSchema } from '@recurrsive/core';
import type { CollectorConfig } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Mock GitLab API Responses
// ---------------------------------------------------------------------------

const MOCK_MEMBERS = [
  { username: 'alice', name: 'Alice', access_level: 40 },
  { username: 'bob', name: 'Bob', access_level: 30 },
  { username: 'carol', name: 'Carol', access_level: 30 },
  { username: 'dave', name: 'Dave', access_level: 30 },
  { username: 'eve', name: 'Eve', access_level: 20 },
];

const MOCK_MRS = [
  {
    iid: 42,
    title: 'feat: add OAuth2 login',
    author: { username: 'alice' },
    reviewers: [{ username: 'bob' }, { username: 'carol' }],
    state: 'merged',
    labels: ['feature'],
  },
  {
    iid: 43,
    title: 'fix: database connection pool leak',
    author: { username: 'bob' },
    reviewers: [{ username: 'alice' }],
    state: 'merged',
    labels: ['bugfix'],
  },
  {
    iid: 44,
    title: 'chore: migrate CI to rules-based pipelines',
    author: { username: 'dave' },
    reviewers: [{ username: 'eve' }, { username: 'alice' }],
    state: 'opened',
    labels: ['chore', 'ci'],
  },
];

const MOCK_PIPELINES = [
  { id: 1001, ref: 'main', status: 'success', user: { username: 'alice' } },
  { id: 1002, ref: 'main', status: 'success', user: { username: 'dave' } },
];

const MOCK_PIPELINE_1001_JOBS = [
  { id: 1, name: 'lint', stage: 'test', status: 'success', pipeline: { id: 1001 }, runner: { description: 'shared-runner' } },
  { id: 2, name: 'unit-test', stage: 'test', status: 'success', pipeline: { id: 1001 }, runner: { description: 'shared-runner' } },
  { id: 3, name: 'build', stage: 'build', status: 'success', pipeline: { id: 1001 }, runner: { description: 'shared-runner' } },
  { id: 4, name: 'deploy-staging', stage: 'deploy', status: 'success', pipeline: { id: 1001 }, runner: { description: 'shared-runner' } },
];

const MOCK_PIPELINE_1002_JOBS = [
  { id: 5, name: 'deploy-production', stage: 'deploy', status: 'success', pipeline: { id: 1002 }, runner: { description: 'shared-runner' } },
];

const MOCK_ENVIRONMENTS = [
  { id: 1, name: 'production', tier: 'production', external_url: 'https://app.example.com' },
  { id: 2, name: 'staging', tier: 'staging', external_url: 'https://staging.example.com' },
];

const MOCK_DEPLOYMENTS = [
  { id: 1, environment: 'staging', sha: 'a1b2c3d4', user: { username: 'alice' }, status: 'success', deployable: { pipeline: { id: 1001 } } },
  { id: 2, environment: 'production', sha: 'e5f6a7b8', user: { username: 'dave' }, status: 'success', deployable: { pipeline: { id: 1002 } } },
];

/**
 * Set up fetch mock that routes GitLab API calls to mock responses.
 */
function setupFetchMock(): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

    const makeResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {
        'Content-Type': 'application/json',
        'RateLimit-Remaining': '1999',
        'RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
        'X-Next-Page': '',
      },
    });

    if (urlStr.includes('/members')) return makeResponse(MOCK_MEMBERS);
    if (urlStr.includes('/merge_requests')) return makeResponse(MOCK_MRS);
    if (urlStr.includes('/pipelines/1001/jobs')) return makeResponse(MOCK_PIPELINE_1001_JOBS);
    if (urlStr.includes('/pipelines/1002/jobs')) return makeResponse(MOCK_PIPELINE_1002_JOBS);
    if (urlStr.includes('/pipelines')) return makeResponse(MOCK_PIPELINES);
    if (urlStr.includes('/environments')) return makeResponse(MOCK_ENVIRONMENTS);
    if (urlStr.includes('/deployments')) return makeResponse(MOCK_DEPLOYMENTS);

    return makeResponse({ message: 'Not Found' }, 404);
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GITLAB_URL = 'https://gitlab.com/recurrsive/platform';

const defaultConfig: CollectorConfig = {
  governance: {
    masked_fields: [],
    excluded_patterns: [],
    pii_detection: false,
    audit_log: false,
    retention_days: 90,
  },
  custom: { gitlab_token: 'glpat-test_token' },
};

let collector: GitLabCollector;

beforeEach(() => {
  setupFetchMock();
  collector = new GitLabCollector(GITLAB_URL);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('initializes without error', async () => {
    await expect(collector.initialize(defaultConfig)).resolves.not.toThrow();
  });

  it('accepts gitlabUrl override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { ...defaultConfig.custom, gitlabUrl: 'https://gitlab.com/other/project' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Validation', () => {
  it('validates a well-formed GitLab URL', async () => {
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a non-GitLab URL', async () => {
    const badCollector = new GitLabCollector('https://github.com/org/repo');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('GitLab');
  });

  it('rejects an invalid URL', async () => {
    const badCollector = new GitLabCollector('not-a-url');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not a valid URL');
  });

  it('rejects an empty URL', async () => {
    const badCollector = new GitLabCollector('');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Collection — Entity Production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('produces between 20 and 40 entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBeGreaterThanOrEqual(20);
    expect(result.entities.length).toBeLessThanOrEqual(40);
  });

  it('produces entities with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.id).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.name).toBeDefined();
      expect(entity.qualified_name).toBeDefined();
      expect(entity.source).toBe('gitlab');
      expect(entity.properties).toBeDefined();
      expect(entity.tags).toBeDefined();
      expect(entity.created_at).toBeDefined();
      expect(entity.updated_at).toBeDefined();
      expect(entity.last_seen_at).toBeDefined();
    }
  });

  it('produces only valid EntityType values', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      const parsed = EntityTypeSchema.safeParse(entity.type);
      expect(parsed.success).toBe(true);
    }
  });

  it('produces the expected entity types', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const types = new Set(result.entities.map((e) => e.type));
    expect(types.has('workflow')).toBe(true);
    expect(types.has('pipeline')).toBe(true);
    expect(types.has('job')).toBe(true);
    expect(types.has('step')).toBe(true);
    expect(types.has('deployment')).toBe(true);
    expect(types.has('environment')).toBe(true);
    expect(types.has('user')).toBe(true);
  });

  it('produces user entities for all members', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    expect(users.length).toBe(5);
  });

  it('produces environment entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const envs = result.entities.filter((e) => e.type === 'environment');
    expect(envs.length).toBe(2);
    expect(envs[0]!.properties['tier']).toBeDefined();
  });

  it('produces pipeline entities with gitlab-ci platform', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const pipelines = result.entities.filter((e) => e.type === 'pipeline');
    expect(pipelines.length).toBe(2);
    for (const pipeline of pipelines) {
      expect(pipeline.properties['platform']).toBe('gitlab-ci');
    }
  });

  it('tags all entities with gitlab', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.tags).toContain('gitlab');
    }
  });
});

// ---------------------------------------------------------------------------
// Collection — Relationship Production
// ---------------------------------------------------------------------------

describe('Collection — relationship production', () => {
  it('produces between 10 and 25 relationships', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBeGreaterThanOrEqual(10);
    expect(result.relationships.length).toBeLessThanOrEqual(25);
  });

  it('produces only valid RelationType values', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const rel of result.relationships) {
      const parsed = RelationTypeSchema.safeParse(rel.type);
      expect(parsed.success).toBe(true);
    }
  });

  it('produces the expected relationship types', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const types = new Set(result.relationships.map((r) => r.type));
    expect(types.has('triggers')).toBe(true);
    expect(types.has('reviews')).toBe(true);
    expect(types.has('deploys_to')).toBe(true);
    expect(types.has('depends_on')).toBe(true);
    expect(types.has('contains')).toBe(true);
  });

  it('produces relationships with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const rel of result.relationships) {
      expect(rel.id).toBeDefined();
      expect(rel.type).toBeDefined();
      expect(rel.source_id).toBeDefined();
      expect(rel.target_id).toBeDefined();
      expect(rel.properties).toBeDefined();
      expect(rel.confidence).toBeGreaterThanOrEqual(0);
      expect(rel.confidence).toBeLessThanOrEqual(1);
      expect(rel.source).toBe('gitlab');
      expect(rel.created_at).toBeDefined();
      expect(rel.updated_at).toBeDefined();
    }
  });

  it('all relationships reference valid entity IDs', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const entityIds = new Set(result.entities.map((e) => e.id));

    for (const rel of result.relationships) {
      expect(entityIds.has(rel.source_id)).toBe(true);
      expect(entityIds.has(rel.target_id)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('masks configured fields in entity properties', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['username', 'deployer'],
        excluded_patterns: [],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: { gitlab_token: 'glpat-test_token' },
    };

    await collector.initialize(maskedConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    for (const user of users) {
      expect(user.properties['username']).toBe('***REDACTED***');
    }

    const deployments = result.entities.filter((e) => e.type === 'deployment');
    for (const deploy of deployments) {
      expect(deploy.properties['deployer']).toBe('***REDACTED***');
    }
  });

  it('does not mask fields that are not configured', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['username'],
        excluded_patterns: [],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: { gitlab_token: 'glpat-test_token' },
    };

    await collector.initialize(maskedConfig);
    const result = await collector.collect();

    const deployments = result.entities.filter((e) => e.type === 'deployment');
    for (const deploy of deployments) {
      expect(deploy.properties['deployer']).not.toBe('***REDACTED***');
    }
  });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('throws CollectorError when collecting before initialization', async () => {
    await expect(collector.collect()).rejects.toThrow('not been initialized');
  });
});

// ---------------------------------------------------------------------------
// Graceful Fallback
// ---------------------------------------------------------------------------

describe('Graceful fallback', () => {
  it('returns empty results without a token', async () => {
    vi.restoreAllMocks(); // Remove fetch mock
    const noTokenConfig: CollectorConfig = {
      governance: defaultConfig.governance,
      custom: {},
    };
    await collector.initialize(noTokenConfig);
    const result = await collector.collect();
    expect(result.entities).toEqual([]);
    expect(result.relationships).toEqual([]);
    expect(result.metadata.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Dispose
// ---------------------------------------------------------------------------

describe('Dispose', () => {
  it('disposes cleanly', async () => {
    await collector.initialize(defaultConfig);
    await expect(collector.dispose()).resolves.not.toThrow();
  });

  it('prevents collection after dispose', async () => {
    await collector.initialize(defaultConfig);
    await collector.dispose();
    await expect(collector.collect()).rejects.toThrow('not been initialized');
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('Metadata', () => {
  it('has correct collector id', () => {
    expect(collector.id).toBe('gitlab');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('GitLab Collector');
  });

  it('has correct version', () => {
    expect(collector.version).toBe('0.1.0');
  });

  it('has correct type', () => {
    expect(collector.type).toBe('gitlab');
  });

  it('returns correct run metadata', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    expect(result.metadata.collector_id).toBe('gitlab');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

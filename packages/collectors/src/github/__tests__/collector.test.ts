/**
 * Tests for the GitHubCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Validation success / failure
 * - Collection produces entities with valid shapes
 * - Entity types are all valid EntityType values
 * - Relationship types are all valid RelationType values
 * - Governance filtering works
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 * - Graceful fallback when no token is configured
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitHubCollector } from '../../github/collector.js';
import { EntityTypeSchema, RelationTypeSchema } from '@recurrsive/core';
import type { CollectorConfig } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Mock GitHub API Responses
// ---------------------------------------------------------------------------

const MOCK_CONTRIBUTORS = [
  { login: 'alice', contributions: 42, type: 'User' },
  { login: 'bob', contributions: 17, type: 'User' },
  { login: 'carol', contributions: 8, type: 'User' },
  { login: 'dave', contributions: 5, type: 'User' },
  { login: 'eve', contributions: 3, type: 'User' },
];

const MOCK_TEAMS = [
  { id: 1, name: 'Platform Team', slug: 'platform-team', description: null, members_url: '' },
  { id: 2, name: 'Frontend Team', slug: 'frontend-team', description: null, members_url: '' },
  { id: 3, name: 'SRE Team', slug: 'sre-team', description: null, members_url: '' },
];

const MOCK_PULL_REQUESTS = [
  {
    number: 101,
    title: 'feat: add user auth',
    user: { login: 'alice' },
    requested_reviewers: [{ login: 'bob' }, { login: 'carol' }],
    state: 'closed',
    merged_at: '2025-01-01T00:00:00Z',
    labels: [{ name: 'feature' }],
  },
  {
    number: 102,
    title: 'fix: resolve race condition',
    user: { login: 'bob' },
    requested_reviewers: [{ login: 'alice' }],
    state: 'closed',
    merged_at: '2025-01-02T00:00:00Z',
    labels: [{ name: 'bugfix' }],
  },
  {
    number: 103,
    title: 'chore: upgrade dependencies',
    user: { login: 'carol' },
    requested_reviewers: [{ login: 'dave' }],
    state: 'open',
    merged_at: null,
    labels: [{ name: 'chore' }],
  },
];

// Submitted reviews per PR, as returned by /pulls/{n}/reviews.
// Note dave was REQUESTED on PR 103 but never actually reviewed — no
// review relationship must be invented for him.
const MOCK_PR_101_REVIEWS = [
  { user: { login: 'bob' }, state: 'APPROVED' },
  { user: { login: 'carol' }, state: 'CHANGES_REQUESTED' },
];
const MOCK_PR_102_REVIEWS = [
  { user: { login: 'alice' }, state: 'APPROVED' },
];
const MOCK_PR_103_REVIEWS: Array<{ user: { login: string } | null; state: string }> = [];

const MOCK_WORKFLOWS_RESPONSE = {
  total_count: 2,
  workflows: [
    { id: 1, name: 'CI Pipeline', path: '.github/workflows/ci.yml', state: 'active' },
    { id: 2, name: 'Deploy Production', path: '.github/workflows/deploy.yml', state: 'active' },
  ],
};

const MOCK_CI_RUNS_RESPONSE = {
  total_count: 1,
  workflow_runs: [
    { id: 100, name: 'CI Pipeline', workflow_id: 1, status: 'completed', conclusion: 'success', run_number: 42, jobs_url: '' },
  ],
};

const MOCK_DEPLOY_RUNS_RESPONSE = {
  total_count: 1,
  workflow_runs: [
    { id: 200, name: 'Deploy Production', workflow_id: 2, status: 'completed', conclusion: 'success', run_number: 5, jobs_url: '' },
  ],
};

const MOCK_CI_JOBS_RESPONSE = {
  total_count: 3,
  jobs: [
    { id: 1, name: 'lint', status: 'completed', conclusion: 'success', runner_name: 'ubuntu-latest', steps: [{ name: 'Checkout', status: 'completed', conclusion: 'success' }, { name: 'Install', status: 'completed', conclusion: 'success' }, { name: 'Lint', status: 'completed', conclusion: 'success' }] },
    { id: 2, name: 'test', status: 'completed', conclusion: 'success', runner_name: 'ubuntu-latest', steps: [{ name: 'Checkout', status: 'completed', conclusion: 'success' }, { name: 'Install', status: 'completed', conclusion: 'success' }, { name: 'Test', status: 'completed', conclusion: 'success' }] },
    { id: 3, name: 'build', status: 'completed', conclusion: 'success', runner_name: 'ubuntu-latest', steps: [{ name: 'Checkout', status: 'completed', conclusion: 'success' }, { name: 'Install', status: 'completed', conclusion: 'success' }, { name: 'Build', status: 'completed', conclusion: 'success' }] },
  ],
};

const MOCK_DEPLOY_JOBS_RESPONSE = {
  total_count: 1,
  jobs: [
    { id: 4, name: 'deploy', status: 'completed', conclusion: 'success', runner_name: 'ubuntu-latest', steps: [{ name: 'Checkout', status: 'completed', conclusion: 'success' }, { name: 'Configure AWS', status: 'completed', conclusion: 'success' }, { name: 'Deploy', status: 'completed', conclusion: 'success' }] },
  ],
};

const MOCK_DEPLOYMENTS = [
  { id: 1, environment: 'production', sha: 'abc1234def', creator: { login: 'alice' }, description: null, created_at: '2025-01-01T00:00:00Z' },
  { id: 2, environment: 'staging', sha: 'def5678abc', creator: { login: 'bob' }, description: null, created_at: '2025-01-02T00:00:00Z' },
];

// Latest-first deployment statuses, as returned by
// /deployments/{id}/statuses
const MOCK_DEPLOYMENT_1_STATUSES = [{ state: 'success' }];
const MOCK_DEPLOYMENT_2_STATUSES = [{ state: 'in_progress' }];

// Workflow definition files served by the contents API.
const CI_WORKFLOW_YAML = `name: CI Pipeline
on:
  push:
    branches: [main]
  pull_request:
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
  test:
    needs: lint
    runs-on: ubuntu-latest
  build:
    needs: [test]
    runs-on: ubuntu-latest
`;

const DEPLOY_WORKFLOW_YAML = `name: Deploy Production
on: workflow_dispatch
jobs:
  deploy:
    runs-on: ubuntu-latest
`;

const contentsResponse = (yaml: string) => ({
  content: Buffer.from(yaml, 'utf8').toString('base64'),
  encoding: 'base64',
});

/**
 * Set up fetch mock that routes GitHub API calls to mock responses.
 */
function setupFetchMock(): void {
  vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, _init?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;

    const makeResponse = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Remaining': '4999',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 3600),
      },
    });

    if (urlStr.includes('/contributors')) return makeResponse(MOCK_CONTRIBUTORS);
    if (urlStr.includes('/teams')) return makeResponse(MOCK_TEAMS);
    if (urlStr.includes('/pulls/101/reviews')) return makeResponse(MOCK_PR_101_REVIEWS);
    if (urlStr.includes('/pulls/102/reviews')) return makeResponse(MOCK_PR_102_REVIEWS);
    if (urlStr.includes('/pulls/103/reviews')) return makeResponse(MOCK_PR_103_REVIEWS);
    if (urlStr.includes('/pulls')) return makeResponse(MOCK_PULL_REQUESTS);
    if (urlStr.includes('/actions/runs/200/jobs')) return makeResponse(MOCK_DEPLOY_JOBS_RESPONSE);
    if (urlStr.includes('/actions/runs/100/jobs')) return makeResponse(MOCK_CI_JOBS_RESPONSE);
    if (urlStr.includes('/actions/workflows/2/runs')) return makeResponse(MOCK_DEPLOY_RUNS_RESPONSE);
    if (urlStr.includes('/actions/workflows/1/runs')) return makeResponse(MOCK_CI_RUNS_RESPONSE);
    if (urlStr.includes('/actions/workflows')) return makeResponse(MOCK_WORKFLOWS_RESPONSE);
    if (urlStr.includes('/contents/.github/workflows/ci.yml')) return makeResponse(contentsResponse(CI_WORKFLOW_YAML));
    if (urlStr.includes('/contents/.github/workflows/deploy.yml')) return makeResponse(contentsResponse(DEPLOY_WORKFLOW_YAML));
    if (urlStr.includes('/deployments/1/statuses')) return makeResponse(MOCK_DEPLOYMENT_1_STATUSES);
    if (urlStr.includes('/deployments/2/statuses')) return makeResponse(MOCK_DEPLOYMENT_2_STATUSES);
    if (urlStr.includes('/deployments')) return makeResponse(MOCK_DEPLOYMENTS);

    return makeResponse({ message: 'Not Found' }, 404);
  }));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPO_URL = 'https://github.com/recurrsive/platform';

const defaultConfig: CollectorConfig = {
  governance: {
    masked_fields: [],
    excluded_patterns: [],
    pii_detection: false,
    audit_log: false,
    retention_days: 90,
  },
  custom: { github_token: 'ghp_test_token' },
};

let collector: GitHubCollector;

beforeEach(() => {
  setupFetchMock();
  collector = new GitHubCollector(REPO_URL);
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

  it('accepts repoUrl override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { ...defaultConfig.custom, repoUrl: 'https://github.com/other/repo' },
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
  it('validates a well-formed GitHub URL', async () => {
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a non-GitHub URL', async () => {
    const badCollector = new GitHubCollector('https://gitlab.com/org/repo');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('GitHub');
  });

  it('rejects an invalid URL', async () => {
    const badCollector = new GitHubCollector('not-a-url');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not a valid URL');
  });

  it('rejects an empty URL', async () => {
    const badCollector = new GitHubCollector('');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Collection — Entity Production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('produces between 15 and 30 entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBeGreaterThanOrEqual(15);
    expect(result.entities.length).toBeLessThanOrEqual(30);
  });

  it('produces entities with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.id).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.name).toBeDefined();
      expect(entity.qualified_name).toBeDefined();
      expect(entity.source).toBe('github');
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
    expect(types.has('job')).toBe(true);
    expect(types.has('step')).toBe(true);
    expect(types.has('deployment')).toBe(true);
    expect(types.has('user')).toBe(true);
    expect(types.has('team')).toBe(true);
    // No synthetic pipeline entity — the API never returned one.
    expect(types.has('pipeline')).toBe(false);
  });

  it('derives workflow triggers from the workflow file on: key', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const workflows = result.entities.filter((e) => e.type === 'workflow');
    const ci = workflows.find((w) => w.name === 'CI Pipeline');
    const deploy = workflows.find((w) => w.name === 'Deploy Production');
    expect(ci?.properties['trigger']).toBe('push,pull_request');
    expect(deploy?.properties['trigger']).toBe('workflow_dispatch');
  });

  it('reports the real deployment status from the statuses API', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const deployments = result.entities.filter((e) => e.type === 'deployment');
    const prod = deployments.find((d) => d.properties['environment'] === 'production');
    const staging = deployments.find((d) => d.properties['environment'] === 'staging');
    expect(prod?.properties['status']).toBe('success');
    expect(staging?.properties['status']).toBe('in_progress');
  });

  it('omits deployment status when the statuses API returns none', async () => {
    // Route statuses endpoints to empty arrays for this test.
    const originalFetch = globalThis.fetch;
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url;
      if (urlStr.includes('/statuses')) {
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'X-RateLimit-Remaining': '4999' },
        });
      }
      return originalFetch(url as never, init);
    }));

    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const deployments = result.entities.filter((e) => e.type === 'deployment');
    expect(deployments.length).toBe(2);
    for (const d of deployments) {
      expect('status' in d.properties).toBe(false);
    }
  });

  it('produces user entities for all contributors', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    expect(users.length).toBe(5);
  });

  it('produces team entities without unfetched membership data', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const teams = result.entities.filter((e) => e.type === 'team');
    expect(teams.length).toBe(3);
    // Membership is never fetched (requires org admin) — it must be
    // omitted, not reported as an empty roster.
    for (const team of teams) {
      expect('members' in team.properties).toBe(false);
      expect('member_count' in team.properties).toBe(false);
    }
  });

  it('names deployments with the sha so environments do not collide', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const deployments = result.entities.filter((e) => e.type === 'deployment');
    const names = deployments.map((d) => d.name).sort();
    expect(names).toEqual(['deploy-production-abc1234', 'deploy-staging-def5678']);
    // The real creation timestamp from the API is carried through.
    for (const d of deployments) {
      expect(d.properties['created_at']).toMatch(/^2025-01-0[12]T00:00:00Z$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Collection — Relationship Production
// ---------------------------------------------------------------------------

describe('Collection — relationship production', () => {
  it('produces exactly the relationships derivable from the API data', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    // 4 triggers (3 CI jobs + 1 deploy job) + 3 reviews (submitted
    // reviews only: bob+carol on PR 101, alice on PR 102, none on PR
    // 103) + 2 depends_on (test needs lint, build needs test)
    expect(result.relationships.length).toBe(9);
  });

  it('builds review relationships from submitted reviews, not review requests', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const usersById = new Map(
      result.entities.filter((e) => e.type === 'user').map((e) => [e.id, e.name]),
    );
    const reviews = result.relationships.filter((r) => r.type === 'reviews');
    const pairs = reviews
      .map((r) => `${usersById.get(r.source_id)}->${usersById.get(r.target_id)}`)
      .sort();

    expect(pairs).toEqual(['alice->bob', 'bob->alice', 'carol->alice']);
    // dave was only a REQUESTED reviewer on PR 103 and never reviewed —
    // no relationship may be fabricated for him.
    for (const rel of reviews) {
      expect(usersById.get(rel.source_id)).not.toBe('dave');
    }
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
    expect(types.has('depends_on')).toBe(true);
    // Positional team→workflow and synthetic pipeline links are gone.
    expect(types.has('owns')).toBe(false);
    expect(types.has('deploys_to')).toBe(false);
  });

  it('derives job depends_on only from declared needs', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const jobsByName = new Map(
      result.entities.filter((e) => e.type === 'job').map((e) => [e.name, e.id]),
    );
    const dependsOn = result.relationships.filter((r) => r.type === 'depends_on');
    const pairs = dependsOn.map((r) => [r.source_id, r.target_id].join('->'));

    expect(pairs).toContain(
      [jobsByName.get('CI Pipeline.test'), jobsByName.get('CI Pipeline.lint')].join('->'),
    );
    expect(pairs).toContain(
      [jobsByName.get('CI Pipeline.build'), jobsByName.get('CI Pipeline.test')].join('->'),
    );
    // The deploy workflow declares no needs — no dependencies invented.
    expect(dependsOn.length).toBe(2);
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
      expect(rel.source).toBe('github');
      expect(rel.created_at).toBeDefined();
      expect(rel.updated_at).toBeDefined();
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
        masked_fields: ['username', 'creator'],
        excluded_patterns: [],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: { github_token: 'ghp_test_token' },
    };

    await collector.initialize(maskedConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    for (const user of users) {
      expect(user.properties['username']).toBe('***REDACTED***');
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
    // The collector falls back to process.env.GITHUB_TOKEN; clear the ambient
    // token (CI environments set one) so this test genuinely runs token-less.
    const savedToken = process.env['GITHUB_TOKEN'];
    const savedGhToken = process.env['GH_TOKEN'];
    delete process.env['GITHUB_TOKEN'];
    delete process.env['GH_TOKEN'];
    try {
      const noTokenConfig: CollectorConfig = {
        governance: defaultConfig.governance,
        custom: {},
      };
      await collector.initialize(noTokenConfig);
      const result = await collector.collect();
      expect(result.entities).toEqual([]);
      expect(result.relationships).toEqual([]);
      expect(result.metadata.errors.length).toBeGreaterThan(0);
    } finally {
      if (savedToken !== undefined) process.env['GITHUB_TOKEN'] = savedToken;
      if (savedGhToken !== undefined) process.env['GH_TOKEN'] = savedGhToken;
    }
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
    expect(collector.id).toBe('github');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('GitHub App Collector');
  });

  it('has correct version', () => {
    expect(collector.version).toBe('0.1.0');
  });

  it('has correct type', () => {
    expect(collector.type).toBe('github');
  });

  it('returns correct run metadata', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    expect(result.metadata.collector_id).toBe('github');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

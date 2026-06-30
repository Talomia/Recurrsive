/**
 * Tests for ProductAnalyzer.
 *
 * Covers all 5 rules: dead feature flags, missing analytics,
 * no A/B testing infrastructure, missing onboarding flows,
 * and no feedback mechanism.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductAnalyzer } from '../../product/analyzer.js';
import type { AnalysisContext, Entity, Relationship, Finding } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();
let _idCounter = 0;
function nextId(): string {
  _idCounter++;
  const hex = _idCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}

function makeEntity(overrides: Partial<Entity> & Pick<Entity, 'type' | 'name'>): Entity {
  return {
    id: nextId(),
    qualified_name: `test:${overrides.name}`,
    source: 'test-collector',
    properties: {},
    tags: [],
    created_at: NOW,
    updated_at: NOW,
    last_seen_at: NOW,
    ...overrides,
  };
}

function makeRel(overrides: Partial<Relationship> & Pick<Relationship, 'type' | 'source_id' | 'target_id'>): Relationship {
  return {
    id: nextId(),
    properties: {},
    confidence: 1,
    source: 'test',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

type GetRelsFn = (id: string, dir: string) => Relationship[];

function makeContext(
  entitiesByType: Record<string, Entity[]> = {},
  relsFn: GetRelsFn = () => [],
): AnalysisContext {
  return {
    graph: {
      getEntity: vi.fn(),
      getEntities: vi.fn().mockImplementation((type: string) =>
        Promise.resolve(entitiesByType[type] ?? []),
      ),
      getRelationships: vi.fn().mockImplementation((id: string, dir: string) =>
        Promise.resolve(relsFn(id, dir)),
      ),
      query: vi.fn(),
      getNeighbors: vi.fn(),
    },
    config: { enabled: true, severity_threshold: 'low', custom: {} },
    history: {
      getPreviousFindings: vi.fn().mockResolvedValue([]),
      getAcceptedOpportunities: vi.fn().mockResolvedValue([]),
      getRejectedOpportunities: vi.fn().mockResolvedValue([]),
    },
    project: {
      name: 'test-project',
      root_path: '/tmp/test',
      languages: ['typescript'],
      frameworks: [],
      ai_providers: [],
    },
    emit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProductAnalyzer', () => {
  let analyzer: ProductAnalyzer;

  beforeEach(() => {
    analyzer = new ProductAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('product.health');
    expect(analyzer.name).toBe('Product Analyzer');
    expect(analyzer.categories).toContain('product');
  });

  // ── Rule 1: Dead Feature Flags ─────────────────────────────────────

  describe('dead feature flags', () => {
    it('detects always-enabled feature flag (always_enabled property)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'dark-mode',
        properties: { always_enabled: true },
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const flagFindings = findings.filter((f) => f.title.includes('always enabled'));
      expect(flagFindings).toHaveLength(1);
      expect(flagFindings[0]!.severity).toBe('low');
      expect(flagFindings[0]!.title).toContain('dark-mode');
    });

    it('detects always-enabled feature flag (value = true)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'new-dashboard',
        properties: { value: true },
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const flagFindings = findings.filter((f) => f.title.includes('always enabled'));
      expect(flagFindings).toHaveLength(1);
      expect(flagFindings[0]!.title).toContain('new-dashboard');
    });

    it('detects always-enabled feature flag (percentage = 100)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'redesign',
        properties: { percentage: 100 },
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const flagFindings = findings.filter((f) => f.title.includes('always enabled'));
      expect(flagFindings).toHaveLength(1);
    });

    it('detects always-enabled feature flag (always-on tag)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'feature-x',
        tags: ['always-on'],
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const flagFindings = findings.filter((f) => f.title.includes('always enabled'));
      expect(flagFindings).toHaveLength(1);
    });

    it('detects always-disabled feature flag (always_disabled property)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'beta-feature',
        properties: { always_disabled: true },
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const flagFindings = findings.filter((f) => f.title.includes('always disabled'));
      expect(flagFindings).toHaveLength(1);
      expect(flagFindings[0]!.severity).toBe('medium');
      expect(flagFindings[0]!.title).toContain('beta-feature');
    });

    it('detects always-disabled feature flag (value = false)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'old-ui',
        properties: { value: false },
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const flagFindings = findings.filter((f) => f.title.includes('always disabled'));
      expect(flagFindings).toHaveLength(1);
    });

    it('detects always-disabled feature flag (percentage = 0)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'removed-feature',
        properties: { percentage: 0 },
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const flagFindings = findings.filter((f) => f.title.includes('always disabled'));
      expect(flagFindings).toHaveLength(1);
    });

    it('detects always-disabled feature flag (always-off tag)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'sunset-feature',
        tags: ['always-off'],
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const flagFindings = findings.filter((f) => f.title.includes('always disabled'));
      expect(flagFindings).toHaveLength(1);
    });

    it('detects unused feature flag (no incoming rels + unused tag)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'orphan-flag',
        tags: ['unused'],
      });
      const ctx = makeContext(
        { feature_flag: [flag] },
        () => [], // no relationships
      );

      const findings = await analyzer.analyze(ctx);

      const unusedFindings = findings.filter((f) => f.title.includes('Unused feature flag'));
      expect(unusedFindings).toHaveLength(1);
      expect(unusedFindings[0]!.severity).toBe('low');
      expect(unusedFindings[0]!.title).toContain('orphan-flag');
    });

    it('skips unused detection when flag has incoming relationships', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'referenced-flag',
        tags: ['unused'],
      });
      const ctx = makeContext(
        { feature_flag: [flag] },
        (id, dir) =>
          id === flag.id && dir === 'in'
            ? [makeRel({ type: 'checks_flag', source_id: nextId(), target_id: flag.id })]
            : [],
      );

      const findings = await analyzer.analyze(ctx);

      const unusedFindings = findings.filter((f) => f.title.includes('Unused feature flag'));
      expect(unusedFindings).toHaveLength(0);
    });

    it('skips normal feature flags (not always-on/off/unused)', async () => {
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'gradual-rollout',
        properties: { percentage: 50 },
      });
      const ctx = makeContext({ feature_flag: [flag] });

      const findings = await analyzer.analyze(ctx);

      const deadFlagFindings = findings.filter(
        (f) =>
          f.title.includes('always enabled') ||
          f.title.includes('always disabled') ||
          f.title.includes('Unused feature flag'),
      );
      expect(deadFlagFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Analytics Tracking ─────────────────────────────

  describe('missing analytics', () => {
    it('detects missing analytics for mutation endpoints', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'POST', path: '/api/users' },
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [],
        business_metric: [],
      });

      const findings = await analyzer.analyze(ctx);

      const analyticsFindings = findings.filter((f) => f.title.includes('No analytics tracking'));
      expect(analyticsFindings).toHaveLength(1);
      expect(analyticsFindings[0]!.severity).toBe('medium');
    });

    it('detects missing analytics for PUT endpoints', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/orders',
        properties: { method: 'PUT', path: '/api/orders' },
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [],
        business_metric: [],
      });

      const findings = await analyzer.analyze(ctx);

      const analyticsFindings = findings.filter((f) => f.title.includes('No analytics tracking'));
      expect(analyticsFindings).toHaveLength(1);
    });

    it('skips when analytics infrastructure exists (business_metric entities)', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'POST', path: '/api/users' },
      });
      const metric = makeEntity({
        type: 'business_metric',
        name: 'user-signups',
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [],
        business_metric: [metric],
      });

      const findings = await analyzer.analyze(ctx);

      const analyticsFindings = findings.filter((f) => f.title.includes('No analytics tracking'));
      expect(analyticsFindings).toHaveLength(0);
    });

    it('skips when analytics functions exist', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'POST', path: '/api/users' },
      });
      const fn = makeEntity({
        type: 'function',
        name: 'trackEvent',
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [fn],
        business_metric: [],
      });

      const findings = await analyzer.analyze(ctx);

      const analyticsFindings = findings.filter((f) => f.title.includes('No analytics tracking'));
      expect(analyticsFindings).toHaveLength(0);
    });

    it('skips when endpoints are tracked', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'DELETE', path: '/api/users', tracked: true },
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [],
        business_metric: [],
      });

      const findings = await analyzer.analyze(ctx);

      // Endpoint is tracked → no "no analytics" finding
      // But hasAnalytics is still false (no business_metric, no analytics functions)
      // Actually, the condition requires both: untrackedEndpoints.length > 0 && !hasAnalytics
      // Since tracked: true → this endpoint is NOT in untrackedEndpoints → length is 0
      const analyticsFindings = findings.filter((f) => f.title.includes('No analytics tracking'));
      expect(analyticsFindings).toHaveLength(0);
    });

    it('skips GET endpoints (only mutation endpoints matter)', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [],
        business_metric: [],
      });

      const findings = await analyzer.analyze(ctx);

      const analyticsFindings = findings.filter((f) => f.title.includes('No analytics tracking'));
      expect(analyticsFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: No A/B Testing ─────────────────────────────────────────

  describe('no A/B testing', () => {
    it('detects missing A/B testing in mature project (>= 5 endpoints)', async () => {
      const endpoints = Array.from({ length: 5 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const ctx = makeContext({
        endpoint: endpoints,
        experiment: [],
        feature_flag: [],
        function: [],
      });

      const findings = await analyzer.analyze(ctx);

      const abFindings = findings.filter((f) => f.title.includes('No A/B testing'));
      expect(abFindings).toHaveLength(1);
      expect(abFindings[0]!.severity).toBe('low');
    });

    it('skips small projects (< 5 endpoints)', async () => {
      const endpoints = Array.from({ length: 3 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const ctx = makeContext({
        endpoint: endpoints,
        experiment: [],
        feature_flag: [],
        function: [],
      });

      const findings = await analyzer.analyze(ctx);

      const abFindings = findings.filter((f) => f.title.includes('No A/B testing'));
      expect(abFindings).toHaveLength(0);
    });

    it('skips when experiment entities exist', async () => {
      const endpoints = Array.from({ length: 5 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const experiment = makeEntity({ type: 'experiment', name: 'cta-color-test' });
      const ctx = makeContext({
        endpoint: endpoints,
        experiment: [experiment],
        feature_flag: [],
        function: [],
      });

      const findings = await analyzer.analyze(ctx);

      const abFindings = findings.filter((f) => f.title.includes('No A/B testing'));
      expect(abFindings).toHaveLength(0);
    });

    it('skips when feature flag is an experiment', async () => {
      const endpoints = Array.from({ length: 5 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const flag = makeEntity({
        type: 'feature_flag',
        name: 'experiment-flag',
        properties: { is_experiment: true },
      });
      const ctx = makeContext({
        endpoint: endpoints,
        experiment: [],
        feature_flag: [flag],
        function: [],
      });

      const findings = await analyzer.analyze(ctx);

      const abFindings = findings.filter((f) => f.title.includes('No A/B testing'));
      expect(abFindings).toHaveLength(0);
    });

    it('skips when functions have ab-test tag', async () => {
      const endpoints = Array.from({ length: 5 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const fn = makeEntity({
        type: 'function',
        name: 'variantSelector',
        tags: ['ab-test'],
      });
      const ctx = makeContext({
        endpoint: endpoints,
        experiment: [],
        feature_flag: [],
        function: [fn],
      });

      const findings = await analyzer.analyze(ctx);

      const abFindings = findings.filter((f) => f.title.includes('No A/B testing'));
      expect(abFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: Missing Onboarding ─────────────────────────────────────

  describe('missing onboarding', () => {
    it('detects missing onboarding in user-facing app', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { method: 'GET', path: '/api/data' },
      });
      const component = makeEntity({
        type: 'function',
        name: 'Dashboard',
        tags: ['component'],
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [component],
        workflow: [],
      });

      const findings = await analyzer.analyze(ctx);

      const onboardingFindings = findings.filter((f) => f.title.includes('No onboarding flow'));
      expect(onboardingFindings).toHaveLength(1);
      expect(onboardingFindings[0]!.severity).toBe('low');
    });

    it('skips when onboarding function exists', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { method: 'GET', path: '/api/data' },
      });
      const component = makeEntity({
        type: 'function',
        name: 'Dashboard',
        tags: ['component'],
      });
      const onboarding = makeEntity({
        type: 'function',
        name: 'WelcomeWizard',
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [component, onboarding],
        workflow: [],
      });

      const findings = await analyzer.analyze(ctx);

      const onboardingFindings = findings.filter((f) => f.title.includes('No onboarding flow'));
      expect(onboardingFindings).toHaveLength(0);
    });

    it('skips when onboarding workflow exists', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { method: 'GET', path: '/api/data' },
      });
      const component = makeEntity({
        type: 'function',
        name: 'Dashboard',
        tags: ['component'],
      });
      const workflow = makeEntity({
        type: 'workflow',
        name: 'user-onboarding',
        tags: ['onboarding'],
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [component],
        workflow: [workflow],
      });

      const findings = await analyzer.analyze(ctx);

      const onboardingFindings = findings.filter((f) => f.title.includes('No onboarding flow'));
      expect(onboardingFindings).toHaveLength(0);
    });

    it('skips when there are no endpoints', async () => {
      const component = makeEntity({
        type: 'function',
        name: 'Dashboard',
        tags: ['component'],
      });
      const ctx = makeContext({
        endpoint: [],
        function: [component],
        workflow: [],
      });

      const findings = await analyzer.analyze(ctx);

      const onboardingFindings = findings.filter((f) => f.title.includes('No onboarding flow'));
      expect(onboardingFindings).toHaveLength(0);
    });

    it('skips when there are no UI components', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { method: 'GET', path: '/api/data' },
      });
      const fn = makeEntity({
        type: 'function',
        name: 'processData',
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [fn],
        workflow: [],
      });

      const findings = await analyzer.analyze(ctx);

      const onboardingFindings = findings.filter((f) => f.title.includes('No onboarding flow'));
      expect(onboardingFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: No Feedback Mechanism ──────────────────────────────────

  describe('no feedback mechanism', () => {
    it('detects missing feedback mechanism in user-facing app', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { method: 'GET', path: '/api/data' },
      });
      const component = makeEntity({
        type: 'function',
        name: 'UserProfile',
        tags: ['component'],
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [component],
      });

      const findings = await analyzer.analyze(ctx);

      const feedbackFindings = findings.filter((f) => f.title.includes('No user feedback mechanism'));
      expect(feedbackFindings).toHaveLength(1);
      expect(feedbackFindings[0]!.severity).toBe('low');
    });

    it('skips when feedback function exists', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { method: 'GET', path: '/api/data' },
      });
      const component = makeEntity({
        type: 'function',
        name: 'UserProfile',
        tags: ['component'],
      });
      const feedbackFn = makeEntity({
        type: 'function',
        name: 'submitFeedback',
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [component, feedbackFn],
      });

      const findings = await analyzer.analyze(ctx);

      const feedbackFindings = findings.filter((f) => f.title.includes('No user feedback mechanism'));
      expect(feedbackFindings).toHaveLength(0);
    });

    it('skips when feedback endpoint exists', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { method: 'GET', path: '/api/data' },
      });
      const feedbackEndpoint = makeEntity({
        type: 'endpoint',
        name: '/api/feedback',
        properties: { method: 'POST', path: '/api/feedback' },
      });
      const component = makeEntity({
        type: 'function',
        name: 'UserProfile',
        tags: ['component'],
      });
      const ctx = makeContext({
        endpoint: [endpoint, feedbackEndpoint],
        function: [component],
      });

      const findings = await analyzer.analyze(ctx);

      const feedbackFindings = findings.filter((f) => f.title.includes('No user feedback mechanism'));
      expect(feedbackFindings).toHaveLength(0);
    });

    it('skips when there are no endpoints', async () => {
      const component = makeEntity({
        type: 'function',
        name: 'UserProfile',
        tags: ['component'],
      });
      const ctx = makeContext({
        endpoint: [],
        function: [component],
      });

      const findings = await analyzer.analyze(ctx);

      const feedbackFindings = findings.filter((f) => f.title.includes('No user feedback mechanism'));
      expect(feedbackFindings).toHaveLength(0);
    });

    it('skips when there are no UI components', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { method: 'GET', path: '/api/data' },
      });
      const fn = makeEntity({
        type: 'function',
        name: 'processData',
      });
      const ctx = makeContext({
        endpoint: [endpoint],
        function: [fn],
      });

      const findings = await analyzer.analyze(ctx);

      const feedbackFindings = findings.filter((f) => f.title.includes('No user feedback mechanism'));
      expect(feedbackFindings).toHaveLength(0);
    });
  });

  // ── Finalize: Cross-cutting checks ─────────────────────────────────

  describe('finalize', () => {
    it('detects no test coverage for API endpoints', async () => {
      const endpoints = Array.from({ length: 3 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const ctx = makeContext({
        endpoint: endpoints,
        file: [],
        function: [],
      });

      const findings = await analyzer.finalize(ctx);

      const testFindings = findings.filter((f) => f.title.includes('No test coverage'));
      expect(testFindings).toHaveLength(1);
      expect(testFindings[0]!.severity).toBe('high');
    });

    it('skips test coverage finding when test files exist', async () => {
      const endpoints = [
        makeEntity({
          type: 'endpoint',
          name: '/api/users',
          properties: { method: 'GET', path: '/api/users' },
        }),
      ];
      const testFile = makeEntity({
        type: 'file',
        name: 'users.test.ts',
      });
      const ctx = makeContext({
        endpoint: endpoints,
        file: [testFile],
        function: [],
      });

      const findings = await analyzer.finalize(ctx);

      const testFindings = findings.filter((f) => f.title.includes('No test coverage'));
      expect(testFindings).toHaveLength(0);
    });

    it('skips test coverage finding when test functions exist', async () => {
      const endpoints = [
        makeEntity({
          type: 'endpoint',
          name: '/api/users',
          properties: { method: 'GET', path: '/api/users' },
        }),
      ];
      const testFn = makeEntity({
        type: 'function',
        name: 'testGetUsers',
        tags: ['test'],
      });
      const ctx = makeContext({
        endpoint: endpoints,
        file: [],
        function: [testFn],
      });

      const findings = await analyzer.finalize(ctx);

      const testFindings = findings.filter((f) => f.title.includes('No test coverage'));
      expect(testFindings).toHaveLength(0);
    });

    it('detects feature documentation gap (> 3:1 ratio)', async () => {
      const endpoints = Array.from({ length: 10 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const doc = makeEntity({ type: 'document', name: 'README' });
      const ctx = makeContext({
        endpoint: endpoints,
        file: [],
        function: [],
        document: [doc],
        adr: [],
        rfc: [],
      });

      const findings = await analyzer.finalize(ctx);

      const docFindings = findings.filter((f) => f.title.includes('Feature documentation gap'));
      expect(docFindings).toHaveLength(1);
      expect(docFindings[0]!.severity).toBe('low');
    });

    it('detects documentation gap with zero docs (> 3 endpoints)', async () => {
      const endpoints = Array.from({ length: 5 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const ctx = makeContext({
        endpoint: endpoints,
        file: [],
        function: [],
        document: [],
        adr: [],
        rfc: [],
      });

      const findings = await analyzer.finalize(ctx);

      const docFindings = findings.filter((f) => f.title.includes('Feature documentation gap'));
      expect(docFindings).toHaveLength(1);
      expect(docFindings[0]!.severity).toBe('medium');
    });

    it('produces no findings when there are no endpoints', async () => {
      const ctx = makeContext();

      const findings = await analyzer.finalize(ctx);

      expect(findings).toHaveLength(0);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────

  it('initialize is a no-op', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
  });
});

/**
 * Tests for UXAnalyzer.
 *
 * Covers all 5 rules: missing loading states, missing error messages,
 * missing empty states, accessibility issues, and missing confirmation
 * dialogs for destructive actions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UXAnalyzer } from '../../ux/analyzer.js';
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

describe('UXAnalyzer', () => {
  let analyzer: UXAnalyzer;

  beforeEach(() => {
    analyzer = new UXAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('ux.quality');
    expect(analyzer.name).toBe('UX Analyzer');
    expect(analyzer.categories).toContain('ux');
  });

  // ── Rule 1: Missing Loading States ─────────────────────────────────

  describe('missing loading states', () => {
    it('detects async data-fetching function without loading state', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'fetchUsers',
        properties: { is_async: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const loadFindings = findings.filter((f) => f.title.includes('Missing loading state'));
      expect(loadFindings).toHaveLength(1);
      expect(loadFindings[0]!.severity).toBe('medium');
      expect(loadFindings[0]!.title).toContain('fetchUsers');
    });

    it('detects async function with data-fetching tag', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'getOrders',
        tags: ['async', 'data-fetching'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const loadFindings = findings.filter((f) => f.title.includes('Missing loading state'));
      expect(loadFindings).toHaveLength(1);
    });

    it('detects async hook-style function (useXxx pattern)', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'useUserData',
        properties: { is_async: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const loadFindings = findings.filter((f) => f.title.includes('Missing loading state'));
      expect(loadFindings).toHaveLength(1);
    });

    it('skips functions that track loading state', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'fetchUsers',
        properties: { is_async: true, has_loading_state: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const loadFindings = findings.filter((f) => f.title.includes('Missing loading state'));
      expect(loadFindings).toHaveLength(0);
    });

    it('skips functions tagged with loading-state', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'loadProducts',
        tags: ['async', 'loading-state'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const loadFindings = findings.filter((f) => f.title.includes('Missing loading state'));
      expect(loadFindings).toHaveLength(0);
    });

    it('skips non-fetching async functions', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processQueue',
        properties: { is_async: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const loadFindings = findings.filter((f) => f.title.includes('Missing loading state'));
      expect(loadFindings).toHaveLength(0);
    });

    it('skips sync functions', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'fetchData',
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const loadFindings = findings.filter((f) => f.title.includes('Missing loading state'));
      expect(loadFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Error Messages ─────────────────────────────────

  describe('missing error messages', () => {
    it('detects functions with error handling but no user message', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'handleSubmit',
        properties: { has_try_catch: true },
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing user-facing error message'));
      expect(errorFindings).toHaveLength(1);
      expect(errorFindings[0]!.severity).toBe('medium');
      expect(errorFindings[0]!.title).toContain('handleSubmit');
    });

    it('detects error-handling tagged function without user feedback', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'saveProfile',
        tags: ['error-handling'],
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing user-facing error message'));
      expect(errorFindings).toHaveLength(1);
    });

    it('skips functions with error messages', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'handleSubmit',
        properties: { has_try_catch: true, has_error_message: true },
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing user-facing error message'));
      expect(errorFindings).toHaveLength(0);
    });

    it('skips functions tagged with error-message', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'handleSubmit',
        properties: { has_try_catch: true },
        tags: ['error-message'],
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing user-facing error message'));
      expect(errorFindings).toHaveLength(0);
    });

    it('detects endpoints without error responses', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
      });
      const ctx = makeContext({
        function: [],
        endpoint: [endpoint],
      });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing error responses'));
      expect(errorFindings).toHaveLength(1);
      expect(errorFindings[0]!.severity).toBe('medium');
    });

    it('skips endpoints with error responses defined', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users', has_error_response: true },
      });
      const ctx = makeContext({
        function: [],
        endpoint: [endpoint],
      });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing error responses'));
      expect(errorFindings).toHaveLength(0);
    });

    it('skips endpoints tagged with error-responses', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
        tags: ['error-responses'],
      });
      const ctx = makeContext({
        function: [],
        endpoint: [endpoint],
      });

      const findings = await analyzer.analyze(ctx);

      const errorFindings = findings.filter((f) => f.title.includes('Missing error responses'));
      expect(errorFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Missing Empty States ───────────────────────────────────

  describe('missing empty states', () => {
    it('detects list component without empty state', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'UserList',
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const emptyFindings = findings.filter((f) => f.title.includes('Missing empty state'));
      expect(emptyFindings).toHaveLength(1);
      expect(emptyFindings[0]!.severity).toBe('low');
      expect(emptyFindings[0]!.title).toContain('UserList');
    });

    it('detects table component without empty state', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'DataTable',
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const emptyFindings = findings.filter((f) => f.title.includes('Missing empty state'));
      expect(emptyFindings).toHaveLength(1);
    });

    it('detects renders-list tagged function without empty state', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'MyComponent',
        tags: ['renders-list'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const emptyFindings = findings.filter((f) => f.title.includes('Missing empty state'));
      expect(emptyFindings).toHaveLength(1);
    });

    it('skips list components with empty state', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'UserList',
        properties: { has_empty_state: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const emptyFindings = findings.filter((f) => f.title.includes('Missing empty state'));
      expect(emptyFindings).toHaveLength(0);
    });

    it('skips list components tagged with empty-state', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'OrderList',
        tags: ['empty-state'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const emptyFindings = findings.filter((f) => f.title.includes('Missing empty state'));
      expect(emptyFindings).toHaveLength(0);
    });

    it('skips non-list functions', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'handleClick',
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const emptyFindings = findings.filter((f) => f.title.includes('Missing empty state'));
      expect(emptyFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: Accessibility Issues ───────────────────────────────────

  describe('accessibility issues', () => {
    it('detects interactive component without accessibility attributes', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'DropdownMenu',
        tags: ['component'],
        properties: { is_interactive: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const a11yFindings = findings.filter((f) => f.title.includes('Accessibility concern'));
      expect(a11yFindings).toHaveLength(1);
      expect(a11yFindings[0]!.severity).toBe('medium');
      expect(a11yFindings[0]!.title).toContain('DropdownMenu');
    });

    it('detects button component (name-based detection) without a11y', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'SubmitButton',
        tags: ['component'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const a11yFindings = findings.filter((f) => f.title.includes('Accessibility concern'));
      expect(a11yFindings).toHaveLength(1);
    });

    it('detects PascalCase component (modal) without a11y', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'ConfirmModal',
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const a11yFindings = findings.filter((f) => f.title.includes('Accessibility concern'));
      expect(a11yFindings).toHaveLength(1);
    });

    it('skips accessible components (has_aria_labels)', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'DropdownMenu',
        tags: ['component'],
        properties: { is_interactive: true, has_aria_labels: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const a11yFindings = findings.filter((f) => f.title.includes('Accessibility concern'));
      expect(a11yFindings).toHaveLength(0);
    });

    it('skips components tagged as accessible', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'DropdownMenu',
        tags: ['component', 'accessible'],
        properties: { is_interactive: true },
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const a11yFindings = findings.filter((f) => f.title.includes('Accessibility concern'));
      expect(a11yFindings).toHaveLength(0);
    });

    it('skips non-interactive components', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'HeaderBanner',
        tags: ['component'],
      });
      const ctx = makeContext({ function: [fn] });

      const findings = await analyzer.analyze(ctx);

      const a11yFindings = findings.filter((f) => f.title.includes('Accessibility concern'));
      expect(a11yFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: Missing Confirmation Dialogs ───────────────────────────

  describe('missing confirmation dialogs', () => {
    it('detects destructive function without confirmation', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'deleteUser',
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const confirmFindings = findings.filter((f) => f.title.includes('Missing confirmation for destructive action'));
      expect(confirmFindings).toHaveLength(1);
      expect(confirmFindings[0]!.severity).toBe('medium');
      expect(confirmFindings[0]!.title).toContain('deleteUser');
    });

    it('detects remove function without confirmation', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'removeItem',
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const confirmFindings = findings.filter((f) => f.title.includes('Missing confirmation for destructive action'));
      expect(confirmFindings).toHaveLength(1);
    });

    it('detects destructive tagged function without confirmation', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processAction',
        tags: ['destructive'],
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const confirmFindings = findings.filter((f) => f.title.includes('Missing confirmation for destructive action'));
      expect(confirmFindings).toHaveLength(1);
    });

    it('skips destructive functions with confirmation', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'deleteUser',
        properties: { has_confirmation: true },
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const confirmFindings = findings.filter((f) => f.title.includes('Missing confirmation for destructive action'));
      expect(confirmFindings).toHaveLength(0);
    });

    it('skips destructive functions tagged with has-confirmation', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'destroyProject',
        tags: ['has-confirmation'],
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const confirmFindings = findings.filter((f) => f.title.includes('Missing confirmation for destructive action'));
      expect(confirmFindings).toHaveLength(0);
    });

    it('detects DELETE endpoint without safety guard', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users/:id',
        properties: { method: 'DELETE', path: '/api/users/:id' },
      });
      const ctx = makeContext({
        function: [],
        endpoint: [endpoint],
      });

      const findings = await analyzer.analyze(ctx);

      const deleteFindings = findings.filter((f) => f.title.includes('DELETE endpoint without safety guard'));
      expect(deleteFindings).toHaveLength(1);
      expect(deleteFindings[0]!.severity).toBe('medium');
    });

    it('skips DELETE endpoint with soft-delete', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users/:id',
        properties: { method: 'DELETE', path: '/api/users/:id', has_soft_delete: true },
      });
      const ctx = makeContext({
        function: [],
        endpoint: [endpoint],
      });

      const findings = await analyzer.analyze(ctx);

      const deleteFindings = findings.filter((f) => f.title.includes('DELETE endpoint without safety guard'));
      expect(deleteFindings).toHaveLength(0);
    });

    it('skips DELETE endpoint tagged as confirmed', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users/:id',
        properties: { method: 'DELETE', path: '/api/users/:id' },
        tags: ['confirmed'],
      });
      const ctx = makeContext({
        function: [],
        endpoint: [endpoint],
      });

      const findings = await analyzer.analyze(ctx);

      const deleteFindings = findings.filter((f) => f.title.includes('DELETE endpoint without safety guard'));
      expect(deleteFindings).toHaveLength(0);
    });

    it('skips non-destructive functions', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'fetchUser',
      });
      const ctx = makeContext({
        function: [fn],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);

      const confirmFindings = findings.filter((f) => f.title.includes('Missing confirmation'));
      expect(confirmFindings).toHaveLength(0);
    });
  });

  // ── Finalize: Cross-cutting checks ─────────────────────────────────

  describe('finalize', () => {
    it('detects error states without loading states', async () => {
      const errorEndpoint = makeEntity({
        type: 'endpoint',
        name: '/api/error-handler',
        tags: ['error'],
      });
      const ctx = makeContext({
        endpoint: [errorEndpoint],
        function: [],
        config: [],
      });

      const findings = await analyzer.finalize(ctx);

      const crossFindings = findings.filter((f) => f.title.includes('Error states without loading states'));
      expect(crossFindings).toHaveLength(1);
      expect(crossFindings[0]!.severity).toBe('medium');
    });

    it('skips when loading patterns exist alongside error patterns', async () => {
      const errorEndpoint = makeEntity({
        type: 'endpoint',
        name: '/api/error-handler',
        tags: ['error'],
      });
      const loadingFn = makeEntity({
        type: 'function',
        name: 'LoadingSkeleton',
        tags: ['skeleton'],
      });
      const ctx = makeContext({
        endpoint: [errorEndpoint],
        function: [loadingFn],
        config: [],
      });

      const findings = await analyzer.finalize(ctx);

      const crossFindings = findings.filter((f) => f.title.includes('Error states without loading states'));
      expect(crossFindings).toHaveLength(0);
    });

    it('detects no i18n in multi-endpoint app', async () => {
      const endpoints = Array.from({ length: 6 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const ctx = makeContext({
        endpoint: endpoints,
        function: [],
        config: [],
      });

      const findings = await analyzer.finalize(ctx);

      const i18nFindings = findings.filter((f) => f.title.includes('No internationalization'));
      expect(i18nFindings).toHaveLength(1);
      expect(i18nFindings[0]!.severity).toBe('low');
    });

    it('skips i18n finding when i18n config exists', async () => {
      const endpoints = Array.from({ length: 6 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const i18nConfig = makeEntity({
        type: 'config',
        name: 'i18n-config',
        tags: ['i18n'],
      });
      const ctx = makeContext({
        endpoint: endpoints,
        function: [],
        config: [i18nConfig],
      });

      const findings = await analyzer.finalize(ctx);

      const i18nFindings = findings.filter((f) => f.title.includes('No internationalization'));
      expect(i18nFindings).toHaveLength(0);
    });

    it('skips i18n finding for small apps (≤ 5 endpoints)', async () => {
      const endpoints = Array.from({ length: 4 }, (_, i) =>
        makeEntity({
          type: 'endpoint',
          name: `/api/resource-${i}`,
          properties: { method: 'GET', path: `/api/resource-${i}` },
        }),
      );
      const ctx = makeContext({
        endpoint: endpoints,
        function: [],
        config: [],
      });

      const findings = await analyzer.finalize(ctx);

      const i18nFindings = findings.filter((f) => f.title.includes('No internationalization'));
      expect(i18nFindings).toHaveLength(0);
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

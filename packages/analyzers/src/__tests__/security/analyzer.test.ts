/**
 * Tests for SecurityAnalyzer.
 *
 * Covers the 3 rules that evaluate produced data: PII in prompts, missing
 * input validation (mutation endpoints), and missing authentication. Also
 * asserts that the removed rules (hardcoded secrets, unsafe deserialization,
 * permissive CORS, dependency vulnerabilities, SQL injection) no longer fire
 * on inputs that previously triggered them — none of the data they required is
 * produced by any parser or collector.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityAnalyzer } from '../../security/analyzer.js';
import type { AnalysisContext, Entity, Relationship } from '@recurrsive/core';

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

describe('SecurityAnalyzer', () => {
  let analyzer: SecurityAnalyzer;

  beforeEach(() => {
    analyzer = new SecurityAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('security.vulnerabilities');
    expect(analyzer.name).toBe('Security Analyzer');
    expect(analyzer.categories).toContain('security');
  });

  // ── Removed rules (producer/consumer contract mismatch) ──────────────
  // Each of these required data no parser or collector produces, so they could
  // only false-positive or sit dead. They were removed; the former inputs must
  // now produce nothing.

  describe('removed rules produce no findings', () => {
    it('does not flag hardcoded secrets (secret entities / file content not produced)', async () => {
      const secret = makeEntity({ type: 'secret', name: 'DB_PASSWORD', tags: ['hardcoded'] });
      const file = makeEntity({
        type: 'file',
        name: 'config.ts',
        properties: { content: 'const key = "AKIAIOSFODNN7EXAMPLE";' },
      });
      const ctx = makeContext({ secret: [secret], file: [file] });

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Hardcoded secret'))).toHaveLength(0);
      expect(findings.filter((f) => f.title.includes('AWS Access Key'))).toHaveLength(0);
      expect(findings).toHaveLength(0);
    });

    it('does not flag unsafe deserialization (markers / file content not produced)', async () => {
      const fn = makeEntity({ type: 'function', name: 'dangerousEval', properties: { uses_eval: true } });
      const file = makeEntity({
        type: 'file',
        name: 'dynamic.js',
        properties: { content: 'const result = eval(userInput);' },
      });
      const ctx = makeContext({ function: [fn], file: [file] });

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Unsafe deserialization'))).toHaveLength(0);
      expect(findings.filter((f) => f.title.includes('Unsafe code execution'))).toHaveLength(0);
    });

    it('does not flag permissive CORS (config cors_origin not produced)', async () => {
      const config = makeEntity({ type: 'config', name: 'server-config', properties: { cors_origin: '*' } });
      const ctx = makeContext({ config: [config] });

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Permissive CORS'))).toHaveLength(0);
    });

    it('does not flag dependency vulnerabilities (markers not produced; real CVE check lives in DependencyAnalyzer)', async () => {
      const dep = makeEntity({ type: 'dependency', name: 'lodash', properties: { has_vulnerability: true } });
      const ctx = makeContext({ dependency: [dep] });

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Vulnerable dependency'))).toHaveLength(0);
      expect(findings.filter((f) => f.title.includes('Outdated dependency'))).toHaveLength(0);
    });

    it('does not flag SQL injection (query entities / markers not produced)', async () => {
      const query = makeEntity({
        type: 'query',
        name: 'getUserByName',
        properties: { uses_string_concatenation: true },
      });
      const fn = makeEntity({ type: 'function', name: 'buildUserQuery', tags: ['sql-concatenation'] });
      const ctx = makeContext({ query: [query], function: [fn] });

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('SQL injection'))).toHaveLength(0);
    });
  });

  // ── Rule 1: PII in Prompts ──────────────────────────────────────────

  describe('PII in prompts', () => {
    it('detects email addresses in prompt templates', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'greeting-prompt',
        properties: { template: 'Hello user@example.com, how can I help?' },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const piiFindings = findings.filter((f) => f.title.includes('PII'));
      expect(piiFindings).toHaveLength(1);
      expect(piiFindings[0]!.severity).toBe('high');
    });

    it('detects SSN in prompt content', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'ssn-prompt',
        properties: { content: 'The SSN is 123-45-6789' },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const piiFindings = findings.filter((f) => f.title.includes('PII'));
      expect(piiFindings).toHaveLength(1);
    });

    it('detects PII via contains-pii tag', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'tagged-prompt',
        tags: ['contains-pii'],
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const piiFindings = findings.filter((f) => f.title.includes('PII'));
      expect(piiFindings).toHaveLength(1);
    });

    it('produces no PII findings for clean prompts', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'clean-prompt',
        properties: { template: 'Summarize the following text.' },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const piiFindings = findings.filter((f) => f.title.includes('PII'));
      expect(piiFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Input Validation ─────────────────────────────────

  describe('missing input validation', () => {
    it('detects POST endpoints without validation (method property)', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'POST', path: '/api/users' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing input validation'));
      expect(valFindings).toHaveLength(1);
      expect(valFindings[0]!.severity).toBe('high');
      expect(valFindings[0]!.title).toContain('POST /api/users');
    });

    it('detects POST endpoints via http_method (the property parsers emit)', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: 'POST /api/users',
        properties: { http_method: 'POST', path: '/api/users', framework: 'express' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing input validation'));
      expect(valFindings).toHaveLength(1);
      expect(valFindings[0]!.title).toContain('POST /api/users');
    });

    it('skips endpoints with validated tag', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { http_method: 'POST', path: '/api/users' },
        tags: ['validated'],
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing input validation'));
      expect(valFindings).toHaveLength(0);
    });

    it('skips GET endpoints (read-only methods must never false-positive)', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { http_method: 'GET', path: '/api/users' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing input validation'));
      expect(valFindings).toHaveLength(0);
    });

    it('skips endpoints with an empty/unknown method', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { path: '/api/users' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing input validation'));
      expect(valFindings).toHaveLength(0);
    });

    it('detects DELETE endpoints without validation', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users/:id',
        properties: { http_method: 'DELETE', path: '/api/users/:id' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing input validation'));
      expect(valFindings).toHaveLength(1);
    });
  });

  // ── Rule 3: Missing Authentication ──────────────────────────────────

  describe('missing authentication', () => {
    it('detects endpoints without auth and resolves the method into the title', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: 'GET /api/admin',
        properties: { http_method: 'GET', path: '/api/admin' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const authFindings = findings.filter((f) => f.title.includes('Missing authentication'));
      expect(authFindings).toHaveLength(1);
      expect(authFindings[0]!.severity).toBe('high');
      // Method must be resolved from http_method, not rendered as empty.
      expect(authFindings[0]!.title).toContain('GET /api/admin');
    });

    it('skips public endpoints like /health', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/health',
        properties: { http_method: 'GET', path: '/health' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const authFindings = findings.filter((f) => f.title.includes('Missing authentication'));
      expect(authFindings).toHaveLength(0);
    });

    it('skips endpoints tagged as public', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/docs',
        properties: { http_method: 'GET', path: '/api/docs' },
        tags: ['public'],
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const authFindings = findings.filter((f) => f.title.includes('Missing authentication'));
      expect(authFindings).toHaveLength(0);
    });

    it('skips endpoints with authenticated=true', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/data',
        properties: { http_method: 'GET', path: '/api/data', authenticated: true },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const authFindings = findings.filter((f) => f.title.includes('Missing authentication'));
      expect(authFindings).toHaveLength(0);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────

  it('initialize is a no-op and finalize is empty on an empty graph', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
    const finalized = await analyzer.finalize(ctx);
    expect(finalized).toEqual([]);
  });
});

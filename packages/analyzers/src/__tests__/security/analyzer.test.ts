/**
 * Tests for SecurityAnalyzer.
 *
 * Covers all 8 rules: hardcoded secrets, PII in prompts,
 * unsafe deserialization, missing input validation, permissive
 * CORS, missing authentication, dependency vulnerabilities,
 * and SQL injection risk.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SecurityAnalyzer } from '../../security/analyzer.js';
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

type GetEntitiesFn = (type: string) => Entity[];
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

  // ── Rule 1: Hardcoded Secrets ────────────────────────────────────────

  describe('hardcoded secrets', () => {
    it('detects secret entities tagged as hardcoded', async () => {
      const secret = makeEntity({
        type: 'secret',
        name: 'DB_PASSWORD',
        tags: ['hardcoded'],
      });
      const ctx = makeContext({ secret: [secret], file: [] });

      const findings = await analyzer.analyze(ctx);

      expect(findings).toHaveLength(1);
      expect(findings[0]!.title).toContain('Hardcoded secret');
      expect(findings[0]!.title).toContain('DB_PASSWORD');
      expect(findings[0]!.severity).toBe('critical');
    });

    it('detects secret entities with storage=source_code property', async () => {
      const secret = makeEntity({
        type: 'secret',
        name: 'API_TOKEN',
        properties: { storage: 'source_code' },
      });
      const ctx = makeContext({ secret: [secret], file: [] });

      const findings = await analyzer.analyze(ctx);

      const secretFindings = findings.filter((f) => f.title.includes('Hardcoded secret'));
      expect(secretFindings).toHaveLength(1);
    });

    it('detects AWS access keys in file content', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'config.ts',
        properties: { content: 'const key = "AKIAIOSFODNN7EXAMPLE";' },
      });
      const ctx = makeContext({ file: [file], secret: [] });

      const findings = await analyzer.analyze(ctx);

      const awsFindings = findings.filter((f) => f.title.includes('AWS Access Key'));
      expect(awsFindings).toHaveLength(1);
      expect(awsFindings[0]!.severity).toBe('critical');
    });

    it('detects generic API keys in file content', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'service.ts',
        properties: { content: 'const api_key = "abcdefghij1234567890xyzw";' },
      });
      const ctx = makeContext({ file: [file], secret: [] });

      const findings = await analyzer.analyze(ctx);

      const apiFindings = findings.filter((f) => f.title.includes('Generic API Key'));
      expect(apiFindings).toHaveLength(1);
    });

    it('detects private keys in file content', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'key.pem',
        properties: { content: '-----BEGIN RSA PRIVATE KEY-----\nMIIE...' },
      });
      const ctx = makeContext({ file: [file], secret: [] });

      const findings = await analyzer.analyze(ctx);

      const pkFindings = findings.filter((f) => f.title.includes('Private Key'));
      expect(pkFindings).toHaveLength(1);
    });

    it('detects GitHub tokens in file content', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'deploy.ts',
        properties: { content: 'const token = ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij;' },
      });
      const ctx = makeContext({ file: [file], secret: [] });

      const findings = await analyzer.analyze(ctx);

      const ghFindings = findings.filter((f) => f.title.includes('GitHub Token'));
      expect(ghFindings).toHaveLength(1);
    });

    it('skips non-source files (lock, images, .env.example)', async () => {
      const files = [
        makeEntity({ type: 'file', name: 'yarn.lock', properties: { content: 'secret = "supersecretpassword123"' } }),
        makeEntity({ type: 'file', name: 'logo.png', properties: { content: 'secret = "supersecretpassword123"' } }),
        makeEntity({ type: 'file', name: '.env.example', properties: { content: 'secret = "supersecretpassword123"' } }),
      ];
      const ctx = makeContext({ file: files, secret: [] });

      const findings = await analyzer.analyze(ctx);

      // Lock and image files are skipped; .env.example is skipped
      expect(findings).toHaveLength(0);
    });

    it('produces no findings for clean files', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'clean.ts',
        properties: { content: 'const x = process.env.API_KEY;' },
      });
      const ctx = makeContext({ file: [file], secret: [] });

      const findings = await analyzer.analyze(ctx);

      expect(findings).toHaveLength(0);
    });
  });

  // ── Rule 2: PII in Prompts ──────────────────────────────────────────

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

  // ── Rule 3: Unsafe Deserialization ──────────────────────────────────

  describe('unsafe deserialization', () => {
    it('detects functions using eval()', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'dangerousEval',
        properties: { uses_eval: true },
      });
      const ctx = makeContext({ function: [fn], file: [] });

      const findings = await analyzer.analyze(ctx);

      const evalFindings = findings.filter((f) => f.title.includes('Unsafe deserialization'));
      expect(evalFindings).toHaveLength(1);
      expect(evalFindings[0]!.severity).toBe('critical');
    });

    it('detects functions using Function constructor via tag', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'buildDynamic',
        tags: ['function-constructor'],
      });
      const ctx = makeContext({ function: [fn], file: [] });

      const findings = await analyzer.analyze(ctx);

      const desFindings = findings.filter((f) => f.title.includes('Unsafe deserialization'));
      expect(desFindings).toHaveLength(1);
    });

    it('detects eval() in file content', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'dynamic.js',
        properties: { content: 'const result = eval(userInput);' },
      });
      const ctx = makeContext({ function: [], file: [file] });

      const findings = await analyzer.analyze(ctx);

      const evalFindings = findings.filter((f) => f.title.includes('Unsafe code execution'));
      expect(evalFindings).toHaveLength(1);
    });

    it('detects new Function() in file content', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'executor.js',
        properties: { content: 'const fn = new Function("return 42");' },
      });
      const ctx = makeContext({ function: [], file: [file] });

      const findings = await analyzer.analyze(ctx);

      const funcFindings = findings.filter((f) => f.title.includes('Unsafe code execution'));
      expect(funcFindings).toHaveLength(1);
    });
  });

  // ── Rule 4: Missing Input Validation ─────────────────────────────────

  describe('missing input validation', () => {
    it('detects POST endpoints without validation', async () => {
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
    });

    it('skips endpoints with validated tag', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'POST', path: '/api/users' },
        tags: ['validated'],
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing input validation'));
      expect(valFindings).toHaveLength(0);
    });

    it('skips GET endpoints (non-data methods)', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { method: 'GET', path: '/api/users' },
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
        properties: { method: 'DELETE', path: '/api/users/:id' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing input validation'));
      expect(valFindings).toHaveLength(1);
    });
  });

  // ── Rule 5: Permissive CORS ──────────────────────────────────────────

  describe('permissive CORS', () => {
    it('detects wildcard CORS origin', async () => {
      const config = makeEntity({
        type: 'config',
        name: 'server-config',
        properties: { cors_origin: '*' },
      });
      const ctx = makeContext({ config: [config] });

      const findings = await analyzer.analyze(ctx);

      const corsFindings = findings.filter((f) => f.title.includes('Permissive CORS'));
      expect(corsFindings).toHaveLength(1);
      expect(corsFindings[0]!.severity).toBe('high');
    });

    it('detects cors object with origin=*', async () => {
      const config = makeEntity({
        type: 'config',
        name: 'express-config',
        properties: { cors: { origin: '*' } },
      });
      const ctx = makeContext({ config: [config] });

      const findings = await analyzer.analyze(ctx);

      const corsFindings = findings.filter((f) => f.title.includes('Permissive CORS'));
      expect(corsFindings).toHaveLength(1);
    });

    it('detects CORS wildcard tag', async () => {
      const config = makeEntity({
        type: 'config',
        name: 'tagged-config',
        tags: ['cors-wildcard'],
      });
      const ctx = makeContext({ config: [config] });

      const findings = await analyzer.analyze(ctx);

      const corsFindings = findings.filter((f) => f.title.includes('Permissive CORS'));
      expect(corsFindings).toHaveLength(1);
    });

    it('produces no finding for restricted CORS', async () => {
      const config = makeEntity({
        type: 'config',
        name: 'secure-config',
        properties: { cors_origin: 'https://example.com' },
      });
      const ctx = makeContext({ config: [config] });

      const findings = await analyzer.analyze(ctx);

      const corsFindings = findings.filter((f) => f.title.includes('Permissive CORS'));
      expect(corsFindings).toHaveLength(0);
    });
  });

  // ── Rule 6: Missing Authentication ──────────────────────────────────

  describe('missing authentication', () => {
    it('detects endpoints without auth', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/admin',
        properties: { method: 'GET', path: '/api/admin' },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const authFindings = findings.filter((f) => f.title.includes('Missing authentication'));
      expect(authFindings).toHaveLength(1);
      expect(authFindings[0]!.severity).toBe('high');
    });

    it('skips public endpoints like /health', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/health',
        properties: { method: 'GET', path: '/health' },
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
        properties: { method: 'GET', path: '/api/docs' },
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
        properties: { method: 'GET', path: '/api/data', authenticated: true },
      });
      const ctx = makeContext({ endpoint: [endpoint] });

      const findings = await analyzer.analyze(ctx);

      const authFindings = findings.filter((f) => f.title.includes('Missing authentication'));
      expect(authFindings).toHaveLength(0);
    });
  });

  // ── Rule 7: Dependency Vulnerabilities ───────────────────────────────

  describe('dependency vulnerabilities', () => {
    it('detects dependencies with has_vulnerability property', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'lodash',
        properties: { has_vulnerability: true },
      });
      const ctx = makeContext({ dependency: [dep] });

      const findings = await analyzer.analyze(ctx);

      const vulnFindings = findings.filter((f) => f.title.includes('Vulnerable dependency'));
      expect(vulnFindings).toHaveLength(1);
      expect(vulnFindings[0]!.severity).toBe('critical');
    });

    it('reports vulnerability count from vulnerabilities array', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'express',
        properties: { vulnerabilities: ['CVE-2024-001', 'CVE-2024-002'] },
      });
      const ctx = makeContext({ dependency: [dep] });

      const findings = await analyzer.analyze(ctx);

      const vulnFindings = findings.filter((f) => f.title.includes('Vulnerable dependency'));
      expect(vulnFindings).toHaveLength(1);
      expect(vulnFindings[0]!.description).toContain('2');
    });

    it('detects outdated dependencies', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'moment',
        tags: ['deprecated'],
      });
      const ctx = makeContext({ dependency: [dep] });

      const findings = await analyzer.analyze(ctx);

      const outdatedFindings = findings.filter((f) => f.title.includes('Outdated dependency'));
      expect(outdatedFindings).toHaveLength(1);
      expect(outdatedFindings[0]!.severity).toBe('low');
    });

    it('does not double-report vulnerable+outdated deps', async () => {
      const dep = makeEntity({
        type: 'dependency',
        name: 'old-and-vuln',
        tags: ['vulnerable', 'outdated'],
      });
      const ctx = makeContext({ dependency: [dep] });

      const findings = await analyzer.analyze(ctx);

      // Should only get 'Vulnerable' (not also 'Outdated')
      const vulnFindings = findings.filter((f) => f.title.includes('Vulnerable'));
      const outdatedFindings = findings.filter((f) => f.title.includes('Outdated'));
      expect(vulnFindings).toHaveLength(1);
      expect(outdatedFindings).toHaveLength(0);
    });
  });

  // ── Rule 8: SQL Injection Risk ──────────────────────────────────────

  describe('SQL injection risk', () => {
    it('detects queries using string concatenation', async () => {
      const query = makeEntity({
        type: 'query',
        name: 'getUserByName',
        properties: { uses_string_concatenation: true },
      });
      const ctx = makeContext({ query: [query], function: [] });

      const findings = await analyzer.analyze(ctx);

      const sqlFindings = findings.filter((f) => f.title.includes('SQL injection risk'));
      expect(sqlFindings).toHaveLength(1);
      expect(sqlFindings[0]!.severity).toBe('critical');
    });

    it('skips parameterized queries', async () => {
      const query = makeEntity({
        type: 'query',
        name: 'safeQuery',
        properties: { uses_string_concatenation: true, parameterized: true },
      });
      const ctx = makeContext({ query: [query], function: [] });

      const findings = await analyzer.analyze(ctx);

      const sqlFindings = findings.filter((f) => f.title.includes('SQL injection risk'));
      expect(sqlFindings).toHaveLength(0);
    });

    it('detects functions with sql-concatenation tag', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'buildUserQuery',
        tags: ['sql-concatenation'],
      });
      const ctx = makeContext({ query: [], function: [fn], file: [] });

      const findings = await analyzer.analyze(ctx);

      const sqlFindings = findings.filter((f) => f.title.includes('SQL injection risk'));
      expect(sqlFindings).toHaveLength(1);
    });

    it('detects queries tagged as dynamic-sql', async () => {
      const query = makeEntity({
        type: 'query',
        name: 'dynamicSearch',
        tags: ['dynamic-sql'],
      });
      const ctx = makeContext({ query: [query], function: [] });

      const findings = await analyzer.analyze(ctx);

      const sqlFindings = findings.filter((f) => f.title.includes('SQL injection risk'));
      expect(sqlFindings).toHaveLength(1);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────

  it('initialize and finalize are no-ops', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
    const finalized = await analyzer.finalize(ctx);
    expect(finalized).toEqual([]);
  });
});

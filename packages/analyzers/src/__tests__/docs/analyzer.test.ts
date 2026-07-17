/**
 * Tests for DocsAnalyzer.
 *
 * Covers all 6 rules: missing README, missing API docs, missing
 * ADRs, stale documentation, missing examples, and API contract
 * drift.  Also tests finalize().
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DocsAnalyzer } from '../../docs/analyzer.js';
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

describe('DocsAnalyzer', () => {
  let analyzer: DocsAnalyzer;

  beforeEach(() => {
    analyzer = new DocsAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('docs.completeness');
    expect(analyzer.name).toBe('Documentation Analyzer');
    expect(analyzer.categories).toContain('documentation');
  });

  // ── Rule 1: Missing README ──────────────────────────────────────────

  describe('missing README', () => {
    it('detects missing top-level README', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'index.ts',
        properties: { is_root: true },
      });
      const ctx = makeContext({
        file: [file],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const readmeFindings = findings.filter((f) => f.title.includes('Missing project README'));
      expect(readmeFindings).toHaveLength(1);
      expect(readmeFindings[0]!.severity).toBe('medium');
    });

    it('skips if README.md exists at root', async () => {
      const readme = makeEntity({
        type: 'file',
        name: 'README.md',
        properties: { is_root: true },
      });
      const ctx = makeContext({
        file: [readme],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const readmeFindings = findings.filter((f) => f.title.includes('Missing project README'));
      expect(readmeFindings).toHaveLength(0);
    });

    it('skips when README is a document sourced from readme.md (no path property)', async () => {
      // Regression: the Documentation collector emits README as a `document`
      // titled by heading (e.g. "readme") with the filename only in
      // source_location.file and empty properties. It must still count.
      const readmeDoc = makeEntity({
        type: 'document',
        name: 'readme',
        source: 'documentation',
        source_location: { file: 'readme.md', repository: '/repo' },
        properties: {},
      });
      const file = makeEntity({
        type: 'file',
        name: 'index.js',
        properties: { is_root: true },
      });
      const ctx = makeContext({
        file: [file],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [readmeDoc],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const readmeFindings = findings.filter((f) => f.title.includes('Missing project README'));
      expect(readmeFindings).toHaveLength(0);
    });

    it('detects missing module README', async () => {
      const readme = makeEntity({
        type: 'file',
        name: 'README.md',
        properties: { is_root: true },
      });
      const mod = makeEntity({
        type: 'module',
        name: 'core',
        properties: { path: 'packages/core' },
      });
      const ctx = makeContext({
        file: [readme],
        repository: [],
        module: [mod],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const modFindings = findings.filter((f) => f.title.includes('Missing README for module'));
      expect(modFindings).toHaveLength(1);
      expect(modFindings[0]!.severity).toBe('low');
    });
  });

  // ── Rule 2: Missing API Docs ────────────────────────────────────────

  describe('missing API docs', () => {
    it('detects exported function without documentation', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processData',
        properties: { is_exported: true },
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [fn],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const docFindings = findings.filter((f) => f.title.includes('Undocumented public API'));
      expect(docFindings).toHaveLength(1);
      expect(docFindings[0]!.severity).toBe('medium');
    });

    it('detects exported class without documentation', async () => {
      const cls = makeEntity({
        type: 'class',
        name: 'DataProcessor',
        tags: ['exported'],
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [cls],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const docFindings = findings.filter((f) => f.title.includes('Undocumented public API'));
      expect(docFindings).toHaveLength(1);
    });

    it('skips documented functions (jsdoc)', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processData',
        properties: { is_exported: true, jsdoc: '/** Processes data */' },
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [fn],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const docFindings = findings.filter((f) => f.title.includes('Undocumented public API'));
      expect(docFindings).toHaveLength(0);
    });

    it('skips functions tagged as documented', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'processData',
        properties: { is_exported: true },
        tags: ['documented'],
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [fn],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const docFindings = findings.filter((f) => f.title.includes('Undocumented public API'));
      expect(docFindings).toHaveLength(0);
    });

    it('skips non-exported functions', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'internalHelper',
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [fn],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const docFindings = findings.filter((f) => f.title.includes('Undocumented public API'));
      expect(docFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Missing ADRs ────────────────────────────────────────────

  describe('missing ADRs', () => {
    it('detects missing ADRs when architectural components exist', async () => {
      const pipeline = makeEntity({ type: 'pipeline', name: 'data-pipeline' });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [pipeline],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const adrFindings = findings.filter((f) => f.title.includes('No Architecture Decision Records'));
      expect(adrFindings).toHaveLength(1);
      expect(adrFindings[0]!.severity).toBe('medium');
    });

    it('detects missing ADRs with agents', async () => {
      const agent = makeEntity({ type: 'agent', name: 'support-bot' });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [agent],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const adrFindings = findings.filter((f) => f.title.includes('No Architecture Decision Records'));
      expect(adrFindings).toHaveLength(1);
    });

    it('skips when ADRs exist', async () => {
      const pipeline = makeEntity({ type: 'pipeline', name: 'data-pipeline' });
      const adr = makeEntity({ type: 'adr', name: 'ADR-001-pipeline-design' });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [adr],
        pipeline: [pipeline],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const adrFindings = findings.filter((f) => f.title.includes('No Architecture Decision Records'));
      expect(adrFindings).toHaveLength(0);
    });

    it('skips when no architectural components exist', async () => {
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const adrFindings = findings.filter((f) => f.title.includes('No Architecture Decision Records'));
      expect(adrFindings).toHaveLength(0);
    });
  });

  // ── Rule 4: Stale Documentation ─────────────────────────────────────

  describe('stale documentation', () => {
    it('detects document updated more than 180 days ago', async () => {
      const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
      const doc = makeEntity({
        type: 'document',
        name: 'architecture-overview',
        updated_at: oldDate,
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [doc],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const staleFindings = findings.filter((f) => f.title.includes('Stale documentation'));
      expect(staleFindings).toHaveLength(1);
      expect(staleFindings[0]!.severity).toBe('low');
    });

    it('detects stale ADR', async () => {
      const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const adr = makeEntity({
        type: 'adr',
        name: 'ADR-001',
        updated_at: oldDate,
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [adr],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const staleFindings = findings.filter((f) => f.title.includes('Stale documentation'));
      expect(staleFindings).toHaveLength(1);
    });

    it('skips recently updated documents', async () => {
      const recentDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const doc = makeEntity({
        type: 'document',
        name: 'recent-doc',
        updated_at: recentDate,
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [doc],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const staleFindings = findings.filter((f) => f.title.includes('Stale documentation'));
      expect(staleFindings).toHaveLength(0);
    });
  });

  // ── Rule 5: Missing Examples ────────────────────────────────────────

  describe('missing examples', () => {
    it('detects modules without example files', async () => {
      const mod = makeEntity({ type: 'module', name: 'core' });
      const file = makeEntity({ type: 'file', name: 'index.ts' });
      const ctx = makeContext({
        file: [file],
        repository: [],
        module: [mod],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const exampleFindings = findings.filter((f) => f.title.includes('No usage examples'));
      expect(exampleFindings).toHaveLength(1);
      expect(exampleFindings[0]!.severity).toBe('low');
    });

    it('skips when example files exist', async () => {
      const mod = makeEntity({ type: 'module', name: 'core' });
      const exampleFile = makeEntity({ type: 'file', name: 'example-usage.ts' });
      const ctx = makeContext({
        file: [exampleFile],
        repository: [],
        module: [mod],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const exampleFindings = findings.filter((f) => f.title.includes('No usage examples'));
      expect(exampleFindings).toHaveLength(0);
    });

    it('skips when files are in examples directory', async () => {
      const mod = makeEntity({ type: 'module', name: 'core' });
      const exampleFile = makeEntity({
        type: 'file',
        name: 'basic.ts',
        properties: { directory: 'examples' },
      });
      const ctx = makeContext({
        file: [exampleFile],
        repository: [],
        module: [mod],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const exampleFindings = findings.filter((f) => f.title.includes('No usage examples'));
      expect(exampleFindings).toHaveLength(0);
    });

    it('skips when no modules exist', async () => {
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const exampleFindings = findings.filter((f) => f.title.includes('No usage examples'));
      expect(exampleFindings).toHaveLength(0);
    });
  });

  // ── Rule 6: API Contract Drift ──────────────────────────────────────

  describe('API contract drift', () => {
    it('detects missing API contract when endpoints exist', async () => {
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { path: '/api/users' },
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [endpoint],
      });

      const findings = await analyzer.analyze(ctx);
      const contractFindings = findings.filter((f) => f.title.includes('Missing API contract'));
      expect(contractFindings).toHaveLength(1);
      expect(contractFindings[0]!.severity).toBe('medium');
    });

    it('detects drift between contract and implementation', async () => {
      const contract = makeEntity({
        type: 'api_contract',
        name: 'openapi.yaml',
        properties: { paths: ['/api/users', '/api/orders', '/api/legacy'] },
      });
      const endpoint1 = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { path: '/api/users' },
      });
      const endpoint2 = makeEntity({
        type: 'endpoint',
        name: '/api/products',
        properties: { path: '/api/products' },
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [contract],
        endpoint: [endpoint1, endpoint2],
      });

      const findings = await analyzer.analyze(ctx);
      const driftFindings = findings.filter((f) => f.title.includes('API contract drift'));
      expect(driftFindings).toHaveLength(1);
      expect(driftFindings[0]!.severity).toBe('high');
    });

    it('produces no drift finding when contract matches implementation', async () => {
      const contract = makeEntity({
        type: 'api_contract',
        name: 'openapi.yaml',
        properties: { paths: ['/api/users'] },
      });
      const endpoint = makeEntity({
        type: 'endpoint',
        name: '/api/users',
        properties: { path: '/api/users' },
      });
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [contract],
        endpoint: [endpoint],
      });

      const findings = await analyzer.analyze(ctx);
      const driftFindings = findings.filter((f) => f.title.includes('API contract drift'));
      expect(driftFindings).toHaveLength(0);
    });

    it('skips when no endpoints and no contracts exist', async () => {
      const ctx = makeContext({
        file: [],
        repository: [],
        module: [],
        function: [],
        class: [],
        adr: [],
        pipeline: [],
        agent: [],
        mcp_server: [],
        document: [],
        rfc: [],
        api_contract: [],
        endpoint: [],
      });

      const findings = await analyzer.analyze(ctx);
      const contractFindings = findings.filter(
        (f) => f.title.includes('Missing API contract') || f.title.includes('API contract drift'),
      );
      expect(contractFindings).toHaveLength(0);
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

  describe('finalize', () => {
    it('detects low documentation coverage', async () => {
      // Create 11 public functions but < 3 documents
      const fns: Entity[] = [];
      for (let i = 0; i < 11; i++) {
        fns.push(makeEntity({
          type: 'function',
          name: `func${i}`,
          properties: { is_exported: true },
        }));
      }

      const ctx = makeContext({
        function: fns,
        document: [],
        endpoint: [],
      });

      const finalized = await analyzer.finalize(ctx);
      const coverageFindings = finalized.filter((f) => f.title.includes('Low documentation coverage'));
      expect(coverageFindings).toHaveLength(1);
      expect(coverageFindings[0]!.severity).toBe('medium');
    });

    it('detects API endpoints not documented', async () => {
      const endpoint = makeEntity({ type: 'endpoint', name: '/api/users' });

      const ctx = makeContext({
        function: [],
        document: [],
        endpoint: [endpoint],
      });

      const finalized = await analyzer.finalize(ctx);
      const apiFindings = finalized.filter((f) => f.title.includes('API endpoints not documented'));
      expect(apiFindings).toHaveLength(1);
    });

    it('returns empty when coverage is adequate', async () => {
      const fns: Entity[] = [];
      for (let i = 0; i < 5; i++) {
        fns.push(makeEntity({
          type: 'function',
          name: `func${i}`,
          properties: { is_exported: true },
        }));
      }

      const ctx = makeContext({
        function: fns,
        document: [],
        endpoint: [],
      });

      const finalized = await analyzer.finalize(ctx);
      expect(finalized).toEqual([]);
    });
  });
});

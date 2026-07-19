/**
 * Tests for AIRuntimeAnalyzer.
 *
 * Covers the rules: excessive token usage, missing rate limiting,
 * single model dependency, missing streaming, context window overflow,
 * missing cost tracking (systemic), and stale embeddings. Also asserts the
 * removed per-function "missing guardrails" rule no longer fabricates
 * criticals (it keyed off content/body no producer sets and duplicated
 * ai.quality's output-validation rule).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIRuntimeAnalyzer } from '../../ai-runtime/analyzer.js';
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

function makeRel(
  overrides: Partial<Relationship> & Pick<Relationship, 'type' | 'source_id' | 'target_id'>,
): Relationship {
  return {
    id: nextId(),
    source: 'test-collector',
    properties: {},
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

type GetRelsFn = (id: string, dir: string) => Relationship[];

function makeContext(
  entitiesByType: Record<string, Entity[]> = {},
  relsFn: GetRelsFn = () => [],
  custom: Record<string, unknown> = {},
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
    config: { enabled: true, severity_threshold: 'low', custom },
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
      ai_providers: ['openai'],
    },
    emit: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AIRuntimeAnalyzer', () => {
  let analyzer: AIRuntimeAnalyzer;

  beforeEach(() => {
    analyzer = new AIRuntimeAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct id', () => {
    expect(analyzer.id).toBe('ai.runtime');
  });

  it('has correct name', () => {
    expect(analyzer.name).toBe('AI Runtime Analyzer');
  });

  it('has correct version', () => {
    expect(analyzer.version).toBe('0.1.0');
  });

  it('has a description', () => {
    expect(analyzer.description).toBeTruthy();
    expect(analyzer.description.length).toBeGreaterThan(10);
  });

  it('has categories', () => {
    expect(analyzer.categories).toContain('ai_quality');
  });

  // ── Rule 1: Excessive Token Usage ────────────────────────────────────

  describe('excessive token usage', () => {
    it('detects functions with content exceeding 10k tokens', async () => {
      const largeContent = 'x'.repeat(50_000); // 50000 chars / 4 = 12500 tokens
      const fn = makeEntity({
        type: 'function',
        name: 'buildPrompt',
        properties: { content: largeContent },
      });
      const ctx = makeContext({ function: [fn], module: [], prompt: [] });

      const findings = await analyzer.analyze(ctx);

      const tokenFindings = findings.filter((f) => f.title.includes('Excessive token usage'));
      expect(tokenFindings).toHaveLength(1);
      expect(tokenFindings[0]!.severity).toBe('high');
      expect(tokenFindings[0]!.title).toContain('buildPrompt');
    });

    it('detects prompts with large templates', async () => {
      const largeTemplate = 'y'.repeat(60_000); // 15000 tokens
      const prompt = makeEntity({
        type: 'prompt',
        name: 'systemPrompt',
        properties: { template: largeTemplate },
      });
      const ctx = makeContext({ function: [], module: [], prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const tokenFindings = findings.filter((f) => f.title.includes('Excessive token usage'));
      expect(tokenFindings).toHaveLength(1);
    });

    it('does not flag entities under the threshold', async () => {
      const smallContent = 'small content';
      const fn = makeEntity({
        type: 'function',
        name: 'smallFn',
        properties: { content: smallContent },
      });
      const ctx = makeContext({ function: [fn], module: [], prompt: [] });

      const findings = await analyzer.analyze(ctx);

      const tokenFindings = findings.filter((f) => f.title.includes('Excessive token usage'));
      expect(tokenFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Rate Limiting ─────────────────────────────────────

  describe('missing rate limiting', () => {
    it('detects LLM calls without rate limiting', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'callOpenAI',
        properties: {},
      });
      const rel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: 'model-1',
      });
      const ctx = makeContext(
        { function: [fn] },
        (id) => (id === fn.id ? [rel] : []),
      );

      const findings = await analyzer.analyze(ctx);

      // Now ONE systemic low-severity "not detectable" finding, not a
      // per-function HIGH (rate-limiting isn't observable from the graph).
      const rlFindings = findings.filter((f) => f.title.includes('Rate limiting not detectable'));
      expect(rlFindings).toHaveLength(1);
      expect(rlFindings[0]!.severity).toBe('low');
    });

    it('does not flag functions with rate limiting tag', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'callOpenAI',
        tags: ['rate-limited'],
      });
      const rel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: 'model-1',
      });
      const ctx = makeContext(
        { function: [fn] },
        (id) => (id === fn.id ? [rel] : []),
      );

      const findings = await analyzer.analyze(ctx);

      const rlFindings = findings.filter((f) => f.title.includes('Rate limiting not detectable'));
      expect(rlFindings).toHaveLength(0);
    });

    it('does not flag functions with retry in content', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'callWithRetry',
        properties: { content: 'const result = await retry(() => openai.chat())' },
      });
      const rel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: 'model-1',
      });
      const ctx = makeContext(
        { function: [fn] },
        (id) => (id === fn.id ? [rel] : []),
      );

      const findings = await analyzer.analyze(ctx);

      const rlFindings = findings.filter((f) => f.title.includes('Rate limiting not detectable'));
      expect(rlFindings).toHaveLength(0);
    });
  });

  // ── Rule 3: Missing Guardrails ─────────────────────────────────────────

  describe('missing guardrails (removed rule)', () => {
    // The per-function "Missing guardrails" CRITICAL was removed: its escape
    // valves were `content`/`body` checks function entities never carry, so
    // it fired unconditionally on every function with a `uses_model` edge and
    // duplicated ai.quality's "Missing LLM output validation" (which now
    // gates on the parser-computed `has_validation_call` body feature).
    it('no longer fabricates a per-function critical for LLM call sites', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'generateResponse',
        properties: {},
      });
      const rel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: 'model-1',
      });
      const ctx = makeContext(
        { function: [fn] },
        (id) => (id === fn.id ? [rel] : []),
      );

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Missing guardrails'))).toHaveLength(0);
      expect(findings.filter((f) => f.severity === 'critical')).toHaveLength(0);
    });
  });

  // ── Rule 4: Single Model Dependency ────────────────────────────────────

  describe('single model dependency', () => {
    it('detects all models using the same name', async () => {
      const model1 = makeEntity({
        type: 'model',
        name: 'gpt-4',
        properties: { model_name: 'gpt-4' },
      });
      const model2 = makeEntity({
        type: 'model',
        name: 'gpt-4',
        properties: { model_name: 'gpt-4' },
      });
      const ctx = makeContext({ model: [model1, model2] });

      const findings = await analyzer.analyze(ctx);

      const singleFindings = findings.filter((f) => f.title.includes('Single model dependency'));
      expect(singleFindings).toHaveLength(1);
      expect(singleFindings[0]!.severity).toBe('medium');
    });

    it('does not flag diverse model usage', async () => {
      const model1 = makeEntity({
        type: 'model',
        name: 'gpt-4',
        properties: { model_name: 'gpt-4' },
      });
      const model2 = makeEntity({
        type: 'model',
        name: 'claude-3-sonnet',
        properties: { model_name: 'claude-3-sonnet' },
      });
      const ctx = makeContext({ model: [model1, model2] });

      const findings = await analyzer.analyze(ctx);

      const singleFindings = findings.filter((f) => f.title.includes('Single model dependency'));
      expect(singleFindings).toHaveLength(0);
    });

    it('does not flag when fewer than 2 models exist', async () => {
      const model = makeEntity({
        type: 'model',
        name: 'gpt-4',
      });
      const ctx = makeContext({ model: [model] });

      const findings = await analyzer.analyze(ctx);

      const singleFindings = findings.filter((f) => f.title.includes('Single model dependency'));
      expect(singleFindings).toHaveLength(0);
    });
  });

  // ── Rule 4 (removed): Missing Streaming ────────────────────────────────

  describe('missing streaming (removed rule)', () => {
    it('never fabricates a streaming finding (rule removed: gated on markers no producer emits)', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'chatCompletion',
        tags: ['user-facing'],
      });
      const rel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: 'model-1',
      });
      const ctx = makeContext(
        { function: [fn] },
        (id) => (id === fn.id ? [rel] : []),
      );

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Missing streaming'))).toHaveLength(0);
    });
  });

  // ── Rule 6: Context Window Overflow ────────────────────────────────────

  describe('context window overflow', () => {
    it('detects prompts exceeding 80% of context window', async () => {
      // Default context limit is 8192 tokens, 80% = 6553 tokens
      // 6553 tokens * 4 chars/token = 26212 chars
      const largeContent = 'a'.repeat(28_000); // ~7000 tokens, > 80% of 8192
      const prompt = makeEntity({
        type: 'prompt',
        name: 'longPrompt',
        properties: { content: largeContent },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const overflowFindings = findings.filter((f) => f.title.includes('Context window overflow'));
      expect(overflowFindings).toHaveLength(1);
      expect(overflowFindings[0]!.severity).toBe('high');
    });

    it('does not flag small prompts', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'shortPrompt',
        properties: { content: 'You are a helpful assistant.' },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const overflowFindings = findings.filter((f) => f.title.includes('Context window overflow'));
      expect(overflowFindings).toHaveLength(0);
    });

    it('uses model-specific context limits when model is known', async () => {
      // gpt-3.5-turbo has 4096 limit, 80% = 3276 tokens = 13107 chars
      const content = 'b'.repeat(14_000); // ~3500 tokens, > 80% of 4096
      const prompt = makeEntity({
        type: 'prompt',
        name: 'gpt35Prompt',
        properties: { content, model: 'gpt-3.5-turbo' },
      });
      const ctx = makeContext({ prompt: [prompt] });

      const findings = await analyzer.analyze(ctx);

      const overflowFindings = findings.filter((f) => f.title.includes('Context window overflow'));
      expect(overflowFindings).toHaveLength(1);
      expect(overflowFindings[0]!.description).toContain('gpt-3.5-turbo');
    });
  });

  // ── Rule 7: Missing Cost Tracking ──────────────────────────────────────

  describe('missing cost tracking (systemic)', () => {
    // Per-function metering is unobservable to this pipeline (function
    // entities carry no body text), so the rule now emits AT MOST ONE
    // low-severity systemic finding, honestly worded as "not detectable".
    it('emits one systemic low finding when LLM usage has no detectable tracking', async () => {
      const fn1 = makeEntity({ type: 'function', name: 'generateText' });
      const fn2 = makeEntity({ type: 'function', name: 'summarize' });
      const rels = new Map([
        [fn1.id, [makeRel({ type: 'uses_model', source_id: fn1.id, target_id: 'model-1' })]],
        [fn2.id, [makeRel({ type: 'uses_model', source_id: fn2.id, target_id: 'model-1' })]],
      ]);
      const ctx = makeContext(
        { function: [fn1, fn2] },
        (id) => rels.get(id) ?? [],
      );

      const findings = await analyzer.analyze(ctx);

      const costFindings = findings.filter((f) => f.title.includes('Cost tracking not detectable'));
      expect(costFindings).toHaveLength(1);
      expect(costFindings[0]!.severity).toBe('low');
      expect(costFindings[0]!.description).toContain('2 function(s)');
      // No per-function "Missing cost tracking: fn" assertions remain.
      expect(findings.filter((f) => f.title.startsWith('Missing cost tracking:'))).toHaveLength(0);
    });

    it('stays silent when a function carries a cost-tracking marker', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'trackedGenerate',
        tags: ['cost-tracked'],
      });
      const rel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: 'model-1',
      });
      const ctx = makeContext(
        { function: [fn] },
        (id) => (id === fn.id ? [rel] : []),
      );

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Cost tracking'))).toHaveLength(0);
    });

    it('stays silent when cost metrics exist in the graph', async () => {
      const fn = makeEntity({ type: 'function', name: 'generateText' });
      const metric = makeEntity({ type: 'cost_metric', name: 'openai-spend' });
      const rel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: 'model-1',
      });
      const ctx = makeContext(
        { function: [fn], cost_metric: [metric] },
        (id) => (id === fn.id ? [rel] : []),
      );

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Cost tracking'))).toHaveLength(0);
    });

    it('stays silent when no LLM usage exists', async () => {
      const fn = makeEntity({ type: 'function', name: 'plainHelper' });
      const ctx = makeContext({ function: [fn] }, () => []);

      const findings = await analyzer.analyze(ctx);

      expect(findings.filter((f) => f.title.includes('Cost tracking'))).toHaveLength(0);
    });
  });

  // ── Rule 8: Stale Embeddings ───────────────────────────────────────────

  describe('stale embeddings', () => {
    it('detects embedding generation without refresh logic', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'generateEmbeddings',
        tags: ['embedding'],
      });
      const ctx = makeContext({ function: [fn], module: [], config: [] });

      const findings = await analyzer.analyze(ctx);

      const staleFindings = findings.filter((f) => f.title.includes('Stale embeddings'));
      expect(staleFindings).toHaveLength(1);
      expect(staleFindings[0]!.severity).toBe('low');
    });

    it('does not flag embedding functions with refresh logic', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'generateEmbeddings',
        tags: ['embedding', 'refresh'],
      });
      const ctx = makeContext({ function: [fn], module: [], config: [] });

      const findings = await analyzer.analyze(ctx);

      const staleFindings = findings.filter((f) => f.title.includes('Stale embeddings'));
      expect(staleFindings).toHaveLength(0);
    });

    it('does not flag non-embedding entities', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'regularFunction',
        properties: {},
      });
      const ctx = makeContext({ function: [fn], module: [], config: [] });

      const findings = await analyzer.analyze(ctx);

      const staleFindings = findings.filter((f) => f.title.includes('Stale embeddings'));
      expect(staleFindings).toHaveLength(0);
    });

    it('detects embedding via content pattern', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'indexDocuments',
        properties: { content: 'const embedding = await openai.embeddings.create(input)' },
      });
      const ctx = makeContext({ function: [fn], module: [], config: [] });

      const findings = await analyzer.analyze(ctx);

      const staleFindings = findings.filter((f) => f.title.includes('Stale embeddings'));
      expect(staleFindings).toHaveLength(1);
    });
  });

  // ── Full run with no entities ──────────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  // ── initialize and finalize ─────────────────────────────────────────────

  it('initialize resolves without error', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
  });

  it('finalize returns empty array', async () => {
    const ctx = makeContext();
    const finalized = await analyzer.finalize(ctx);
    expect(finalized).toEqual([]);
  });

  // ── Evidence and metadata ───────────────────────────────────────────────

  it('findings contain evidence with descriptions', async () => {
    const fn = makeEntity({
      type: 'function',
      name: 'unsafeLLM',
      properties: {},
    });
    const rel = makeRel({
      type: 'uses_model',
      source_id: fn.id,
      target_id: 'model-1',
    });
    const ctx = makeContext(
      { function: [fn] },
      (id) => (id === fn.id ? [rel] : []),
    );

    const findings = await analyzer.analyze(ctx);

    for (const finding of findings) {
      expect(finding.evidence.length).toBeGreaterThan(0);
      for (const ev of finding.evidence) {
        expect(ev.description).toBeTruthy();
        expect(ev.source).toBe('ai.runtime');
      }
    }
  });

  // ── Multiple rules fire on the same entity ──────────────────────────────

  it('fires the honest systemic rules on an unguarded LLM call (no fabricated per-function findings)', async () => {
    // A user-facing function that uses a model with no observable rate-limiting
    // or cost-tracking signal. The honest rule set now emits SYSTEMIC findings
    // (rate-limiting + cost-tracking "not detectable"), and must NOT fabricate
    // the removed per-function "missing guardrails"/"missing streaming" rules
    // (they keyed off markers no producer emits).
    const fn = makeEntity({
      type: 'function',
      name: 'rawLLMCall',
      tags: ['user-facing'],
      properties: {},
    });
    const rel = makeRel({
      type: 'uses_model',
      source_id: fn.id,
      target_id: 'model-1',
    });
    const ctx = makeContext(
      { function: [fn] },
      (id) => (id === fn.id ? [rel] : []),
    );

    const findings = await analyzer.analyze(ctx);

    expect(findings.some((f) => f.title.includes('Rate limiting not detectable'))).toBe(true);
    expect(findings.some((f) => f.title.includes('Cost tracking'))).toBe(true);
    // Removed rules must not reappear.
    expect(findings.some((f) => f.title.includes('Missing guardrails'))).toBe(false);
    expect(findings.some((f) => f.title.includes('Missing streaming'))).toBe(false);
  });
});

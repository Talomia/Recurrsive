/**
 * Tests for AIAnalyzer.
 *
 * Covers all 10 rules: hardcoded models, missing error handling,
 * no fallback provider, prompt injection risk, missing output
 * validation, agent loop risk, token waste, missing evaluations,
 * hardcoded temperature, and missing system prompt.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AIAnalyzer } from '../../ai/analyzer.js';
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

describe('AIAnalyzer', () => {
  let analyzer: AIAnalyzer;

  beforeEach(() => {
    analyzer = new AIAnalyzer();
    _idCounter = 0;
  });

  // ── Metadata ─────────────────────────────────────────────────────────

  it('has correct metadata', () => {
    expect(analyzer.id).toBe('ai.quality');
    expect(analyzer.name).toBe('AI Quality Analyzer');
    expect(analyzer.categories).toContain('ai_quality');
  });

  // ── Rule 1: Hardcoded Models ───────────────────────────────────────

  describe('hardcoded models', () => {
    it('detects hardcoded "gpt-4" in source files', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'chat.ts',
        properties: { content: 'const model = "gpt-4-turbo";' },
      });
      const ctx = makeContext({ file: [file], config: [] });

      const findings = await analyzer.analyze(ctx);

      const modelFindings = findings.filter((f) => f.title.includes('Hardcoded model'));
      expect(modelFindings).toHaveLength(1);
      expect(modelFindings[0]!.severity).toBe('medium');
    });

    it('detects hardcoded "claude" model names', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'agent.ts',
        properties: { content: "const m = 'claude-3-opus';" },
      });
      const ctx = makeContext({ file: [file], config: [] });

      const findings = await analyzer.analyze(ctx);

      const modelFindings = findings.filter((f) => f.title.includes('Hardcoded model'));
      expect(modelFindings).toHaveLength(1);
    });

    it('skips config files', async () => {
      const configFile = makeEntity({
        type: 'file',
        name: 'model.config.ts',
        properties: { content: 'const model = "gpt-4";' },
      });
      const ctx = makeContext({ file: [configFile], config: [] });

      const findings = await analyzer.analyze(ctx);

      const modelFindings = findings.filter((f) => f.title.includes('Hardcoded model'));
      expect(modelFindings).toHaveLength(0);
    });

    it('skips .env files', async () => {
      const envFile = makeEntity({
        type: 'file',
        name: '.env.local',
        properties: { content: 'MODEL="gpt-4"' },
      });
      const ctx = makeContext({ file: [envFile], config: [] });

      const findings = await analyzer.analyze(ctx);

      const modelFindings = findings.filter((f) => f.title.includes('Hardcoded model'));
      expect(modelFindings).toHaveLength(0);
    });

    it('produces no finding for clean files', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'service.ts',
        properties: { content: 'const model = config.get("model");' },
      });
      const ctx = makeContext({ file: [file], config: [] });

      const findings = await analyzer.analyze(ctx);

      const modelFindings = findings.filter((f) => f.title.includes('Hardcoded model'));
      expect(modelFindings).toHaveLength(0);
    });
  });

  // ── Rule 2: Missing Error Handling ─────────────────────────────────

  describe('missing error handling', () => {
    it('detects LLM calls without try/catch', async () => {
      const fn = makeEntity({ type: 'function', name: 'generateText' });
      const modelRel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: nextId(),
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === fn.id && dir === 'out') return [modelRel];
        return [];
      };

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('without error handling'));
      expect(errFindings).toHaveLength(1);
      expect(errFindings[0]!.severity).toBe('high');
    });

    it('skips functions with error handling', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'safeGenerate',
        properties: { has_try_catch: true },
      });
      const modelRel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: nextId(),
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === fn.id && dir === 'out') return [modelRel];
        return [];
      };

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('without error handling'));
      expect(errFindings).toHaveLength(0);
    });

    it('skips functions that do not call models', async () => {
      const fn = makeEntity({ type: 'function', name: 'plainHelper' });

      const relsFn: GetRelsFn = () => [];

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('without error handling'));
      expect(errFindings).toHaveLength(0);
    });

    it('detects invokes_agent without error handling', async () => {
      const fn = makeEntity({ type: 'function', name: 'callAgent' });
      const agentRel = makeRel({
        type: 'invokes_agent',
        source_id: fn.id,
        target_id: nextId(),
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === fn.id && dir === 'out') return [agentRel];
        return [];
      };

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const errFindings = findings.filter((f) => f.title.includes('without error handling'));
      expect(errFindings).toHaveLength(1);
    });
  });

  // ── Rule 3: No Fallback Provider ───────────────────────────────────

  describe('no fallback provider', () => {
    it('detects single provider usage', async () => {
      const model1 = makeEntity({
        type: 'model',
        name: 'gpt-4',
        properties: { provider: 'openai' },
      });
      const model2 = makeEntity({
        type: 'model',
        name: 'gpt-3.5',
        properties: { provider: 'openai' },
      });

      const ctx = makeContext({ model: [model1, model2] });
      const findings = await analyzer.analyze(ctx);

      const fallbackFindings = findings.filter((f) => f.title.includes('Single AI provider'));
      expect(fallbackFindings).toHaveLength(1);
      expect(fallbackFindings[0]!.severity).toBe('medium');
    });

    it('produces no finding with multiple providers', async () => {
      const model1 = makeEntity({
        type: 'model',
        name: 'gpt-4',
        properties: { provider: 'openai' },
      });
      const model2 = makeEntity({
        type: 'model',
        name: 'claude-3',
        properties: { provider: 'anthropic' },
      });

      const ctx = makeContext({ model: [model1, model2] });
      const findings = await analyzer.analyze(ctx);

      const fallbackFindings = findings.filter((f) => f.title.includes('Single AI provider'));
      expect(fallbackFindings).toHaveLength(0);
    });

    it('produces no finding when no models exist', async () => {
      const ctx = makeContext({ model: [] });
      const findings = await analyzer.analyze(ctx);

      const fallbackFindings = findings.filter((f) => f.title.includes('Single AI provider'));
      expect(fallbackFindings).toHaveLength(0);
    });

    it('detects provider from tags', async () => {
      const model = makeEntity({
        type: 'model',
        name: 'my-model',
        tags: ['google'],
      });

      const ctx = makeContext({ model: [model] });
      const findings = await analyzer.analyze(ctx);

      const fallbackFindings = findings.filter((f) => f.title.includes('Single AI provider'));
      expect(fallbackFindings).toHaveLength(1);
      expect(fallbackFindings[0]!.title).toContain('google');
    });
  });

  // ── Rule 4: Prompt Injection Risk ──────────────────────────────────

  describe('prompt injection risk', () => {
    it('detects prompts with {user_input} without sanitization', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'chat-prompt',
        properties: { template: 'Answer the {user_input} question.' },
      });

      const ctx = makeContext({ prompt: [prompt] });
      const findings = await analyzer.analyze(ctx);

      const injFindings = findings.filter((f) => f.title.includes('Prompt injection'));
      expect(injFindings).toHaveLength(1);
      expect(injFindings[0]!.severity).toBe('high');
    });

    it('detects prompts with ${userInput} template literals', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'template-prompt',
        properties: { content: 'Process: ${userInput}' },
      });

      const ctx = makeContext({ prompt: [prompt] });
      const findings = await analyzer.analyze(ctx);

      const injFindings = findings.filter((f) => f.title.includes('Prompt injection'));
      expect(injFindings).toHaveLength(1);
    });

    it('skips sanitized prompts', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'safe-prompt',
        properties: { template: 'Answer the {user_input} question.' },
        tags: ['sanitized'],
      });

      const ctx = makeContext({ prompt: [prompt] });
      const findings = await analyzer.analyze(ctx);

      const injFindings = findings.filter((f) => f.title.includes('Prompt injection'));
      expect(injFindings).toHaveLength(0);
    });

    it('detects prompts tagged with user-input', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'user-prompt',
        tags: ['user-input'],
      });

      const ctx = makeContext({ prompt: [prompt] });
      const findings = await analyzer.analyze(ctx);

      const injFindings = findings.filter((f) => f.title.includes('Prompt injection'));
      expect(injFindings).toHaveLength(1);
    });
  });

  // ── Rule 5: Missing Output Validation ──────────────────────────────

  describe('missing output validation', () => {
    it('detects functions using model without output validation', async () => {
      const fn = makeEntity({ type: 'function', name: 'getCompletion' });
      const modelRel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: nextId(),
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === fn.id && dir === 'out') return [modelRel];
        return [];
      };

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing LLM output validation'));
      expect(valFindings).toHaveLength(1);
      expect(valFindings[0]!.severity).toBe('medium');
    });

    it('skips functions with zod validation', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'parseCompletion',
        properties: { uses_zod: true },
      });
      const modelRel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: nextId(),
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === fn.id && dir === 'out') return [modelRel];
        return [];
      };

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing LLM output validation'));
      expect(valFindings).toHaveLength(0);
    });

    it('skips functions tagged with output-validated', async () => {
      const fn = makeEntity({
        type: 'function',
        name: 'validated',
        tags: ['output-validated'],
      });
      const modelRel = makeRel({
        type: 'uses_model',
        source_id: fn.id,
        target_id: nextId(),
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === fn.id && dir === 'out') return [modelRel];
        return [];
      };

      const ctx = makeContext({ function: [fn] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const valFindings = findings.filter((f) => f.title.includes('Missing LLM output validation'));
      expect(valFindings).toHaveLength(0);
    });
  });

  // ── Rule 6: Agent Loop Risk ────────────────────────────────────────

  describe('agent loop risk', () => {
    it('detects agents without max iterations or termination condition', async () => {
      const agent = makeEntity({ type: 'agent', name: 'researcher' });

      const ctx = makeContext({ agent: [agent] });
      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Agent loop risk'));
      expect(loopFindings).toHaveLength(1);
      expect(loopFindings[0]!.severity).toBe('critical');
    });

    it('skips agents with max_iterations', async () => {
      const agent = makeEntity({
        type: 'agent',
        name: 'bounded-agent',
        properties: { max_iterations: 10 },
      });

      const ctx = makeContext({ agent: [agent] });
      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Agent loop risk'));
      expect(loopFindings).toHaveLength(0);
    });

    it('skips agents tagged with bounded-loop', async () => {
      const agent = makeEntity({
        type: 'agent',
        name: 'safe-agent',
        tags: ['bounded-loop'],
      });

      const ctx = makeContext({ agent: [agent] });
      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Agent loop risk'));
      expect(loopFindings).toHaveLength(0);
    });

    it('skips agents with termination_condition', async () => {
      const agent = makeEntity({
        type: 'agent',
        name: 'cond-agent',
        properties: { termination_condition: 'goal_reached' },
      });

      const ctx = makeContext({ agent: [agent] });
      const findings = await analyzer.analyze(ctx);

      const loopFindings = findings.filter((f) => f.title.includes('Agent loop risk'));
      expect(loopFindings).toHaveLength(0);
    });
  });

  // ── Rule 7: Token Waste ────────────────────────────────────────────

  describe('token waste', () => {
    it('detects large static prompts (>2000 estimated tokens)', async () => {
      // 2001 tokens * 4 chars/token = 8004 chars
      const largeContent = 'x'.repeat(8004);
      const prompt = makeEntity({
        type: 'prompt',
        name: 'big-prompt',
        properties: { template: largeContent },
      });

      const ctx = makeContext({ prompt: [prompt] });
      const findings = await analyzer.analyze(ctx);

      const tokenFindings = findings.filter((f) => f.title.includes('Large static prompt'));
      expect(tokenFindings).toHaveLength(1);
      expect(tokenFindings[0]!.severity).toBe('low');
    });

    it('does not flag small prompts', async () => {
      const prompt = makeEntity({
        type: 'prompt',
        name: 'small-prompt',
        properties: { template: 'Summarize the text.' },
      });

      const ctx = makeContext({ prompt: [prompt] });
      const findings = await analyzer.analyze(ctx);

      const tokenFindings = findings.filter((f) => f.title.includes('Large static prompt'));
      expect(tokenFindings).toHaveLength(0);
    });
  });

  // ── Rule 8: Missing Evaluations ────────────────────────────────────

  describe('missing evaluations', () => {
    it('detects agents without evaluation pipelines', async () => {
      const agent = makeEntity({ type: 'agent', name: 'untested-agent' });

      const relsFn: GetRelsFn = () => [];

      const ctx = makeContext(
        { agent: [agent], workflow: [], evaluation: [] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const evalFindings = findings.filter((f) => f.title.includes('Missing evaluation'));
      expect(evalFindings).toHaveLength(1);
      expect(evalFindings[0]!.severity).toBe('medium');
    });

    it('skips agents that have evaluates_with relationships', async () => {
      const agent = makeEntity({ type: 'agent', name: 'tested-agent' });
      const evalEntity = makeEntity({ type: 'evaluation', name: 'eval-suite' });

      const evalRel = makeRel({
        type: 'evaluates_with',
        source_id: agent.id,
        target_id: evalEntity.id,
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === agent.id && dir === 'both') return [evalRel];
        if (id === evalEntity.id && dir === 'out') return [];
        if (id === evalEntity.id && dir === 'in') return [];
        return [];
      };

      const ctx = makeContext(
        { agent: [agent], workflow: [], evaluation: [evalEntity] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const evalFindings = findings.filter((f) => f.title.includes('Missing evaluation'));
      expect(evalFindings).toHaveLength(0);
    });

    it('detects AI workflows without evaluations', async () => {
      const workflow = makeEntity({
        type: 'workflow',
        name: 'rag-pipeline',
        tags: ['ai'],
      });

      const relsFn: GetRelsFn = () => [];

      const ctx = makeContext(
        { agent: [], workflow: [workflow], evaluation: [] },
        relsFn,
      );
      const findings = await analyzer.analyze(ctx);

      const evalFindings = findings.filter((f) => f.title.includes('Missing evaluation'));
      expect(evalFindings).toHaveLength(1);
    });

    it('ignores non-AI workflows', async () => {
      const workflow = makeEntity({
        type: 'workflow',
        name: 'ci-pipeline',
        tags: ['ci'],
      });

      const ctx = makeContext(
        { agent: [], workflow: [workflow], evaluation: [] },
      );
      const findings = await analyzer.analyze(ctx);

      const evalFindings = findings.filter((f) => f.title.includes('Missing evaluation'));
      expect(evalFindings).toHaveLength(0);
    });
  });

  // ── Rule 9: Hardcoded Temperature ──────────────────────────────────

  describe('hardcoded temperature', () => {
    it('detects temperature= in source files', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'llm.ts',
        properties: { content: 'const opts = { temperature: 0.7 };' },
      });

      const ctx = makeContext({ file: [file] });
      const findings = await analyzer.analyze(ctx);

      const tempFindings = findings.filter((f) => f.title.includes('Hardcoded temperature'));
      expect(tempFindings).toHaveLength(1);
      expect(tempFindings[0]!.severity).toBe('low');
    });

    it('skips config files for temperature check', async () => {
      const configFile = makeEntity({
        type: 'file',
        name: 'ai.config.ts',
        properties: { content: 'temperature = 0.5' },
      });

      const ctx = makeContext({ file: [configFile] });
      const findings = await analyzer.analyze(ctx);

      const tempFindings = findings.filter((f) => f.title.includes('Hardcoded temperature'));
      expect(tempFindings).toHaveLength(0);
    });

    it('produces no finding when no temperature pattern found', async () => {
      const file = makeEntity({
        type: 'file',
        name: 'utils.ts',
        properties: { content: 'function helper() { return 42; }' },
      });

      const ctx = makeContext({ file: [file] });
      const findings = await analyzer.analyze(ctx);

      const tempFindings = findings.filter((f) => f.title.includes('Hardcoded temperature'));
      expect(tempFindings).toHaveLength(0);
    });
  });

  // ── Rule 10: Missing System Prompt ─────────────────────────────────

  describe('missing system prompt', () => {
    it('detects agents without system prompt', async () => {
      const agent = makeEntity({ type: 'agent', name: 'bare-agent' });

      const relsFn: GetRelsFn = () => [];

      const ctx = makeContext({ agent: [agent] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const sysFindings = findings.filter((f) => f.title.includes('Missing system prompt'));
      expect(sysFindings).toHaveLength(1);
      expect(sysFindings[0]!.severity).toBe('medium');
    });

    it('skips agents with system_prompt property', async () => {
      const agent = makeEntity({
        type: 'agent',
        name: 'prompted-agent',
        properties: { system_prompt: 'You are a helpful assistant.' },
      });

      const relsFn: GetRelsFn = () => [];

      const ctx = makeContext({ agent: [agent] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const sysFindings = findings.filter((f) => f.title.includes('Missing system prompt'));
      expect(sysFindings).toHaveLength(0);
    });

    it('skips agents with has_prompt relationship', async () => {
      const agent = makeEntity({ type: 'agent', name: 'rel-agent' });
      const promptRel = makeRel({
        type: 'has_prompt',
        source_id: agent.id,
        target_id: nextId(),
      });

      const relsFn: GetRelsFn = (id, dir) => {
        if (id === agent.id && dir === 'out') return [promptRel];
        return [];
      };

      const ctx = makeContext({ agent: [agent] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const sysFindings = findings.filter((f) => f.title.includes('Missing system prompt'));
      expect(sysFindings).toHaveLength(0);
    });

    it('skips agents tagged with has-system-prompt', async () => {
      const agent = makeEntity({
        type: 'agent',
        name: 'tagged-agent',
        tags: ['has-system-prompt'],
      });

      const relsFn: GetRelsFn = () => [];

      const ctx = makeContext({ agent: [agent] }, relsFn);
      const findings = await analyzer.analyze(ctx);

      const sysFindings = findings.filter((f) => f.title.includes('Missing system prompt'));
      expect(sysFindings).toHaveLength(0);
    });
  });

  // ── Empty graph & lifecycle ────────────────────────────────────────

  it('produces no findings on an empty graph', async () => {
    const ctx = makeContext();
    const findings = await analyzer.analyze(ctx);
    expect(findings).toHaveLength(0);
  });

  it('initialize and finalize are no-ops', async () => {
    const ctx = makeContext();
    await expect(analyzer.initialize(ctx)).resolves.toBeUndefined();
    const finalized = await analyzer.finalize(ctx);
    expect(finalized).toEqual([]);
  });
});

/**
 * Tests for the ReasoningEngine with mocked LLM and graph dependencies.
 *
 * Covers: instantiation with config, full pipeline with mocked deps,
 * graceful handling of individual specialist failures, and empty inputs.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReasoningEngine } from '../engine.js';
import { ReasoningError } from '@recurrsive/core';
import type {
  ReasoningConfig,
  Finding,
  GraphClient,
} from '@recurrsive/core';

// ---------------------------------------------------------------------------
// We need to mock the dependencies that ReasoningEngine imports
// ---------------------------------------------------------------------------

// Mock createLLMAdapter
vi.mock('../llm/index.js', () => ({
  createLLMAdapter: vi.fn(() => ({
    chat: vi.fn().mockResolvedValue({
      content: 'mocked response',
      usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
      model: 'test-model',
      finish_reason: 'stop',
    }),
    chatJSON: vi.fn().mockResolvedValue({ hypotheses: [] }),
    getModel: vi.fn(() => 'test-model'),
    getProvider: vi.fn(() => 'test-provider'),
  })),
}));

// Mock createDefaultSpecialists to return controllable mocks
vi.mock('../specialists/index.js', () => ({
  createDefaultSpecialists: vi.fn(() => [
    {
      role: 'architecture_engineer',
      name: 'Mock Architecture Engineer',
      cognitiveFramework: 'test',
      systemPrompt: 'test',
      analyzeFindings: vi.fn().mockResolvedValue([]),
      challenge: vi.fn().mockResolvedValue('mock challenge'),
      defend: vi.fn().mockResolvedValue({ response: 'mock defense', revised_confidence: 0.7 }),
    },
    {
      role: 'security_engineer',
      name: 'Mock Security Engineer',
      cognitiveFramework: 'test',
      systemPrompt: 'test',
      analyzeFindings: vi.fn().mockResolvedValue([]),
      challenge: vi.fn().mockResolvedValue('mock challenge'),
      defend: vi.fn().mockResolvedValue({ response: 'mock defense', revised_confidence: 0.7 }),
    },
  ]),
}));

// Mock DebateProtocol
vi.mock('../debate/protocol.js', () => ({
  DebateProtocol: vi.fn().mockImplementation(() => ({
    execute: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock Synthesizer
vi.mock('../synthesizer/synthesizer.js', () => ({
  Synthesizer: vi.fn().mockImplementation(() => ({
    synthesize: vi.fn().mockResolvedValue([]),
  })),
}));

// Mock FileMemoryStore
vi.mock('../memory/store.js', () => ({
  FileMemoryStore: vi.fn().mockImplementation(() => ({
    recordDecision: vi.fn(),
    recordOutcome: vi.fn(),
    getSpecialistAccuracy: vi.fn().mockResolvedValue({ correct: 0, total: 0, accuracy: 0 }),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ReasoningConfig> = {}): ReasoningConfig {
  return {
    llm_provider: 'openai',
    llm_model: 'gpt-4.1-mini',
    llm_api_key: 'test-key',
    max_debate_rounds: 3,
    min_consensus_score: 0.6,
    specialists: ['architecture_engineer', 'security_engineer'],
    temperature: 0.3,
    ...overrides,
  };
}

function makeFinding(id: string): Finding {
  const now = new Date().toISOString();
  return {
    id,
    analyzer_id: 'test-analyzer',
    title: `Finding ${id}`,
    description: `Description for ${id}`,
    severity: 'medium',
    category: 'architecture',
    evidence: [],
    locations: [],
    confidence: 0.8,
    tags: ['test'],
    created_at: now,
  };
}

function makeGraphClient(): GraphClient {
  return {
    getEntity: vi.fn().mockResolvedValue(null),
    getEntities: vi.fn().mockResolvedValue([]),
    getRelationships: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue([]),
    getNeighbors: vi.fn().mockResolvedValue({ entities: [], relationships: [] }),
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('ReasoningEngine', () => {
  let config: ReasoningConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = makeConfig();
  });

  // ── Instantiation ──────────────────────────────────────────────────────

  describe('instantiation', () => {
    it('creates an engine with valid config', () => {
      const engine = new ReasoningEngine(config);
      expect(engine).toBeDefined();
    });

    it('creates an engine with custom memory path', () => {
      const engine = new ReasoningEngine(config, '/tmp/test-memory');
      expect(engine).toBeDefined();
    });

    it('exposes LLM adapter', () => {
      const engine = new ReasoningEngine(config);
      const llm = engine.getLLM();
      expect(llm.getModel()).toBe('test-model');
      expect(llm.getProvider()).toBe('test-provider');
    });

    it('exposes specialists', () => {
      const engine = new ReasoningEngine(config);
      const specialists = engine.getSpecialists();
      expect(specialists.length).toBeGreaterThan(0);
    });

    it('exposes memory store', () => {
      const engine = new ReasoningEngine(config);
      const memory = engine.getMemory();
      expect(memory).toBeDefined();
    });

    it('throws if no specialists match configured roles', () => {
      const badConfig = makeConfig({
        specialists: ['backend_engineer' as any], // not in default list
      });

      // The mock only returns architecture_engineer and security_engineer,
      // so backend_engineer won't match any
      expect(() => new ReasoningEngine(badConfig)).toThrow(ReasoningError);
    });
  });

  // ── Process with empty findings ──────────────────────────────────────────

  describe('process with empty findings', () => {
    it('returns empty result for empty findings array', async () => {
      const engine = new ReasoningEngine(config);
      const graph = makeGraphClient();
      const result = await engine.process([], graph);

      expect(result.hypotheses).toEqual([]);
      expect(result.rounds).toEqual([]);
      expect(result.final_rankings).toEqual([]);
      expect(result.opportunities).toEqual([]);
    });
  });

  // ── Full pipeline with mocked dependencies ──────────────────────────────

  describe('full pipeline', () => {
    it('runs the full pipeline and returns a ConsensusResult', async () => {
      const engine = new ReasoningEngine(config);
      const graph = makeGraphClient();
      const findings = [
        makeFinding('00000000-0000-4000-8000-000000000001'),
        makeFinding('00000000-0000-4000-8000-000000000002'),
      ];

      const result = await engine.process(findings, graph);

      expect(result).toHaveProperty('hypotheses');
      expect(result).toHaveProperty('rounds');
      expect(result).toHaveProperty('final_rankings');
      expect(result).toHaveProperty('opportunities');
    });

    it('calls specialist analyzeFindings for each specialist', async () => {
      const engine = new ReasoningEngine(config);
      const specialists = engine.getSpecialists();
      const graph = makeGraphClient();
      const findings = [makeFinding('00000000-0000-4000-8000-000000000001')];

      await engine.process(findings, graph);

      // Each specialist's analyzeFindings should have been called
      for (const specialist of specialists) {
        expect(specialist.analyzeFindings).toHaveBeenCalledWith(
          findings,
          expect.anything(),
          graph,
        );
      }
    });
  });

  // ── Graceful specialist failure handling ──────────────────────────────────

  describe('graceful specialist failure', () => {
    it('continues when individual specialist fails', async () => {
      const engine = new ReasoningEngine(config);
      const specialists = engine.getSpecialists();

      // Make the first specialist throw
      (specialists[0]!.analyzeFindings as ReturnType<typeof vi.fn>)
        .mockRejectedValue(new Error('Specialist crashed'));

      // Second specialist produces a hypothesis
      (specialists[1]!.analyzeFindings as ReturnType<typeof vi.fn>)
        .mockResolvedValue([
          {
            id: '00000000-0000-4000-8000-000000000099',
            finding_ids: [],
            title: 'Test Hypothesis',
            description: 'From specialist 2',
            proposed_by: 'security_engineer',
            confidence: 0.8,
            evidence_strength: 0.7,
            impact_estimate: 'High',
            effort_estimate: 'Medium',
            risk_level: 'Low',
            supporting_arguments: [],
            counter_arguments: [],
            assumptions: [],
          },
        ]);

      const graph = makeGraphClient();
      const findings = [makeFinding('00000000-0000-4000-8000-000000000001')];

      // Should not throw even though one specialist failed
      const result = await engine.process(findings, graph);
      expect(result).toBeDefined();
    });

    it('returns empty hypotheses when all specialists fail', async () => {
      const engine = new ReasoningEngine(config);
      const specialists = engine.getSpecialists();

      // All specialists fail
      for (const s of specialists) {
        (s.analyzeFindings as ReturnType<typeof vi.fn>)
          .mockRejectedValue(new Error('Crashed'));
      }

      const graph = makeGraphClient();
      const findings = [makeFinding('00000000-0000-4000-8000-000000000001')];

      const result = await engine.process(findings, graph);
      expect(result.hypotheses).toEqual([]);
      expect(result.opportunities).toEqual([]);
    });
  });

  // ── Config variations ────────────────────────────────────────────────────

  describe('config variations', () => {
    it('uses all specialists when specialists array is empty', () => {
      // When specialists config is empty, all should be used
      // But the mock only returns architecture_engineer and security_engineer
      // so this would work as long as the filter passes through
      const allConfig = makeConfig({ specialists: [] });

      // Empty array means "use all" per the engine logic
      const engine = new ReasoningEngine(allConfig);
      const specialists = engine.getSpecialists();
      expect(specialists.length).toBe(2); // from our mock
    });
  });
});

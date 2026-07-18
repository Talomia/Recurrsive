/**
 * Tests for the multi-agent DebateProtocol.
 *
 * Covers the protocol invariants that the synthesizer and consensus logic rely
 * on: specialists challenge only OTHER specialists' hypotheses, every recorded
 * challenge pairs with exactly one recorded response, a failed challenge
 * records neither (keeping the arrays length-aligned), and defended confidence
 * revisions flow into the round snapshot.
 */

import { describe, it, expect, vi } from 'vitest';
import type { GraphClient, Hypothesis, LLMAdapter, LLMResponse } from '@recurrsive/core';
import { DebateProtocol } from '../../debate/protocol.js';
import type { Specialist } from '../../specialists/base.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLLM(): LLMAdapter {
  return {
    getModel: () => 'test-model',
    getProvider: () => 'test-provider',
    chat: vi.fn().mockResolvedValue({
      content: '', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: 'test-model', finish_reason: 'stop',
    } satisfies LLMResponse),
    chatJSON: vi.fn().mockResolvedValue({}),
  } as unknown as LLMAdapter;
}

function makeGraph(): GraphClient {
  return {
    getEntity: vi.fn().mockResolvedValue(null),
    getEntities: vi.fn().mockResolvedValue([]),
    getRelationships: vi.fn().mockResolvedValue([]),
    query: vi.fn().mockResolvedValue([]),
    getNeighbors: vi.fn().mockResolvedValue({ entities: [], relationships: [] }),
  } as unknown as GraphClient;
}

function makeSpecialist(role: string, overrides: Partial<Specialist> = {}): Specialist {
  return {
    role,
    name: `Mock ${role}`,
    cognitiveFramework: 'test-framework',
    systemPrompt: 'test',
    analyzeFindings: vi.fn().mockResolvedValue([]),
    challenge: vi.fn().mockResolvedValue(`challenge from ${role}`),
    defend: vi.fn().mockResolvedValue({ response: 'defense', revised_confidence: 0.7 }),
    ...overrides,
  } as unknown as Specialist;
}

function makeHypothesis(id: string, proposedBy: string, confidence = 0.8): Hypothesis {
  return {
    id,
    finding_ids: [`f-${id}`],
    title: `Hypothesis ${id}`,
    description: `Description ${id}`,
    proposed_by: proposedBy,
    confidence,
    evidence_strength: 0.7,
    impact_estimate: 'medium',
    effort_estimate: 'medium',
    risk_level: 'medium',
    supporting_arguments: [],
    counter_arguments: [],
    assumptions: [],
  } as unknown as Hypothesis;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DebateProtocol', () => {
  it('returns no rounds when there are no hypotheses', async () => {
    const protocol = new DebateProtocol(makeLLM(), 3, 0.6);
    const rounds = await protocol.execute([], [makeSpecialist('architecture_engineer')], makeGraph());
    expect(rounds).toEqual([]);
  });

  it('returns no rounds when there are no specialists', async () => {
    const protocol = new DebateProtocol(makeLLM(), 3, 0.6);
    const rounds = await protocol.execute([makeHypothesis('h1', 'architecture_engineer')], [], makeGraph());
    expect(rounds).toEqual([]);
  });

  it('specialists only challenge OTHER specialists hypotheses, with paired responses', async () => {
    const arch = makeSpecialist('architecture_engineer');
    const sec = makeSpecialist('security_engineer');
    const protocol = new DebateProtocol(makeLLM(), 1, 1.1 /* unreachable → run the single round */);

    const hypotheses = [
      makeHypothesis('h-arch', 'architecture_engineer'),
      makeHypothesis('h-sec', 'security_engineer'),
    ];
    const rounds = await protocol.execute(hypotheses, [arch, sec], makeGraph());

    expect(rounds).toHaveLength(1);
    const round = rounds[0]!;
    // arch challenges h-sec, sec challenges h-arch → 2 challenges, 2 responses.
    expect(round.challenges).toHaveLength(2);
    expect(round.responses).toHaveLength(round.challenges.length);

    // No specialist challenged its own hypothesis.
    for (const c of round.challenges) {
      const challenged = hypotheses.find((h) => h.id === c.hypothesis_id)!;
      expect(challenged.proposed_by).not.toBe(c.challenger);
    }
    // The proposer defends its own hypothesis.
    expect(arch.challenge).toHaveBeenCalled();
    expect(sec.challenge).toHaveBeenCalled();
  });

  it('records a failed challenge as an UNRESOLVED exchange, not a silent drop', async () => {
    const arch = makeSpecialist('architecture_engineer', {
      challenge: vi.fn().mockRejectedValue(new Error('challenge boom')),
    });
    const sec = makeSpecialist('security_engineer');
    const protocol = new DebateProtocol(makeLLM(), 1, 1.1);

    const hypotheses = [
      makeHypothesis('h-arch', 'architecture_engineer'),
      makeHypothesis('h-sec', 'security_engineer'),
    ];
    const round = (await protocol.execute(hypotheses, [arch, sec], makeGraph()))[0]!;

    // Both challenges are recorded (arch's failed, sec's succeeded); a failed
    // challenge must not be silently dropped — otherwise a round of all-failed
    // challenges would look like "nothing disputed → agreement". Arrays stay
    // aligned (one response per challenge).
    expect(round.challenges).toHaveLength(2);
    expect(round.responses).toHaveLength(2);

    // arch challenged h-sec and failed → that exchange is marked unresolved.
    const archResp = round.responses.find((r) => r.hypothesis_id === 'h-sec');
    expect(archResp?.unresolved).toBe(true);

    // sec challenged h-arch and succeeded → a normal, resolved exchange.
    const secChallenge = round.challenges.find((c) => c.challenger === 'security_engineer');
    expect(secChallenge?.hypothesis_id).toBe('h-arch');
    const secResp = round.responses.find((r) => r.hypothesis_id === 'h-arch');
    expect(secResp?.unresolved).toBeFalsy();
  });

  it('applies the defender revised confidence into the round hypotheses snapshot', async () => {
    const arch = makeSpecialist('architecture_engineer', {
      // When arch defends h-arch, it lowers its confidence to 0.4.
      defend: vi.fn().mockResolvedValue({ response: 'conceding', revised_confidence: 0.4 }),
    });
    const sec = makeSpecialist('security_engineer');
    const protocol = new DebateProtocol(makeLLM(), 1, 1.1);

    const hypotheses = [
      makeHypothesis('h-arch', 'architecture_engineer', 0.8),
      makeHypothesis('h-sec', 'security_engineer', 0.8),
    ];
    const round = (await protocol.execute(hypotheses, [arch, sec], makeGraph()))[0]!;

    const revisedArch = round.hypotheses.find((h) => h.id === 'h-arch')!;
    expect(revisedArch.confidence).toBe(0.4);
  });
});

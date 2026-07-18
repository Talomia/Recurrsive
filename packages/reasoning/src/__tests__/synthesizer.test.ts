import { describe, it, expect } from 'vitest';
import { Synthesizer } from '../synthesizer/synthesizer.js';
import type { LLMAdapter, LLMMessage, LLMOptions, LLMResponse } from '../llm/adapter.js';
import type { Hypothesis, Finding } from '@recurrsive/core';

/** Minimal LLM adapter that returns a valid opportunity detail and counts calls. */
class MockLLM implements LLMAdapter {
  public calls = 0;
  async chat(_m: LLMMessage[], _o?: LLMOptions): Promise<LLMResponse> {
    return { content: '{}', model: 'mock', usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }
  async chatJSON<T>(_m: LLMMessage[], _s: object, _o?: LLMOptions): Promise<T> {
    this.calls++;
    return {
      type: 'debt', category: 'dependency', severity: 'high',
      problem: 'p', recommendation: 'r',
      impact: { summary: 's', metrics: [], affected_services: [] },
      effort: { t_shirt: 's', skills_required: [], dependencies: [] },
      risk: { level: 'low', description: 'd', mitigations: [] },
      validation: { steps: [], success_criteria: [] },
      rollback: { strategy: 'manual', steps: [] },
    } as unknown as T;
  }
  getModel(): string { return 'mock'; }
  getProvider(): string { return 'mock'; }
}

function hyp(id: string, findingIds: string[], title: string, confidence: number): Hypothesis {
  return {
    id, finding_ids: findingIds, title, description: 'desc',
    proposed_by: 'architecture' as Hypothesis['proposed_by'],
    confidence, evidence_strength: 0.8,
    impact_estimate: 'medium', effort_estimate: 'small', risk_level: 'low',
    supporting_arguments: [], counter_arguments: [], assumptions: [],
  } as Hypothesis;
}

/** Minimal real finding so cited finding_ids resolve (evidence-validation). */
function finding(id: string): Finding {
  return {
    id, analyzer_id: 'test-analyzer', title: `Finding ${id}`,
    description: `Description for ${id}`, severity: 'high', category: 'architecture',
    evidence: [], locations: [], confidence: 0.8, tags: [],
    created_at: new Date().toISOString(),
  } as Finding;
}

describe('Synthesizer hypothesis dedup', () => {
  it('collapses hypotheses that share the same source findings', async () => {
    const llm = new MockLLM();
    const s = new Synthesizer(llm);
    const hypotheses: Hypothesis[] = [
      hyp('h1', ['f1'], 'Missing lockfile exposes build to non-determinism', 0.6),
      hyp('h2', ['f1'], 'Absence of lockfile introduces supply chain risk', 0.8),
      hyp('h3', ['f1'], 'Lockfile absence creates reproducibility gaps', 0.5),
      hyp('h4', ['f2'], 'No resilience patterns for external deps', 0.7),
      hyp('h5', ['f2'], 'Add resilience configuration for dependencies', 0.6),
      hyp('h6', ['f1', 'f2'], 'Systemic dependency management weakness', 0.9),
    ];
    const result = await s.synthesize(hypotheses, [], [finding('f1'), finding('f2')]);
    // 3 distinct source-finding signatures: {f1}, {f2}, {f1,f2}
    expect(result.length).toBe(3);
    // synthesis LLM was called once per surviving hypothesis, not once per input
    expect(llm.calls).toBe(3);
  });

  it('does not merge hypotheses with distinct source findings', async () => {
    const llm = new MockLLM();
    const s = new Synthesizer(llm);
    const hypotheses: Hypothesis[] = [
      hyp('a', ['f1'], 'Issue one', 0.6),
      hyp('b', ['f2'], 'Issue two', 0.6),
      hyp('c', ['f3'], 'Issue three', 0.6),
    ];
    const result = await s.synthesize(hypotheses, [], [finding('f1'), finding('f2'), finding('f3')]);
    expect(result.length).toBe(3);
  });

  it('drops a hypothesis whose cited finding_ids are all hallucinated', async () => {
    const llm = new MockLLM();
    const s = new Synthesizer(llm);
    const hypotheses: Hypothesis[] = [
      hyp('real', ['f1'], 'Grounded issue', 0.7),
      hyp('fake', ['ghost'], 'Ungrounded issue citing a non-existent finding', 0.9),
    ];
    const result = await s.synthesize(hypotheses, [], [finding('f1')]);
    // Only the grounded hypothesis survives; the hallucinated one is dropped.
    expect(result.length).toBe(1);
    expect(llm.calls).toBe(1);
  });
});

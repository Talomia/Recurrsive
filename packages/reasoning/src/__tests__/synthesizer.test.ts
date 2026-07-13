import { describe, expect, it } from 'vitest';
import { FindingSchema, OpportunitySchema, type Finding, type Hypothesis } from '@recurrsive/core';
import { Synthesizer } from '../synthesizer/synthesizer.js';

function finding(): Finding {
  return FindingSchema.parse({
    id: crypto.randomUUID(),
    analyzer_id: 'reliability.dependencies',
    title: 'External dependency lacks a timeout',
    description: 'The HTTP client call has no configured timeout.',
    severity: 'high',
    category: 'reliability',
    evidence: [{
      id: crypto.randomUUID(),
      type: 'code',
      source: 'reliability.dependencies',
      description: 'HTTP client created without a timeout',
      entity_ids: [],
      collected_at: new Date().toISOString(),
      confidence: 0.9,
    }],
    locations: [{ file: 'src/client.ts', start_line: 12 }],
    suggested_fix: 'Configure an explicit timeout and test the failure path.',
    confidence: 0.9,
    tags: ['timeout'],
    created_at: new Date().toISOString(),
  });
}

function hypothesis(findingId: string): Hypothesis {
  return {
    id: crypto.randomUUID(),
    finding_ids: [findingId],
    title: 'Model-authored title must not replace the finding',
    description: 'Claims an unsupported 40% availability gain.',
    proposed_by: 'architecture_engineer',
    confidence: 0.8,
    evidence_strength: 0.7,
    impact_estimate: 'Invented business impact',
    effort_estimate: '80 hours',
    risk_level: 'medium',
    supporting_arguments: [],
    counter_arguments: [],
    assumptions: [],
  };
}

describe('evidence-bounded opportunity synthesis', () => {
  it('creates one schema-valid opportunity per finding without model-authored estimates', async () => {
    const source = finding();
    const result = await new Synthesizer().synthesize([hypothesis(source.id)], [], [source]);

    expect(result).toHaveLength(1);
    const opportunity = result[0]!;
    expect(OpportunitySchema.safeParse(opportunity).success).toBe(true);
    expect(opportunity.title).toBe(source.title);
    expect(opportunity.problem).toBe(source.description);
    expect(opportunity.recommendation).toBe(source.suggested_fix);
    expect(opportunity.evidence).toEqual(source.evidence);
    expect(opportunity.effort.t_shirt).toBe('unknown');
    expect(opportunity.effort.estimated_hours).toBeUndefined();
    expect(opportunity.risk.level).toBe('unknown');
    expect(opportunity.expected_impact.business_value).toBeUndefined();
    expect(opportunity.expected_impact.metrics).toEqual([
      expect.objectContaining({ name: 'open_findings', current_value: 1, expected_value: 0 }),
    ]);
    expect(opportunity.assumptions).toContain(
      'Effort, implementation risk, business outcomes, and delivery timelines require human planning and are intentionally unestimated.',
    );
    expect(opportunity.reasoning.consensus_score).toBeLessThanOrEqual(source.confidence);
  });

  it('does not multiply opportunities when several hypotheses cite the same finding', async () => {
    const source = finding();
    const result = await new Synthesizer().synthesize(
      [hypothesis(source.id), hypothesis(source.id), hypothesis(source.id)],
      [],
      [source],
    );
    expect(result).toHaveLength(1);
  });
});

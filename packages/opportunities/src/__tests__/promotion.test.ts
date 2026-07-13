import { describe, expect, it } from 'vitest';
import { FindingSchema, OpportunitySchema, type Finding } from '@recurrsive/core';
import { promoteFinding, promoteFindings } from '../promotion.js';

function finding(overrides: Partial<Finding> = {}): Finding {
  return FindingSchema.parse({
    id: crypto.randomUUID(),
    analyzer_id: 'security.static',
    title: 'Unsafe production default',
    description: 'A default credential is enabled in production.',
    severity: 'critical',
    category: 'security',
    evidence: [{
      id: crypto.randomUUID(),
      type: 'code',
      source: 'security.static',
      description: 'Default credential found',
      entity_ids: [],
      collected_at: new Date().toISOString(),
      confidence: 0.95,
    }],
    locations: [{ file: 'deploy/config.ts', start_line: 12 }],
    suggested_fix: 'Require a generated secret.',
    confidence: 0.95,
    tags: ['credential'],
    created_at: new Date().toISOString(),
    ...overrides,
  });
}

describe('deterministic finding promotion', () => {
  it('produces a complete schema-valid opportunity without an LLM', () => {
    const result = promoteFinding(finding());
    expect(OpportunitySchema.safeParse(result).success).toBe(true);
    expect(result.type).toBe('risk');
    expect(result.recommendation).toBe('Require a generated secret.');
    expect(result.evidence).toHaveLength(1);
    expect(result.validation.success_criteria).toHaveLength(2);
    expect(result.effort.t_shirt).toBe('unknown');
    expect(result.effort.estimated_hours).toBeUndefined();
    expect(result.risk.level).toBe('unknown');
    expect(result.assumptions).toContain(
      'Effort and implementation risk require human planning and are intentionally left unestimated.',
    );
    expect(result.reasoning.reasoning_trace).toContain('no external model');
  });

  it('preserves every finding as an actionable decision path', () => {
    const results = promoteFindings([
      finding(),
      finding({ id: crypto.randomUUID(), severity: 'low', category: 'documentation' }),
    ]);
    expect(results).toHaveLength(2);
    expect(results[1]?.type).toBe('debt');
  });
});

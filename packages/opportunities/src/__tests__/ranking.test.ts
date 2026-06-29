/**
 * Tests for scoring and ranking utilities.
 */

import { describe, it, expect } from 'vitest';
import type { Opportunity } from '@recurrsive/core';
import { computeScore, rankOpportunities, groupByDependency } from '../ranking.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** Create a minimal valid Opportunity for scoring tests. */
function makeOpp(overrides: Partial<{
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  confidence: number;
  t_shirt: 'xs' | 's' | 'm' | 'l' | 'xl';
  risk_level: 'critical' | 'high' | 'medium' | 'low' | 'negligible';
  evidence_count: number;
  metric_count: number;
  estimated_hours?: number;
  dependencies: string[];
  related: string[];
}> = {}): Opportunity {
  const {
    id = '00000000-0000-0000-0000-000000000001',
    severity = 'medium',
    confidence = 0.8,
    t_shirt = 'm',
    risk_level = 'medium',
    evidence_count = 2,
    metric_count = 1,
    estimated_hours,
    dependencies = [],
    related = [],
  } = overrides;

  // Build evidence array of the given count
  const evidence = Array.from({ length: evidence_count }, (_, i) => ({
    id: `e${i}-0000-0000-0000-000000000000`,
    type: 'code' as const,
    source: 'test',
    description: `Evidence item ${i}`,
    entity_ids: [],
    collected_at: '2026-01-01T00:00:00.000Z',
    confidence: 0.9,
  }));

  // Build metrics array
  const metrics = Array.from({ length: metric_count }, (_, i) => ({
    name: `metric_${i}`,
    current_value: i,
    expected_value: i + 1,
    change_percent: 10,
    direction: 'increase' as const,
  }));

  return {
    id,
    title: 'Test Opportunity',
    type: 'opportunity',
    category: 'performance',
    severity,
    problem: 'Test problem',
    evidence,
    recommendation: 'Fix it',
    expected_impact: {
      summary: 'Some impact',
      metrics,
      affected_services: ['svc-a'],
    },
    confidence,
    effort: {
      t_shirt,
      estimated_hours,
      skills_required: [],
      dependencies,
    },
    risk: {
      level: risk_level,
      description: 'Some risk',
      mitigations: [],
    },
    validation: { steps: [], success_criteria: [] },
    rollback: { strategy: 'manual', steps: [] },
    reasoning: {
      proposer: 'agent-1',
      supporters: [],
      dissenters: [],
      consensus_score: 0.9,
    },
    locations: [],
    related,
    status: 'proposed',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as Opportunity;
}

// ---------------------------------------------------------------------------
// computeScore tests
// ---------------------------------------------------------------------------

describe('computeScore', () => {
  it('returns a number between 0 and 1', () => {
    const opp = makeOpp();
    const score = computeScore(opp);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('computes a known score for specific inputs', () => {
    // Using default weights:
    //   confidence * 0.20 + impact * 0.30 + effortInverse * 0.20 + riskInverse * 0.15 + evidenceNorm * 0.15
    //
    // Inputs: severity=critical(1.0), confidence=1.0, t_shirt=xs(0.1), risk=negligible(0.1), evidence=20
    // impact: min(1.0 + min(1/5,1)*0.2, 1.0) = min(1.0 + 0.04, 1.0) = 1.0
    // effortInverse: 1.0 - 0.1 = 0.9
    // riskInverse: 1.0 - 0.1 = 0.9
    // evidenceNorm: min(20/20, 1.0) = 1.0
    //
    // score = 1.0*0.2 + 1.0*0.3 + 0.9*0.2 + 0.9*0.15 + 1.0*0.15
    //       = 0.2 + 0.3 + 0.18 + 0.135 + 0.15 = 0.965
    const opp = makeOpp({
      severity: 'critical',
      confidence: 1.0,
      t_shirt: 'xs',
      risk_level: 'negligible',
      evidence_count: 20,
      metric_count: 1,
    });
    const score = computeScore(opp);
    expect(score).toBeCloseTo(0.965, 3);
  });

  it('higher confidence produces higher score, all else equal', () => {
    const low = makeOpp({ confidence: 0.2 });
    const high = makeOpp({ confidence: 0.9 });
    expect(computeScore(high)).toBeGreaterThan(computeScore(low));
  });

  it('higher severity produces higher score, all else equal', () => {
    const low = makeOpp({ severity: 'low' });
    const critical = makeOpp({ severity: 'critical' });
    expect(computeScore(critical)).toBeGreaterThan(computeScore(low));
  });

  it('lower effort produces higher score, all else equal', () => {
    const small = makeOpp({ t_shirt: 'xs' });
    const large = makeOpp({ t_shirt: 'xl' });
    expect(computeScore(small)).toBeGreaterThan(computeScore(large));
  });

  it('lower risk produces higher score, all else equal', () => {
    const low = makeOpp({ risk_level: 'negligible' });
    const high = makeOpp({ risk_level: 'critical' });
    expect(computeScore(low)).toBeGreaterThan(computeScore(high));
  });

  it('more evidence produces higher score, all else equal', () => {
    const few = makeOpp({ evidence_count: 1 });
    const many = makeOpp({ evidence_count: 15 });
    expect(computeScore(many)).toBeGreaterThan(computeScore(few));
  });

  it('more metrics give a small impact bonus', () => {
    const fewMetrics = makeOpp({ metric_count: 0 });
    const manyMetrics = makeOpp({ metric_count: 5 });
    expect(computeScore(manyMetrics)).toBeGreaterThan(computeScore(fewMetrics));
  });

  describe('edge cases', () => {
    it('handles all-zero/minimum values gracefully', () => {
      const opp = makeOpp({
        severity: 'info',
        confidence: 0,
        t_shirt: 'xl',
        risk_level: 'critical',
        evidence_count: 0,
        metric_count: 0,
      });
      const score = computeScore(opp);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(typeof score).toBe('number');
      expect(Number.isFinite(score)).toBe(true);
    });

    it('handles all-max values gracefully', () => {
      const opp = makeOpp({
        severity: 'critical',
        confidence: 1,
        t_shirt: 'xs',
        risk_level: 'negligible',
        evidence_count: 20,
        metric_count: 10,
      });
      const score = computeScore(opp);
      expect(score).toBeLessThanOrEqual(1);
      expect(score).toBeGreaterThan(0.9);
    });

    it('evidence normalization caps at MAX_EVIDENCE_COUNT (20)', () => {
      const at20 = makeOpp({ evidence_count: 20 });
      const at30 = makeOpp({ evidence_count: 30 });
      // Both should produce the same score since evidence is capped
      expect(computeScore(at20)).toBe(computeScore(at30));
    });

    it('returns a rounded result (3 decimal places)', () => {
      const opp = makeOpp();
      const score = computeScore(opp);
      const rounded = Math.round(score * 1000) / 1000;
      expect(score).toBe(rounded);
    });
  });
});

// ---------------------------------------------------------------------------
// rankOpportunities tests
// ---------------------------------------------------------------------------

describe('rankOpportunities', () => {
  it('returns a new array sorted by composite score descending', () => {
    const low = makeOpp({ id: '00000000-0000-0000-0000-000000000001', severity: 'low', confidence: 0.3 });
    const high = makeOpp({ id: '00000000-0000-0000-0000-000000000002', severity: 'critical', confidence: 0.9 });
    const mid = makeOpp({ id: '00000000-0000-0000-0000-000000000003', severity: 'medium', confidence: 0.6 });

    const ranked = rankOpportunities([low, mid, high]);

    expect(ranked[0]!.id).toBe(high.id);
    expect(ranked[ranked.length - 1]!.id).toBe(low.id);
  });

  it('does not mutate the original array', () => {
    const opps = [
      makeOpp({ id: '00000000-0000-0000-0000-000000000001', severity: 'low' }),
      makeOpp({ id: '00000000-0000-0000-0000-000000000002', severity: 'critical' }),
    ];
    const originalIds = opps.map((o) => o.id);
    rankOpportunities(opps);
    expect(opps.map((o) => o.id)).toEqual(originalIds);
  });

  it('returns empty array for empty input', () => {
    expect(rankOpportunities([])).toEqual([]);
  });

  it('preserves all elements', () => {
    const opps = [
      makeOpp({ id: '00000000-0000-0000-0000-000000000001' }),
      makeOpp({ id: '00000000-0000-0000-0000-000000000002' }),
      makeOpp({ id: '00000000-0000-0000-0000-000000000003' }),
    ];
    const ranked = rankOpportunities(opps);
    expect(ranked).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// groupByDependency tests
// ---------------------------------------------------------------------------

describe('groupByDependency', () => {
  it('places standalone opportunities in separate groups', () => {
    const a = makeOpp({ id: '00000000-0000-0000-0000-000000000001' });
    const b = makeOpp({ id: '00000000-0000-0000-0000-000000000002' });

    const groups = groupByDependency([a, b]);

    expect(groups).toHaveLength(2);
    expect(groups[0]!.memberIds).toHaveLength(1);
    expect(groups[1]!.memberIds).toHaveLength(1);
  });

  it('clusters opportunities connected by dependencies', () => {
    const a = makeOpp({
      id: '00000000-0000-0000-0000-000000000001',
      dependencies: ['00000000-0000-0000-0000-000000000002'],
    });
    const b = makeOpp({ id: '00000000-0000-0000-0000-000000000002' });

    const groups = groupByDependency([a, b]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.memberIds).toHaveLength(2);
    expect(groups[0]!.memberIds).toContain(a.id);
    expect(groups[0]!.memberIds).toContain(b.id);
  });

  it('clusters opportunities connected by related field', () => {
    const a = makeOpp({
      id: '00000000-0000-0000-0000-000000000001',
      related: ['00000000-0000-0000-0000-000000000002'],
    });
    const b = makeOpp({ id: '00000000-0000-0000-0000-000000000002' });

    const groups = groupByDependency([a, b]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.memberIds).toHaveLength(2);
  });

  it('handles transitive dependencies (A→B, B→C becomes one group)', () => {
    const a = makeOpp({
      id: '00000000-0000-0000-0000-000000000001',
      dependencies: ['00000000-0000-0000-0000-000000000002'],
    });
    const b = makeOpp({
      id: '00000000-0000-0000-0000-000000000002',
      dependencies: ['00000000-0000-0000-0000-000000000003'],
    });
    const c = makeOpp({ id: '00000000-0000-0000-0000-000000000003' });

    const groups = groupByDependency([a, b, c]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.memberIds).toHaveLength(3);
  });

  it('ignores dependencies pointing to IDs not in the input set', () => {
    const a = makeOpp({
      id: '00000000-0000-0000-0000-000000000001',
      dependencies: ['00000000-0000-0000-0000-999999999999'], // not in input
    });
    const b = makeOpp({ id: '00000000-0000-0000-0000-000000000002' });

    const groups = groupByDependency([a, b]);

    expect(groups).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(groupByDependency([])).toEqual([]);
  });

  it('members array contains the actual Opportunity objects', () => {
    const a = makeOpp({ id: '00000000-0000-0000-0000-000000000001' });
    const groups = groupByDependency([a]);

    expect(groups[0]!.members[0]).toBe(a);
  });

  it('rootId is one of the memberIds', () => {
    const a = makeOpp({
      id: '00000000-0000-0000-0000-000000000001',
      dependencies: ['00000000-0000-0000-0000-000000000002'],
    });
    const b = makeOpp({ id: '00000000-0000-0000-0000-000000000002' });

    const groups = groupByDependency([a, b]);

    expect(groups[0]!.memberIds).toContain(groups[0]!.rootId);
  });
});

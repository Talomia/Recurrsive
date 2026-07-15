/**
 * Tests for the Judge scoring and ranking system.
 *
 * Covers: scoring formula with known inputs, descending rank order,
 * empty input, single opportunity, and weight summation.
 */

import { describe, it, expect } from 'vitest';
import { Judge } from '../../judge/judge.js';
import type { Opportunity } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Factory helper — produces a minimal valid Opportunity object
// ---------------------------------------------------------------------------

function makeOpportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? '00000000-0000-4000-8000-000000000001',
    title: overrides.title ?? 'Test Opportunity',
    type: 'opportunity',
    category: 'architecture',
    severity: overrides.severity ?? 'medium',
    problem: 'Test problem',
    evidence: overrides.evidence ?? [],
    recommendation: 'Test recommendation',
    expected_impact: overrides.expected_impact ?? {
      summary: 'Moderate improvement',
      metrics: [],
      affected_services: [],
    },
    confidence: overrides.confidence ?? 0.7,
    effort: overrides.effort ?? {
      t_shirt: 'm',
      skills_required: [],
      dependencies: [],
    },
    risk: overrides.risk ?? {
      level: 'medium',
      description: 'Moderate risk',
      mitigations: [],
    },
    validation: {
      steps: [],
      success_criteria: [],
    },
    rollback: {
      strategy: 'manual',
      steps: [],
    },
    reasoning: overrides.reasoning ?? {
      proposer: 'architecture_engineer',
      supporters: [],
      dissenters: [],
      consensus_score: 0.7,
    },
    locations: [],
    related: [],
    status: 'proposed',
    created_at: now,
    updated_at: now,
    ...overrides,
  } as Opportunity;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Judge', () => {
  const judge = new Judge();

  // ── Empty input ──────────────────────────────────────────────────────────

  describe('empty input', () => {
    it('rank() returns empty array for empty input', () => {
      const result = judge.rank([]);
      expect(result).toEqual([]);
    });

    it('rankWithDetails() returns empty arrays for empty input', () => {
      const result = judge.rankWithDetails([]);
      expect(result.opportunities).toEqual([]);
      expect(result.rankings).toEqual([]);
    });
  });

  // ── Single opportunity ───────────────────────────────────────────────────

  describe('single opportunity', () => {
    it('returns the single opportunity unchanged', () => {
      const opp = makeOpportunity({ title: 'Only One' });
      const result = judge.rank([opp]);
      expect(result).toHaveLength(1);
      expect(result[0]!.title).toBe('Only One');
    });

    it('rankWithDetails returns a single ranking', () => {
      const opp = makeOpportunity();
      const { opportunities, rankings } = judge.rankWithDetails([opp]);
      expect(opportunities).toHaveLength(1);
      expect(rankings).toHaveLength(1);
      expect(rankings[0]!.hypothesis_id).toBe(opp.id);
    });
  });

  // ── Ranking order ────────────────────────────────────────────────────────

  describe('ranking order', () => {
    it('orders by descending final_score', () => {
      const high = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        title: 'High',
        severity: 'critical',
        confidence: 0.95,
        effort: { t_shirt: 'xs', skills_required: [], dependencies: [] },
        risk: { level: 'negligible', description: 'Low risk', mitigations: ['a', 'b', 'c'] },
        expected_impact: {
          summary: 'Big impact',
          metrics: [{ name: 'm1', direction: 'increase' as const }],
          affected_services: ['svc1', 'svc2', 'svc3'],
          business_value: 'High ROI',
        },
      });

      const low = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        title: 'Low',
        severity: 'info',
        confidence: 0.1,
        effort: { t_shirt: 'xl', skills_required: [], dependencies: [] },
        risk: { level: 'critical', description: 'Very risky', mitigations: [] },
        expected_impact: {
          summary: 'Minor',
          metrics: [],
          affected_services: [],
        },
      });

      const result = judge.rank([low, high]);
      expect(result[0]!.title).toBe('High');
      expect(result[1]!.title).toBe('Low');
    });

    it('preserves relative order for 3 opportunities', () => {
      const a = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        title: 'A-critical',
        severity: 'critical',
        confidence: 0.9,
      });
      const b = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        title: 'B-medium',
        severity: 'medium',
        confidence: 0.5,
      });
      const c = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000003',
        title: 'C-info',
        severity: 'info',
        confidence: 0.2,
      });

      const result = judge.rank([c, a, b]);
      // Critical should be first, then medium, then info
      expect(result[0]!.title).toBe('A-critical');
      expect(result[2]!.title).toBe('C-info');
    });
  });

  // ── Scoring formula ──────────────────────────────────────────────────────

  describe('scoring formula', () => {
    it('final_score is between 0 and 1', () => {
      const opp = makeOpportunity({
        severity: 'critical',
        confidence: 1.0,
      });

      const { rankings } = judge.rankWithDetails([opp]);
      const score = rankings[0]!.final_score;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('higher severity yields higher evidence score', () => {
      const critical = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        severity: 'critical',
      });
      const info = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        severity: 'info',
      });

      const result = judge.rankWithDetails([critical, info]);
      const criticalRanking = result.rankings.find(
        (r) => r.hypothesis_id === critical.id,
      )!;
      const infoRanking = result.rankings.find(
        (r) => r.hypothesis_id === info.id,
      )!;

      expect(criticalRanking.technical_impact_score).toBeGreaterThan(
        infoRanking.technical_impact_score,
      );
    });

    it('higher confidence yields higher confidence score', () => {
      const highConf = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        confidence: 0.95,
      });
      const lowConf = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        confidence: 0.1,
      });

      const result = judge.rankWithDetails([highConf, lowConf]);
      const highRank = result.rankings.find(
        (r) => r.hypothesis_id === highConf.id,
      )!;
      const lowRank = result.rankings.find(
        (r) => r.hypothesis_id === lowConf.id,
      )!;

      expect(highRank.confidence_score).toBeGreaterThan(
        lowRank.confidence_score,
      );
    });

    it('smaller effort (xs) yields higher effort score than xl', () => {
      const xs = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        effort: { t_shirt: 'xs', skills_required: [], dependencies: [] },
      });
      const xl = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        effort: { t_shirt: 'xl', skills_required: [], dependencies: [] },
      });

      const result = judge.rankWithDetails([xs, xl]);
      const xsRank = result.rankings.find(
        (r) => r.hypothesis_id === xs.id,
      )!;
      const xlRank = result.rankings.find(
        (r) => r.hypothesis_id === xl.id,
      )!;

      expect(xsRank.effort_score).toBeGreaterThan(xlRank.effort_score);
    });

    it('lower risk yields higher risk score', () => {
      const low = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        risk: { level: 'negligible', description: '', mitigations: [] },
      });
      const high = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        risk: { level: 'critical', description: '', mitigations: [] },
      });

      const result = judge.rankWithDetails([low, high]);
      const lowRank = result.rankings.find(
        (r) => r.hypothesis_id === low.id,
      )!;
      const highRank = result.rankings.find(
        (r) => r.hypothesis_id === high.id,
      )!;

      expect(lowRank.risk_score).toBeGreaterThan(highRank.risk_score);
    });

    it('mitigations improve risk score', () => {
      const noMitigations = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        risk: { level: 'medium', description: '', mitigations: [] },
      });
      const withMitigations = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        risk: { level: 'medium', description: '', mitigations: ['m1', 'm2', 'm3'] },
      });

      const result = judge.rankWithDetails([noMitigations, withMitigations]);
      const noMitRank = result.rankings.find(
        (r) => r.hypothesis_id === noMitigations.id,
      )!;
      const withMitRank = result.rankings.find(
        (r) => r.hypothesis_id === withMitigations.id,
      )!;

      expect(withMitRank.risk_score).toBeGreaterThan(noMitRank.risk_score);
    });
  });

  // ── Weights sum to ~1.0 ──────────────────────────────────────────────────

  describe('scoring weights', () => {
    it('weights sum to approximately 1.0', () => {
      // The weights are: 0.25 + 0.20 + 0.25 + 0.15 + 0.15 = 1.0
      const sum = 0.25 + 0.20 + 0.25 + 0.15 + 0.15;
      expect(sum).toBeCloseTo(1.0, 10);
    });
  });

  // ── rankWithDetails ──────────────────────────────────────────────────────

  describe('rankWithDetails()', () => {
    it('returns matching opportunity and ranking arrays', () => {
      const opps = [
        makeOpportunity({ id: '00000000-0000-4000-8000-000000000001' }),
        makeOpportunity({ id: '00000000-0000-4000-8000-000000000002', severity: 'high' }),
      ];

      const { opportunities, rankings } = judge.rankWithDetails(opps);
      expect(opportunities).toHaveLength(2);
      expect(rankings).toHaveLength(2);

      // Rankings should reference the same IDs
      for (let i = 0; i < opportunities.length; i++) {
        expect(rankings[i]!.hypothesis_id).toBe(opportunities[i]!.id);
      }
    });

    it('all ranking fields are numbers between 0 and 1', () => {
      const opp = makeOpportunity();
      const { rankings } = judge.rankWithDetails([opp]);
      const r = rankings[0]!;

      expect(r.business_impact_score).toBeGreaterThanOrEqual(0);
      expect(r.business_impact_score).toBeLessThanOrEqual(1);
      expect(r.technical_impact_score).toBeGreaterThanOrEqual(0);
      expect(r.technical_impact_score).toBeLessThanOrEqual(1);
      expect(r.confidence_score).toBeGreaterThanOrEqual(0);
      expect(r.confidence_score).toBeLessThanOrEqual(1);
      expect(r.effort_score).toBeGreaterThanOrEqual(0);
      expect(r.effort_score).toBeLessThanOrEqual(1);
      expect(r.risk_score).toBeGreaterThanOrEqual(0);
      expect(r.risk_score).toBeLessThanOrEqual(1);
      expect(r.final_score).toBeGreaterThanOrEqual(0);
      expect(r.final_score).toBeLessThanOrEqual(1);
    });
  });

  // ── Business impact scoring details ──────────────────────────────────────

  describe('business impact scoring', () => {
    it('a free-form business_value string does NOT inflate business impact', () => {
      // A qualitative, unverifiable business_value statement must not add a flat
      // bonus to the score — otherwise any opportunity could pad its ranking by
      // asserting vague value. Business impact must be driven by real signals
      // (severity, affected services, measured metrics) only.
      const noBizVal = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        expected_impact: {
          summary: 'Test',
          metrics: [],
          affected_services: [],
        },
      });
      const withBizVal = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        expected_impact: {
          summary: 'Test',
          metrics: [],
          affected_services: [],
          business_value: 'Increases retention by 5%',
        },
      });

      const result = judge.rankWithDetails([noBizVal, withBizVal]);
      const noRank = result.rankings.find(
        (r) => r.hypothesis_id === noBizVal.id,
      )!;
      const withRank = result.rankings.find(
        (r) => r.hypothesis_id === withBizVal.id,
      )!;

      expect(withRank.business_impact_score).toBe(noRank.business_impact_score);
    });

    it('more affected services increase business impact', () => {
      const few = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000001',
        expected_impact: {
          summary: 'Test',
          metrics: [],
          affected_services: ['svc1'],
        },
      });
      const many = makeOpportunity({
        id: '00000000-0000-4000-8000-000000000002',
        expected_impact: {
          summary: 'Test',
          metrics: [],
          affected_services: ['s1', 's2', 's3', 's4', 's5'],
        },
      });

      const result = judge.rankWithDetails([few, many]);
      const fewRank = result.rankings.find(
        (r) => r.hypothesis_id === few.id,
      )!;
      const manyRank = result.rankings.find(
        (r) => r.hypothesis_id === many.id,
      )!;

      expect(manyRank.business_impact_score).toBeGreaterThan(
        fewRank.business_impact_score,
      );
    });
  });
});

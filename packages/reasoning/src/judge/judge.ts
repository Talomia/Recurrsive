/**
 * Opportunity scoring and ranking judge.
 *
 * Applies a weighted multi-factor scoring model to rank opportunities
 * by their overall value. The scoring balances evidence quality,
 * confidence, business impact, effort efficiency, and risk.
 *
 * @module
 */

import { SEVERITY_WEIGHTS, EFFORT_WEIGHTS } from '@recurrsive/core';
import type { Opportunity, HypothesisRanking } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

/**
 * Weight distribution for the multi-factor scoring model.
 * Sum = 1.0
 */
const SCORING_WEIGHTS = {
  /** Weight for evidence strength / severity. */
  evidence_strength: 0.25,
  /** Weight for confidence score. */
  confidence: 0.20,
  /** Weight for business impact. */
  business_impact: 0.25,
  /** Weight for effort efficiency (inverse — less effort = higher score). */
  effort_inverse: 0.15,
  /** Weight for risk profile (inverse — lower risk = higher score). */
  risk_inverse: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Judge
// ---------------------------------------------------------------------------

/**
 * Scores and ranks opportunities using a weighted multi-factor model.
 *
 * The scoring formula:
 * ```
 * final_score = evidence_strength × 0.25
 *             + confidence       × 0.20
 *             + business_impact  × 0.25
 *             + effort_inverse   × 0.15
 *             + risk_inverse     × 0.15
 * ```
 *
 * All sub-scores are normalized to [0, 1] before weighting.
 *
 * @example
 * ```ts
 * const judge = new Judge();
 * const ranked = judge.rank(opportunities);
 * // ranked[0] is the highest-scoring opportunity
 * ```
 */
export class Judge {
  /**
   * Score and rank opportunities from highest to lowest value.
   *
   * @param opportunities - Unranked opportunities.
   * @returns The same opportunities sorted by descending score.
   */
  rank(opportunities: Opportunity[]): Opportunity[] {
    if (opportunities.length === 0) return [];

    // Calculate scores and sort
    const scored = opportunities.map((opp) => ({
      opportunity: opp,
      ranking: this.calculateRanking(opp),
    }));

    scored.sort((a, b) => this.compareScored(a, b));

    return scored.map((s) => s.opportunity);
  }

  /**
   * Deterministic comparator: final score desc, then severity desc, then id asc.
   * Tie-breaking never depends on insertion order.
   */
  private compareScored(
    a: { opportunity: Opportunity; ranking: HypothesisRanking },
    b: { opportunity: Opportunity; ranking: HypothesisRanking },
  ): number {
    const scoreDelta = b.ranking.final_score - a.ranking.final_score;
    if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
    const sevDelta =
      (SEVERITY_WEIGHTS[b.opportunity.severity] ?? 3) -
      (SEVERITY_WEIGHTS[a.opportunity.severity] ?? 3);
    if (sevDelta !== 0) return sevDelta;
    return a.opportunity.id < b.opportunity.id
      ? -1
      : a.opportunity.id > b.opportunity.id
        ? 1
        : 0;
  }

  /**
   * Score and rank opportunities, returning both the ranked list
   * and the detailed ranking breakdowns.
   *
   * @param opportunities - Unranked opportunities.
   * @returns Ranked opportunities with their scoring details.
   */
  rankWithDetails(
    opportunities: Opportunity[],
  ): { opportunities: Opportunity[]; rankings: HypothesisRanking[] } {
    if (opportunities.length === 0) {
      return { opportunities: [], rankings: [] };
    }

    const scored = opportunities.map((opp) => ({
      opportunity: opp,
      ranking: this.calculateRanking(opp),
    }));

    scored.sort((a, b) => this.compareScored(a, b));

    return {
      opportunities: scored.map((s) => s.opportunity),
      rankings: scored.map((s) => s.ranking),
    };
  }

  // ── Private scoring methods ──────────────────────────────────────────────

  /**
   * Calculate the full scoring breakdown for a single opportunity.
   *
   * @param opp - The opportunity to score.
   * @returns Hypothesis ranking with all sub-scores.
   */
  private calculateRanking(opp: Opportunity): HypothesisRanking {
    const evidenceScore = this.scoreEvidence(opp);
    const confidenceScore = opp.confidence;
    const businessImpactScore = this.scoreBusinessImpact(opp);
    const effortScore = this.scoreEffort(opp);
    const riskScore = this.scoreRisk(opp);

    const finalScore =
      evidenceScore * SCORING_WEIGHTS.evidence_strength +
      confidenceScore * SCORING_WEIGHTS.confidence +
      businessImpactScore * SCORING_WEIGHTS.business_impact +
      effortScore * SCORING_WEIGHTS.effort_inverse +
      riskScore * SCORING_WEIGHTS.risk_inverse;

    return {
      hypothesis_id: opp.id,
      consensus_score: opp.reasoning.consensus_score,
      business_impact_score: businessImpactScore,
      technical_impact_score: evidenceScore,
      confidence_score: confidenceScore,
      effort_score: effortScore,
      risk_score: riskScore,
      final_score: Math.max(0, Math.min(1, finalScore)),
    };
  }

  /**
   * Score evidence strength based on severity and evidence count.
   *
   * Higher severity and more evidence pieces yield a higher score.
   *
   * @param opp - Opportunity to score.
   * @returns Normalized score [0, 1].
   */
  private scoreEvidence(opp: Opportunity): number {
    // Severity contributes 60% of the evidence score
    const severityWeight = SEVERITY_WEIGHTS[opp.severity] ?? 3;
    const normalizedSeverity = severityWeight / 5; // max severity = 5

    // Evidence count contributes 40% — diminishing returns after 5 pieces
    const evidenceCount = Math.min(opp.evidence.length, 5);
    const normalizedEvidence = evidenceCount / 5;

    return normalizedSeverity * 0.6 + normalizedEvidence * 0.4;
  }

  /**
   * Score business impact from the impact assessment.
   *
   * Uses the number of affected services, metrics with improvements,
   * and severity as proxies for business importance.
   *
   * @param opp - Opportunity to score.
   * @returns Normalized score [0, 1].
   */
  private scoreBusinessImpact(opp: Opportunity): number {
    const impact = opp.expected_impact;

    // Number of affected services (capped at 10). This is a real, collected
    // structural signal.
    const serviceImpact = Math.min(impact.affected_services.length, 10) / 10;

    // Metrics contribute only when they are MEASURED (a real baseline that is
    // not flagged as an estimate). We do NOT treat direction === 'increase' as
    // "positive": the semantics are metric-specific (an increase in latency or
    // error rate is bad), so direction alone cannot indicate improvement.
    const measuredMetrics = impact.metrics.filter(
      (m) => m.current_value !== undefined && m.current_value !== '' && m.is_estimate !== true,
    ).length;
    const metricImpact = Math.min(measuredMetrics, 5) / 5;

    // Severity-based baseline.
    const severityWeight = SEVERITY_WEIGHTS[opp.severity] ?? 3;
    const severityBase = severityWeight / 5;

    // Weights sum to 1.0 across the three real signals. A free-form
    // business_value string is qualitative and unverifiable, so it no longer
    // adds a flat bonus that could dominate the score.
    return Math.min(1, severityBase * 0.6 + serviceImpact * 0.2 + metricImpact * 0.2);
  }

  /**
   * Score effort as an inverse — less effort yields a higher score.
   *
   * @param opp - Opportunity to score.
   * @returns Normalized score [0, 1] where 1 = minimal effort.
   */
  private scoreEffort(opp: Opportunity): number {
    const effortWeight = EFFORT_WEIGHTS[opp.effort.t_shirt] ?? 3;
    // Invert: xs(1) → 1.0, s(2) → 0.8, m(3) → 0.6, l(4) → 0.4, xl(5) → 0.2
    return 1 - (effortWeight - 1) / 5;
  }

  /**
   * Score risk as an inverse — lower risk yields a higher score.
   *
   * @param opp - Opportunity to score.
   * @returns Normalized score [0, 1] where 1 = negligible risk.
   */
  private scoreRisk(opp: Opportunity): number {
    const riskLevelMap: Record<string, number> = {
      negligible: 1.0,
      low: 0.8,
      medium: 0.6,
      high: 0.3,
      critical: 0.1,
    };

    const baseScore = riskLevelMap[opp.risk.level] ?? 0.5;

    // Having mitigations improves the risk score slightly
    const mitigationBonus = Math.min(opp.risk.mitigations.length * 0.05, 0.15);

    return Math.min(1, baseScore + mitigationBonus);
  }
}

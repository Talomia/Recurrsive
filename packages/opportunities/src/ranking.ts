/**
 * @module @recurrsive/opportunities/ranking
 *
 * Composite scoring and dependency-based grouping for opportunities.
 *
 * @packageDocumentation
 */

import type { Opportunity, Severity } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Score weights
// ---------------------------------------------------------------------------

/** Weight configuration for the composite scoring formula. */
interface ScoreWeights {
  readonly confidence: number;
  readonly impact: number;
  readonly effortInverse: number;
  readonly riskInverse: number;
  readonly evidenceNormalized: number;
}

/** Default weights used by {@link computeScore}. */
const DEFAULT_WEIGHTS: ScoreWeights = {
  confidence: 0.2,
  impact: 0.3,
  effortInverse: 0.2,
  riskInverse: 0.15,
  evidenceNormalized: 0.15,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map severity to a 0–1 numeric impact score. */
const SEVERITY_IMPACT: Record<Severity, number> = {
  critical: 1.0,
  high: 0.8,
  medium: 0.6,
  low: 0.4,
  info: 0.2,
};

/** Map t-shirt size to a 0–1 numeric effort value (higher = more effort). */
const EFFORT_MAP: Record<string, number> = {
  unknown: 0.5,
  xs: 0.1,
  s: 0.25,
  m: 0.5,
  l: 0.75,
  xl: 1.0,
};

/** Map risk level to a 0–1 numeric risk value. */
const RISK_MAP: Record<string, number> = {
  unknown: 0.5,
  negligible: 0.1,
  low: 0.25,
  medium: 0.5,
  high: 0.75,
  critical: 1.0,
};

/** Maximum number of evidence items used for normalization. */
const MAX_EVIDENCE_COUNT = 20;

/**
 * Compute a normalised impact score (0–1) for an opportunity.
 *
 * @param opp - The opportunity to score
 * @returns Numeric impact score between 0 and 1
 */
function impactScore(opp: Opportunity): number {
  const severityScore = SEVERITY_IMPACT[opp.severity];
  const metricCount = opp.expected_impact.metrics.length;
  const metricBonus = Math.min(metricCount / 5, 1) * 0.2;
  return Math.min(severityScore + metricBonus, 1.0);
}

/**
 * Compute an inverse effort score (0–1). Lower effort → higher score.
 *
 * @param opp - The opportunity to score
 * @returns Inverse effort score between 0 and 1
 */
function effortInverse(opp: Opportunity): number {
  const effort = EFFORT_MAP[opp.effort.t_shirt] ?? 0.5;
  return 1.0 - effort;
}

/**
 * Compute an inverse risk score (0–1). Lower risk → higher score.
 *
 * @param opp - The opportunity to score
 * @returns Inverse risk score between 0 and 1
 */
function riskInverse(opp: Opportunity): number {
  const risk = RISK_MAP[opp.risk.level] ?? 0.5;
  return 1.0 - risk;
}

/**
 * Normalise the evidence count to a 0–1 scale, capped at
 * {@link MAX_EVIDENCE_COUNT}.
 *
 * @param opp - The opportunity to score
 * @returns Normalised evidence count between 0 and 1
 */
function evidenceNormalized(opp: Opportunity): number {
  return Math.min(opp.evidence.length / MAX_EVIDENCE_COUNT, 1.0);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute the composite score for a single opportunity.
 *
 * Formula:
 * ```
 * (confidence × 0.20) +
 * (impact_score × 0.30) +
 * (effort_inverse × 0.20) +
 * (risk_inverse × 0.15) +
 * (evidence_count_normalized × 0.15)
 * ```
 *
 * @param opp - The opportunity to score
 * @param weights - Optional custom weights (must sum to 1.0)
 * @returns A composite score between 0 and 1
 */
export function computeScore(
  opp: Opportunity,
  weights: ScoreWeights = DEFAULT_WEIGHTS,
): number {
  const score =
    opp.confidence * weights.confidence +
    impactScore(opp) * weights.impact +
    effortInverse(opp) * weights.effortInverse +
    riskInverse(opp) * weights.riskInverse +
    evidenceNormalized(opp) * weights.evidenceNormalized;

  return Math.round(score * 1000) / 1000;
}

/**
 * Rank an array of opportunities by their composite score (descending).
 *
 * @param opportunities - Array of opportunities to rank
 * @returns A new array sorted by composite score (highest first)
 */
export function rankOpportunities(opportunities: readonly Opportunity[]): Opportunity[] {
  return [...opportunities].sort((a, b) => computeScore(b) - computeScore(a));
}

/** A group of interdependent opportunities. */
export interface DependencyGroup {
  /** Canonical root opportunity ID (first discovered root). */
  rootId: string;
  /** All opportunity IDs in this dependency cluster. */
  memberIds: string[];
  /** The opportunities themselves. */
  members: Opportunity[];
}

/**
 * Group opportunities by their dependency chains.
 *
 * Uses Union-Find to cluster opportunities that are connected through
 * `effort.dependencies` references. Standalone opportunities (with no
 * dependencies) are each placed in their own group.
 *
 * @param opportunities - Array of opportunities to group
 * @returns Array of dependency groups
 */
export function groupByDependency(opportunities: readonly Opportunity[]): DependencyGroup[] {
  const idSet = new Set(opportunities.map((o) => o.id));
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  // Initialise Union-Find
  for (const id of idSet) {
    parent.set(id, id);
    rank.set(id, 0);
  }

  function find(x: string): string {
    let root = x;
    while (parent.get(root) !== root) {
      root = parent.get(root)!;
    }
    // Path compression
    let current = x;
    while (current !== root) {
      const next = parent.get(current)!;
      parent.set(current, root);
      current = next;
    }
    return root;
  }

  function union(a: string, b: string): void {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA === rootB) return;

    const rankA = rank.get(rootA) ?? 0;
    const rankB = rank.get(rootB) ?? 0;

    if (rankA < rankB) {
      parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      parent.set(rootB, rootA);
    } else {
      parent.set(rootB, rootA);
      rank.set(rootA, rankA + 1);
    }
  }

  // Union all connected opportunities
  for (const opp of opportunities) {
    for (const depId of opp.effort.dependencies) {
      if (idSet.has(depId)) {
        union(opp.id, depId);
      }
    }
    for (const relId of opp.related) {
      if (idSet.has(relId)) {
        union(opp.id, relId);
      }
    }
  }

  // Collect groups
  const groups = new Map<string, Opportunity[]>();
  for (const opp of opportunities) {
    const root = find(opp.id);
    const group = groups.get(root);
    if (group) {
      group.push(opp);
    } else {
      groups.set(root, [opp]);
    }
  }

  const result: DependencyGroup[] = [];
  for (const [rootId, members] of groups) {
    result.push({
      rootId,
      memberIds: members.map((m) => m.id),
      members,
    });
  }

  return result;
}

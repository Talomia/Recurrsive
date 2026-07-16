/**
 * @module @recurrsive/server/health-score
 *
 * Canonical project health-score computation.
 *
 * This is the SINGLE source of truth for turning analysis findings into a
 * health score. Every route that reports a health score (health, forecasting,
 * timeline, analytics, projects) MUST delegate here — no divergent
 * `100 - findingCount * 2` style formulas are permitted anywhere else.
 *
 * The formula is a severity-weighted exponential decay:
 *
 *   weighted = Σ severityWeight(finding.severity)
 *   overall  = round(100 * e^(-weighted / 200))
 *
 * which degrades gracefully (0 findings → 100, 10 critical → ~61,
 * 20 critical → ~37) instead of collapsing linearly to zero.
 *
 * @packageDocumentation
 */

import type { Finding, Opportunity, MaturityScore } from '@recurrsive/core';

/** Severity → weight used by the exponential-decay formula. */
export const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 0.5,
  info: 0,
};

/**
 * Map each finding category (OpportunityCategory) to a maturity dimension.
 *
 * Every category a finding can actually carry maps to exactly one dimension so
 * that no finding is silently dropped from the breakdown and no dimension is
 * reported that no finding can ever populate (which would fabricate a perfect
 * score). The maturity `testing` dimension is intentionally omitted: no
 * analyzer emits a `testing` category, so reporting it would always show a
 * fabricated 100.
 */
const CATEGORY_TO_DIMENSION: Record<string, MaturityScore['dimension']> = {
  architecture: 'architecture',
  security: 'security',
  privacy: 'security',
  compliance: 'security',
  reliability: 'reliability',
  performance: 'operational',
  cost: 'operational',
  infrastructure: 'operational',
  data: 'data',
  documentation: 'documentation',
  ai_quality: 'ai',
  ux: 'product',
  accessibility: 'product',
  product: 'product',
  developer_experience: 'developer_experience',
};

/**
 * Maturity dimensions reported by the health score — only dimensions that a
 * finding category can actually map to (see {@link CATEGORY_TO_DIMENSION}).
 */
const DIMENSIONS: MaturityScore['dimension'][] = [
  'architecture',
  'security',
  'reliability',
  'operational',
  'data',
  'documentation',
  'ai',
  'product',
  'developer_experience',
];

/** Result of a health-score computation for an analyzed project. */
export interface HealthScoreResult {
  /** Present so callers can branch on analyzed vs. not-analyzed uniformly. */
  status: 'analyzed';
  /** Overall health score (0–100). */
  overall: number;
  /** Per-dimension maturity breakdown. */
  dimensions: MaturityScore[];
}

/** Sentinel returned by state when no analysis has been run for a project. */
export interface NotAnalyzedResult {
  status: 'not_analyzed';
  overall: null;
  dimensions: [];
}

/**
 * Compute the canonical health score from analyzer findings.
 *
 * @param findings - Findings produced by the analyzers.
 * @param _opportunities - Reserved for future weighting; unused today so that
 *   the score reflects measured findings only, not model-generated opportunities.
 * @returns The overall score and per-dimension maturity scores.
 */
export function computeHealthScore(
  findings: Finding[],
  _opportunities?: Opportunity[],
): HealthScoreResult {
  let weightedCount = 0;
  for (const finding of findings) {
    weightedCount += SEVERITY_WEIGHT[finding.severity] ?? 0;
  }

  const overall = Math.round(100 * Math.exp(-weightedCount / 200));

  // Tally findings per dimension via the category→dimension map so that every
  // finding contributes to exactly one reported dimension.
  const dimensionFindings = new Map<string, number>();
  for (const finding of findings) {
    const dim = CATEGORY_TO_DIMENSION[finding.category];
    if (dim) {
      dimensionFindings.set(dim, (dimensionFindings.get(dim) ?? 0) + 1);
    }
  }

  const dimensions: MaturityScore[] = DIMENSIONS.map((dim) => {
    const count = dimensionFindings.get(dim) ?? 0;
    const score = Math.round(100 * Math.exp(-count / 10));
    return {
      dimension: dim,
      level:
        score >= 80 ? 'optimizing'
          : score >= 60 ? 'managed'
            : score >= 40 ? 'defined'
              : score >= 20 ? 'developing'
                : 'initial',
      score,
      trend: 'stable' as const,
      evidence: [`${count} findings in ${dim} category`],
      recommendations: count > 0 ? [`Address ${count} ${dim} findings`] : [],
    };
  });

  return { status: 'analyzed', overall, dimensions };
}

/**
 * Count findings by severity — a real, measured value that replaces the
 * fabricated tech-debt dollar figures.
 *
 * @param findings - Findings to tally.
 * @returns A map of severity → count including zero-valued buckets.
 */
export function severityBreakdown(findings: Finding[]): Record<string, number> {
  const breakdown: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  for (const f of findings) {
    breakdown[f.severity] = (breakdown[f.severity] ?? 0) + 1;
  }
  return breakdown;
}

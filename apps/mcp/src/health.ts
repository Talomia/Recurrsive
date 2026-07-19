/**
 * @module @recurrsive/mcp/health
 *
 * Canonical health-score computation for the MCP server.
 *
 * Mirrors the server's single source of truth (`apps/server/src/health-score.ts`
 * and `state.ts`): a severity-weighted exponential decay over analyzer
 * **findings** — NOT reasoning-generated opportunities. This matters because a
 * project analyzed without an LLM key produces many findings but zero
 * opportunities; scoring off opportunities would report a misleading 100/100.
 *
 *   weighted = Σ severityWeight(finding.severity)
 *   overall  = round(100 * e^(-weighted / 200))
 *
 * (0 findings → 100, 10 critical → ~61, 20 critical → ~37.)
 *
 * @packageDocumentation
 */

import type { Finding } from '@recurrsive/core';

/**
 * Severity → weight used by the canonical exponential-decay formula.
 * Must match `SEVERITY_WEIGHT` in `apps/server/src/health-score.ts`.
 */
export const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 10,
  high: 5,
  medium: 2,
  low: 0.5,
  info: 0,
};

/**
 * Compute the canonical health score (0–100) from analyzer findings.
 *
 * @param findings - Findings produced by the analyzers.
 * @returns A health score between 0 and 100.
 */
export function computeHealthScore(findings: Finding[]): number {
  let weightedCount = 0;
  for (const finding of findings) {
    weightedCount += SEVERITY_WEIGHT[finding.severity] ?? 0;
  }
  return Math.round(100 * Math.exp(-weightedCount / 200));
}

/**
 * Map each finding category (OpportunityCategory) to a maturity dimension.
 * Mirrors `CATEGORY_TO_DIMENSION` in `apps/server/src/health-score.ts`.
 *
 * Every category a finding can actually carry maps to exactly one dimension,
 * and no dimension is reported that no finding can ever populate. The
 * `testing` maturity dimension is intentionally omitted: no analyzer emits a
 * `testing` category, so reporting it would always show a fabricated 100.
 */
const CATEGORY_TO_DIMENSION: Record<string, string> = {
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
 * Maturity dimensions reported — only those a finding category maps to.
 * Mirrors `DIMENSIONS` in `apps/server/src/health-score.ts`.
 */
const DIMENSIONS: string[] = [
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

/** Per-dimension maturity summary for MCP tool output. */
export interface MaturityScoreSummary {
  dimension: string;
  score: number;
  level: string;
  issueCount: number;
  topRisks: string[];
}

/**
 * Compute per-dimension maturity scores from analyzer findings, mirroring
 * the canonical server logic (`apps/server/src/health-score.ts`):
 * `score = round(100 * e^(-count / 10))` with level thresholds 80/60/40/20.
 *
 * @param findings - All analyzer findings.
 * @returns Per-dimension maturity summaries.
 */
export function computeMaturityScores(findings: Finding[]): MaturityScoreSummary[] {
  const findingsByDimension = new Map<string, Finding[]>();
  for (const finding of findings) {
    const dim = CATEGORY_TO_DIMENSION[finding.category];
    if (!dim) continue;
    const list = findingsByDimension.get(dim);
    if (list) list.push(finding);
    else findingsByDimension.set(dim, [finding]);
  }

  return DIMENSIONS.map((dim) => {
    const dimFindings = findingsByDimension.get(dim) ?? [];
    const count = dimFindings.length;
    const score = Math.round(100 * Math.exp(-count / 10));

    const level =
      score >= 80 ? 'optimizing'
        : score >= 60 ? 'managed'
          : score >= 40 ? 'defined'
            : score >= 20 ? 'developing'
              : 'initial';

    const topRisks = dimFindings
      .filter((f) => f.severity === 'critical' || f.severity === 'high')
      .slice(0, 3)
      .map((f) => f.title);

    return { dimension: dim, score, level, issueCount: count, topRisks };
  });
}

/**
 * Count findings by severity — a real, measured value suitable for reporting
 * alongside (or instead of) a single score.
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

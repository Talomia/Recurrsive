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

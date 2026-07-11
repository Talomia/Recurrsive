/**
 * @module @recurrsive/mcp/health
 *
 * Shared health score computation utility.
 *
 * Computes a 0-100 health score from active opportunities,
 * penalizing by severity. Used across analyze tools and reports.
 *
 * @packageDocumentation
 */

import type { Opportunity } from '@recurrsive/core';
import type { GraphStats } from '@recurrsive/graph';

/**
 * Compute a health score (0-100) based on active opportunities.
 *
 * Scoring:
 * - Start at 100
 * - Deduct 15 per critical opportunity
 * - Deduct 8 per high severity
 * - Deduct 3 per medium severity
 * - Deduct 1 per low severity
 * - Info and archived/validated opportunities are ignored
 *
 * @param opportunities - Current opportunities.
 * @param _stats - Graph statistics (reserved for future graph-size bonus).
 * @returns A health score between 0 and 100.
 */
export function computeHealthScore(opportunities: Opportunity[], _stats: GraphStats): number {
  let score = 100;

  // Penalize by severity
  for (const opp of opportunities) {
    if (opp.status === 'archived' || opp.status === 'validated') continue;
    switch (opp.severity) {
      case 'critical':
        score -= 15;
        break;
      case 'high':
        score -= 8;
        break;
      case 'medium':
        score -= 3;
        break;
      case 'low':
        score -= 1;
        break;
      case 'info':
        break;
    }
  }

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, score));
}

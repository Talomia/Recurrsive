/** Shared MCP adapter for the canonical finding-based health calculation. */

import { calculateFindingHealth, type Finding } from '@recurrsive/core';

export function computeHealthScore(findings: readonly Finding[]): number {
  return calculateFindingHealth(findings);
}

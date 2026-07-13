import type { Finding } from '../types/findings.js';

/** Calculate the canonical finding-based project health score. */
export function calculateFindingHealth(findings: readonly Finding[]): number {
  const severityWeight: Record<string, number> = {
    critical: 10,
    high: 5,
    medium: 2,
    low: 0.5,
    info: 0,
  };
  const weightedCount = findings.reduce(
    (sum, finding) => sum + (severityWeight[finding.severity] ?? 0),
    0,
  );
  return Math.round(100 * Math.exp(-weightedCount / 200));
}

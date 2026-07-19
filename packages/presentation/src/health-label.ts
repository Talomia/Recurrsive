/**
 * @module @recurrsive/presentation/health-label
 *
 * Single source of truth for mapping a 0–100 health score to a status
 * tier and human-readable label. Every presentation surface (HTML,
 * markdown, terminal) MUST use this scale so the same score never
 * receives different labels in different outputs.
 *
 * @packageDocumentation
 */

/** Discrete health status tier. */
export type HealthTier =
  | 'excellent'
  | 'good'
  | 'fair'
  | 'needs-attention'
  | 'critical';

/**
 * Map a health score to its status tier (5-tier scale).
 *
 * @param score - Health score 0–100
 * @returns Status tier
 */
export function healthTier(score: number): HealthTier {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 60) return 'fair';
  if (score >= 40) return 'needs-attention';
  return 'critical';
}

/** Human-readable label for each tier. */
export const HEALTH_TIER_LABEL: Record<HealthTier, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  'needs-attention': 'Needs Attention',
  critical: 'Critical',
};

/**
 * Get the human-readable health status label for a score.
 *
 * @param score - Health score 0–100
 * @returns Status label (e.g. `"Fair"`)
 */
export function healthLabel(score: number): string {
  return HEALTH_TIER_LABEL[healthTier(score)];
}

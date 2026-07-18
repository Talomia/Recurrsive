/**
 * Unit tests for the canonical health-score computation.
 *
 * This is the single source of truth for turning findings into a score, so the
 * exact severity-weighted exponential-decay formula and the category→dimension
 * mapping are pinned here to prevent silent drift.
 */

import { describe, it, expect } from 'vitest';
import type { Finding } from '@recurrsive/core';
import { computeHealthScore, severityBreakdown, SEVERITY_WEIGHT } from '../health-score.js';

/** Build a minimal Finding — the scorer reads only severity and category. */
function finding(severity: string, category: string): Finding {
  return { severity, category } as unknown as Finding;
}

describe('computeHealthScore', () => {
  it('returns a perfect score with no findings', () => {
    const result = computeHealthScore([]);
    expect(result.status).toBe('analyzed');
    expect(result.overall).toBe(100);
    // Every reported dimension is perfect when nothing is wrong.
    expect(result.dimensions.every((d) => d.score === 100)).toBe(true);
  });

  it('applies the exponential-decay formula: 10 critical → 61', () => {
    const findings = Array.from({ length: 10 }, () => finding('critical', 'security'));
    // weighted = 10 * 10 = 100 → round(100 * e^-0.5) = 61
    expect(computeHealthScore(findings).overall).toBe(61);
  });

  it('applies the exponential-decay formula: 20 critical → 37', () => {
    const findings = Array.from({ length: 20 }, () => finding('critical', 'security'));
    // weighted = 200 → round(100 * e^-1) = 37
    expect(computeHealthScore(findings).overall).toBe(37);
  });

  it('weights severities distinctly', () => {
    // 1 critical (10) + 2 high (10) + 5 medium (10) + 20 low (10) = weighted 40
    const findings = [
      finding('critical', 'security'),
      ...Array.from({ length: 2 }, () => finding('high', 'security')),
      ...Array.from({ length: 5 }, () => finding('medium', 'security')),
      ...Array.from({ length: 20 }, () => finding('low', 'security')),
    ];
    // round(100 * e^-0.2) = 82
    expect(computeHealthScore(findings).overall).toBe(82);
    expect(SEVERITY_WEIGHT).toMatchObject({ critical: 10, high: 5, medium: 2, low: 0.5, info: 0 });
  });

  it('ignores unknown severities (weight 0)', () => {
    const findings = Array.from({ length: 50 }, () => finding('bogus', 'security'));
    expect(computeHealthScore(findings).overall).toBe(100);
  });

  it('maps categories to the right dimension and lowers only that one', () => {
    const findings = Array.from({ length: 10 }, () => finding('high', 'security'));
    const result = computeHealthScore(findings);
    const security = result.dimensions.find((d) => d.dimension === 'security');
    const architecture = result.dimensions.find((d) => d.dimension === 'architecture');
    // 10 security findings → round(100 * e^-1) = 37 for that dimension only.
    expect(security?.score).toBe(37);
    expect(architecture?.score).toBe(100);
  });

  it('never reports a fabricated "testing" dimension', () => {
    const result = computeHealthScore([finding('low', 'security')]);
    expect(result.dimensions.some((d) => d.dimension === 'testing')).toBe(false);
  });

  it('does not crash on a finding whose category has no dimension mapping', () => {
    const result = computeHealthScore([finding('high', 'not_a_real_category')]);
    // The finding still lowers the overall score...
    expect(result.overall).toBeLessThan(100);
    // ...but every reported dimension stays perfect since it maps to none.
    expect(result.dimensions.every((d) => d.score === 100)).toBe(true);
  });
});

describe('severityBreakdown', () => {
  it('counts findings per severity including zero buckets', () => {
    const findings = [
      finding('critical', 'security'),
      finding('critical', 'security'),
      finding('low', 'documentation'),
    ];
    expect(severityBreakdown(findings)).toEqual({
      critical: 2,
      high: 0,
      medium: 0,
      low: 1,
      info: 0,
    });
  });
});

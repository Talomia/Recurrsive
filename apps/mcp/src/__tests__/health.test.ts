/**
 * Tests for the MCP health-score module.
 *
 * The overall score and per-dimension maturity breakdown must MIRROR the
 * canonical server logic in `apps/server/src/health-score.ts` — a divergent
 * linear formula previously lived in tools/analyze.ts, and it reported a
 * `testing` dimension no analyzer category maps to (a fabricated permanent
 * 100/optimizing row).
 */

import { describe, it, expect } from 'vitest';
import type { Finding } from '@recurrsive/core';
import { computeHealthScore, computeMaturityScores, severityBreakdown } from '../health.js';

function makeFinding(overrides: Partial<Finding>): Finding {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    analyzer_id: 'test.analyzer',
    title: 'Test finding',
    description: 'A test finding',
    severity: 'medium',
    category: 'security',
    evidence: [],
    locations: [],
    confidence: 0.8,
    tags: [],
    created_at: new Date().toISOString(),
    ...overrides,
  } as Finding;
}

describe('computeHealthScore', () => {
  it('returns 100 for zero findings', () => {
    expect(computeHealthScore([])).toBe(100);
  });

  it('matches the canonical exponential decay (10 criticals → ~61)', () => {
    const findings = Array.from({ length: 10 }, () =>
      makeFinding({ severity: 'critical' }),
    );
    expect(computeHealthScore(findings)).toBe(Math.round(100 * Math.exp(-100 / 200)));
  });
});

describe('computeMaturityScores', () => {
  it('does NOT report a testing dimension — no analyzer category maps to it', () => {
    const scores = computeMaturityScores([makeFinding({ category: 'security' })]);
    expect(scores.some((s) => s.dimension === 'testing')).toBe(false);
  });

  it('reports the same dimensions as the canonical server logic', () => {
    const scores = computeMaturityScores([]);
    expect(scores.map((s) => s.dimension).sort()).toEqual(
      [
        'ai',
        'architecture',
        'data',
        'developer_experience',
        'documentation',
        'operational',
        'product',
        'reliability',
        'security',
      ],
    );
  });

  it('uses the canonical count-based exponential decay per dimension', () => {
    const findings = Array.from({ length: 5 }, () =>
      makeFinding({ category: 'security' }),
    );
    const scores = computeMaturityScores(findings);
    const security = scores.find((s) => s.dimension === 'security')!;
    // round(100 * e^(-5/10)) = 61, NOT the removed linear 100 - Σweight*5.
    expect(security.score).toBe(Math.round(100 * Math.exp(-5 / 10)));
    expect(security.issueCount).toBe(5);
  });

  it('uses the canonical level thresholds (80/60/40/20)', () => {
    // 5 findings → score 61 → 'managed' under canonical thresholds
    // (the removed divergent thresholds 90/70/50/30 would say 'defined').
    const findings = Array.from({ length: 5 }, () =>
      makeFinding({ category: 'security' }),
    );
    const security = computeMaturityScores(findings).find((s) => s.dimension === 'security')!;
    expect(security.level).toBe('managed');

    // Zero findings → 100 → 'optimizing'.
    const clean = computeMaturityScores([]).find((s) => s.dimension === 'security')!;
    expect(clean.level).toBe('optimizing');
  });

  it('maps every finding category to exactly one dimension (none dropped)', () => {
    const categories: Array<Finding['category']> = [
      'architecture', 'performance', 'security', 'cost', 'ai_quality',
      'reliability', 'ux', 'accessibility', 'privacy', 'compliance',
      'developer_experience', 'product', 'data', 'documentation', 'infrastructure',
    ];
    const findings = categories.map((category) => makeFinding({ category }));
    const scores = computeMaturityScores(findings);
    const totalCounted = scores.reduce((sum, s) => sum + s.issueCount, 0);
    expect(totalCounted).toBe(categories.length);
  });

  it('surfaces critical/high titles as top risks', () => {
    const findings = [
      makeFinding({ category: 'security', severity: 'critical', title: 'Big problem' }),
      makeFinding({ category: 'security', severity: 'low', title: 'Small problem' }),
    ];
    const security = computeMaturityScores(findings).find((s) => s.dimension === 'security')!;
    expect(security.topRisks).toEqual(['Big problem']);
  });
});

describe('severityBreakdown', () => {
  it('tallies all severities including zero buckets', () => {
    const findings = [
      makeFinding({ severity: 'critical' }),
      makeFinding({ severity: 'low' }),
      makeFinding({ severity: 'low' }),
    ];
    expect(severityBreakdown(findings)).toEqual({
      critical: 1,
      high: 0,
      medium: 0,
      low: 2,
      info: 0,
    });
  });
});

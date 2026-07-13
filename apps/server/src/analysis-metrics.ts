import { calculateFindingHealth, type MaturityScore } from '@recurrsive/core';
import type { AnalysisCache } from './state.js';

/** Compute health deterministically from a persisted analysis cache. */
export function calculateHealthScore(cache: AnalysisCache | null): {
  overall: number;
  dimensions: MaturityScore[];
} {
  if (!cache) return { overall: 0, dimensions: [] };

  const overall = calculateFindingHealth(cache.findings);

  const categoryFindings = new Map<string, number>();
  for (const finding of cache.findings) {
    categoryFindings.set(finding.category, (categoryFindings.get(finding.category) ?? 0) + 1);
  }

  const dimensions: MaturityScore[] = [
    'architecture',
    'security',
    'reliability',
    'data',
    'documentation',
    'testing',
  ].map((dimension) => {
    const count = categoryFindings.get(dimension) ?? 0;
    const score = Math.round(100 * Math.exp(-count / 10));
    return {
      dimension: dimension as MaturityScore['dimension'],
      level: score >= 80 ? 'optimizing' : score >= 60 ? 'managed' : score >= 40 ? 'defined' : score >= 20 ? 'developing' : 'initial',
      score,
      trend: 'stable' as const,
      evidence: [`${count} findings in ${dimension} category`],
      recommendations: count > 0 ? [`Address ${count} ${dimension} findings`] : [],
    };
  });

  return { overall, dimensions };
}

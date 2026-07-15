/**
 * @module @recurrsive/presentation/reports/markdown
 *
 * Comprehensive markdown report generator with health scores,
 * opportunity breakdown, and maturity assessment.
 *
 * @packageDocumentation
 */

import type { Opportunity, Severity, MaturityScore } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Report options
// ---------------------------------------------------------------------------

/** Configuration options for markdown report generation. */
export interface MarkdownReportOptions {
  /** Report title (default: "Recurrsive Analysis Report"). */
  title?: string;
  /** Overall health score (0–100). */
  healthScore?: number;
  /** Maturity scores per dimension. */
  maturityScores?: MaturityScore[];
  /** Maximum number of top opportunities to show in detail. */
  maxDetailedOpportunities?: number;
  /** Whether to include action items section. */
  includeActionItems?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_BADGE: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
  info: '🔵',
};

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

/**
 * Get a health status label from a numeric score.
 *
 * @param score - Health score 0–100
 * @returns Status label
 */
function healthLabel(score: number): string {
  if (score >= 90) return '🟢 Excellent';
  if (score >= 75) return '🟡 Good';
  if (score >= 60) return '🟠 Fair';
  if (score >= 40) return '🔴 Needs Attention';
  return '⛔ Critical';
}

/**
 * Count opportunities by a given key extractor.
 *
 * @param opps - Opportunities to count
 * @param key - Key extractor function
 * @returns Record of counts
 */
function countBy(
  opps: readonly Opportunity[],
  key: (o: Opportunity) => string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const o of opps) {
    const k = key(o);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a comprehensive markdown report for a set of opportunities.
 *
 * @param opportunities - Array of opportunities
 * @param options - Report configuration options
 * @returns Formatted markdown report string
 */
export function generateMarkdownReport(
  opportunities: readonly Opportunity[],
  options: MarkdownReportOptions = {},
): string {
  const {
    title = 'Recurrsive Analysis Report',
    healthScore,
    maturityScores,
    maxDetailedOpportunities = 10,
    includeActionItems = true,
  } = options;

  const lines: string[] = [];

  // Title
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  if (healthScore !== undefined) {
    lines.push(`**Health Score:** ${healthScore}/100 ${healthLabel(healthScore)}`);
    lines.push('');
  }
  lines.push(`**Total Findings:** ${opportunities.length}`);
  lines.push('');

  // Severity breakdown
  const sevCounts = countBy(opportunities, (o) => o.severity);
  lines.push('### Severity Breakdown');
  lines.push('');
  lines.push('| Severity | Count | Percentage |');
  lines.push('|----------|-------|------------|');
  for (const sev of SEVERITY_ORDER) {
    const count = sevCounts[sev] ?? 0;
    if (count > 0) {
      const pct = opportunities.length > 0 ? ((count / opportunities.length) * 100).toFixed(1) : '0.0';
      lines.push(`| ${SEVERITY_BADGE[sev]} ${sev} | ${count} | ${pct}% |`);
    }
  }
  lines.push('');

  // Category breakdown
  const catCounts = countBy(opportunities, (o) => o.category);
  lines.push('### Category Breakdown');
  lines.push('');
  lines.push('| Category | Count | Critical | High | Medium | Low |');
  lines.push('|----------|-------|----------|------|--------|-----|');
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  for (const [cat, count] of sortedCats) {
    const catOpps = opportunities.filter((o) => o.category === cat);
    const crit = catOpps.filter((o) => o.severity === 'critical').length;
    const high = catOpps.filter((o) => o.severity === 'high').length;
    const med = catOpps.filter((o) => o.severity === 'medium').length;
    const low = catOpps.filter((o) => o.severity === 'low').length;
    lines.push(`| ${cat} | ${count} | ${crit} | ${high} | ${med} | ${low} |`);
  }
  lines.push('');

  // Maturity scores
  if (maturityScores && maturityScores.length > 0) {
    lines.push('## Maturity Assessment');
    lines.push('');
    lines.push('| Dimension | Level | Score | Trend |');
    lines.push('|-----------|-------|-------|-------|');
    for (const ms of maturityScores) {
      const trendIcon = ms.trend === 'improving' ? '📈' : ms.trend === 'declining' ? '📉' : '➡️';
      lines.push(`| ${ms.dimension} | ${ms.level} | ${ms.score}/100 | ${trendIcon} ${ms.trend} |`);
    }
    lines.push('');

    // Maturity recommendations
    const allRecs = maturityScores.flatMap((ms) =>
      ms.recommendations.map((r) => ({ dimension: ms.dimension, rec: r })),
    );
    if (allRecs.length > 0) {
      lines.push('### Maturity Recommendations');
      lines.push('');
      for (const { dimension, rec } of allRecs) {
        lines.push(`- **${dimension}:** ${rec}`);
      }
      lines.push('');
    }
  }

  // Top Opportunities (detailed)
  const sortedOpps = [...opportunities].sort((a, b) => {
    const sevOrder = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (sevOrder !== 0) return sevOrder;
    return b.confidence - a.confidence;
  });

  const topOpps = sortedOpps.slice(0, maxDetailedOpportunities);

  if (topOpps.length > 0) {
    lines.push('## Top Opportunities');
    lines.push('');

    for (const opp of topOpps) {
      lines.push(`### ${SEVERITY_BADGE[opp.severity]} ${opp.title}`);
      lines.push('');
      lines.push(`**Category:** ${opp.category} | **Type:** ${opp.type} | **Severity:** ${opp.severity} | **Confidence:** ${Math.round(opp.confidence * 100)}%`);
      lines.push('');
      lines.push(`**Problem:** ${opp.problem}`);
      lines.push('');
      lines.push(`**Recommendation:** ${opp.recommendation}`);
      lines.push('');

      // Impact
      lines.push('**Expected Impact:**');
      lines.push(`> ${opp.expected_impact.summary}`);
      lines.push('');
      if (opp.expected_impact.metrics.length > 0) {
        const measured = opp.expected_impact.metrics.filter(
          (m) => m.current_value !== undefined && m.current_value !== '' && m.is_estimate !== true,
        );
        const estimates = opp.expected_impact.metrics.filter(
          (m) => !(m.current_value !== undefined && m.current_value !== '' && m.is_estimate !== true),
        );
        if (measured.length > 0) {
          lines.push('_Measured metrics_');
          lines.push('| Metric | Current | Expected | Change |');
          lines.push('|--------|---------|----------|--------|');
          for (const m of measured) {
            const current = m.current_value?.toString() ?? '—';
            const expected = m.expected_value?.toString() ?? '—';
            const change = m.change_percent !== undefined
              ? `${m.change_percent > 0 ? '+' : ''}${m.change_percent}%`
              : '—';
            lines.push(`| ${m.name} | ${current} | ${expected} | ${change} |`);
          }
          lines.push('');
        }
        if (estimates.length > 0) {
          lines.push('_Projected metrics (estimates — not measured)_');
          for (const m of estimates) {
            const target = m.expected_value !== undefined ? `→ ${m.expected_value}` : '';
            const dir = m.direction ? ` (${m.direction})` : '';
            lines.push(`- ${m.name} _(estimate)_ ${target}${dir}`.trimEnd());
            if (m.assumptions && m.assumptions.length > 0) {
              lines.push(`  - Assumptions: ${m.assumptions.join('; ')}`);
            }
          }
          lines.push('');
        }
      }

      // Effort
      lines.push(`**Effort:** ${opp.effort.t_shirt.toUpperCase()} (${opp.effort.estimated_hours ?? '?'}h)`);
      if (opp.effort.skills_required.length > 0) {
        lines.push(`**Skills:** ${opp.effort.skills_required.join(', ')}`);
      }
      lines.push('');

      // Evidence summary
      if (opp.evidence.length > 0) {
        lines.push(`**Evidence:** ${opp.evidence.length} item(s)`);
        for (const e of opp.evidence.slice(0, 3)) {
          lines.push(`- _${e.type}_ — ${e.description.slice(0, 120)}${e.description.length > 120 ? '…' : ''}`);
        }
        if (opp.evidence.length > 3) {
          lines.push(`- _...and ${opp.evidence.length - 3} more_`);
        }
        lines.push('');
      }

      // Validation
      if (opp.validation.success_criteria.length > 0) {
        lines.push('**Validation Criteria:**');
        for (const c of opp.validation.success_criteria) {
          lines.push(`- [ ] ${c}`);
        }
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // Action Items
  if (includeActionItems) {
    const actionable = sortedOpps.filter(
      (o) => o.status === 'proposed' || o.status === 'accepted',
    );
    if (actionable.length > 0) {
      lines.push('## Action Items');
      lines.push('');
      for (const opp of actionable.slice(0, 20)) {
        const effortTag = `[${opp.effort.t_shirt.toUpperCase()}]`;
        lines.push(`- [ ] ${SEVERITY_BADGE[opp.severity]} ${effortTag} ${opp.title} — ${opp.recommendation.slice(0, 100)}${opp.recommendation.length > 100 ? '…' : ''}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

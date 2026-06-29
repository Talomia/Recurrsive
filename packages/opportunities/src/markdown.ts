/**
 * @module @recurrsive/opportunities/markdown
 *
 * Markdown report generation for opportunities.
 *
 * @packageDocumentation
 */

import type { Opportunity, Evidence, Severity } from '@recurrsive/core';
import { computeScore, rankOpportunities } from './ranking.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Severity badge emoji mapping. */
const SEVERITY_BADGE: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢',
  info: '🔵',
};

/**
 * Format a confidence value as a percentage string.
 *
 * @param value - Confidence between 0 and 1
 * @returns Formatted percentage (e.g. "85%")
 */
function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Render an evidence item as a markdown block.
 *
 * @param evidence - The evidence to render
 * @param idx - Zero-based index for numbering
 * @returns Markdown string for the evidence
 */
function renderEvidence(evidence: Evidence, idx: number): string {
  const lines: string[] = [];
  lines.push(`**Evidence ${idx + 1}** — _${evidence.type}_ (confidence: ${pct(evidence.confidence)})`);
  lines.push('');
  lines.push(`> ${evidence.description}`);
  lines.push('');
  lines.push(`- **Source:** ${evidence.source}`);
  lines.push(`- **Collected:** ${evidence.collected_at}`);
  if (evidence.entity_ids.length > 0) {
    lines.push(`- **Entities:** ${evidence.entity_ids.join(', ')}`);
  }
  return lines.join('\n');
}

/**
 * Render a single opportunity as a detailed markdown section.
 *
 * @param opp - The opportunity to render
 * @returns Markdown string for the opportunity
 */
function renderOpportunityDetail(opp: Opportunity): string {
  const score = computeScore(opp);
  const lines: string[] = [];

  // Header
  lines.push(`### ${SEVERITY_BADGE[opp.severity]} ${opp.title}`);
  lines.push('');
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| **ID** | \`${opp.id}\` |`);
  lines.push(`| **Type** | ${opp.type} |`);
  lines.push(`| **Category** | ${opp.category} |`);
  lines.push(`| **Severity** | ${opp.severity} |`);
  lines.push(`| **Status** | ${opp.status} |`);
  lines.push(`| **Confidence** | ${pct(opp.confidence)} |`);
  lines.push(`| **Composite Score** | ${score.toFixed(3)} |`);
  lines.push(`| **Effort** | ${opp.effort.t_shirt.toUpperCase()} |`);
  lines.push(`| **Risk** | ${opp.risk.level} |`);
  lines.push(`| **Created** | ${opp.created_at} |`);
  lines.push('');

  // Problem & Recommendation
  lines.push('#### Problem');
  lines.push('');
  lines.push(opp.problem);
  lines.push('');
  lines.push('#### Recommendation');
  lines.push('');
  lines.push(opp.recommendation);
  lines.push('');

  // Impact
  lines.push('#### Expected Impact');
  lines.push('');
  lines.push(opp.expected_impact.summary);
  lines.push('');
  if (opp.expected_impact.metrics.length > 0) {
    lines.push('| Metric | Current | Expected | Change |');
    lines.push('|--------|---------|----------|--------|');
    for (const m of opp.expected_impact.metrics) {
      const current = m.current_value?.toString() ?? '—';
      const expected = m.expected_value?.toString() ?? '—';
      const change = m.change_percent !== undefined ? `${m.change_percent > 0 ? '+' : ''}${m.change_percent}%` : '—';
      lines.push(`| ${m.name} | ${current} | ${expected} | ${change} |`);
    }
    lines.push('');
  }
  if (opp.expected_impact.affected_services.length > 0) {
    lines.push(`**Affected Services:** ${opp.expected_impact.affected_services.join(', ')}`);
    lines.push('');
  }

  // Evidence
  if (opp.evidence.length > 0) {
    lines.push('#### Evidence');
    lines.push('');
    opp.evidence.forEach((e, i) => {
      lines.push(renderEvidence(e, i));
      lines.push('');
    });
  }

  // Locations
  if (opp.locations.length > 0) {
    lines.push('#### Locations');
    lines.push('');
    for (const loc of opp.locations) {
      const lineRange =
        loc.start_line !== undefined
          ? `:${loc.start_line}${loc.end_line !== undefined ? `-${loc.end_line}` : ''}`
          : '';
      lines.push(`- \`${loc.file}${lineRange}\``);
    }
    lines.push('');
  }

  // Risk
  lines.push('#### Risk Assessment');
  lines.push('');
  lines.push(`**Level:** ${opp.risk.level}`);
  lines.push('');
  lines.push(opp.risk.description);
  lines.push('');
  if (opp.risk.mitigations.length > 0) {
    lines.push('**Mitigations:**');
    for (const m of opp.risk.mitigations) {
      lines.push(`- ${m}`);
    }
    lines.push('');
  }

  // Validation Plan
  if (opp.validation.steps.length > 0) {
    lines.push('#### Validation Plan');
    lines.push('');
    for (const step of opp.validation.steps) {
      const duration = step.duration ? ` (${step.duration})` : '';
      lines.push(`- [${step.type}] ${step.description}${duration}`);
    }
    lines.push('');
    if (opp.validation.success_criteria.length > 0) {
      lines.push('**Success Criteria:**');
      for (const c of opp.validation.success_criteria) {
        lines.push(`- ${c}`);
      }
      lines.push('');
    }
  }

  // Actual impact (if present)
  if (opp.actual_impact) {
    lines.push('#### Actual Impact (Post-Implementation)');
    lines.push('');
    lines.push(opp.actual_impact.summary);
    lines.push('');
  }

  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a full markdown report for a set of opportunities.
 *
 * Includes:
 * - Executive summary with counts and severity breakdown
 * - Summary table of all opportunities
 * - Individual detailed sections for each opportunity
 * - Evidence, impact metrics, and validation plans
 *
 * @param opportunities - Array of opportunities to report on
 * @returns A complete markdown report string
 */
export function exportToMarkdown(opportunities: readonly Opportunity[]): string {
  const ranked = rankOpportunities(opportunities);
  const lines: string[] = [];

  // Title
  lines.push('# Recurrsive Opportunity Report');
  lines.push('');
  lines.push(`_Generated: ${new Date().toISOString()}_`);
  lines.push('');

  // Executive Summary
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(`**Total Opportunities:** ${ranked.length}`);
  lines.push('');

  // Severity breakdown
  const severityCounts: Record<string, number> = {};
  for (const opp of ranked) {
    severityCounts[opp.severity] = (severityCounts[opp.severity] ?? 0) + 1;
  }
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const sev of ['critical', 'high', 'medium', 'low', 'info'] as const) {
    const count = severityCounts[sev] ?? 0;
    if (count > 0) {
      lines.push(`| ${SEVERITY_BADGE[sev]} ${sev} | ${count} |`);
    }
  }
  lines.push('');

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  for (const opp of ranked) {
    categoryCounts[opp.category] = (categoryCounts[opp.category] ?? 0) + 1;
  }
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  for (const [cat, count] of Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push('');

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const opp of ranked) {
    statusCounts[opp.status] = (statusCounts[opp.status] ?? 0) + 1;
  }
  lines.push('| Status | Count |');
  lines.push('|--------|-------|');
  for (const [status, count] of Object.entries(statusCounts).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${status} | ${count} |`);
  }
  lines.push('');

  // Summary Table
  lines.push('## Opportunity Summary');
  lines.push('');
  lines.push('| # | Severity | Title | Category | Score | Effort | Status |');
  lines.push('|---|----------|-------|----------|-------|--------|--------|');
  ranked.forEach((opp, i) => {
    const score = computeScore(opp);
    lines.push(
      `| ${i + 1} | ${SEVERITY_BADGE[opp.severity]} ${opp.severity} | ${opp.title} | ${opp.category} | ${score.toFixed(3)} | ${opp.effort.t_shirt.toUpperCase()} | ${opp.status} |`,
    );
  });
  lines.push('');

  // Detailed Sections
  lines.push('## Detailed Findings');
  lines.push('');
  for (const opp of ranked) {
    lines.push(renderOpportunityDetail(opp));
  }

  return lines.join('\n');
}

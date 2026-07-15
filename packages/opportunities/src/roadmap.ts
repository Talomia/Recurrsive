/**
 * @module @recurrsive/opportunities/roadmap
 *
 * Roadmap generator that groups opportunities into implementation phases
 * based on effort size and confidence level.
 *
 * @packageDocumentation
 */

import type { Opportunity, Severity } from '@recurrsive/core';
import { computeScore, rankOpportunities } from './ranking.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Human-friendly phase name. */
export type PhaseName = 'Quick Wins' | 'Strategic Improvements' | 'Long-term Investments';

/** A single opportunity entry within a roadmap phase. */
export interface RoadmapEntry {
  /** The full opportunity. */
  opportunity: Opportunity;
  /** Composite score. */
  score: number;
  /** Estimated hours (if available). */
  estimatedHours: number | undefined;
}

/** A phase in the implementation roadmap. */
export interface RoadmapPhase {
  /** Human-friendly phase name. */
  name: PhaseName;
  /** Phase description. */
  description: string;
  /** Ranked entries in this phase. */
  entries: RoadmapEntry[];
  /** Total estimated hours across all entries (where available). */
  totalEstimatedHours: number;
  /** Aggregate estimated impact score for this phase. */
  totalEstimatedImpact: number;
  /** Count of opportunities in this phase. */
  count: number;
}

/** The complete roadmap. */
export interface Roadmap {
  /** ISO-8601 generation timestamp. */
  generatedAt: string;
  /** Ordered phases. */
  phases: RoadmapPhase[];
  /** Total number of opportunities across all phases. */
  totalOpportunities: number;
  /** Summary statistics. */
  summary: {
    totalEstimatedHours: number;
    totalEstimatedImpact: number;
    severityBreakdown: Record<Severity, number>;
    categoryBreakdown: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Phase classification
// ---------------------------------------------------------------------------

/** Impact weight by severity. */
const SEVERITY_IMPACT_WEIGHT: Record<Severity, number> = {
  critical: 10,
  high: 7,
  medium: 4,
  low: 2,
  info: 1,
};

/**
 * Classify an opportunity into its roadmap phase.
 *
 * - **Quick Wins:** xs or s effort with ≥ 0.5 confidence
 * - **Strategic Improvements:** m effort, or xs/s with < 0.5 confidence
 * - **Long-term Investments:** l or xl effort
 *
 * @param opp - The opportunity to classify
 * @returns The phase name
 */
function classifyPhase(opp: Opportunity): PhaseName {
  const effort = opp.effort.t_shirt;
  if ((effort === 'xs' || effort === 's') && opp.confidence >= 0.5) {
    return 'Quick Wins';
  }
  if (effort === 'l' || effort === 'xl') {
    return 'Long-term Investments';
  }
  return 'Strategic Improvements';
}

/**
 * Compute a rough impact value for an opportunity based on severity and
 * confidence only.
 *
 * The previous formula multiplied by the raw metric count, which is unbounded
 * and trivially inflated by model-generated (possibly hallucinated) estimate
 * metrics. Impact must not scale with how many metrics an LLM happened to
 * emit, so metric count is dropped entirely in favour of severity × confidence
 * (bounded by the severity weight).
 *
 * @param opp - The opportunity to assess
 * @returns A numeric impact estimate in [0, severityWeight]
 */
function estimateImpact(opp: Opportunity): number {
  const severityWeight = SEVERITY_IMPACT_WEIGHT[opp.severity];
  return severityWeight * opp.confidence;
}

// ---------------------------------------------------------------------------
// Phase metadata
// ---------------------------------------------------------------------------

const PHASE_DESCRIPTIONS: Record<PhaseName, string> = {
  'Quick Wins':
    'Low-effort, high-confidence opportunities that can be implemented quickly for immediate impact.',
  'Strategic Improvements':
    'Medium-effort improvements requiring planning and coordination. Deliver significant value over weeks.',
  'Long-term Investments':
    'Large-effort initiatives that deliver transformative results. Require dedicated resources and multi-sprint planning.',
};

const PHASE_ORDER: PhaseName[] = ['Quick Wins', 'Strategic Improvements', 'Long-term Investments'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate an implementation roadmap from a set of opportunities.
 *
 * Groups opportunities into three phases:
 * 1. **Quick Wins** — xs/s effort, high confidence
 * 2. **Strategic Improvements** — m effort
 * 3. **Long-term Investments** — l/xl effort
 *
 * Within each phase, opportunities are ranked by their composite score.
 * Each phase includes total estimated hours and aggregate impact.
 *
 * @param opportunities - Array of opportunities to plan
 * @returns A complete roadmap with phases and summary statistics
 */
export function generateRoadmap(opportunities: readonly Opportunity[]): Roadmap {
  // Phase buckets
  const buckets = new Map<PhaseName, RoadmapEntry[]>();
  for (const name of PHASE_ORDER) {
    buckets.set(name, []);
  }

  // Classify and collect
  const ranked = rankOpportunities(opportunities);
  for (const opp of ranked) {
    const phase = classifyPhase(opp);
    buckets.get(phase)!.push({
      opportunity: opp,
      score: computeScore(opp),
      estimatedHours: opp.effort.estimated_hours,
    });
  }

  // Build phases
  const phases: RoadmapPhase[] = PHASE_ORDER.map((name) => {
    const entries = buckets.get(name)!;
    const totalEstimatedHours = entries.reduce(
      (sum, e) => sum + (e.estimatedHours ?? 0),
      0,
    );
    const totalEstimatedImpact = entries.reduce(
      (sum, e) => sum + estimateImpact(e.opportunity),
      0,
    );

    return {
      name,
      description: PHASE_DESCRIPTIONS[name],
      entries,
      totalEstimatedHours: Math.round(totalEstimatedHours * 10) / 10,
      totalEstimatedImpact: Math.round(totalEstimatedImpact * 100) / 100,
      count: entries.length,
    };
  });

  // Summary statistics
  const severityBreakdown: Record<Severity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
  };
  const categoryBreakdown: Record<string, number> = {};

  for (const opp of opportunities) {
    severityBreakdown[opp.severity]++;
    categoryBreakdown[opp.category] = (categoryBreakdown[opp.category] ?? 0) + 1;
  }

  return {
    generatedAt: new Date().toISOString(),
    phases,
    totalOpportunities: opportunities.length,
    summary: {
      totalEstimatedHours: phases.reduce((s, p) => s + p.totalEstimatedHours, 0),
      totalEstimatedImpact: phases.reduce((s, p) => s + p.totalEstimatedImpact, 0),
      severityBreakdown,
      categoryBreakdown,
    },
  };
}

/**
 * Render a roadmap as a formatted markdown string.
 *
 * @param roadmap - The roadmap to render
 * @returns Markdown-formatted roadmap report
 */
export function renderRoadmapMarkdown(roadmap: Roadmap): string {
  const lines: string[] = [];

  lines.push('# Implementation Roadmap');
  lines.push('');
  lines.push(`_Generated: ${roadmap.generatedAt}_`);
  lines.push('');
  lines.push(`**Total Opportunities:** ${roadmap.totalOpportunities}`);
  lines.push(`**Total Estimated Hours:** ${roadmap.summary.totalEstimatedHours}`);
  lines.push(`**Total Estimated Impact:** ${roadmap.summary.totalEstimatedImpact.toFixed(2)}`);
  lines.push('');

  for (const phase of roadmap.phases) {
    lines.push(`## ${phase.name} (${phase.count} items)`);
    lines.push('');
    lines.push(`_${phase.description}_`);
    lines.push('');
    lines.push(`- **Estimated Hours:** ${phase.totalEstimatedHours}`);
    lines.push(`- **Estimated Impact:** ${phase.totalEstimatedImpact.toFixed(2)}`);
    lines.push('');

    if (phase.entries.length === 0) {
      lines.push('_No opportunities in this phase._');
      lines.push('');
      continue;
    }

    lines.push('| # | Title | Category | Severity | Score | Effort | Hours |');
    lines.push('|---|-------|----------|----------|-------|--------|-------|');
    phase.entries.forEach((entry, i) => {
      const opp = entry.opportunity;
      const hours = entry.estimatedHours?.toString() ?? '—';
      lines.push(
        `| ${i + 1} | ${opp.title} | ${opp.category} | ${opp.severity} | ${entry.score.toFixed(3)} | ${opp.effort.t_shirt.toUpperCase()} | ${hours} |`,
      );
    });
    lines.push('');
  }

  // Severity breakdown
  lines.push('## Summary');
  lines.push('');
  lines.push('### Severity Breakdown');
  lines.push('');
  lines.push('| Severity | Count |');
  lines.push('|----------|-------|');
  for (const [sev, count] of Object.entries(roadmap.summary.severityBreakdown)) {
    if (count > 0) {
      lines.push(`| ${sev} | ${count} |`);
    }
  }
  lines.push('');

  // Category breakdown
  lines.push('### Category Breakdown');
  lines.push('');
  lines.push('| Category | Count |');
  lines.push('|----------|-------|');
  for (const [cat, count] of Object.entries(roadmap.summary.categoryBreakdown).sort(
    (a, b) => b[1] - a[1],
  )) {
    lines.push(`| ${cat} | ${count} |`);
  }
  lines.push('');

  return lines.join('\n');
}

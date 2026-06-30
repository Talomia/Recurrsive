/**
 * @module @recurrsive/presentation/reports/json
 *
 * Structured JSON report generator for machine-readable export.
 *
 * Produces a clean JSON object summarizing opportunities, health scores,
 * maturity dimensions, and severity distributions for consumption by
 * CI/CD pipelines, monitoring dashboards, and third-party integrations.
 *
 * @packageDocumentation
 */

import type { Opportunity, MaturityScore, Severity } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for JSON report generation. */
export interface JsonReportOptions {
  /** Report title. */
  title?: string;
  /** Overall health score (0–100). */
  healthScore?: number;
  /** Maturity scores per dimension. */
  maturityScores?: MaturityScore[];
  /** Maximum number of detailed opportunities to include. */
  maxItems?: number;
  /** Whether to include the full evidence array for each opportunity. */
  includeEvidence?: boolean;
  /** Whether to pretty-print the output (default: true). */
  prettyPrint?: boolean;
}

/** Severity distribution counts. */
interface SeverityDistribution {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

/** Category distribution counts. */
interface CategoryDistribution {
  [category: string]: number;
}

/** The top-level JSON report structure. */
interface JsonReport {
  $schema: string;
  version: string;
  generated_at: string;
  title: string;
  summary: {
    total_opportunities: number;
    health_score: number | null;
    severity_distribution: SeverityDistribution;
    category_distribution: CategoryDistribution;
  };
  maturity: MaturityScore[] | null;
  opportunities: JsonOpportunity[];
}

/** A single opportunity in JSON format. */
interface JsonOpportunity {
  id: string;
  title: string;
  type: string;
  category: string;
  severity: string;
  status: string;
  problem: string;
  recommendation: string;
  confidence: number;
  expected_impact: {
    summary: string;
    metrics: Array<Record<string, unknown>>;
  };
  effort: {
    hours: number | undefined;
    t_shirt: string;
    skills: string[];
  };
  evidence?: Array<{
    type: string;
    description: string;
  }>;
  locations: Array<{
    file: string;
    start_line?: number;
    end_line?: number;
  }>;
  tags: string[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

function countSeverities(opps: readonly Opportunity[]): SeverityDistribution {
  const dist: SeverityDistribution = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const opp of opps) {
    if (opp.severity in dist) {
      dist[opp.severity as keyof SeverityDistribution]++;
    }
  }
  return dist;
}

function countCategories(opps: readonly Opportunity[]): CategoryDistribution {
  const dist: CategoryDistribution = {};
  for (const opp of opps) {
    dist[opp.category] = (dist[opp.category] ?? 0) + 1;
  }
  return dist;
}

function sortBySeverity(opps: readonly Opportunity[]): Opportunity[] {
  return [...opps].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a structured JSON report from opportunities.
 *
 * @param opportunities - Array of opportunities to report on
 * @param options - Report configuration
 * @returns JSON string
 */
export function generateJsonReport(
  opportunities: readonly Opportunity[],
  options: JsonReportOptions = {},
): string {
  const {
    title = 'Recurrsive Analysis Report',
    healthScore,
    maturityScores,
    maxItems = 100,
    includeEvidence = true,
    prettyPrint = true,
  } = options;

  const sorted = sortBySeverity(opportunities);
  const capped = sorted.slice(0, maxItems);

  const jsonOpps: JsonOpportunity[] = capped.map((opp) => {
    const result: JsonOpportunity = {
      id: opp.id,
      title: opp.title,
      type: opp.type,
      category: opp.category,
      severity: opp.severity,
      status: opp.status,
      problem: opp.problem,
      recommendation: opp.recommendation,
      confidence: opp.confidence,
      expected_impact: {
        summary: opp.expected_impact.summary,
        metrics: opp.expected_impact.metrics ?? [],
      },
      effort: {
        hours: opp.effort.estimated_hours,
        t_shirt: opp.effort.t_shirt,
        skills: opp.effort.skills_required,
      },
      locations: opp.locations.map((loc) => ({
        file: loc.file,
        start_line: loc.start_line,
        end_line: loc.end_line,
      })),
      tags: opp.tags ?? [],
      created_at: opp.created_at,
    };

    if (includeEvidence) {
      result.evidence = opp.evidence.map((e) => ({
        type: e.type,
        description: e.description,
      }));
    }

    return result;
  });

  const report: JsonReport = {
    $schema: 'https://recurrsive.dev/schemas/report-v1.json',
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    title,
    summary: {
      total_opportunities: opportunities.length,
      health_score: healthScore ?? null,
      severity_distribution: countSeverities(opportunities),
      category_distribution: countCategories(opportunities),
    },
    maturity: maturityScores ?? null,
    opportunities: jsonOpps,
  };

  return prettyPrint
    ? JSON.stringify(report, null, 2)
    : JSON.stringify(report);
}

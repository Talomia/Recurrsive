/**
 * @module @recurrsive/presentation/reports/sarif
 *
 * SARIF v2.1.0 compliant report generator.
 *
 * Produces Static Analysis Results Interchange Format (SARIF) output
 * suitable for GitHub Advanced Security, Azure DevOps, VS Code SARIF
 * Viewer, and other SARIF-compatible tools.
 *
 * @see https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
 *
 * @packageDocumentation
 */

import type { Opportunity, Severity } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// SARIF types (v2.1.0 subset)
// ---------------------------------------------------------------------------

type SarifLevel = 'error' | 'warning' | 'note' | 'none';

interface SarifPhysicalLocation {
  artifactLocation: { uri: string };
  region?: {
    startLine?: number;
    endLine?: number;
    startColumn?: number;
    endColumn?: number;
  };
}

interface SarifLocation {
  physicalLocation: SarifPhysicalLocation;
}

interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: SarifLocation[];
  properties: Record<string, unknown>;
}

interface SarifReportingDescriptor {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  properties: Record<string, unknown>;
}

interface SarifToolComponent {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifReportingDescriptor[];
}

interface SarifRun {
  tool: { driver: SarifToolComponent };
  results: SarifResult[];
  invocations: Array<{
    executionSuccessful: boolean;
    startTimeUtc: string;
    endTimeUtc: string;
  }>;
}

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/** Options for SARIF report generation. */
export interface SarifReportOptions {
  /** Report title. */
  title?: string;
  /** Maximum number of results to include. */
  maxItems?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map Recurrsive severity to SARIF level. */
function severityToLevel(severity: Severity): SarifLevel {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'error';
    case 'medium':
      return 'warning';
    case 'low':
    case 'info':
      return 'note';
    default:
      return 'note';
  }
}

/** Sanitize a string into a valid SARIF rule ID (alphanumeric + dashes). */
function toRuleId(opp: Opportunity): string {
  return `recurrsive/${opp.category}/${opp.id.slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate a SARIF v2.1.0 report from opportunities.
 *
 * @param opportunities - Array of opportunities to report on
 * @param options - SARIF generation options
 * @returns JSON string in SARIF format
 *
 * @example
 * ```ts
 * const sarif = generateSarifReport(opportunities);
 * await writeFile('results.sarif', sarif);
 * ```
 */
export function generateSarifReport(
  opportunities: readonly Opportunity[],
  options: SarifReportOptions = {},
): string {
  const { maxItems = 500 } = options;
  const capped = opportunities.slice(0, maxItems);

  const now = new Date().toISOString();

  // Build rule descriptors (one per unique opportunity)
  const rules: SarifReportingDescriptor[] = capped.map((opp) => ({
    id: toRuleId(opp),
    name: opp.title.replace(/[^a-zA-Z0-9\s\-_]/g, '').slice(0, 128),
    shortDescription: { text: opp.problem.slice(0, 256) },
    fullDescription: { text: opp.recommendation },
    properties: {
      category: opp.category,
      severity: opp.severity,
      confidence: opp.confidence,
      type: opp.type,
      effort_hours: opp.effort.estimated_hours,
      effort_size: opp.effort.t_shirt,
    },
  }));

  // Build results
  const results: SarifResult[] = capped.map((opp) => {
    const locations: SarifLocation[] = opp.locations.length > 0
      ? opp.locations.map((loc) => ({
          physicalLocation: {
            artifactLocation: { uri: loc.file },
            region: loc.start_line
              ? {
                  startLine: loc.start_line,
                  endLine: loc.end_line ?? loc.start_line,
                }
              : undefined,
          },
        }))
      : [
          {
            physicalLocation: {
              artifactLocation: { uri: 'project' },
            },
          },
        ];

    return {
      ruleId: toRuleId(opp),
      level: severityToLevel(opp.severity),
      message: {
        text: `${opp.problem}\n\nRecommendation: ${opp.recommendation}`,
      },
      locations,
      properties: {
        status: opp.status,
        tags: opp.tags ?? [],
        impact: opp.expected_impact.summary,
      },
    };
  });

  const log: SarifLog = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Recurrsive',
            version: '0.1.2',
            informationUri: 'https://github.com/Talomia/Recurrsive',
            rules,
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: now,
            endTimeUtc: now,
          },
        ],
      },
    ],
  };

  return JSON.stringify(log, null, 2);
}

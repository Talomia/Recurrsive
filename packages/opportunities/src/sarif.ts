/**
 * @module @recurrsive/opportunities/sarif
 *
 * Full SARIF v2.1.0 compliant export for opportunities.
 *
 * @packageDocumentation
 */

import type { Opportunity, Severity } from '@recurrsive/core';
import { computeScore } from './ranking.js';

// ---------------------------------------------------------------------------
// SARIF types (subset needed for export)
// ---------------------------------------------------------------------------

/** SARIF notification/result level. */
type SarifLevel = 'error' | 'warning' | 'note' | 'none';

/** SARIF physical location. */
interface SarifPhysicalLocation {
  artifactLocation: { uri: string };
  region?: {
    startLine?: number;
    endLine?: number;
    startColumn?: number;
    endColumn?: number;
  };
}

/** SARIF location wrapper. */
interface SarifLocation {
  physicalLocation: SarifPhysicalLocation;
}

/** A single SARIF result. */
interface SarifResult {
  ruleId: string;
  level: SarifLevel;
  message: { text: string };
  locations: SarifLocation[];
  properties: Record<string, unknown>;
}

/** SARIF rule descriptor. */
interface SarifReportingDescriptor {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  helpUri?: string;
  properties: Record<string, unknown>;
}

/** SARIF tool component. */
interface SarifToolComponent {
  name: string;
  version: string;
  informationUri: string;
  rules: SarifReportingDescriptor[];
}

/** A full SARIF run. */
interface SarifRun {
  tool: { driver: SarifToolComponent };
  results: SarifResult[];
  invocations: Array<{
    executionSuccessful: boolean;
    startTimeUtc: string;
  }>;
}

/** Top-level SARIF log. */
interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

// ---------------------------------------------------------------------------
// Level mapping
// ---------------------------------------------------------------------------

/**
 * Map an opportunity severity to a SARIF result level.
 *
 * - critical / high → error
 * - medium → warning
 * - low / info → note
 *
 * @param severity - The Recurrsive severity level
 * @returns The corresponding SARIF level
 */
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
  }
}

// ---------------------------------------------------------------------------
// Location conversion
// ---------------------------------------------------------------------------

/**
 * Convert opportunity source locations to SARIF locations.
 *
 * @param opp - The opportunity whose locations to convert
 * @returns Array of SARIF location objects
 */
function toSarifLocations(opp: Opportunity): SarifLocation[] {
  if (opp.locations.length === 0) {
    return [];
  }

  return opp.locations.map((loc) => {
    const sarifLoc: SarifLocation = {
      physicalLocation: {
        artifactLocation: { uri: loc.file },
      },
    };

    if (loc.start_line !== undefined) {
      sarifLoc.physicalLocation.region = {
        startLine: loc.start_line,
        endLine: loc.end_line,
        startColumn: loc.start_column,
        endColumn: loc.end_column,
      };
    }

    return sarifLoc;
  });
}

// ---------------------------------------------------------------------------
// Rule extraction
// ---------------------------------------------------------------------------

/**
 * Extract unique SARIF rule descriptors from a set of opportunities.
 *
 * Each opportunity produces one rule keyed by `category/type`.
 *
 * @param opportunities - Source opportunities
 * @returns Array of unique rule descriptors
 */
function extractRules(opportunities: readonly Opportunity[]): SarifReportingDescriptor[] {
  const seen = new Map<string, SarifReportingDescriptor>();

  for (const opp of opportunities) {
    const ruleId = `recurrsive/${opp.category}/${opp.type}`;
    if (!seen.has(ruleId)) {
      seen.set(ruleId, {
        id: ruleId,
        name: `${opp.category}-${opp.type}`,
        shortDescription: { text: `${opp.category} ${opp.type} finding` },
        fullDescription: {
          text: `Opportunities, risks, and debt items in the ${opp.category} category.`,
        },
        properties: {
          category: opp.category,
          type: opp.type,
        },
      });
    }
  }

  return Array.from(seen.values());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Export an array of opportunities as a SARIF v2.1.0 JSON string.
 *
 * Produces a fully compliant SARIF log with:
 * - `$schema` pointing to the official SARIF JSON schema
 * - `version` set to `"2.1.0"`
 * - A single `run` containing all results
 * - `tool.driver.rules` with de-duplicated rule descriptors
 * - Per-result `locations`, `level`, and `properties`
 *
 * @param opportunities - The opportunities to export
 * @returns A formatted SARIF JSON string
 */
export function exportToSarif(opportunities: readonly Opportunity[]): string {
  const results: SarifResult[] = opportunities.map((opp) => ({
    ruleId: `recurrsive/${opp.category}/${opp.type}`,
    level: severityToLevel(opp.severity),
    message: {
      text: `${opp.title}\n\nProblem: ${opp.problem}\n\nRecommendation: ${opp.recommendation}`,
    },
    locations: toSarifLocations(opp),
    properties: {
      id: opp.id,
      severity: opp.severity,
      category: opp.category,
      type: opp.type,
      status: opp.status,
      confidence: opp.confidence,
      compositeScore: computeScore(opp),
      effort: opp.effort.t_shirt,
      riskLevel: opp.risk.level,
      evidenceCount: opp.evidence.length,
      affectedServices: opp.expected_impact.affected_services,
      createdAt: opp.created_at,
      updatedAt: opp.updated_at,
    },
  }));

  const sarifLog: SarifLog = {
    $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Recurrsive',
            version: '0.1.0',
            informationUri: 'https://github.com/recurrsive/recurrsive',
            rules: extractRules(opportunities),
          },
        },
        results,
        invocations: [
          {
            executionSuccessful: true,
            startTimeUtc: new Date().toISOString(),
          },
        ],
      },
    ],
  };

  return JSON.stringify(sarifLog, null, 2);
}

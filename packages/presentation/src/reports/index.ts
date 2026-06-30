/**
 * @module @recurrsive/presentation/reports
 *
 * Report factory and barrel export.
 *
 * @packageDocumentation
 */

import type { Opportunity, MaturityScore } from '@recurrsive/core';
import { generateMarkdownReport, type MarkdownReportOptions } from './markdown.js';
import { generateHtmlReport, type HtmlReportOptions } from './html.js';
import { generateJsonReport, type JsonReportOptions } from './json.js';
import { generateSarifReport, type SarifReportOptions } from './sarif.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported report formats. */
export type ReportFormat = 'markdown' | 'html' | 'json' | 'sarif';

/** Unified report generation options. */
export interface ReportOptions {
  /** Report title. */
  title?: string;
  /** Overall health score (0–100). */
  healthScore?: number;
  /** Maturity scores per dimension. */
  maturityScores?: MaturityScore[];
  /** Maximum number of detailed items to show. */
  maxItems?: number;
  /** Whether to include action items (markdown only). */
  includeActionItems?: boolean;
  /** Whether to include evidence (JSON only, default: true). */
  includeEvidence?: boolean;
  /** Whether to pretty-print output (JSON only, default: true). */
  prettyPrint?: boolean;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Generate a report in the specified format.
 *
 * @param opportunities - Array of opportunities to report on
 * @param format - Output format ('markdown', 'html', 'json', or 'sarif')
 * @param options - Report configuration options
 * @returns The formatted report string
 * @throws {Error} If the format is unsupported
 *
 * @example
 * ```ts
 * const markdown = generateReport(opportunities, 'markdown', {
 *   healthScore: 78,
 *   title: 'Sprint Review',
 * });
 *
 * const sarif = generateReport(opportunities, 'sarif');
 * const json = generateReport(opportunities, 'json', { prettyPrint: false });
 * ```
 */
export function generateReport(
  opportunities: readonly Opportunity[],
  format: ReportFormat,
  options: ReportOptions = {},
): string {
  switch (format) {
    case 'markdown': {
      const mdOpts: MarkdownReportOptions = {
        title: options.title,
        healthScore: options.healthScore,
        maturityScores: options.maturityScores,
        maxDetailedOpportunities: options.maxItems,
        includeActionItems: options.includeActionItems,
      };
      return generateMarkdownReport(opportunities, mdOpts);
    }
    case 'html': {
      const htmlOpts: HtmlReportOptions = {
        title: options.title,
        healthScore: options.healthScore,
        maturityScores: options.maturityScores,
        maxCards: options.maxItems,
      };
      return generateHtmlReport(opportunities, htmlOpts);
    }
    case 'json': {
      const jsonOpts: JsonReportOptions = {
        title: options.title,
        healthScore: options.healthScore,
        maturityScores: options.maturityScores,
        maxItems: options.maxItems,
        includeEvidence: options.includeEvidence,
        prettyPrint: options.prettyPrint,
      };
      return generateJsonReport(opportunities, jsonOpts);
    }
    case 'sarif': {
      const sarifOpts: SarifReportOptions = {
        title: options.title,
        maxItems: options.maxItems,
      };
      return generateSarifReport(opportunities, sarifOpts);
    }
    default: {
      const _exhaustive: never = format;
      throw new Error(`Unsupported report format: ${String(_exhaustive)}`);
    }
  }
}

// Re-exports
export { generateMarkdownReport } from './markdown.js';
export type { MarkdownReportOptions } from './markdown.js';
export { generateHtmlReport } from './html.js';
export type { HtmlReportOptions } from './html.js';
export { generateJsonReport } from './json.js';
export type { JsonReportOptions } from './json.js';
export { generateSarifReport } from './sarif.js';
export type { SarifReportOptions } from './sarif.js';

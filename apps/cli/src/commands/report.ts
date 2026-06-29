/**
 * @module @recurrsive/cli/commands/report
 *
 * `recurrsive report` — Generate reports from saved analysis results.
 *
 * Reads findings and opportunities produced by `recurrsive analyze`,
 * then formats them using the presentation package's report generators
 * or the opportunities package's SARIF exporter.
 *
 * Supported formats: markdown (default), html, sarif, json.
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Command } from 'commander';
import type { Finding, Opportunity } from '@recurrsive/core';
import { OpportunityManager } from '@recurrsive/opportunities';
import { exportToSarif } from '@recurrsive/opportunities';
import { generateMarkdownReport, generateHtmlReport } from '@recurrsive/presentation';
import { loadConfig } from '../config/loader.js';
import {
  banner,
  header,
  success,
  error,
  info,
  bold,
  cyan,
  dim,
  magenta,
  table,
  severityColor,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Supported report output formats.
 */
type ReportFormat = 'markdown' | 'html' | 'sarif' | 'json';

/**
 * File extension for each report format.
 *
 * @param format - The report format.
 * @returns Appropriate file extension.
 */
function extensionForFormat(format: ReportFormat): string {
  switch (format) {
    case 'markdown':
      return 'md';
    case 'html':
      return 'html';
    case 'sarif':
      return 'sarif.json';
    case 'json':
      return 'json';
  }
}

/**
 * Load findings from the saved findings file.
 *
 * @param findingsPath - Absolute path to findings.json.
 * @returns Array of findings, or empty array if unavailable.
 */
async function loadFindings(findingsPath: string): Promise<Finding[]> {
  if (!existsSync(findingsPath)) return [];

  try {
    const raw = await readFile(findingsPath, 'utf-8');
    return JSON.parse(raw) as Finding[];
  } catch { // expected
    return [];
  }
}

/**
 * Load opportunities from the saved opportunities file.
 *
 * @param oppsPath - Absolute path to opportunities.json.
 * @returns Array of opportunities, or empty array if unavailable.
 */
async function loadOpportunities(oppsPath: string): Promise<Opportunity[]> {
  if (!existsSync(oppsPath)) return [];

  const manager = new OpportunityManager();
  try {
    await manager.load(oppsPath);
    return manager.list();
  } catch { // expected
    return [];
  }
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `report` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerReportCommand(program: Command): void {
  program
    .command('report')
    .description('Generate a report from the latest analysis results')
    .option(
      '--format <format>',
      'Report format: markdown, html, sarif, json',
      'markdown',
    )
    .option('--output <path>', 'Output file path (default: stdout for markdown)')
    .option('--title <title>', 'Report title')
    .action(
      async (opts: {
        format: string;
        output?: string;
        title?: string;
      }) => {
        const format = opts.format as ReportFormat;
        const validFormats: ReportFormat[] = ['markdown', 'html', 'sarif', 'json'];

        if (!validFormats.includes(format)) {
          error(
            `Invalid format: ${bold(format)}. ` +
              `Valid formats: ${validFormats.map((f) => cyan(f)).join(', ')}`,
          );
          process.exit(1);
        }

        // ── Load config ────────────────────────────────────────────
        const { config, projectRoot } = await loadConfig();
        const outputDir = config.output.directory;

        banner();
        header('Report Generation');

        // ── Load saved results ─────────────────────────────────────
        const findingsPath = join(projectRoot, outputDir, 'findings.json');
        const oppsPath = join(projectRoot, outputDir, 'opportunities.json');

        const findings = await loadFindings(findingsPath);
        const opportunities = await loadOpportunities(oppsPath);

        if (findings.length === 0 && opportunities.length === 0) {
          error(
            'No analysis results found. ' +
              `Run ${bold(cyan('recurrsive analyze'))} first.`,
          );
          console.log('');
          info(
            `Expected data in ${dim(join(projectRoot, outputDir))}`,
          );
          console.log('');
          process.exit(1);
        }

        // Show quick summary of loaded data
        console.log(
          `  ${bold('Findings:')}        ${cyan(String(findings.length))}`,
        );
        console.log(
          `  ${bold('Opportunities:')}   ${magenta(String(opportunities.length))}`,
        );
        console.log('');

        // Severity breakdown
        if (findings.length > 0) {
          const bySeverity = new Map<string, number>();
          for (const f of findings) {
            bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
          }

          const severityRows: string[][] = [];
          for (const sev of ['critical', 'high', 'medium', 'low', 'info'] as const) {
            const count = bySeverity.get(sev);
            if (count !== undefined && count > 0) {
              severityRows.push([severityColor(sev), String(count)]);
            }
          }

          if (severityRows.length > 0) {
            console.log(table(['Severity', 'Count'], severityRows));
            console.log('');
          }
        }

        // ── Generate report content ────────────────────────────────
        info(`Generating ${bold(format)} report...`);
        console.log('');

        const reportTitle = opts.title ?? `Recurrsive Analysis Report`;
        let content: string;

        switch (format) {
          case 'markdown': {
            content = generateMarkdownReport(opportunities, {
              title: reportTitle,
              includeActionItems: true,
            });
            break;
          }
          case 'html': {
            content = generateHtmlReport(opportunities, {
              title: reportTitle,
            });
            break;
          }
          case 'sarif': {
            content = exportToSarif(opportunities);
            break;
          }
          case 'json': {
            const payload = {
              generated_at: new Date().toISOString(),
              findings_count: findings.length,
              opportunities_count: opportunities.length,
              findings,
              opportunities,
            };
            content = JSON.stringify(payload, null, 2);
            break;
          }
        }

        // ── Output ─────────────────────────────────────────────────
        if (opts.output) {
          // Write to explicit output path
          const outputPath = resolve(opts.output);
          const dir = resolve(outputPath, '..');
          await mkdir(dir, { recursive: true });
          await writeFile(outputPath, content, 'utf-8');
          success(`Report saved to ${dim(outputPath)}`);
        } else if (format === 'markdown') {
          // Markdown defaults to stdout
          console.log(content);
        } else {
          // Other formats default to file in reports directory
          const reportsDir = join(projectRoot, outputDir, 'reports');
          await mkdir(reportsDir, { recursive: true });
          const ext = extensionForFormat(format);
          const outputPath = join(reportsDir, `report.${ext}`);
          await writeFile(outputPath, content, 'utf-8');
          success(`Report saved to ${dim(outputPath)}`);
        }

        // ── Next steps ─────────────────────────────────────────────
        if (format !== 'markdown' || opts.output) {
          console.log('');
          console.log(
            dim('  Run ') +
              cyan(bold('recurrsive opportunities')) +
              dim(' to view and manage opportunities.'),
          );
          console.log('');
        }
      },
    );
}

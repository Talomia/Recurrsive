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
import {
  generateMarkdownReport,
  generateHtmlReport,
  generateJsonReport,
  generateSarifReport,
} from '@recurrsive/presentation';
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

/**
 * Build a report directly from findings. Used when analysis produced
 * findings but no opportunities (e.g. a run without an LLM key, where
 * the reasoning engine did not promote findings into opportunities).
 *
 * This guarantees a no-reasoning run still yields a report with real
 * content rather than an empty document with a success message.
 *
 * @param findings - The findings to render.
 * @param format - Output format.
 * @param title - Report title.
 * @returns Rendered report content.
 */
function buildFindingsReport(
  findings: Finding[],
  format: ReportFormat,
  title: string,
): string {
  if (format === 'json') {
    return JSON.stringify(
      {
        title,
        generated_at: new Date().toISOString(),
        opportunities: [],
        findings,
        note: 'Findings only — no opportunities were generated (reasoning did not run).',
      },
      null,
      2,
    );
  }

  if (format === 'sarif') {
    const sevToLevel = (s: string): string =>
      s === 'critical' || s === 'high' ? 'error' : s === 'medium' ? 'warning' : 'note';
    const sarif = {
      $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
      version: '2.1.0',
      runs: [
        {
          tool: { driver: { name: 'Recurrsive', informationUri: 'https://recurrsive.io' } },
          results: findings.map((f) => ({
            ruleId: f.analyzer_id,
            level: sevToLevel(f.severity),
            message: { text: `${f.title}: ${f.description}` },
            locations: f.locations.map((loc) => ({
              physicalLocation: {
                artifactLocation: { uri: loc.file },
                ...(loc.start_line
                  ? { region: { startLine: loc.start_line } }
                  : {}),
              },
            })),
          })),
        },
      ],
    };
    return JSON.stringify(sarif, null, 2);
  }

  // Markdown body — reused verbatim for HTML (wrapped in <pre>).
  const body =
    `# ${title}\n\n` +
    `**Generated:** ${new Date().toISOString()}\n` +
    `**Findings:** ${findings.length}\n\n` +
    `> No opportunities were generated for this run (reasoning did not run). ` +
    `The findings below are the raw analyzer output.\n\n` +
    findings
      .map(
        (f) =>
          `## ${f.title}\n\n` +
          `**Severity:** ${f.severity} | **Category:** ${f.category} | ` +
          `**Confidence:** ${Math.round(f.confidence * 100)}%\n\n` +
          `${f.description}\n\n` +
          (f.locations[0]
            ? `**Location:** ${f.locations[0].file}${f.locations[0].start_line ? `:${f.locations[0].start_line}` : ''}\n\n`
            : '') +
          (f.suggested_fix ? `**Suggested fix:** ${f.suggested_fix}\n\n` : ''),
      )
      .join('---\n\n');

  if (format === 'html') {
    return (
      `<!doctype html><html><head><meta charset="utf-8">` +
      `<title>${title}</title></head><body>` +
      `<pre>${body.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</pre>` +
      `</body></html>`
    );
  }

  return body;
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

        if (opportunities.length === 0) {
          // No opportunities (reasoning did not run) — report the real
          // findings instead of emitting an empty opportunity report.
          info(dim('  No opportunities found — reporting findings directly.'));
          content = buildFindingsReport(findings, format, reportTitle);
        } else {
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
              content = generateSarifReport(opportunities, {
                title: reportTitle,
              });
              break;
            }
            case 'json': {
              content = generateJsonReport(opportunities, {
                title: reportTitle,
                includeEvidence: true,
              });
              break;
            }
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

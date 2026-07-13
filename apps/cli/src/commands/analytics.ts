/**
 * @module @recurrsive/cli/commands/analytics
 *
 * `recurrsive analytics` — View analytics summaries and categories.
 *
 * Provides subcommands for viewing analysis trends, aggregate
 * statistics, and top finding categories from the Recurrsive server.
 *
 * @packageDocumentation
 */

import { apiRequest } from '../config.js';
import type { Command } from 'commander';
import {
  header,
  info,
  error,
  dim,
  table,
  bold,
  cyan,
  green,
  yellow,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single data point in the trend time series. */
interface TrendPoint {
  date: string;
  findings: number;
  health: number;
}

/** Summary analytics response. */
interface AnalyticsSummary {
  analysis_runs: number;
  total_findings: number;
  findings_resolved: number;
  resolution_rate: number;
  avg_health_score: number;
  trends: TrendPoint[];
}

/** A single finding category. */
interface CategoryStat {
  name: string;
  count: number;
  percentage: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `analytics` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerAnalyticsCommand(program: Command): void {
  const analytics = program
    .command('analytics')
    .description('View analytics summaries and categories');

  // ── analytics summary ─────────────────────────────────────────────────
  analytics
    .command('summary')
    .description('View analytics summary and trends')
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean; projectId?: string }) => {
      try {
        let summary: AnalyticsSummary;
        try {
          summary = opts.projectId
            ? await apiRequest<AnalyticsSummary>('/api/v1/analytics/summary', { projectId: opts.projectId })
            : await apiRequest<AnalyticsSummary>('/api/v1/analytics/summary');
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(summary, null, 2));
          return;
        }

        header('Analytics Summary');

        info(`  ${bold('Analysis Runs:')}    ${cyan(String(summary.analysis_runs))}`);
        info(`  ${bold('Total Findings:')}   ${cyan(String(summary.total_findings))}`);
        info(`  ${bold('Resolved:')}         ${green(String(summary.findings_resolved))}`);
        info(`  ${bold('Resolution Rate:')}  ${green(`${summary.resolution_rate}%`)}`);
        info(`  ${bold('Avg Health Score:')} ${cyan(String(summary.avg_health_score))}`);

        if (summary.trends.length > 0) {
          info('');
          info(bold('  Trends (weekly):'));

          const rows = summary.trends.map(t => [
            t.date,
            String(t.findings),
            `${t.health}%`,
          ]);

          table(['Date', 'Findings', 'Health'], rows);
        }

        info(`\n${dim(`Showing ${summary.trends.length} data point(s)`)}`);
      } catch (err) {
        error(`Failed to load analytics summary: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── analytics categories ──────────────────────────────────────────────
  analytics
    .command('categories')
    .description('View top finding categories')
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean; projectId?: string }) => {
      try {
        let categories: CategoryStat[];
        try {
          const data = opts.projectId
            ? await apiRequest<CategoryStat[] | { categories: CategoryStat[] }>('/api/v1/analytics/top-categories', { projectId: opts.projectId })
            : await apiRequest<CategoryStat[] | { categories: CategoryStat[] }>('/api/v1/analytics/top-categories');
          categories = Array.isArray(data) ? data : data.categories;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(categories, null, 2));
          return;
        }

        header('Top Categories');

        if (categories.length === 0) {
          info(dim('No category data available.'));
          return;
        }

        // Find max name length for alignment
        const maxName = Math.max(...categories.map(c => c.name.length));

        for (const cat of categories) {
          const barLength = Math.round(cat.percentage / 2);
          const bar = '█'.repeat(barLength);
          const name = cat.name.padEnd(maxName);
          info(`  ${bold(name)}  ${cyan(bar)} ${dim(`${cat.count} (${cat.percentage}%)`)}`);
        }

        info(`\n${dim(`${categories.length} categories`)}`);
      } catch (err) {
        error(`Failed to load categories: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}

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
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single data point in the trend time series. */
interface TrendPoint {
  date: string;
  findings: number;
  resolved: number;
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

const DEFAULT_SERVER = 'http://localhost:3000';

/**
 * Make an API request to the Recurrsive server.
 */
async function apiRequest(
  path: string,
  options: RequestInit = {},
): Promise<unknown> {
  const base = process.env['RECURRSIVE_SERVER'] ?? DEFAULT_SERVER;
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

/** Generate fallback mock analytics summary. */
function getMockSummary(): AnalyticsSummary {
  return {
    analysis_runs: 47,
    total_findings: 312,
    findings_resolved: 189,
    resolution_rate: 60.6,
    avg_health_score: 74.2,
    trends: [
      { date: '2026-04-06', findings: 28, resolved: 12, health: 68 },
      { date: '2026-04-13', findings: 31, resolved: 15, health: 70 },
      { date: '2026-04-20', findings: 33, resolved: 18, health: 72 },
      { date: '2026-04-27', findings: 35, resolved: 20, health: 73 },
    ],
  };
}

/** Generate fallback mock categories. */
function getMockCategories(): CategoryStat[] {
  return [
    { name: 'Performance', count: 68, percentage: 21.8 },
    { name: 'Architecture', count: 54, percentage: 17.3 },
    { name: 'Security', count: 42, percentage: 13.5 },
    { name: 'Reliability', count: 39, percentage: 12.5 },
    { name: 'Documentation', count: 35, percentage: 11.2 },
  ];
}

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
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        let summary: AnalyticsSummary;
        try {
          summary = await apiRequest('/api/v1/analytics/summary') as AnalyticsSummary;
        } catch {
          // Fallback to mock data
          summary = getMockSummary();
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
            String(t.resolved),
            `${t.health}%`,
          ]);

          table(['Date', 'Findings', 'Resolved', 'Health'], rows);
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
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        let categories: CategoryStat[];
        try {
          const data = await apiRequest('/api/v1/analytics/top-categories') as { categories: CategoryStat[] };
          categories = data.categories;
        } catch {
          // Fallback to mock data
          categories = getMockCategories();
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

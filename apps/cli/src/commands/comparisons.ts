/**
 * @module @recurrsive/cli/commands/comparisons
 *
 * `recurrsive comparisons` — Compare analysis runs side-by-side.
 *
 * Provides subcommands for listing past analysis runs and
 * generating diffs between two runs showing health score deltas,
 * findings added/removed, and category breakdowns.
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

/** A single analysis run entry. */
interface AnalysisRun {
  id: string;
  label: string;
  date: string;
  health_score: number;
  findings: number;
  resolved: number;
}

/** Category breakdown within a finding. */
interface CategoryDelta {
  name: string;
  baseline: number;
  target: number;
  delta: number;
}

/** Comparison diff between two analysis runs. */
interface ComparisonDiff {
  baseline: AnalysisRun;
  target: AnalysisRun;
  health_delta: number;
  findings_delta: number;
  resolution_rate_baseline: number;
  resolution_rate_target: number;
  resolution_rate_delta: number;
  new_findings: number;
  findings_resolved: number;
  categories: CategoryDelta[];
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `comparisons` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerComparisonsCommand(program: Command): void {
  const comparisons = program
    .command('comparisons')
    .description('Compare analysis runs side-by-side');

  // ── comparisons list ───────────────────────────────────────────────
  comparisons
    .command('list')
    .description('List available analysis runs')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        let runs: AnalysisRun[];
        try {
          const data = await apiRequest('/api/v1/analysis/history') as { data: AnalysisRun[] };
          runs = data.data;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(runs, null, 2));
          return;
        }

        header('Analysis Runs');

        if (runs.length === 0) {
          info(dim('No analysis runs found.'));
          return;
        }

        const rows = runs.map(r => [
          r.id,
          r.label,
          r.date.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
          String(r.health_score),
          String(r.findings),
          String(r.resolved),
        ]);

        table(['ID', 'Label', 'Date', 'Health', 'Findings', 'Resolved'], rows);

        info(`\n${dim(`Showing ${runs.length} run(s)`)}`);
      } catch (err) {
        error(`Failed to list analysis runs: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── comparisons diff <run1> <run2> ─────────────────────────────────
  comparisons
    .command('diff <run1> <run2>')
    .description('Show diff between two analysis runs')
    .option('--json', 'Output as JSON')
    .action(async (run1: string, run2: string, opts: { json?: boolean }) => {
      try {
        let diff: ComparisonDiff;
        try {
          diff = await apiRequest(
            `/api/v1/analysis/compare?baseline=${encodeURIComponent(run1)}&target=${encodeURIComponent(run2)}`,
          ) as ComparisonDiff;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(diff, null, 2));
          return;
        }

        header(`Comparison: ${diff.baseline.label} → ${diff.target.label}`);

        // Health score delta
        const healthSign = diff.health_delta >= 0 ? '+' : '';
        info(`  ${bold('Health Score:')}  ${diff.baseline.health_score} → ${diff.target.health_score}  (${green(`${healthSign}${diff.health_delta}`)})`);

        // Findings delta
        const findingsSign = diff.findings_delta >= 0 ? '+' : '';
        info(`  ${bold('Findings:')}     ${diff.baseline.findings} → ${diff.target.findings}  (${cyan(`${findingsSign}${diff.findings_delta}`)})`);

        // Resolution rates
        info(`  ${bold('Res. Rate:')}    ${diff.resolution_rate_baseline}% → ${diff.resolution_rate_target}%  (${green(`+${diff.resolution_rate_delta}%`)})`);

        info('');
        info(`  ${bold('New Findings:')}      ${cyan(String(diff.new_findings))}`);
        info(`  ${bold('Findings Resolved:')} ${green(String(diff.findings_resolved))}`);

        // Category breakdown
        if (diff.categories.length > 0) {
          info('');
          info(bold('  Category Breakdown:'));

          const catRows = diff.categories.map(c => {
            const sign = c.delta >= 0 ? '+' : '';
            return [c.name, String(c.baseline), String(c.target), `${sign}${c.delta}`];
          });

          table(['Category', 'Baseline', 'Target', 'Delta'], catRows);
        }

        info(`\n${dim(`Baseline: ${diff.baseline.id}  |  Target: ${diff.target.id}`)}`);
      } catch (err) {
        error(`Failed to compare runs: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}

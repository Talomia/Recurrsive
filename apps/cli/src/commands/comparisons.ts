/**
 * @module @recurrsive/cli/commands/comparisons
 *
 * `recurrsive comparisons` — Compare analysis runs side-by-side.
 *
 * Lists past analysis runs and diffs two of them, showing real deltas
 * in health score, findings, and opportunities. Both subcommands read
 * the server's `/api/v1/analysis/history` endpoint; the diff is computed
 * from those real run records (there is no separate compare endpoint).
 *
 * @packageDocumentation
 */

import { apiRequestList, reportApiError } from '../config.js';
import type { Command } from 'commander';
import {
  header,
  info,
  error,
  dim,
  table,
  bold,
  green,
  red,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types (match the server's AnalysisHistoryEntry shape)
// ---------------------------------------------------------------------------

interface AnalysisRun {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  findingCount: number;
  opportunityCount: number;
  includeReasoning: boolean;
  healthScore: number | null;
  status: 'success' | 'failed';
  error: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  return iso.replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function fmtHealth(score: number | null): string {
  return score === null ? dim('—') : String(score);
}

function signed(delta: number): string {
  const s = delta >= 0 ? `+${delta}` : String(delta);
  return delta > 0 ? green(s) : delta < 0 ? red(s) : dim(s);
}

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
      let runs: AnalysisRun[];
      try {
        runs = (await apiRequestList<AnalysisRun>('/api/v1/analysis/history')).items;
      } catch (err) {
        reportApiError(err, { action: 'List analysis runs' });
      }

      if (opts.json) {
        console.log(JSON.stringify(runs, null, 2));
        return;
      }

      header('Analysis Runs');

      if (runs.length === 0) {
        info(dim('No analysis runs found. Run `recurrsive analyze` first.'));
        return;
      }

      const rows = runs.map((r) => [
        r.id,
        fmtDate(r.startedAt),
        r.status === 'success' ? green(r.status) : red(r.status),
        fmtHealth(r.healthScore),
        String(r.findingCount),
        String(r.opportunityCount),
      ]);
      console.log(table(['ID', 'Date', 'Status', 'Health', 'Findings', 'Opps'], rows));
      info(`\n${dim(`Showing ${runs.length} run(s)`)}`);
    });

  // ── comparisons diff <run1> <run2> ─────────────────────────────────
  comparisons
    .command('diff <run1> <run2>')
    .description('Show the diff between two analysis runs (baseline → target)')
    .option('--json', 'Output as JSON')
    .action(async (run1: string, run2: string, opts: { json?: boolean }) => {
      let runs: AnalysisRun[];
      try {
        runs = (await apiRequestList<AnalysisRun>('/api/v1/analysis/history')).items;
      } catch (err) {
        reportApiError(err, { action: 'Load analysis runs' });
      }

      const baseline = runs.find((r) => r.id === run1);
      const target = runs.find((r) => r.id === run2);

      if (!baseline || !target) {
        const missing = !baseline ? run1 : run2;
        error(`Analysis run not found: ${missing}`);
        info(dim('Use `recurrsive comparisons list` to see available run IDs.'));
        process.exitCode = 1;
        return;
      }

      const healthDelta =
        baseline.healthScore !== null && target.healthScore !== null
          ? target.healthScore - baseline.healthScore
          : null;
      const findingsDelta = target.findingCount - baseline.findingCount;
      const oppsDelta = target.opportunityCount - baseline.opportunityCount;

      if (opts.json) {
        console.log(
          JSON.stringify(
            { baseline, target, healthDelta, findingsDelta, oppsDelta },
            null,
            2,
          ),
        );
        return;
      }

      header(`Comparison: ${baseline.id} → ${target.id}`);

      if (healthDelta !== null) {
        info(`  ${bold('Health Score:')}  ${baseline.healthScore} → ${target.healthScore}  (${signed(healthDelta)})`);
      } else {
        info(`  ${bold('Health Score:')}  ${fmtHealth(baseline.healthScore)} → ${fmtHealth(target.healthScore)}  ${dim('(not comparable)')}`);
      }
      info(`  ${bold('Findings:')}      ${baseline.findingCount} → ${target.findingCount}  (${signed(findingsDelta)})`);
      info(`  ${bold('Opportunities:')} ${baseline.opportunityCount} → ${target.opportunityCount}  (${signed(oppsDelta)})`);
      info('');
      info(`  ${dim(`Baseline: ${fmtDate(baseline.startedAt)}  |  Target: ${fmtDate(target.startedAt)}`)}`);
      console.log('');
    });
}

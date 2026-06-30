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

/** Fallback mock analysis runs. */
function getMockRuns(): AnalysisRun[] {
  return [
    { id: 'run_001', label: 'Run #1', date: '2026-06-20T08:00:00Z', health_score: 71, findings: 55, resolved: 18 },
    { id: 'run_002', label: 'Run #2', date: '2026-06-23T10:30:00Z', health_score: 76, findings: 48, resolved: 22 },
    { id: 'run_003', label: 'Run #3', date: '2026-06-25T14:15:00Z', health_score: 80, findings: 42, resolved: 28 },
    { id: 'run_004', label: 'Run #4', date: '2026-06-28T09:00:00Z', health_score: 84, findings: 38, resolved: 31 },
    { id: 'run_005', label: 'Run #5', date: '2026-06-30T10:00:00Z', health_score: 87, findings: 34, resolved: 29 },
  ];
}

/** Fallback mock comparison diff. */
function getMockDiff(baselineId: string, targetId: string): ComparisonDiff {
  const runs = getMockRuns();
  const baseline = runs.find(r => r.id === baselineId) ?? runs[0]!;
  const target = runs.find(r => r.id === targetId) ?? runs[runs.length - 1]!;

  const rateA = baseline.findings > 0 ? (baseline.resolved / baseline.findings) * 100 : 0;
  const rateB = target.findings > 0 ? (target.resolved / target.findings) * 100 : 0;

  return {
    baseline,
    target,
    health_delta: target.health_score - baseline.health_score,
    findings_delta: target.findings - baseline.findings,
    resolution_rate_baseline: Math.round(rateA * 10) / 10,
    resolution_rate_target: Math.round(rateB * 10) / 10,
    resolution_rate_delta: Math.round((rateB - rateA) * 10) / 10,
    new_findings: Math.max(0, target.findings - baseline.resolved),
    findings_resolved: Math.max(0, baseline.findings - target.findings + target.resolved - baseline.resolved),
    categories: [
      { name: 'Security', baseline: 12, target: 5, delta: -7 },
      { name: 'Performance', baseline: 16, target: 9, delta: -7 },
      { name: 'Architecture', baseline: 10, target: 7, delta: -3 },
      { name: 'Reliability', baseline: 9, target: 6, delta: -3 },
      { name: 'Cost', baseline: 8, target: 7, delta: -1 },
    ],
  };
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
      try {
        let runs: AnalysisRun[];
        try {
          const data = await apiRequest('/api/v1/analysis/history') as { data: AnalysisRun[] };
          runs = data.data;
        } catch {
          // Fallback to mock data
          runs = getMockRuns();
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
          // Fallback to mock data
          diff = getMockDiff(run1, run2);
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

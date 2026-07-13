/** Compare recorded analysis runs without inferring unrecorded resolution data. */

import { apiRequest } from '../config.js';
import type { Command } from 'commander';
import { header, info, error, dim, table, bold, cyan, green, red } from '../output/terminal.js';

interface HistoryEntry {
  id: string;
  startedAt: string;
  durationMs: number;
  findingCount: number;
  opportunityCount: number;
  healthScore: number | null;
  status: 'success' | 'error';
}

interface ComparedRun {
  id: string;
  label: string;
  date: string;
  health_score: number;
  findings: number;
  opportunities: number;
  duration_ms: number;
}

interface ComparisonDiff {
  runA: ComparedRun;
  runB: ComparedRun;
  health_delta: number;
  findings_delta: number;
  opportunities_delta: number;
  duration_delta_ms: number;
}

export function registerComparisonsCommand(program: Command): void {
  const comparisons = program.command('comparisons').description('Compare recorded analysis runs');

  comparisons
    .command('list')
    .description('List available successful analysis runs')
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean; projectId?: string }) => {
      try {
        const history = opts.projectId
          ? await apiRequest<HistoryEntry[]>('/api/v1/analysis/history', { projectId: opts.projectId })
          : await apiRequest<HistoryEntry[]>('/api/v1/analysis/history');
        const runs = history.filter((run) => run.status === 'success' && run.healthScore !== null);
        if (opts.json) {
          console.log(JSON.stringify(runs, null, 2));
          return;
        }
        header('Analysis Runs');
        if (runs.length === 0) {
          info(dim('No successful analysis runs found.'));
          return;
        }
        table(
          ['ID', 'Date', 'Health', 'Findings', 'Opportunities', 'Duration'],
          runs.map((run) => [
            run.id,
            run.startedAt.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
            String(run.healthScore),
            String(run.findingCount),
            String(run.opportunityCount),
            `${Math.round(run.durationMs / 1000)}s`,
          ]),
        );
        info(`\n${dim(`Showing ${runs.length} run(s)`)}`);
      } catch (caught) {
        error(`Failed to list analysis runs: ${caught instanceof Error ? caught.message : String(caught)}`);
        process.exitCode = 1;
      }
    });

  comparisons
    .command('diff <run1> <run2>')
    .description('Show recorded metric deltas between two runs')
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .option('--json', 'Output as JSON')
    .action(async (run1: string, run2: string, opts: { json?: boolean; projectId?: string }) => {
      try {
        const path = `/api/v1/analysis/compare?run_a=${encodeURIComponent(run1)}&run_b=${encodeURIComponent(run2)}`;
        const diff = opts.projectId
          ? await apiRequest<ComparisonDiff>(path, { projectId: opts.projectId })
          : await apiRequest<ComparisonDiff>(path);
        if (opts.json) {
          console.log(JSON.stringify(diff, null, 2));
          return;
        }

        header(`Comparison: ${diff.runA.label} → ${diff.runB.label}`);
        const healthColor = diff.health_delta >= 0 ? green : red;
        const findingColor = diff.findings_delta <= 0 ? green : red;
        info(`  ${bold('Health:')}        ${diff.runA.health_score} → ${diff.runB.health_score}  (${healthColor(`${diff.health_delta >= 0 ? '+' : ''}${diff.health_delta}`)})`);
        info(`  ${bold('Findings:')}      ${diff.runA.findings} → ${diff.runB.findings}  (${findingColor(`${diff.findings_delta >= 0 ? '+' : ''}${diff.findings_delta}`)})`);
        info(`  ${bold('Opportunities:')} ${diff.runA.opportunities} → ${diff.runB.opportunities}  (${cyan(`${diff.opportunities_delta >= 0 ? '+' : ''}${diff.opportunities_delta}`)})`);
        info(`  ${bold('Duration:')}      ${Math.round(diff.runA.duration_ms / 1000)}s → ${Math.round(diff.runB.duration_ms / 1000)}s  (${diff.duration_delta_ms >= 0 ? '+' : ''}${diff.duration_delta_ms}ms)`);
      } catch (caught) {
        error(`Failed to compare runs: ${caught instanceof Error ? caught.message : String(caught)}`);
        process.exitCode = 1;
      }
    });
}

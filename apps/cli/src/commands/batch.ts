/**
 * @module @recurrsive/cli/commands/batch
 *
 * `recurrsive batch` — Run batch analysis on multiple projects.
 *
 * Provides subcommands for starting, monitoring, and reviewing
 * multi-project batch analysis runs.
 *
 * @packageDocumentation
 */

import { apiRequest, apiRequestList, reportApiError } from '../config.js';
import type { Command } from 'commander';
import {
  header,
  info,
  error,
  bold,
  cyan,
  green,
  red,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types (match the server's BatchRun shape)
// ---------------------------------------------------------------------------

interface BatchProject {
  path: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string | null;
  completed_at?: string | null;
  error?: string;
}

interface BatchRun {
  batch_id: string;
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  projects: BatchProject[];
  created_at: string;
  completed_at?: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function batchStatusText(status: string): string {
  return status === 'completed' ? green(status) : status === 'failed' ? red(status) : status;
}

function projectStatusText(status: string): string {
  return status === 'completed'
    ? green('✔ completed')
    : status === 'failed'
      ? red('✗ failed')
      : dim(status);
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `batch` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerBatchCommand(program: Command): void {
  const batch = program
    .command('batch')
    .description('Run batch analysis on multiple projects');

  // ── batch run ──────────────────────────────────────────────────────
  batch
    .command('run')
    .description('Start a batch analysis run')
    .argument('<paths...>', 'Project paths to analyze')
    .option('--json', 'Output as JSON')
    .action(async (paths: string[], opts: { json?: boolean }) => {
      if (paths.length === 0) {
        error('Please provide at least one project path');
        process.exitCode = 1;
        return;
      }
      if (paths.length > 10) {
        error(`Maximum 10 projects per batch (got ${paths.length})`);
        process.exitCode = 1;
        return;
      }

      let result: BatchRun;
      try {
        const env = (await apiRequest('/api/v1/batch/analyze', {
          method: 'POST',
          body: JSON.stringify({ projects: paths }),
        })) as { data?: BatchRun } & Partial<BatchRun>;
        result = (env.data ?? env) as BatchRun;
      } catch (err) {
        reportApiError(err, { action: 'Start batch analysis' });
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      header('Batch Analysis Started');
      info(`${bold('Batch ID:')} ${cyan(result.batch_id)}`);
      info(`${bold('Projects:')} ${result.projects.length}`);
      info(`${bold('Status:')}   ${batchStatusText(result.status)}\n`);

      const rows = result.projects.map((p, i) => [
        String(i + 1),
        p.path,
        projectStatusText(p.status),
      ]);
      console.log(table(['#', 'Project Path', 'Status'], rows));
      info(`\n${dim('Use')} ${cyan(`recurrsive batch status ${result.batch_id}`)} ${dim('to check progress')}`);
    });

  // ── batch status ───────────────────────────────────────────────────
  batch
    .command('status <batch_id>')
    .description('Check the status of a batch run')
    .option('--json', 'Output as JSON')
    .action(async (batchId: string, opts: { json?: boolean }) => {
      let result: BatchRun;
      try {
        result = await apiRequest(`/api/v1/batch/status/${encodeURIComponent(batchId)}`).then(
          (env) => (env as { data: BatchRun }).data,
        );
      } catch (err) {
        reportApiError(err, { resource: `batch '${batchId}'`, action: 'Get batch status' });
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      header(`Batch Status: ${batchId}`);
      info(`${bold('Status:')}  ${batchStatusText(result.status)}`);
      info(`${bold('Created:')} ${result.created_at}`);
      if (result.completed_at) {
        info(`${bold('Completed:')} ${result.completed_at}`);
      }
      info('');

      const rows = result.projects.map((p, i) => [
        String(i + 1),
        p.path,
        projectStatusText(p.status),
        p.error ? red(p.error) : dim('—'),
      ]);
      console.log(table(['#', 'Project', 'Status', 'Error'], rows));
    });

  // ── batch history ──────────────────────────────────────────────────
  batch
    .command('history')
    .description('View past batch analysis runs')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let runs: BatchRun[];
      let total: number;
      try {
        const res = await apiRequestList<BatchRun>('/api/v1/batch/history');
        runs = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'Get batch history' });
      }

      if (opts.json) {
        console.log(JSON.stringify(runs, null, 2));
        return;
      }

      header('Batch Run History');

      if (runs.length === 0) {
        info(dim('No batch runs recorded yet.'));
        return;
      }

      const rows = runs.map((r) => [
        r.batch_id,
        batchStatusText(r.status),
        String(r.projects.length),
        r.created_at.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
      ]);
      console.log(table(['Batch ID', 'Status', 'Projects', 'Created'], rows));
      info(`\n${dim(`Showing ${runs.length} of ${total} batch run(s)`)}`);
    });
}

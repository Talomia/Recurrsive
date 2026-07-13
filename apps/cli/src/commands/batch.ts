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

import { apiRequest } from '../config.js';
import type { Command } from 'commander';
import {
  header,
  info,
  error,
  bold,
  cyan,
  green,
  red,
  yellow,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Batch project entry. */
interface BatchProject {
  projectId: string;
  name: string;
  repository: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: string;
  completed_at?: string;
  findings_count?: number;
  opportunities_count?: number;
}

/** Batch run record. */
interface BatchRun {
  batch_id: string;
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  projects: BatchProject[];
  created_at: string;
  completed_at?: string;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------



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
    .argument('<project-ids...>', 'Registered project IDs to analyze')
    .option('--json', 'Output as JSON')
    .action(async (projectIds: string[], opts: { json?: boolean }) => {
      if (projectIds.length === 0) {
        error('Please provide at least one registered project ID');
        process.exitCode = 1;
        return;
      }

      if (projectIds.length > 100) {
        error(`Maximum 100 projects per batch (got ${projectIds.length})`);
        process.exitCode = 1;
        return;
      }

      try {
        let result: BatchRun;
        try {
          result = await apiRequest<BatchRun>('/api/v1/batch/analyze', {
            method: 'POST',
            body: JSON.stringify({ projectIds }),
          });
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        header('Batch Analysis Started');
        info(`${bold('Batch ID:')} ${cyan(result.batch_id)}`);
        info(`${bold('Projects:')} ${result.projects.length}`);
        info(`${bold('Status:')}  ${result.status}\n`);

        const rows = result.projects.map((p, i) => [
          String(i + 1),
          p.name,
          p.status === 'completed' ? green(p.status) : dim(p.status),
        ]);

        console.log(table(['#', 'Project', 'Status'], rows));

        info(`\n${dim('Use')} ${cyan(`recurrsive batch status ${result.batch_id}`)} ${dim('to check progress')}`);
      } catch (err) {
        error(`Failed to start batch: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── batch status ───────────────────────────────────────────────────
  batch
    .command('status <batch_id>')
    .description('Check the status of a batch run')
    .option('--json', 'Output as JSON')
    .action(async (batchId: string, opts: { json?: boolean }) => {
      try {
        let result: BatchRun;
        try {
          result = await apiRequest<BatchRun>(`/api/v1/batch/status/${encodeURIComponent(batchId)}`);
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        header(`Batch Status: ${batchId}`);
        info(`${bold('Status:')} ${result.status === 'completed' ? green(result.status) : result.status}`);
        info(`${bold('Created:')} ${result.created_at}`);
        if (result.completed_at) {
          info(`${bold('Completed:')} ${result.completed_at}`);
        }
        info('');

        const rows = result.projects.map((p, i) => {
          const statusStr = p.status === 'completed' ? green('✔ completed')
            : p.status === 'failed' ? red('✗ failed')
            : dim(p.status);
          return [
            String(i + 1),
            p.name,
            statusStr,
            p.findings_count !== undefined ? String(p.findings_count) : dim('-'),
            p.opportunities_count !== undefined ? String(p.opportunities_count) : dim('-'),
          ];
        });

        console.log(table(['#', 'Project', 'Status', 'Findings', 'Opps'], rows));
      } catch (err) {
        error(`Failed to get batch status: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── batch history ──────────────────────────────────────────────────
  batch
    .command('history')
    .description('View past batch analysis runs')
    .option('--limit <n>', 'Maximum entries to show', '10')
    .option('--json', 'Output as JSON')
    .action(async (opts: { limit: string; json?: boolean }) => {
      try {
        let runs: BatchRun[];
        try {
          const requestedLimit = Math.max(1, Number.parseInt(opts.limit, 10) || 10);
          runs = (await apiRequest<BatchRun[]>('/api/v1/batch/history')).slice(0, requestedLimit);
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
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

        const rows = runs.map(r => [
          r.batch_id,
          r.status === 'completed' ? green(r.status) : r.status,
          String(r.projects.length),
          r.created_at.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
        ]);

        console.log(table(['Batch ID', 'Status', 'Projects', 'Created'], rows));

        info(`\n${dim(`Showing ${runs.length} batch run(s)`)}`);
      } catch (err) {
        error(`Failed to get batch history: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}

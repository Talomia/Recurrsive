/**
 * @module @recurrsive/cli/commands/experiments
 *
 * `recurrsive experiments` — Manage analysis experiments.
 *
 * Provides subcommands for listing, creating, and inspecting
 * experiments that test hypotheses about codebase improvements.
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
  yellow,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Experiment record. */
interface Experiment {
  id: string;
  name: string;
  hypothesis?: string;
  status: 'draft' | 'running' | 'complete' | 'failed';
  created_at: string;
  completed_at?: string;
  results?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------





// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `experiments` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerExperimentsCommand(program: Command): void {
  const experiments = program
    .command('experiments')
    .description('Manage analysis experiments');

  // ── experiments list ───────────────────────────────────────────────
  experiments
    .command('list')
    .description('List all experiments')
    .option('--status <status>', 'Filter by status (draft, running, complete, failed)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { status?: string; json?: boolean }) => {
      try {
        let result: Experiment[];
        try {
          const query = opts.status ? `?status=${opts.status}` : '';
          const data = await apiRequest(`/api/v1/experiments${query}`) as { data: Experiment[] };
          result = data.data;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        header('Experiments');

        if (result.length === 0) {
          info(dim('No experiments found.'));
          return;
        }

        const rows = result.map(e => [
          e.name,
          e.status === 'complete' ? green(e.status)
            : e.status === 'running' ? cyan(e.status)
            : dim(e.status),
          e.created_at.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
        ]);

        table(['Name', 'Status', 'Created'], rows);

        info(`\n${dim(`Showing ${result.length} experiment(s)`)}`);
      } catch (err) {
        error(`Failed to list experiments: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── experiments create <name> ─────────────────────────────────────
  experiments
    .command('create <name>')
    .description('Create a new experiment')
    .option('--hypothesis <text>', 'Experiment hypothesis')
    .option('--json', 'Output as JSON')
    .action(async (name: string, opts: { hypothesis?: string; json?: boolean }) => {
      try {
        let result: Experiment;
        try {
          result = await apiRequest('/api/v1/experiments', {
            method: 'POST',
            body: JSON.stringify({ name, hypothesis: opts.hypothesis }),
          }) as Experiment;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        header('Experiment Created');
        info(`${bold('ID:')}         ${cyan(result.id)}`);
        info(`${bold('Name:')}       ${result.name}`);
        if (result.hypothesis) {
          info(`${bold('Hypothesis:')} ${result.hypothesis}`);
        }
        info(`${bold('Status:')}     ${dim(result.status)}`);
      } catch (err) {
        error(`Failed to create experiment: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── experiments status <id> ───────────────────────────────────────
  experiments
    .command('status <id>')
    .description('Show experiment details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      try {
        let result: Experiment;
        try {
          result = await apiRequest(`/api/v1/experiments/${id}`) as Experiment;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        header(`Experiment: ${result.name}`);
        info(`${bold('ID:')}         ${cyan(result.id)}`);
        info(`${bold('Name:')}       ${result.name}`);
        info(`${bold('Status:')}     ${result.status === 'complete' ? green(result.status) : result.status}`);
        info(`${bold('Created:')}    ${result.created_at}`);
        if (result.hypothesis) {
          info(`${bold('Hypothesis:')} ${result.hypothesis}`);
        }
        if (result.completed_at) {
          info(`${bold('Completed:')}  ${result.completed_at}`);
        }
        if (result.results) {
          info(`\n${bold('Results:')}`);
          for (const [key, val] of Object.entries(result.results)) {
            info(`  ${dim(key)}: ${String(val)}`);
          }
        }
      } catch (err) {
        error(`Failed to get experiment: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}

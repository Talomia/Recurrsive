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
  hypothesis: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  variants: Array<{ name: string; analyzers: string[]; collectors: string[] }>;
  results: Array<Record<string, unknown>>;
  metrics: Array<Record<string, unknown>>;
  conclusion: string | null;
  error: string | null;
}

function csv(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
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
    .option('--status <status>', 'Filter by status (pending, running, completed, failed)')
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .option('--json', 'Output as JSON')
    .action(async (opts: { status?: string; projectId?: string; json?: boolean }) => {
      try {
        let result: Experiment[];
        try {
          const query = opts.status ? `?status=${opts.status}` : '';
          const data = opts.projectId
            ? await apiRequest<Experiment[] | { data: Experiment[] }>(`/api/v1/experiments${query}`, { projectId: opts.projectId })
            : await apiRequest<Experiment[] | { data: Experiment[] }>(`/api/v1/experiments${query}`);
          result = Array.isArray(data) ? data : data.data;
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
          e.status === 'completed' ? green(e.status)
            : e.status === 'running' ? cyan(e.status)
            : dim(e.status),
          e.createdAt.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
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
    .description('Create an isolated two-variant analyzer experiment')
    .requiredOption('--hypothesis <text>', 'Experiment hypothesis')
    .requiredOption('--control-analyzers <ids>', 'Comma-separated analyzer IDs for Control')
    .requiredOption('--candidate-analyzers <ids>', 'Comma-separated analyzer IDs for Candidate')
    .option('--collectors <ids>', 'Comma-separated collector IDs for both variants', 'git')
    .option('--description <text>', 'Experiment description')
    .option('--no-reasoning', 'Disable multi-agent reasoning for both variants')
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .option('--json', 'Output as JSON')
    .action(async (name: string, opts: {
      hypothesis: string;
      controlAnalyzers: string;
      candidateAnalyzers: string;
      collectors: string;
      description?: string;
      reasoning: boolean;
      projectId?: string;
      json?: boolean;
    }) => {
      try {
        let result: Experiment;
        try {
          const request = {
            method: 'POST',
            body: JSON.stringify({
              name,
              hypothesis: opts.hypothesis,
              description: opts.description,
              variants: [
                {
                  name: 'Control',
                  analyzers: csv(opts.controlAnalyzers),
                  collectors: csv(opts.collectors),
                  includeReasoning: opts.reasoning,
                },
                {
                  name: 'Candidate',
                  analyzers: csv(opts.candidateAnalyzers),
                  collectors: csv(opts.collectors),
                  includeReasoning: opts.reasoning,
                },
              ],
            }),
            ...(opts.projectId ? { projectId: opts.projectId } : {}),
          };
          result = await apiRequest<Experiment>('/api/v1/experiments', request);
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
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { projectId?: string; json?: boolean }) => {
      try {
        let result: Experiment;
        try {
          const path = `/api/v1/experiments/${encodeURIComponent(id)}`;
          result = opts.projectId
            ? await apiRequest<Experiment>(path, { projectId: opts.projectId })
            : await apiRequest<Experiment>(path);
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
        info(`${bold('Status:')}     ${result.status === 'completed' ? green(result.status) : result.status}`);
        info(`${bold('Created:')}    ${result.createdAt}`);
        info(`${bold('Hypothesis:')} ${result.hypothesis}`);
        if (result.completedAt) {
          info(`${bold('Completed:')}  ${result.completedAt}`);
        }
        if (result.results.length > 0) {
          info(`\n${bold('Results:')}`);
          info(JSON.stringify(result.results, null, 2));
        }
        if (result.conclusion) {
          info(`${bold('Conclusion:')} ${result.conclusion}`);
        }
        if (result.error) {
          error(result.error);
        }
      } catch (err) {
        error(`Failed to get experiment: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  experiments
    .command('run <id>')
    .description('Run or re-run an experiment')
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { projectId?: string; json?: boolean }) => {
      try {
        const path = `/api/v1/experiments/${encodeURIComponent(id)}/run`;
        const request = { method: 'POST', ...(opts.projectId ? { projectId: opts.projectId } : {}) };
        const result = await apiRequest<Experiment>(path, request);
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }
        header('Experiment Started');
        info(`${bold('ID:')}     ${cyan(result.id)}`);
        info(`${bold('Status:')} ${cyan(result.status)}`);
      } catch (caught) {
        error(`Failed to run experiment: ${caught instanceof Error ? caught.message : String(caught)}`);
        process.exitCode = 1;
      }
    });
}

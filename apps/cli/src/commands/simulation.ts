/**
 * @module @recurrsive/cli/commands/simulation
 *
 * `recurrsive simulate` — Run and view simulations.
 *
 * Provides subcommands for listing past simulations, starting new
 * ones (traffic-replay, load-test, failure-injection), and viewing
 * detailed results with impact metrics.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest } from '../config.js';
import {
  header,
  info,
  error,
  success,
  bold,
  cyan,
  dim,
  green,
  yellow,
  red,
  magenta,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SimulationEntry {
  id: string;
  type: string;
  status: 'complete' | 'running' | 'pending' | 'failed';
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  started: string;
  duration: string;
}

interface ImpactMetric {
  metric: string;
  before: string;
  after: string;
  change: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_TYPES = ['traffic-replay', 'load-test', 'failure-injection'] as const;

function statusBadge(status: string): string {
  switch (status) {
    case 'complete': return green('● complete');
    case 'running':  return yellow('● running');
    case 'pending':  return cyan('● pending');
    case 'failed':   return red('● failed');
    default:         return dim('● unknown');
  }
}

function riskBadge(level: string): string {
  switch (level) {
    case 'HIGH':   return red('HIGH');
    case 'MEDIUM': return yellow('MEDIUM');
    case 'LOW':    return green('LOW');
    default:       return dim(level);
  }
}

function changeBadge(change: number): string {
  if (change > 0) return green(`▲ +${Math.abs(change)}%`);
  if (change < 0) return red(`▼ -${Math.abs(change)}%`);
  return dim('─ 0%');
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `simulate` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerSimulationCommand(program: Command): void {
  const simulate = program
    .command('simulate')
    .description('Run and view simulations');

  // ── simulate list ────────────────────────────────────────────────────
  simulate
    .command('list')
    .description('List all simulations')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let data: SimulationEntry[];
      try {
        data = await apiRequest('/api/v1/simulations') as SimulationEntry[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Simulations');

      const rows = data.map((s) => [
        bold(s.id),
        cyan(s.type),
        statusBadge(s.status),
        riskBadge(s.riskLevel),
        dim(s.started),
        dim(s.duration),
      ]);

      console.log(table(['ID', 'Type', 'Status', 'Risk', 'Started', 'Duration'], rows));
      console.log('');
      info(dim(`${data.length} simulations`));
      console.log('');
    });

  // ── simulate run ─────────────────────────────────────────────────────
  simulate
    .command('run <type>')
    .description('Start a simulation (traffic-replay|load-test|failure-injection)')
    .option('--name <name>', 'Simulation name')
    .option('--duration <min>', 'Duration in minutes', '5')
    .action(async (type: string, opts: { name?: string; duration?: string }) => {
      if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
        error(`Invalid simulation type: ${bold(type)}`);
        info(`Valid types: ${VALID_TYPES.map((t) => cyan(t)).join(', ')}`);
        process.exitCode = 1;
        return;
      }

      const name = opts.name ?? `CLI ${type} simulation`;

      header('Starting Simulation');

      let sim: { id: string; status: string };
      try {
        const result = await apiRequest('/api/v1/simulations', {
          method: 'POST',
          body: JSON.stringify({
            name,
            type,
            description: `${type} simulation started from CLI`,
          }),
        });
        sim = (result as { data: { id: string; status: string } }).data;
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      info(`  ${bold('ID:')}       ${cyan(sim.id)}`);
      info(`  ${bold('Type:')}     ${cyan(type)}`);
      info(`  ${bold('Duration:')} ${opts.duration ?? '5'} minutes`);
      info(`  ${bold('Status:')}   ${statusBadge(sim.status)}`);
      info(`  ${bold('Started:')}  ${dim(new Date().toISOString())}`);
      console.log('');

      success(`Simulation ${bold(sim.id)} started successfully.`);
      console.log('');
      info(dim(`  Monitor progress: ${cyan(`recurrsive simulate show ${sim.id}`)}`));
      console.log('');
    });

  // ── simulate show ────────────────────────────────────────────────────
  simulate
    .command('show <id>')
    .description('Show simulation results')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      let allSimulations: SimulationEntry[];
      try {
        allSimulations = await apiRequest('/api/v1/simulations') as SimulationEntry[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }
      const sim = allSimulations.find((s) => s.id === id) ?? allSimulations[0]!;

      let metrics: ImpactMetric[];
      try {
        metrics = await apiRequest(`/api/v1/simulations/${id}/impact`) as ImpactMetric[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify({ simulation: sim, metrics }, null, 2));
        return;
      }

      header(`Simulation: ${sim.id}`);

      info(`  ${bold('Type:')}     ${cyan(sim.type)}`);
      info(`  ${bold('Status:')}   ${statusBadge(sim.status)}`);
      info(`  ${bold('Duration:')} ${dim(sim.duration)}`);
      info(`  ${bold('Risk:')}     ${riskBadge(sim.riskLevel)}`);

      header('Impact Metrics');

      const rows = metrics.map((m) => [
        bold(m.metric),
        m.before,
        m.after,
        changeBadge(m.change),
      ]);

      console.log(table(['Metric', 'Before', 'After', 'Change'], rows));

      header('Recommendations');

      console.log(`  ${magenta('→')} ${bold('Scale horizontally')} before peak traffic windows`);
      console.log(`  ${magenta('→')} ${bold('Add circuit breakers')} to downstream service calls`);
      console.log(`  ${magenta('→')} ${bold('Increase connection pool')} size for database layer`);
      console.log(`  ${magenta('→')} ${bold('Review retry policies')} to prevent cascading failures`);
      console.log('');

      info(dim('Run simulations regularly to validate resilience improvements.'));
      console.log('');
    });
}

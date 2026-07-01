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
// Mock Data
// ---------------------------------------------------------------------------

const VALID_TYPES = ['traffic-replay', 'load-test', 'failure-injection'] as const;

function getMockSimulations(): SimulationEntry[] {
  return [
    { id: 'sim-a1b2', type: 'load-test', status: 'complete', riskLevel: 'MEDIUM', started: '2026-06-30 10:00', duration: '8m 32s' },
    { id: 'sim-c3d4', type: 'failure-injection', status: 'complete', riskLevel: 'HIGH', started: '2026-06-29 14:15', duration: '12m 05s' },
    { id: 'sim-e5f6', type: 'traffic-replay', status: 'running', riskLevel: 'LOW', started: '2026-06-30 15:30', duration: '3m 12s' },
    { id: 'sim-g7h8', type: 'load-test', status: 'failed', riskLevel: 'HIGH', started: '2026-06-28 09:45', duration: '1m 08s' },
    { id: 'sim-i9j0', type: 'traffic-replay', status: 'complete', riskLevel: 'LOW', started: '2026-06-27 11:20', duration: '5m 44s' },
    { id: 'sim-k1l2', type: 'failure-injection', status: 'pending', riskLevel: 'MEDIUM', started: '2026-06-30 16:00', duration: '—' },
  ];
}

function getMockImpactMetrics(): ImpactMetric[] {
  return [
    { metric: 'p99 Latency', before: '120ms', after: '185ms', change: -54 },
    { metric: 'Error Rate', before: '0.02%', after: '0.15%', change: -650 },
    { metric: 'Throughput', before: '2,400 rps', after: '2,180 rps', change: -9 },
    { metric: 'CPU Usage', before: '45%', after: '72%', change: -60 },
    { metric: 'Memory Usage', before: '62%', after: '68%', change: -10 },
  ];
}

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
    .action((opts: { json?: boolean }) => {
      const data = getMockSimulations();

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
    .option('--duration <min>', 'Duration in minutes', '5')
    .action((type: string, opts: { duration?: string }) => {
      if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
        error(`Invalid simulation type: ${bold(type)}`);
        info(`Valid types: ${VALID_TYPES.map((t) => cyan(t)).join(', ')}`);
        process.exitCode = 1;
        return;
      }

      const duration = opts.duration ?? '5';
      const simId = `sim-${Math.random().toString(36).slice(2, 6)}`;

      header('Starting Simulation');

      info(`  ${bold('ID:')}       ${cyan(simId)}`);
      info(`  ${bold('Type:')}     ${cyan(type)}`);
      info(`  ${bold('Duration:')} ${duration} minutes`);
      info(`  ${bold('Started:')}  ${dim(new Date().toISOString())}`);
      console.log('');

      success(`Simulation ${bold(simId)} started successfully.`);
      console.log('');
      info(dim(`  Monitor progress: ${cyan(`recurrsive simulate show ${simId}`)}`));
      console.log('');
    });

  // ── simulate show ────────────────────────────────────────────────────
  simulate
    .command('show <id>')
    .description('Show simulation results')
    .option('--json', 'Output as JSON')
    .action((id: string, opts: { json?: boolean }) => {
      const sim = getMockSimulations().find((s) => s.id === id) ?? getMockSimulations()[0]!;
      const metrics = getMockImpactMetrics();

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

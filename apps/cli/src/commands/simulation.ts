/**
 * @module @recurrsive/cli/commands/simulation
 *
 * `recurrsive simulate` — Run and view simulations.
 *
 * Subcommands list simulations, start new ones, and view detailed
 * results. Impact metrics and findings come from the server's stored
 * simulation results (derived from real analysis data) — the CLI does
 * not invent metrics or recommendations.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest, apiRequestList, reportApiError } from '../config.js';
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
// Types (match the server's SimulationScenario shape)
// ---------------------------------------------------------------------------

interface SimulationResult {
  impactScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  findings: Array<{
    area: string;
    impact: string;
    probability: number;
    recommendation: string;
  }>;
  metrics: {
    estimatedLatencyChangeMs: number;
    estimatedErrorRateChange: number;
    estimatedCostChangePct: number;
    estimatedAvailabilityChange: number;
  };
}

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: SimulationResult | null;
  createdAt: string;
  completedAt: string | null;
}

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const VALID_TYPES = [
  'traffic-replay',
  'load-test',
  'failure-injection',
  'dependency-change',
  'architecture-change',
] as const;

function statusBadge(status: string): string {
  switch (status) {
    case 'completed': return green('● completed');
    case 'running':   return yellow('● running');
    case 'pending':   return cyan('● pending');
    case 'failed':    return red('● failed');
    default:          return dim(`● ${status}`);
  }
}

function riskBadge(level: string | undefined): string {
  switch (level) {
    case 'critical': return red('CRITICAL');
    case 'high':     return red('HIGH');
    case 'medium':   return yellow('MEDIUM');
    case 'low':      return green('LOW');
    default:         return dim('—');
  }
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
      let items: SimulationScenario[];
      let total: number;
      try {
        const res = await apiRequestList<SimulationScenario>('/api/v1/simulations');
        items = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'List simulations' });
      }

      if (opts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      header('Simulations');

      if (items.length === 0) {
        info(dim('No simulations yet. Start one with `recurrsive simulate run <type>`.'));
        return;
      }

      const rows = items.map((s) => [
        bold(s.id),
        cyan(s.type),
        statusBadge(s.status),
        riskBadge(s.results?.riskLevel),
        dim(s.createdAt),
      ]);
      console.log(table(['ID', 'Type', 'Status', 'Risk', 'Created'], rows));
      console.log('');
      info(dim(`${total} simulation(s)`));
      console.log('');
    });

  // ── simulate run ─────────────────────────────────────────────────────
  simulate
    .command('run <type>')
    .description(`Start a simulation (${VALID_TYPES.join('|')})`)
    .option('--name <name>', 'Simulation name')
    .action(async (type: string, opts: { name?: string }) => {
      if (!VALID_TYPES.includes(type as typeof VALID_TYPES[number])) {
        error(`Invalid simulation type: ${bold(type)}`);
        info(`Valid types: ${VALID_TYPES.map((t) => cyan(t)).join(', ')}`);
        process.exitCode = 1;
        return;
      }

      const name = opts.name ?? `CLI ${type} simulation`;

      header('Starting Simulation');

      let sim: SimulationScenario;
      try {
        sim = await apiRequest('/api/v1/simulations', {
          method: 'POST',
          body: JSON.stringify({
            name,
            type,
            description: `${type} simulation started from CLI`,
          }),
        }).then((env) => (env as { data: SimulationScenario }).data);
      } catch (err) {
        reportApiError(err, { action: 'Start simulation' });
      }

      info(`  ${bold('ID:')}      ${cyan(sim.id)}`);
      info(`  ${bold('Type:')}    ${cyan(sim.type)}`);
      info(`  ${bold('Status:')}  ${statusBadge(sim.status)}`);
      info(`  ${bold('Created:')} ${dim(sim.createdAt)}`);
      console.log('');
      success(`Simulation ${bold(sim.id)} created.`);
      console.log('');
      info(dim(`View results: ${cyan(`recurrsive simulate show ${sim.id}`)}`));
      console.log('');
    });

  // ── simulate show ────────────────────────────────────────────────────
  simulate
    .command('show <id>')
    .description('Show simulation results')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      let sim: SimulationScenario;
      try {
        sim = await apiRequest(`/api/v1/simulations/${encodeURIComponent(id)}`).then(
          (env) => (env as { data: SimulationScenario }).data,
        );
      } catch (err) {
        reportApiError(err, { resource: `simulation '${id}'`, action: 'Get simulation' });
      }

      if (opts.json) {
        console.log(JSON.stringify(sim, null, 2));
        return;
      }

      header(`Simulation: ${sim.id}`);
      info(`  ${bold('Name:')}   ${sim.name}`);
      info(`  ${bold('Type:')}   ${cyan(sim.type)}`);
      info(`  ${bold('Status:')} ${statusBadge(sim.status)}`);

      if (!sim.results) {
        console.log('');
        info(dim('No results available yet.'));
        console.log('');
        return;
      }

      info(`  ${bold('Risk:')}   ${riskBadge(sim.results.riskLevel)}`);
      info(`  ${bold('Impact score:')} ${cyan(String(sim.results.impactScore))}`);

      header('Estimated Impact Metrics');
      const m = sim.results.metrics;
      const rows = [
        ['Latency change', `${m.estimatedLatencyChangeMs} ms`],
        ['Error rate change', String(m.estimatedErrorRateChange)],
        ['Cost change', `${m.estimatedCostChangePct}%`],
        ['Availability change', String(m.estimatedAvailabilityChange)],
      ];
      console.log(table(['Metric', 'Estimate'], rows));

      if (sim.results.findings.length > 0) {
        header('Findings & Recommendations');
        for (const f of sim.results.findings) {
          console.log(`  ${magenta('→')} ${bold(f.area)}: ${f.impact}`);
          if (f.recommendation) {
            console.log(`    ${dim(f.recommendation)} ${dim(`(p=${f.probability})`)}`);
          }
        }
        console.log('');
      }

      info(dim('Impact metrics are model estimates derived from the project\'s current analysis findings.'));
      console.log('');
    });
}

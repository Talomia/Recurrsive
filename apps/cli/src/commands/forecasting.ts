/**
 * @module @recurrsive/cli/commands/forecasting
 *
 * `recurrsive forecast` — Health predictions and what-if simulations.
 *
 * Provides subcommands for viewing health trend forecasts with
 * confidence bands and running interactive what-if impact analyses.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest } from '../config.js';
import {
  header,
  info,
  bold,
  cyan,
  dim,
  green,
  yellow,
  red,
  magenta,
  progressBar,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HealthForecast {
  currentHealth: number;
  predictedHealth: number;
  trend: 'improving' | 'declining' | 'stable';
  confidenceLow: number;
  confidenceHigh: number;
  margin: number;
  factors: string[];
  weekly: { week: string; predicted: number; confidence: string; trend: string }[];
}

interface WhatIfAction {
  id: string;
  name: string;
  impact: number;
  effort: string;
  confidence: number;
  category: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTrend(trend: string): string {
  switch (trend) {
    case 'improving': return green('▲ Improving');
    case 'declining': return red('▼ Declining');
    default:          return yellow('─ Stable');
  }
}

function formatTrendArrow(trend: string): string {
  switch (trend) {
    case 'improving': return green('▲');
    case 'declining': return red('▼');
    default:          return dim('─');
  }
}

function effortBadge(effort: string): string {
  switch (effort) {
    case 'S':  return green(`[${effort}]`);
    case 'M':  return cyan(`[${effort}]`);
    case 'L':  return yellow(`[${effort}]`);
    case 'XL': return red(`[${effort}]`);
    default:   return dim(`[${effort}]`);
  }
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `forecast` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerForecastCommand(program: Command): void {
  const forecast = program
    .command('forecast')
    .description('Health predictions and what-if simulations');

  // ── forecast health ──────────────────────────────────────────────────
  forecast
    .command('health')
    .description('Show health prediction with trend and confidence')
    .option('--json', 'Output as JSON')
    .option('--days <n>', 'Forecast horizon in days', '30')
    .action(async (opts: { json?: boolean; days?: string }) => {
      const days = parseInt(opts.days ?? '30', 10);
      let data: HealthForecast;
      try {
        data = await apiRequest('/api/v1/forecasting') as HealthForecast;
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header(`Health Forecast (${days}-day horizon)`);

      console.log(`  ${bold('Current Health:')}`);
      console.log(`    ${progressBar(data.currentHealth, 100, 35)}`);
      console.log('');
      console.log(`  ${bold('Predicted Health:')}`);
      console.log(`    ${progressBar(data.predictedHealth, 100, 35)}`);
      console.log('');
      console.log(`  ${bold('Trend:')}       ${formatTrend(data.trend)}`);
      console.log(`  ${bold('Confidence:')}  ${cyan(`${data.confidenceLow}–${data.confidenceHigh}`)} ${dim(`(±${data.margin})`)}`);
      console.log('');

      header('Key Factors');
      for (const factor of data.factors) {
        console.log(`  ${magenta('→')} ${factor}`);
      }

      header('Weekly Forecast');
      const rows = data.weekly.map((w) => [
        bold(w.week),
        String(w.predicted),
        dim(w.confidence),
        formatTrendArrow(w.trend),
      ]);
      console.log(table(['Week', 'Predicted Score', 'Confidence', 'Trend'], rows));
      console.log('');

      info(dim('Predictions based on historical trend analysis and active opportunity resolution rates.'));
      console.log('');
    });

  // ── forecast what-if ─────────────────────────────────────────────────
  forecast
    .command('what-if')
    .description('Interactive what-if impact simulation')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let actions: WhatIfAction[];
      let body: Record<string, unknown>;
      try {
        body = await apiRequest('/api/v1/forecasting/actions') as Record<string, unknown>;
        actions = body as unknown as WhatIfAction[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }
      const bodyData = body['data'] as Record<string, unknown> | undefined;
      const currentHealth = (bodyData?.['currentScore'] ?? bodyData?.['currentHealth'] ?? 74) as number;

      if (opts.json) {
        console.log(JSON.stringify({ currentHealth, actions }, null, 2));
        return;
      }

      header('What-If Simulation');

      console.log(`  ${bold('Current Health:')} ${progressBar(currentHealth, 100, 25)}`);
      console.log('');

      header('Available Actions');

      for (const action of actions) {
        const impactBar = green('█'.repeat(action.impact)) + dim('░'.repeat(15 - action.impact));
        console.log(`  ${cyan('▸')} ${bold(action.name)}`);
        console.log(`    Impact: ${impactBar} ${green(`+${action.impact}`)}  ${effortBadge(action.effort)}  ${dim(`${action.confidence}% confidence`)}`);
        console.log(`    ${dim(`Category: ${action.category}`)}`);
        console.log('');
      }

      // Cumulative impact summary
      const totalImpact = actions.reduce((s, a) => s + a.impact, 0);
      const projected = Math.min(100, currentHealth + totalImpact);

      header('Cumulative Impact');
      console.log(`  ${bold('If all actions completed:')}`);
      console.log(`    ${progressBar(projected, 100, 35)}`);
      console.log(`    ${green(`+${totalImpact}`)} ${dim('points from current score')}`);
      console.log('');

      info(dim('Run individual actions to refine predictions with real-time data.'));
      console.log('');
    });
}

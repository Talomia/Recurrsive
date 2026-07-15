/**
 * @module @recurrsive/cli/commands/forecasting
 *
 * `recurrsive forecast` — Health predictions and what-if simulations.
 *
 * Provides subcommands for viewing health trend forecasts with
 * confidence bands and running what-if impact analyses. All data comes
 * from the server's `/api/v1/forecasting/*` endpoints — the CLI does not
 * fabricate scores or fall back to placeholder values.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest, reportApiError } from '../config.js';
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
// Types (match the server's forecasting response shapes)
// ---------------------------------------------------------------------------

interface HealthForecastData {
  status?: 'insufficient_data';
  message?: string;
  snapshotsAvailable?: number;
  currentScore?: number;
  trend?: 'improving' | 'declining' | 'stable';
  confidence?: number;
  history?: Array<{ date: string; score: number }>;
  forecast?: Array<{
    date: string;
    predicted: number;
    lowerBound: number;
    upperBound: number;
  }>;
  targets?: Array<{ target: number; daysToReach: number | null; reachable: boolean }>;
}

interface WhatIfData {
  status?: 'insufficient_data';
  message?: string;
  currentScore?: number;
  projectedScore?: number;
  totalImpact?: number;
  actions?: Array<{
    type: string;
    description?: string;
    impact?: {
      healthScoreDelta: number;
      confidence: number;
      timeToRealize: string;
      affectedDimensions: string[];
    };
  }>;
  summary?: {
    highestImpact?: string | null;
    totalActions?: number;
    avgConfidence?: number;
    recommendation?: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTrend(trend: string | undefined): string {
  switch (trend) {
    case 'improving': return green('▲ Improving');
    case 'declining': return red('▼ Declining');
    case 'stable':    return yellow('─ Stable');
    default:          return dim('unknown');
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
      let data: HealthForecastData;
      try {
        data = await apiRequest(
          `/api/v1/forecasting/health?horizon=${days}`,
        ).then((env) => (env as { data: HealthForecastData }).data);
      } catch (err) {
        reportApiError(err, { action: 'Fetch health forecast' });
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header(`Health Forecast (${days}-day horizon)`);

      // Honest empty state — the server needs >= 2 snapshots to forecast.
      if (data.status === 'insufficient_data' || data.currentScore === undefined) {
        info(
          data.message ??
            'Not enough analysis history to forecast. Run `recurrsive analyze` at least twice.',
        );
        if (typeof data.snapshotsAvailable === 'number') {
          console.log(dim(`  Snapshots available: ${data.snapshotsAvailable} (need at least 2)`));
        }
        console.log('');
        return;
      }

      console.log(`  ${bold('Current Health:')}`);
      console.log(`    ${progressBar(data.currentScore, 100, 35)}`);
      console.log('');
      console.log(`  ${bold('Trend:')}       ${formatTrend(data.trend)}`);
      if (typeof data.confidence === 'number') {
        console.log(`  ${bold('Confidence:')}  ${cyan(`${Math.round(data.confidence * 100)}%`)} ${dim('(model fit R²)')}`);
      }
      console.log('');

      const forecast = data.forecast ?? [];
      if (forecast.length > 0) {
        header('Projected Scores');
        const rows = forecast.map((f) => [
          bold(f.date),
          String(f.predicted),
          dim(`${f.lowerBound}–${f.upperBound}`),
        ]);
        console.log(table(['Date', 'Predicted', 'Range'], rows));
        console.log('');
      }

      const targets = (data.targets ?? []).filter((t) => t.reachable && t.daysToReach !== null);
      if (targets.length > 0) {
        header('Time to Target');
        for (const t of targets) {
          console.log(`  ${magenta('→')} Reach ${bold(String(t.target))} in ~${t.daysToReach} days`);
        }
        console.log('');
      }

      info(dim('Projections are model estimates from historical analysis snapshots, not guarantees.'));
      console.log('');
    });

  // ── forecast what-if ─────────────────────────────────────────────────
  forecast
    .command('what-if')
    .description('Simulate the health impact of one or more proposed actions')
    .argument(
      '<actions...>',
      'Action types (e.g. fix-critical-findings add-tests upgrade-dependencies)',
    )
    .option('--json', 'Output as JSON')
    .action(async (actions: string[], opts: { json?: boolean }) => {
      let data: WhatIfData;
      try {
        data = await apiRequest('/api/v1/forecasting/what-if', {
          method: 'POST',
          body: JSON.stringify({ actions: actions.map((type) => ({ type })) }),
        }).then((env) => (env as { data: WhatIfData }).data);
      } catch (err) {
        reportApiError(err, { action: 'Run what-if simulation' });
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('What-If Simulation');

      if (data.status === 'insufficient_data' || data.currentScore === undefined) {
        info(
          data.message ??
            'Not enough analysis data to simulate impact. Run `recurrsive analyze` first.',
        );
        console.log('');
        return;
      }

      console.log(`  ${bold('Current Health:')} ${progressBar(data.currentScore, 100, 25)}`);
      console.log('');

      header('Actions');
      for (const action of data.actions ?? []) {
        console.log(`  ${cyan('▸')} ${bold(action.description ?? action.type)}`);
        if (action.impact) {
          console.log(
            `    Impact: ${green(`+${action.impact.healthScoreDelta}`)}  ` +
              `${dim(`${Math.round(action.impact.confidence * 100)}% confidence`)}  ` +
              `${dim(`realizes in ${action.impact.timeToRealize}`)}`,
          );
          if (action.impact.affectedDimensions.length > 0) {
            console.log(`    ${dim(`Dimensions: ${action.impact.affectedDimensions.join(', ')}`)}`);
          }
        }
        console.log('');
      }

      if (data.projectedScore !== undefined) {
        header('Projected Impact');
        console.log(`  ${bold('If all actions completed:')}`);
        console.log(`    ${progressBar(data.projectedScore, 100, 35)}`);
        if (typeof data.totalImpact === 'number') {
          console.log(`    ${green(`+${data.totalImpact}`)} ${dim('points from current score (estimate)')}`);
        }
        console.log('');
      }

      if (data.summary?.recommendation) {
        info(dim(data.summary.recommendation));
        console.log('');
      }
    });
}

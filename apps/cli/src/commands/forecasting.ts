/**
 * `recurrsive forecast` — Display the server's history-based health trend.
 */

import type { Command } from 'commander';
import { apiRequest } from '../config.js';
import { header, info, bold, cyan, dim, green, yellow, red, progressBar, table } from '../output/terminal.js';

interface HealthForecastResponse {
  currentScore: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient-data';
  confidence: number;
  history: Array<{ date: string; score: number }>;
  forecast: Array<{ date: string; predicted: number; lowerBound: number; upperBound: number }>;
  regression: { slope: number; intercept: number; r2: number };
}

function formatTrend(trend: HealthForecastResponse['trend']): string {
  if (trend === 'improving') return green('▲ Improving');
  if (trend === 'declining') return red('▼ Declining');
  if (trend === 'insufficient-data') return yellow('Insufficient data');
  return yellow('─ Stable');
}

export function registerForecastCommand(program: Command): void {
  const forecast = program
    .command('forecast')
    .description('Show a history-based health trend projection');

  forecast
    .command('health')
    .description('Show the health trend projection and its observed-data fit')
    .option('--json', 'Output as JSON')
    .option('--days <n>', 'Projection horizon in days', '30')
    .option('--project-id <id>', 'Project ID (or set RECURRSIVE_PROJECT_ID)')
    .action(async (opts: { json?: boolean; days?: string; projectId?: string }) => {
      const requestedDays = Number.parseInt(opts.days ?? '30', 10);
      const days = Number.isFinite(requestedDays) ? Math.min(180, Math.max(1, requestedDays)) : 30;
      let response: HealthForecastResponse;
      try {
        response = opts.projectId
          ? await apiRequest<HealthForecastResponse>(`/api/v1/forecasting/health?horizon=${days}`, { projectId: opts.projectId })
          : await apiRequest<HealthForecastResponse>(`/api/v1/forecasting/health?horizon=${days}`);
      } catch {
        console.error(yellow('⚠ Could not reach the API server. Ensure it is running and you are authenticated.'));
        process.exitCode = 1;
        return;
      }

      if (opts.json) {
        console.log(JSON.stringify(response, null, 2));
        return;
      }

      const data = response;
      header(`Health Trend Projection (${days} days)`);
      console.log(`  ${bold('Current score:')} ${progressBar(data.currentScore, 100, 35)}`);
      console.log(`  ${bold('Trend:')} ${formatTrend(data.trend)}`);
      console.log(`  ${bold('Observed-data fit (R²):')} ${cyan(data.confidence.toFixed(2))}`);
      console.log(`  ${bold('History points:')} ${data.history.length}`);
      console.log('');

      if (data.history.length < 2) {
        info(yellow('At least two completed analyses are required for a meaningful trend.'));
        return;
      }

      const sample = data.forecast.filter((_point, index) => index === 0 || (index + 1) % 7 === 0 || index === data.forecast.length - 1);
      console.log(table(
        ['Date', 'Projected', 'Lower', 'Upper'],
        sample.map((point) => [point.date, point.predicted.toFixed(1), point.lowerBound.toFixed(1), point.upperBound.toFixed(1)]),
      ));
      console.log('');
      info(dim('This is a linear extrapolation of recorded analysis history, not a guarantee of future results.'));
    });
}

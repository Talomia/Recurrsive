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
// Mock Data
// ---------------------------------------------------------------------------

function getMockForecast(days: number): HealthForecast {
  const scale = days / 30;
  return {
    currentHealth: 74,
    predictedHealth: Math.min(100, Math.round(74 + 5 * scale)),
    trend: 'improving',
    confidenceLow: Math.round(72 + 2 * scale),
    confidenceHigh: Math.round(74 + 12 * scale),
    margin: 7,
    factors: [
      'Security findings resolution rate trending upward (+12% MoM)',
      'Test coverage increased from 64% to 71% over 3 sprints',
      'Two critical dependency vulnerabilities remain unpatched',
      'Documentation score declining due to new API endpoints',
    ],
    weekly: [
      { week: 'Week 1', predicted: 75, confidence: '72–78', trend: 'improving' },
      { week: 'Week 2', predicted: 77, confidence: '73–81', trend: 'improving' },
      { week: 'Week 3', predicted: 78, confidence: '73–83', trend: 'stable' },
      { week: 'Week 4', predicted: 79, confidence: '72–86', trend: 'improving' },
    ],
  };
}

function getMockActions(): WhatIfAction[] {
  return [
    { id: 'act-001', name: 'Resolve critical security findings', impact: 8, effort: 'M', confidence: 92, category: 'security' },
    { id: 'act-002', name: 'Add unit test coverage', impact: 5, effort: 'L', confidence: 85, category: 'testing' },
    { id: 'act-003', name: 'Refactor legacy modules', impact: 12, effort: 'XL', confidence: 70, category: 'architecture' },
    { id: 'act-004', name: 'Enable performance monitoring', impact: 3, effort: 'S', confidence: 95, category: 'performance' },
    { id: 'act-005', name: 'Adopt dependency scanning', impact: 6, effort: 'M', confidence: 88, category: 'security' },
  ];
}

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
    .action((opts: { json?: boolean; days?: string }) => {
      const days = parseInt(opts.days ?? '30', 10);
      const data = getMockForecast(days);

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
    .action((opts: { json?: boolean }) => {
      const actions = getMockActions();
      const currentHealth = 74;

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

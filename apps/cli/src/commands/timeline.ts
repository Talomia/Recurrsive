/**
 * @module @recurrsive/cli/commands/timeline
 *
 * `recurrsive timeline` — Show evolution over time.
 *
 * Displays maturity score trends, health score history, and allows
 * comparison between snapshots stored in `.recurrsive/snapshots/`.
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Command } from 'commander';
import type { EvolutionSnapshot } from '@recurrsive/core';
import { loadConfig } from '../config/loader.js';
import {
  header,
  info,
  error,
  bold,
  cyan,
  dim,
  green,
  red,
  table,
  progressBar,
  scoreBar,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Snapshot Loading
// ---------------------------------------------------------------------------

/**
 * Load all evolution snapshots from the snapshots directory.
 *
 * @param snapshotsDir - Path to the snapshots directory.
 * @returns Array of snapshots sorted by timestamp (newest first).
 */
async function loadSnapshots(snapshotsDir: string): Promise<EvolutionSnapshot[]> {
  if (!existsSync(snapshotsDir)) {
    return [];
  }

  const files = await readdir(snapshotsDir);
  const snapshots: EvolutionSnapshot[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const raw = await readFile(join(snapshotsDir, file), 'utf-8');
      const snapshot = JSON.parse(raw) as EvolutionSnapshot;
      snapshots.push(snapshot);
    } catch {
      // Skip malformed snapshots
    }
  }

  // Sort by timestamp descending (newest first)
  snapshots.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return snapshots;
}

/**
 * Format a trend indicator.
 *
 * @param trend - 'improving', 'stable', or 'declining'.
 * @returns Coloured trend string with arrow.
 */
function formatTrend(trend: string): string {
  switch (trend) {
    case 'improving':
      return green('↑ improving');
    case 'declining':
      return red('↓ declining');
    case 'stable':
    default:
      return dim('→ stable');
  }
}

/**
 * Render a mini sparkline for a series of values.
 *
 * @param values - Numeric values to display.
 * @param width - Character width of the sparkline.
 * @returns Sparkline string.
 */
function sparkline(values: number[], _width?: number): string {
  if (values.length === 0) return '';
  const blocks = '▁▂▃▄▅▆▇█';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((v) => {
      const idx = Math.round(((v - min) / range) * (blocks.length - 1));
      return blocks[idx] ?? blocks[0]!;
    })
    .join('');
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `timeline` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerTimelineCommand(program: Command): void {
  program
    .command('timeline')
    .description('Show intelligence timeline')
    .option('--limit <n>', 'Number of snapshots to show', parseInt)
    .option('--compare <ids>', 'Compare two snapshot IDs (comma-separated)')
    .option('--dimension <dim>', 'Focus on a specific maturity dimension')
    .action(
      async (opts: {
        limit?: number;
        compare?: string;
        dimension?: string;
      }) => {
        const { config, projectRoot } = await loadConfig();
        const snapshotsDir = join(
          projectRoot,
          config.output.directory,
          'snapshots',
        );

        const snapshots = await loadSnapshots(snapshotsDir);

        if (snapshots.length === 0) {
          info('No intelligence snapshots found.');
          info(
            `Run ${bold(cyan('recurrsive analyze'))} to generate your first snapshot.`,
          );
          return;
        }

        const limit = opts.limit ?? 10;
        const displayed = snapshots.slice(0, limit);

        // ── Compare Mode ─────────────────────────────────────────
        if (opts.compare) {
          const ids = opts.compare.split(',').map((s) => s.trim());
          if (ids.length !== 2) {
            error('Provide exactly two snapshot IDs separated by a comma.');
            return;
          }

          const [snap1, snap2] = ids.map((id) =>
            snapshots.find(
              (s) => s.id === id || s.id.startsWith(id),
            ),
          );

          if (!snap1 || !snap2) {
            error('One or both snapshots not found.');
            return;
          }

          header('Snapshot Comparison');

          console.log(
            `  ${bold('Old:')} ${dim(snap1.id.slice(0, 8))} — ${dim(snap1.timestamp)}`,
          );
          console.log(
            `  ${bold('New:')} ${dim(snap2.id.slice(0, 8))} — ${dim(snap2.timestamp)}`,
          );
          console.log('');

          // Health score comparison
          const healthDelta = snap2.overall_health - snap1.overall_health;
          const healthColor = healthDelta > 0 ? green : healthDelta < 0 ? red : dim;
          console.log(
            `  ${bold('Health:')} ${snap1.overall_health} → ${snap2.overall_health} ` +
              healthColor(`(${healthDelta >= 0 ? '+' : ''}${healthDelta})`),
          );
          console.log('');

          // Maturity comparison table
          const maturityRows: string[][] = [];
          for (const score2 of snap2.maturity_scores) {
            const score1 = snap1.maturity_scores.find(
              (s) => s.dimension === score2.dimension,
            );
            const prev = score1?.score ?? 0;
            const delta = score2.score - prev;
            const deltaStr = delta > 0 ? green(`+${delta}`) : delta < 0 ? red(String(delta)) : dim('0');

            maturityRows.push([
              score2.dimension,
              String(prev),
              String(score2.score),
              deltaStr,
              score2.level,
            ]);
          }

          console.log(
            table(
              ['Dimension', 'Before', 'After', 'Δ', 'Level'],
              maturityRows,
            ),
          );
          console.log('');

          // Delta summary
          const delta = snap2.changes_since_last;
          console.log(bold('  Changes:'));
          console.log(
            `    ${green('+')} ${delta.new_opportunities} new opportunities`,
          );
          console.log(
            `    ${green('✔')} ${delta.resolved_opportunities} resolved`,
          );
          console.log(
            `    ${red('!')} ${delta.new_risks} new risks`,
          );
          console.log(
            `    ${green('✔')} ${delta.resolved_risks} resolved risks`,
          );
          console.log('');

          return;
        }

        // ── Dimension Focus ──────────────────────────────────────
        if (opts.dimension) {
          const dim_ = opts.dimension;

          header(`Timeline: ${dim_}`);

          const values: Array<{ timestamp: string; score: number; level: string }> = [];
          for (const snap of [...displayed].reverse()) {
            const score = snap.maturity_scores.find(
              (s) => s.dimension === dim_,
            );
            if (score) {
              values.push({
                timestamp: snap.timestamp.slice(0, 10),
                score: score.score,
                level: score.level,
              });
            }
          }

          if (values.length === 0) {
            info(`No data for dimension "${dim_}".`);
            return;
          }

          // Show sparkline
          const scores = values.map((v) => v.score);
          console.log(
            `  ${bold('Trend:')} ${sparkline(scores)}  ${dim(String(scores[0]))} → ${bold(String(scores[scores.length - 1]))}`,
          );
          console.log('');

          // Show data points
          const rows = values.map((v) => [
            v.timestamp,
            String(v.score),
            v.level,
            progressBar(v.score, 100, 15),
          ]);

          console.log(
            table(['Date', 'Score', 'Level', 'Progress'], rows),
          );
          console.log('');

          return;
        }

        // ── Default: Timeline Overview ───────────────────────────
        header('Intelligence Timeline');

        const latest = displayed[0]!;
        console.log(
          `  ${bold('Latest snapshot:')} ${dim(latest.timestamp)}`,
        );
        console.log(
          `  ${bold('Overall health:')}  ${progressBar(latest.overall_health, 100, 25)}`,
        );
        console.log('');

        // Current maturity scores
        console.log(bold('  Current Maturity Scores:'));
        console.log('');

        for (const score of latest.maturity_scores) {
          console.log(
            `  ${scoreBar(score.dimension, score.score)} ${formatTrend(score.trend)} ${dim(`(${score.level})`)}`,
          );
        }
        console.log('');

        // Health score history
        if (displayed.length > 1) {
          console.log(bold('  Health History:'));
          console.log('');

          const healthValues = [...displayed]
            .reverse()
            .map((s) => s.overall_health);
          console.log(
            `  ${sparkline(healthValues)}  ${dim(String(healthValues[0]))} → ${bold(String(healthValues[healthValues.length - 1]))}`,
          );
          console.log('');

          const historyRows = displayed.slice(0, 8).map((snap) => [
            snap.timestamp.slice(0, 16),
            String(snap.overall_health),
            String(snap.opportunity_count),
            String(snap.risk_count),
            String(snap.debt_count),
            snap.id.slice(0, 8),
          ]);

          console.log(
            table(
              ['Timestamp', 'Health', 'Opps', 'Risks', 'Debt', 'ID'],
              historyRows,
            ),
          );
          console.log('');
        }

        console.log(
          dim('  Use ') +
            cyan('recurrsive timeline --compare <id1>,<id2>') +
            dim(' to compare snapshots.'),
        );
        console.log(
          dim('  Use ') +
            cyan('recurrsive timeline --dimension <dim>') +
            dim(' to focus on a dimension.'),
        );
        console.log('');
      },
    );
}

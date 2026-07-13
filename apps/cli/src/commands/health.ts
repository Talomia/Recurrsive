/**
 * @module @recurrsive/cli/commands/health
 *
 * `recurrsive health` — Show health score and maturity breakdown.
 *
 * Displays the overall health score with a visual bar, maturity
 * scores by dimension, and the top risks and opportunities.
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Command } from 'commander';
import { calculateFindingHealth, type EvolutionSnapshot, type Finding, type Opportunity } from '@recurrsive/core';
import { OpportunityManager } from '@recurrsive/opportunities';
import { createGraphClient } from '@recurrsive/graph';
import { loadConfig } from '../config/loader.js';
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
  scoreBar,
  severityBadge,
  severityColor,
  banner,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Load the latest evolution snapshot from disk.
 *
 * @param snapshotsDir - Path to the snapshots directory.
 * @returns The latest snapshot, or null if none found.
 */
async function loadLatestSnapshot(
  snapshotsDir: string,
): Promise<EvolutionSnapshot | null> {
  if (!existsSync(snapshotsDir)) return null;

  const files = await readdir(snapshotsDir);
  const jsonFiles = files.filter((f) => f.endsWith('.json'));
  if (jsonFiles.length === 0) return null;

  let latest: EvolutionSnapshot | null = null;
  let latestTime = 0;

  for (const file of jsonFiles) {
    try {
      const raw = await readFile(join(snapshotsDir, file), 'utf-8');
      const snapshot = JSON.parse(raw) as EvolutionSnapshot;
      const time = new Date(snapshot.timestamp).getTime();
      if (time > latestTime) {
        latestTime = time;
        latest = snapshot;
      }
    } catch { // expected
      // Skip malformed
    }
  }

  return latest;
}

/**
 * Format a trend direction with colour.
 *
 * @param trend - The trend direction.
 * @returns Formatted trend string.
 */
function formatTrend(trend: string): string {
  switch (trend) {
    case 'improving':
      return green('▲');
    case 'declining':
      return red('▼');
    case 'stable':
    default:
      return dim('─');
  }
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `health` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerHealthCommand(program: Command): void {
  program
    .command('health')
    .description('Show project health score and maturity breakdown')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      const { config, projectRoot } = await loadConfig();
      const outputDir = config.output.directory;

      // Load snapshot
      const snapshotsDir = join(projectRoot, outputDir, 'snapshots');
      const snapshot = await loadLatestSnapshot(snapshotsDir);

      // Load opportunities
      const oppsPath = join(projectRoot, outputDir, 'opportunities.json');
      const manager = new OpportunityManager();
      let opportunities: Opportunity[] = [];
      if (existsSync(oppsPath)) {
        try {
          await manager.load(oppsPath);
          opportunities = manager.list();
        } catch { // expected
          // Ignore
        }
      }

      const findingsPath = join(projectRoot, outputDir, 'findings.json');
      let findings: Finding[] | null = null;
      if (!snapshot && existsSync(findingsPath)) {
        const raw = JSON.parse(await readFile(findingsPath, 'utf-8')) as unknown;
        if (!Array.isArray(raw)) throw new Error('findings.json must contain an array');
        findings = raw as Finding[];
      }

      // Get graph stats for additional context
      let entityCount = 0;
      try {
        const dbPath =
          config.graph.connection_string ??
          resolve(projectRoot, '.recurrsive', 'graph.db');

        if (existsSync(dbPath)) {
          const client = await createGraphClient({
            provider: config.graph.provider,
            sqlitePath: config.graph.provider === 'sqlite' ? dbPath : undefined,
            connectionString:
              config.graph.provider === 'postgresql_age'
                ? config.graph.connection_string
                : undefined,
            autoMigrate: false,
          });
          const stats = await client.getStats();
          entityCount = stats.totalEntities;
          await client.dispose();
        }
      } catch { // expected
        // Ignore — graph may not exist yet
      }

      // Compute health score
      const healthScore = snapshot?.overall_health ?? (findings ? calculateFindingHealth(findings) : null);

      // ── JSON output ────────────────────────────────────────
      if (opts.json) {
        const output = {
          overall_health: healthScore,
          maturity_scores: snapshot?.maturity_scores ?? [],
          opportunity_count: opportunities.length,
          risk_count: opportunities.filter((o) => o.type === 'risk').length,
          debt_count: opportunities.filter((o) => o.type === 'debt').length,
          entity_count: entityCount,
          snapshot_id: snapshot?.id ?? null,
          snapshot_timestamp: snapshot?.timestamp ?? null,
        };
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      // ── Visual output ──────────────────────────────────────
      banner();

      header('Project Health');

      if (healthScore === null) {
        info(yellow('No recorded analysis results found. Run `recurrsive analyze .` first.'));
        return;
      }

      // Big health score
      console.log(`  ${bold('Overall Health Score:')}`);
      console.log('');
      console.log(`    ${progressBar(healthScore, 100, 40)}`);
      console.log('');

      // Quick stats
      const riskCount = opportunities.filter((o) => o.type === 'risk').length;
      const debtCount = opportunities.filter((o) => o.type === 'debt').length;
      const oppCount = opportunities.filter(
        (o) => o.type === 'opportunity',
      ).length;

      console.log(
        `  ${bold('Graph:')} ${cyan(String(entityCount))} entities  │  ` +
          `${magenta('Opportunities:')} ${oppCount}  │  ` +
          `${red('Risks:')} ${riskCount}  │  ` +
          `${yellow('Debt:')} ${debtCount}`,
      );
      console.log('');

      // Maturity scores
      if (snapshot && snapshot.maturity_scores.length > 0) {
        header('Maturity by Dimension');

        for (const score of snapshot.maturity_scores) {
          const trend = formatTrend(score.trend);
          console.log(
            `  ${trend} ${scoreBar(score.dimension, score.score)} ${dim(`(${score.level})`)}`,
          );
        }
        console.log('');
      } else {
        info(
          'No maturity data available. ' +
            `Run ${bold(cyan('recurrsive analyze'))} to generate a snapshot.`,
        );
        console.log('');
      }

      // Top risks
      const risks = opportunities
        .filter((o) => o.type === 'risk')
        .slice(0, 5);

      if (risks.length > 0) {
        header('Top Risks');

        for (const risk of risks) {
          console.log(
            `  ${severityBadge(risk.severity)} ${bold(risk.title)}`,
          );
          console.log(
            `    ${dim(risk.category)} · ${severityColor(risk.severity)} · ${dim(`${Math.round(risk.confidence * 100)}%`)}`,
          );
        }
        console.log('');
      }

      // Top opportunities
      const topOpps = opportunities
        .filter((o) => o.type === 'opportunity' && o.status === 'proposed')
        .slice(0, 5);

      if (topOpps.length > 0) {
        header('Top Opportunities');

        for (const opp of topOpps) {
          console.log(
            `  ${severityBadge(opp.severity)} ${bold(opp.title)}`,
          );
          console.log(
            `    ${dim(opp.category)} · Effort: ${dim(opp.effort.t_shirt.toUpperCase())} · ${dim(`${Math.round(opp.confidence * 100)}%`)}`,
          );
        }
        console.log('');
      }

      // Recommendations
      if (snapshot) {
        const recommendations: string[] = [];
        for (const score of snapshot.maturity_scores) {
          if (score.score < 40 && score.recommendations.length > 0) {
            recommendations.push(
              `${bold(score.dimension)}: ${score.recommendations[0]}`,
            );
          }
        }

        if (recommendations.length > 0) {
          header('Key Recommendations');
          for (const rec of recommendations.slice(0, 5)) {
            console.log(`  ${green('→')} ${rec}`);
          }
          console.log('');
        }
      }

      console.log(
        dim('  Run ') +
          cyan(bold('recurrsive analyze')) +
          dim(' to update health scores.'),
      );
      console.log('');
    });
}

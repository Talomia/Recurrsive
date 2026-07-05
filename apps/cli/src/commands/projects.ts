/**
 * @module @recurrsive/cli/commands/projects
 *
 * `recurrsive projects` — Manage and compare projects.
 *
 * Provides subcommands for listing projects, viewing details with
 * analyzer/collector settings, and comparing health across projects.
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

interface ProjectSummary {
  id: string;
  name: string;
  health: number;
  status: string;
  language: string;
  lastAnalyzed: string;
}

interface ProjectDetail extends ProjectSummary {
  description: string;
  repoUrl: string;
  framework: string;
  analyzers: { name: string; enabled: boolean }[];
  collectors: { name: string; interval: string }[];
}

interface HealthComparison {
  project: string;
  health: number;
  complexity: number;
  security: number;
  performance: number;
  trend: 'improving' | 'declining' | 'stable';
}

function formatTrend(trend: string): string {
  switch (trend) {
    case 'improving': return green('▲');
    case 'declining': return red('▼');
    default:          return dim('─');
  }
}

function statusBadge(status: string): string {
  switch (status) {
    case 'active':   return green('● active');
    case 'warning':  return yellow('● warning');
    case 'critical': return red('● critical');
    default:         return dim('● unknown');
  }
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `projects` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerProjectsCommand(program: Command): void {
  const projects = program
    .command('projects')
    .description('Manage and compare projects');

  // ── projects list ────────────────────────────────────────────────────
  projects
    .command('list')
    .description('List all projects with health scores')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let data: ProjectSummary[];
      try {
        data = await apiRequest('/api/v1/projects') as ProjectSummary[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Projects');

      const rows = data.map((p) => [
        bold(p.name),
        progressBar(p.health, 100, 15),
        statusBadge(p.status),
        cyan(p.language),
        dim(p.lastAnalyzed),
      ]);

      console.log(table(['Name', 'Health', 'Status', 'Language', 'Last Analyzed'], rows));
      console.log('');
      info(dim(`${data.length} projects`));
      console.log('');
    });

  // ── projects show ────────────────────────────────────────────────────
  projects
    .command('show <id>')
    .description('Show project details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      let detail: ProjectDetail;
      try {
        detail = await apiRequest(`/api/v1/projects/${id}`) as ProjectDetail;
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(detail, null, 2));
        return;
      }

      header(`Project: ${detail.name}`);

      info(`  ${bold('ID:')}          ${cyan(detail.id)}`);
      info(`  ${bold('Description:')} ${detail.description}`);
      info(`  ${bold('Repository:')}  ${dim(detail.repoUrl)}`);
      info(`  ${bold('Language:')}    ${cyan(detail.language)}`);
      info(`  ${bold('Framework:')}   ${detail.framework}`);
      info(`  ${bold('Health:')}      ${progressBar(detail.health, 100, 20)}`);

      header('Analyzers');
      for (const a of detail.analyzers) {
        const badge = a.enabled ? green('● enabled') : dim('○ disabled');
        info(`  ${badge}  ${bold(a.name)}`);
      }

      header('Collectors');
      for (const c of detail.collectors) {
        info(`  ${magenta('◈')} ${bold(c.name)}  ${dim(`every ${c.interval}`)}`);
      }
      console.log('');
    });

  // ── projects health-compare ──────────────────────────────────────────
  projects
    .command('health-compare')
    .description('Side-by-side health comparison')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let data: HealthComparison[];
      try {
        data = await apiRequest('/api/v1/projects/comparisons') as HealthComparison[];
      } catch {
        console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      header('Health Comparison');

      const rows = data.map((c) => [
        bold(c.project),
        progressBar(c.health, 100, 12),
        String(c.complexity),
        String(c.security),
        String(c.performance),
        formatTrend(c.trend),
      ]);

      console.log(table(['Project', 'Health', 'Complexity', 'Security', 'Performance', 'Trend'], rows));
      console.log('');

      const avg = Math.round(data.reduce((s, c) => s + c.health, 0) / data.length);
      info(`  ${bold('Average Health:')} ${progressBar(avg, 100, 20)}`);
      console.log('');
    });
}

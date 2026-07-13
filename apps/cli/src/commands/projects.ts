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
  yellow,
  progressBar,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProjectSummary {
  id: string;
  name: string;
  healthScore: number;
  language: string;
  framework: string;
  lastAnalysis: string | null;
}

interface ProjectDetail extends ProjectSummary {
  description: string;
  repository: string;
  settings: {
    analyzers: string[];
    collectors: string[];
  };
}

interface HealthComparison {
  id: string;
  name: string;
  healthScore: number;
  language: string;
  framework: string;
  lastAnalysis: string | null;
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
        data = await apiRequest<ProjectSummary[]>('/api/v1/projects');
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
        progressBar(p.healthScore, 100, 15),
        cyan(p.language || '—'),
        p.framework || '—',
        dim(p.lastAnalysis ?? 'Never'),
      ]);

      console.log(table(['Name', 'Health', 'Language', 'Framework', 'Last Analyzed'], rows));
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
        detail = await apiRequest<ProjectDetail>(`/api/v1/projects/${encodeURIComponent(id)}`);
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
      info(`  ${bold('Repository:')}  ${dim(detail.repository)}`);
      info(`  ${bold('Language:')}    ${cyan(detail.language)}`);
      info(`  ${bold('Framework:')}   ${detail.framework}`);
      info(`  ${bold('Health:')}      ${progressBar(detail.healthScore, 100, 20)}`);

      header('Analyzers');
      for (const analyzer of detail.settings.analyzers) {
        info(`  ${bold(analyzer)}`);
      }

      header('Collectors');
      for (const collector of detail.settings.collectors) {
        info(`  ${bold(collector)}`);
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
        data = await apiRequest<HealthComparison[]>('/api/v1/projects/compare/health');
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
        bold(c.name),
        progressBar(c.healthScore, 100, 12),
        c.language || '—',
        c.framework || '—',
        c.lastAnalysis ?? 'Never',
      ]);

      console.log(table(['Project', 'Health', 'Language', 'Framework', 'Last Analyzed'], rows));
      console.log('');

      const avg = data.length > 0
        ? Math.round(data.reduce((sum, project) => sum + project.healthScore, 0) / data.length)
        : 0;
      info(`  ${bold('Average Health:')} ${progressBar(avg, 100, 20)}`);
      console.log('');
    });
}

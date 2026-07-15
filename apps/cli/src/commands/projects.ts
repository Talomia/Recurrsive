/**
 * @module @recurrsive/cli/commands/projects
 *
 * `recurrsive projects` — Manage and compare projects.
 *
 * Subcommands list projects, show project details, and compare health
 * across projects. Data comes from the server; unanalyzed projects are
 * reported as "not analyzed" rather than shown with a fabricated score.
 *
 * @packageDocumentation
 */

import type { Command } from 'commander';
import { apiRequest, apiRequestList, reportApiError } from '../config.js';
import {
  header,
  info,
  bold,
  cyan,
  dim,
  progressBar,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types (match the server's Project shape)
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  repository: string;
  language: string;
  framework: string;
  healthScore: number;
  lastAnalysis: string | null;
  settings?: {
    analyzers: string[];
    collectors: string[];
    autoAnalyze: boolean;
    notifyOnCritical: boolean;
  };
}

interface HealthComparisonEntry {
  id: string;
  name: string;
  slug: string;
  healthScore: number;
  language: string;
  framework: string;
  lastAnalysis: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Render a health cell, honestly showing "not analyzed" when applicable. */
function healthCell(healthScore: number, lastAnalysis: string | null, width = 15): string {
  if (!lastAnalysis) return dim('not analyzed');
  return progressBar(healthScore, 100, width);
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
      let items: Project[];
      let total: number;
      try {
        const res = await apiRequestList<Project>('/api/v1/projects');
        items = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'List projects' });
      }

      if (opts.json) {
        console.log(JSON.stringify(items, null, 2));
        return;
      }

      header('Projects');

      if (items.length === 0) {
        info(dim('No projects yet. Create one via the API or dashboard.'));
        return;
      }

      const rows = items.map((p) => [
        bold(p.name),
        healthCell(p.healthScore, p.lastAnalysis),
        cyan(p.language),
        p.framework,
        dim(p.lastAnalysis ?? '—'),
      ]);
      console.log(table(['Name', 'Health', 'Language', 'Framework', 'Last Analyzed'], rows));
      console.log('');
      info(dim(`${total} project(s)`));
      console.log('');
    });

  // ── projects show ────────────────────────────────────────────────────
  projects
    .command('show <id>')
    .description('Show project details')
    .option('--json', 'Output as JSON')
    .action(async (id: string, opts: { json?: boolean }) => {
      let project: Project;
      try {
        project = await apiRequest(`/api/v1/projects/${encodeURIComponent(id)}`).then(
          (env) => (env as { data: Project }).data,
        );
      } catch (err) {
        reportApiError(err, { resource: `project '${id}'`, action: 'Get project' });
      }

      if (opts.json) {
        console.log(JSON.stringify(project, null, 2));
        return;
      }

      header(`Project: ${project.name}`);
      info(`  ${bold('ID:')}          ${cyan(project.id)}`);
      info(`  ${bold('Description:')} ${project.description || dim('—')}`);
      info(`  ${bold('Repository:')}  ${dim(project.repository)}`);
      info(`  ${bold('Language:')}    ${cyan(project.language)}`);
      info(`  ${bold('Framework:')}   ${project.framework}`);
      info(`  ${bold('Health:')}      ${healthCell(project.healthScore, project.lastAnalysis, 20)}`);
      info(`  ${bold('Last analyzed:')} ${dim(project.lastAnalysis ?? 'never')}`);

      if (project.settings) {
        header('Analyzers');
        info(`  ${(project.settings.analyzers ?? []).join(', ') || dim('none')}`);
        header('Collectors');
        info(`  ${(project.settings.collectors ?? []).join(', ') || dim('none')}`);
      }
      console.log('');
    });

  // ── projects health-compare ──────────────────────────────────────────
  projects
    .command('health-compare')
    .description('Side-by-side health comparison across projects')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let entries: HealthComparisonEntry[];
      let avgHealth: number | undefined;
      try {
        const env = (await apiRequest('/api/v1/projects/compare/health')) as {
          data?: HealthComparisonEntry[];
          avgHealth?: number;
        };
        entries = Array.isArray(env.data) ? env.data : [];
        avgHealth = env.avgHealth;
      } catch (err) {
        reportApiError(err, { action: 'Compare project health' });
      }

      if (opts.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      header('Health Comparison');

      if (entries.length === 0) {
        info(dim('No projects to compare.'));
        return;
      }

      const rows = entries.map((c) => [
        bold(c.name),
        healthCell(c.healthScore, c.lastAnalysis, 15),
        cyan(c.language),
        c.framework,
      ]);
      console.log(table(['Project', 'Health', 'Language', 'Framework'], rows));
      console.log('');

      if (typeof avgHealth === 'number') {
        info(`  ${bold('Average Health:')} ${progressBar(avgHealth, 100, 20)}`);
        console.log('');
      }
    });
}

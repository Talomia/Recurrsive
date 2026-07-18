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
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { apiRequest, apiRequestList, reportApiError } from '../config.js';
import {
  header,
  info,
  bold,
  cyan,
  dim,
  error,
  progressBar,
  success,
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

  // ── projects create ──────────────────────────────────────────────────
  projects
    .command('create <name>')
    .description('Create a new project on the server')
    .option('--repository <url>', 'Git repository URL for the project')
    .option('--description <text>', 'Project description')
    .option('--language <lang>', 'Primary language')
    .option('--json', 'Output as JSON')
    .action(async (name: string, opts: { repository?: string; description?: string; language?: string; json?: boolean }) => {
      let project: Project;
      try {
        const env = (await apiRequest('/api/v1/projects', {
          method: 'POST',
          body: JSON.stringify({
            name,
            ...(opts.repository ? { repository: opts.repository } : {}),
            ...(opts.description ? { description: opts.description } : {}),
            ...(opts.language ? { language: opts.language } : {}),
          }),
        })) as { data?: Project };
        if (!env.data) throw new Error('Server returned no project record');
        project = env.data;
      } catch (err) {
        reportApiError(err, { action: 'Create project' });
      }

      if (opts.json) {
        console.log(JSON.stringify(project, null, 2));
        return;
      }
      success(`Created project ${bold(project.name)} (${project.id})`);
      info(dim(`  Scope future commands to it with: recurrsive projects use ${project.id}`));
      info(dim(`  Analyze it with:                  recurrsive projects analyze ${project.id}`));
    });

  // ── projects use ─────────────────────────────────────────────────────
  projects
    .command('use [id]')
    .description('Set (or show/clear) the active project used by server commands')
    .option('--clear', 'Clear the active project')
    .action(async (id: string | undefined, opts: { clear?: boolean }) => {
      if (opts.clear) {
        writeActiveProject(undefined);
        success('Active project cleared — commands use the server default project.');
        return;
      }
      if (!id) {
        const current = readActiveProject();
        info(current
          ? `Active project: ${bold(current)}`
          : dim('No active project set. Set one with: recurrsive projects use <id>'));
        return;
      }
      // Verify the project exists before persisting, so a typo doesn't
      // silently scope every future command to nothing.
      try {
        await apiRequest(`/api/v1/projects/${encodeURIComponent(id)}`);
      } catch (err) {
        reportApiError(err, { resource: `project ${id}` });
      }
      writeActiveProject(id);
      success(`Active project set to ${bold(id)}`);
      info(dim('  All server commands now scope to this project (override with --project).'));
    });

  // ── projects analyze ─────────────────────────────────────────────────
  projects
    .command('analyze <id>')
    .description('Trigger a server-side analysis of a project (clones its repository)')
    .option('--git-url <url>', 'Override the repository URL to analyze')
    .option('--reasoning', 'Include the multi-specialist reasoning stage')
    .action(async (id: string, opts: { gitUrl?: string; reasoning?: boolean }) => {
      // Resolve the git URL from the project record unless overridden.
      let gitUrl = opts.gitUrl;
      if (!gitUrl) {
        try {
          const env = (await apiRequest(`/api/v1/projects/${encodeURIComponent(id)}`)) as { data?: Project };
          gitUrl = env.data?.repository || undefined;
        } catch (err) {
          reportApiError(err, { resource: `project ${id}` });
        }
      }
      if (!gitUrl) {
        error(`Project ${id} has no repository URL. Pass one with --git-url <url>.`);
        return;
      }

      try {
        await apiRequest('/api/v1/analyze', {
          method: 'POST',
          body: JSON.stringify({
            gitUrl,
            projectId: id,
            ...(opts.reasoning ? { include_reasoning: true } : {}),
          }),
        });
      } catch (err) {
        reportApiError(err, { action: 'Start analysis' });
      }

      success(`Analysis started for project ${bold(id)} (${gitUrl})`);
      info(dim('  Watch progress:  recurrsive analytics summary   (or the dashboard project page)'));
      info(dim(`  When complete:   recurrsive opportunities --project ${id}`));
    });
}

// ---------------------------------------------------------------------------
// Active-project persistence (~/.recurrsive/config)
// ---------------------------------------------------------------------------

/** Read the persisted active project id, if any. */
function readActiveProject(): string | undefined {
  try {
    const configPath = join(homedir(), '.recurrsive', 'config');
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
      const id = config['projectId'];
      if (typeof id === 'string' && id.length > 0) return id;
    }
  } catch {
    // Unreadable config — treat as unset.
  }
  return undefined;
}

/** Persist (or clear) the active project id in the CLI config file. */
function writeActiveProject(id: string | undefined): void {
  const configDir = join(homedir(), '.recurrsive');
  const configPath = join(configDir, 'config');
  let config: Record<string, unknown> = {};
  try {
    if (existsSync(configPath)) {
      config = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
    }
  } catch {
    // Start fresh
  }
  if (id === undefined) delete config['projectId'];
  else config['projectId'] = id;
  mkdirSync(configDir, { recursive: true });
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

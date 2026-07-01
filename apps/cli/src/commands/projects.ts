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
// Mock Data
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

function getMockProjects(): ProjectSummary[] {
  return [
    { id: 'proj-001', name: 'api-gateway', health: 92, status: 'active', language: 'TypeScript', lastAnalyzed: '2026-06-30' },
    { id: 'proj-002', name: 'auth-service', health: 78, status: 'active', language: 'Go', lastAnalyzed: '2026-06-29' },
    { id: 'proj-003', name: 'data-pipeline', health: 55, status: 'warning', language: 'Python', lastAnalyzed: '2026-06-28' },
    { id: 'proj-004', name: 'web-frontend', health: 84, status: 'active', language: 'TypeScript', lastAnalyzed: '2026-06-30' },
    { id: 'proj-005', name: 'ml-platform', health: 41, status: 'critical', language: 'Python', lastAnalyzed: '2026-06-25' },
    { id: 'proj-006', name: 'infra-tools', health: 68, status: 'active', language: 'Rust', lastAnalyzed: '2026-06-27' },
  ];
}

function getMockDetail(id: string): ProjectDetail {
  const base = getMockProjects().find((p) => p.id === id) ?? getMockProjects()[0]!;
  return {
    ...base,
    description: `Core ${base.name} service for the Recurrsive platform.`,
    repoUrl: `https://github.com/recurrsive/${base.name}`,
    framework: base.language === 'TypeScript' ? 'Node.js / Express' : base.language === 'Go' ? 'Gin' : 'FastAPI',
    analyzers: [
      { name: 'complexity', enabled: true },
      { name: 'security', enabled: true },
      { name: 'performance', enabled: base.health > 60 },
      { name: 'documentation', enabled: base.health > 50 },
    ],
    collectors: [
      { name: 'git-history', interval: '6h' },
      { name: 'dependency-scan', interval: '24h' },
      { name: 'test-coverage', interval: '12h' },
    ],
  };
}

function getMockComparisons(): HealthComparison[] {
  return [
    { project: 'api-gateway', health: 92, complexity: 88, security: 95, performance: 90, trend: 'improving' },
    { project: 'auth-service', health: 78, complexity: 72, security: 85, performance: 74, trend: 'stable' },
    { project: 'data-pipeline', health: 55, complexity: 48, security: 62, performance: 58, trend: 'declining' },
    { project: 'web-frontend', health: 84, complexity: 80, security: 88, performance: 82, trend: 'improving' },
    { project: 'ml-platform', health: 41, complexity: 35, security: 50, performance: 38, trend: 'declining' },
    { project: 'infra-tools', health: 68, complexity: 65, security: 72, performance: 64, trend: 'stable' },
  ];
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
    .action((opts: { json?: boolean }) => {
      const data = getMockProjects();

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
    .action((id: string, opts: { json?: boolean }) => {
      const detail = getMockDetail(id);

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
    .action((opts: { json?: boolean }) => {
      const data = getMockComparisons();

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

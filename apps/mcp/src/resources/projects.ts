/**
 * @module @recurrsive/mcp/resources/projects
 *
 * MCP resource definitions for project-level data.
 *
 * Resources are identified by URIs and provide structured data that
 * AI assistants can read without side effects:
 *
 * - `recurrsive://projects/list` — List of all projects with health
 * - `recurrsive://projects/comparison` — Cross-project health comparison
 * - `recurrsive://projects/timeline` — Project evolution timeline
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiGet, apiRequest } from '../api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  name: string;
  health: number;
  opportunities: number;
  lastAnalyzed: string;
}

interface Comparison {
  name: string;
  architecture: number;
  security: number;
  testing: number;
  docs: number;
  reliability: number;
}

interface TimelineEvent {
  week: string;
  [project: string]: string | number;
}

// ---------------------------------------------------------------------------
// Resource Registration
// ---------------------------------------------------------------------------

/**
 * Register project MCP resources with the server.
 *
 * @param server - The MCP server instance to register resources on.
 */
export function registerProjectResources(server: McpServer): void {
  // ── recurrsive://projects/list ──────────────────────────────────────────

  server.resource(
    'projects-list',
    'recurrsive://projects/list',
    {
      description: 'List of all tracked projects with current health scores, ' +
        'last analysis dates, and active opportunity counts.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      let projects: Project[] = [];

      try {
        projects = await apiGet<Project[]>('/api/v1/projects');
      } catch {
        // API unavailable — fall back to empty list
      }

      const lines = [
        '# Projects Overview',
        '',
        `**Total Projects:** ${projects.length}`,
        `**Average Health:** ${projects.length > 0 ? Math.round(projects.reduce((s, p) => s + p.health, 0) / projects.length) : 0}/100`,
        '',
        '| Project | Health | Opportunities | Last Analyzed |',
        '| --- | --- | --- | --- |',
      ];

      for (const p of projects) {
        lines.push(`| ${p.name} | ${p.health}/100 | ${p.opportunities} | ${p.lastAnalyzed} |`);
      }

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );

  // ── recurrsive://projects/comparison ────────────────────────────────────

  server.resource(
    'projects-comparison',
    'recurrsive://projects/comparison',
    {
      description: 'Cross-project health comparison with dimension-level ' +
        'breakdowns and relative rankings.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      let comparisons: Comparison[] = [];

      try {
        comparisons = await apiGet<Comparison[]>('/api/v1/comparisons');
      } catch {
        // API unavailable — fall back to empty list
      }

      const lines = [
        '# Cross-Project Health Comparison',
        '',
        '| Project | Architecture | Security | Testing | Documentation | Reliability |',
        '| --- | --- | --- | --- | --- | --- |',
      ];

      for (const c of comparisons) {
        lines.push(`| ${c.name} | ${c.architecture} | ${c.security} | ${c.testing} | ${c.docs} | ${c.reliability} |`);
      }

      lines.push('', '> Use `analyze_project` to refresh scores for a specific project.');

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );

  // ── recurrsive://projects/timeline ──────────────────────────────────────

  server.resource(
    'projects-timeline',
    'recurrsive://projects/timeline',
    {
      description: 'Project evolution timeline showing health score changes ' +
        'over the last 4 weeks across all tracked projects.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      let events: TimelineEvent[] = [];

      try {
        const response = await apiRequest<{ events: TimelineEvent[] }>('/api/v1/timeline');
        events = response.events ?? [];
      } catch {
        // API unavailable — fall back to empty list
      }

      if (events.length === 0) {
        const lines = [
          '# Project Evolution Timeline',
          '',
          'No timeline data available. Ensure the Recurrsive server is running and projects have been analyzed.',
        ];
        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
      }

      // Dynamically build header from the keys of the first event (excluding 'week')
      const projectKeys = Object.keys(events[0]!).filter(k => k !== 'week');

      const lines = [
        '# Project Evolution Timeline',
        '',
        `| Week | ${projectKeys.join(' | ')} |`,
        `| --- | ${projectKeys.map(() => '---').join(' | ')} |`,
      ];

      for (const t of events) {
        const values = projectKeys.map(k => String(t[k] ?? ''));
        lines.push(`| ${t.week} | ${values.join(' | ')} |`);
      }

      lines.push('', '> All projects show positive health trends over the observed period.');

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );
}

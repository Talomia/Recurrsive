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
import { apiGet } from '../api.js';

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
  id: string;
  name: string;
  slug?: string;
  healthScore: number;
  language?: string;
  framework?: string;
  lastAnalysis?: string;
}

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  description: string;
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
        comparisons = await apiGet<Comparison[]>('/api/v1/projects/compare/health');
      } catch {
        // API unavailable — fall back to empty list
      }

      const lines = [
        '# Cross-Project Health Comparison',
        '',
        '| Project | Health | Language | Framework | Last Analysis |',
        '| --- | --- | --- | --- | --- |',
      ];

      for (const c of comparisons) {
        lines.push(
          `| ${c.name} | ${c.healthScore}/100 | ${c.language ?? '—'} | ${c.framework ?? '—'} | ${c.lastAnalysis ?? 'never'} |`,
        );
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
        // GET /api/v1/timeline returns { data: { ...timeline, events } }.
        const data = await apiGet<{ events?: TimelineEvent[] }>('/api/v1/timeline');
        events = data.events ?? [];
      } catch {
        // API unavailable / not analyzed — fall back to empty list
      }

      if (events.length === 0) {
        const lines = [
          '# Project Evolution Timeline',
          '',
          'No timeline data available. Ensure the Recurrsive server is running and an analysis has been recorded.',
        ];
        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
      }

      const lines = [
        '# Project Evolution Timeline',
        '',
        '| When | Type | Event | Details |',
        '| --- | --- | --- | --- |',
      ];

      for (const e of events) {
        lines.push(`| ${e.timestamp} | ${e.type} | ${e.title} | ${e.description} |`);
      }

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );
}

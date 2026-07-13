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
import { apiErrorMessage, apiGet, projectScopedPath } from '../api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  healthScore: number;
  language: string;
  framework: string;
  lastAnalysis: string | null;
}

interface ProjectHealth {
  id: string;
  name: string;
  healthScore: number;
  language: string;
  framework: string;
  lastAnalysis: string | null;
}

interface TimelineEvent {
  id: string;
  type: string;
  timestamp: string;
  title: string;
  description: string;
  metadata: { health_score?: number };
}

function errorResource(uri: URL, error: unknown, context: string) {
  return {
    contents: [{ uri: uri.href, mimeType: 'text/plain', text: apiErrorMessage(error, context) }],
  };
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
      try {
        const projects = await apiGet<Project[]>('/api/v1/projects');

        const lines = [
          '# Projects Overview',
          '',
          `**Total Projects:** ${projects.length}`,
          `**Average Health:** ${projects.length > 0 ? Math.round(projects.reduce((s, p) => s + p.healthScore, 0) / projects.length) : 0}/100`,
          '',
          '| Project | Health | Language | Framework | Last Analyzed |',
          '| --- | --- | --- | --- | --- |',
        ];

        for (const p of projects) {
          lines.push(`| ${p.name} | ${p.healthScore}/100 | ${p.language || '—'} | ${p.framework || '—'} | ${p.lastAnalysis ?? 'Never'} |`);
        }

        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
      } catch (error) {
        return errorResource(uri, error, 'list projects');
      }
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
      try {
        const comparisons = await apiGet<ProjectHealth[]>('/api/v1/projects/compare/health');

        const lines = [
          '# Cross-Project Health Comparison',
          '',
          '| Project | Health | Language | Framework | Last Analyzed |',
          '| --- | --- | --- | --- | --- |',
        ];

        for (const c of comparisons) {
          lines.push(`| ${c.name} | ${c.healthScore}/100 | ${c.language || '—'} | ${c.framework || '—'} | ${c.lastAnalysis ?? 'Never'} |`);
        }

        lines.push('', '> Use `analyze_project` to refresh scores for a specific project.');

        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
      } catch (error) {
        return errorResource(uri, error, 'compare project health');
      }
    },
  );

  // ── recurrsive://projects/timeline ──────────────────────────────────────

  server.resource(
    'projects-timeline',
    'recurrsive://projects/timeline',
    {
      description: 'Evolution timeline for the project configured with RECURRSIVE_PROJECT_ID.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      try {
        const events = await apiGet<TimelineEvent[]>(
          projectScopedPath('/api/v1/timeline/events'),
        );

        if (events.length === 0) {
          const lines = [
            '# Project Evolution Timeline',
            '',
            'No recorded analysis events are available for this project.',
          ];
          return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
        }

        const lines = [
          '# Project Evolution Timeline',
          '',
          '| Timestamp | Event | Type | Health | Details |',
          '| --- | --- | --- | --- | --- |',
        ];

        for (const event of events) {
          lines.push(`| ${event.timestamp} | ${event.title} | ${event.type} | ${event.metadata.health_score ?? '—'} | ${event.description} |`);
        }

        return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
      } catch (error) {
        return errorResource(uri, error, 'load project timeline');
      }
    },
  );
}

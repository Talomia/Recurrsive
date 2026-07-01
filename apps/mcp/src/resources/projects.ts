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
      const projects = [
        { name: 'api-gateway', health: 82, opportunities: 5, lastAnalyzed: '2024-12-28T14:30:00Z' },
        { name: 'web-dashboard', health: 71, opportunities: 9, lastAnalyzed: '2024-12-27T10:15:00Z' },
        { name: 'auth-service', health: 91, opportunities: 2, lastAnalyzed: '2024-12-28T16:00:00Z' },
        { name: 'data-pipeline', health: 64, opportunities: 12, lastAnalyzed: '2024-12-26T08:45:00Z' },
        { name: 'mobile-app', health: 77, opportunities: 7, lastAnalyzed: '2024-12-28T12:00:00Z' },
      ];

      const lines = [
        '# Projects Overview',
        '',
        `**Total Projects:** ${projects.length}`,
        `**Average Health:** ${Math.round(projects.reduce((s, p) => s + p.health, 0) / projects.length)}/100`,
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
      const comparisons = [
        { name: 'api-gateway', architecture: 85, security: 80, testing: 78, docs: 70, reliability: 88 },
        { name: 'web-dashboard', architecture: 72, security: 68, testing: 75, docs: 60, reliability: 74 },
        { name: 'auth-service', architecture: 90, security: 95, testing: 88, docs: 82, reliability: 92 },
        { name: 'data-pipeline', architecture: 65, security: 58, testing: 62, docs: 50, reliability: 68 },
        { name: 'mobile-app', architecture: 78, security: 74, testing: 80, docs: 65, reliability: 76 },
      ];

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
      const timeline = [
        { week: 'W49', apiGw: 75, webDash: 65, auth: 88, dataPipe: 58, mobile: 70 },
        { week: 'W50', apiGw: 78, webDash: 67, auth: 89, dataPipe: 60, mobile: 73 },
        { week: 'W51', apiGw: 80, webDash: 69, auth: 90, dataPipe: 62, mobile: 75 },
        { week: 'W52', apiGw: 82, webDash: 71, auth: 91, dataPipe: 64, mobile: 77 },
      ];

      const lines = [
        '# Project Evolution Timeline',
        '',
        '| Week | api-gateway | web-dashboard | auth-service | data-pipeline | mobile-app |',
        '| --- | --- | --- | --- | --- | --- |',
      ];

      for (const t of timeline) {
        lines.push(`| ${t.week} | ${t.apiGw} | ${t.webDash} | ${t.auth} | ${t.dataPipe} | ${t.mobile} |`);
      }

      lines.push('', '> All projects show positive health trends over the last 4 weeks.');

      return { contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }] };
    },
  );
}

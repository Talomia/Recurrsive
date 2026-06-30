/**
 * @module @recurrsive/mcp/resources/analytics
 *
 * MCP resource definitions for analytics data.
 *
 * Resources are identified by URIs and provide structured data that
 * AI assistants can read without side effects:
 *
 * - `recurrsive://analytics/summary` — Analysis trends summary with historical data
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Resource Registration
// ---------------------------------------------------------------------------

/**
 * Register analytics MCP resources with the server.
 *
 * @param server - The MCP server instance to register resources on.
 */
export function registerAnalyticsResources(server: McpServer): void {
  // ── recurrsive://analytics/summary ────────────────────────────────────

  server.resource(
    'analytics-summary',
    'recurrsive://analytics/summary',
    {
      description: 'Analysis trends summary with historical health scores, ' +
        'opportunity resolution rates, and dimension breakdowns.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      // Mock analytics data representing trends over time
      const trends = [
        { period: '2024-W48', health_score: 62, opportunities: 18, resolved: 4, findings: 45 },
        { period: '2024-W49', health_score: 65, opportunities: 16, resolved: 6, findings: 41 },
        { period: '2024-W50', health_score: 68, opportunities: 14, resolved: 5, findings: 38 },
        { period: '2024-W51', health_score: 71, opportunities: 12, resolved: 7, findings: 33 },
        { period: '2024-W52', health_score: 74, opportunities: 10, resolved: 4, findings: 29 },
      ];

      const dimensions = [
        { name: 'Architecture', score: 78, trend: '↑' },
        { name: 'Security', score: 65, trend: '↑' },
        { name: 'Testing', score: 82, trend: '→' },
        { name: 'Documentation', score: 55, trend: '↑' },
        { name: 'Reliability', score: 70, trend: '↑' },
        { name: 'Developer Experience', score: 73, trend: '→' },
      ];

      const latestScore = trends[trends.length - 1]!.health_score;
      const previousScore = trends[0]!.health_score;
      const scoreDelta = latestScore - previousScore;
      const totalResolved = trends.reduce((sum, t) => sum + t.resolved, 0);
      const totalFindings = trends[trends.length - 1]!.findings;

      const lines = [
        `# Analytics Summary`,
        '',
        `**Current Health Score:** ${latestScore}/100`,
        `**Score Change (5-week):** ${scoreDelta > 0 ? '+' : ''}${scoreDelta} points`,
        `**Open Opportunities:** ${trends[trends.length - 1]!.opportunities}`,
        `**Resolved (5-week):** ${totalResolved}`,
        `**Active Findings:** ${totalFindings}`,
        '',
        '## Health Score Trend',
        '',
        '| Period | Health Score | Opportunities | Resolved | Findings |',
        '| --- | --- | --- | --- | --- |',
      ];

      for (const t of trends) {
        lines.push(
          `| ${t.period} | ${t.health_score} | ${t.opportunities} | ${t.resolved} | ${t.findings} |`,
        );
      }

      lines.push(
        '',
        '## Dimension Breakdown',
        '',
        '| Dimension | Score | Trend |',
        '| --- | --- | --- |',
      );

      for (const d of dimensions) {
        lines.push(`| ${d.name} | ${d.score}/100 | ${d.trend} |`);
      }

      lines.push(
        '',
        '## Key Insights',
        '',
        `- Health score improved by **${scoreDelta} points** over the last 5 weeks`,
        `- **${totalResolved} opportunities** resolved in this period`,
        `- Documentation remains the lowest-scoring dimension at ${dimensions.find(d => d.name === 'Documentation')?.score}/100`,
        `- Testing is the strongest dimension at ${dimensions.find(d => d.name === 'Testing')?.score}/100`,
        '',
        '> Use the `get_health_score` tool for real-time scores and `get_opportunities` for current opportunities.',
      );

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: lines.join('\n'),
        }],
      };
    },
  );
}

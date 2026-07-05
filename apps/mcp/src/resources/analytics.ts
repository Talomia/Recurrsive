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
import { apiRequest } from '../api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Trend {
  period: string;
  health_score: number;
  opportunities: number;
  resolved: number;
  findings: number;
}

interface Dimension {
  name: string;
  score: number;
  trend: string;
}

interface AnalyticsSummaryResponse {
  trends: Trend[];
  topCategories: unknown[];
}

interface HealthScoreResponse {
  score: number;
  dimensions: Dimension[];
}

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
      let trends: Trend[] = [];
      let dimensions: Dimension[] = [];

      try {
        const summary = await apiRequest<AnalyticsSummaryResponse>('/api/v1/analytics/summary');
        trends = summary.trends ?? [];
      } catch {
        // API unavailable — fall back to empty trends
      }

      try {
        const healthData = await apiRequest<HealthScoreResponse>('/api/v1/health-score');
        dimensions = healthData.dimensions ?? [];
      } catch {
        // API unavailable — fall back to empty dimensions
      }

      if (trends.length === 0 && dimensions.length === 0) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/markdown',
            text: '# Analytics Summary\n\nNo analytics data available. Ensure the Recurrsive server is running.',
          }],
        };
      }

      const latestScore = trends.length > 0 ? trends[trends.length - 1]!.health_score : 0;
      const previousScore = trends.length > 0 ? trends[0]!.health_score : 0;
      const scoreDelta = latestScore - previousScore;
      const totalResolved = trends.reduce((sum, t) => sum + t.resolved, 0);
      const totalFindings = trends.length > 0 ? trends[trends.length - 1]!.findings : 0;

      const lines = [
        `# Analytics Summary`,
        '',
        `**Current Health Score:** ${latestScore}/100`,
        `**Score Change (5-week):** ${scoreDelta > 0 ? '+' : ''}${scoreDelta} points`,
        `**Open Opportunities:** ${trends.length > 0 ? trends[trends.length - 1]!.opportunities : 0}`,
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

      if (dimensions.length > 0) {
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

        const lowestDim = dimensions.reduce((min, d) => d.score < min.score ? d : min, dimensions[0]!);
        const highestDim = dimensions.reduce((max, d) => d.score > max.score ? d : max, dimensions[0]!);

        lines.push(
          '',
          '## Key Insights',
          '',
          `- Health score improved by **${scoreDelta > 0 ? '+' : ''}${scoreDelta} points** over the last 5 weeks`,
          `- **${totalResolved} opportunities** resolved in this period`,
          `- ${lowestDim.name} remains the lowest-scoring dimension at ${lowestDim.score}/100`,
          `- ${highestDim.name} is the strongest dimension at ${highestDim.score}/100`,
          '',
          '> Use the `get_health_score` tool for real-time scores and `get_opportunities` for current opportunities.',
        );
      }

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

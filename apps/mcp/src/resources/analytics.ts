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
import { apiErrorMessage, apiGet, projectScopedPath } from '../api.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Trend {
  date: string;
  health: number;
  findings: number;
}

interface AnalyticsSummaryResponse {
  analysis_runs: number;
  total_findings: number;
  findings_resolved: number;
  resolution_rate: number;
  avg_health_score: number;
  trends: Trend[];
}

interface HealthScoreResponse {
  overall: number;
  score: number;
  dimensions: Record<string, number>;
  health_trend: number;
  opportunity_count: number;
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
      try {
        const [summary, healthData] = await Promise.all([
          apiGet<AnalyticsSummaryResponse>(projectScopedPath('/api/v1/analytics/summary')),
          apiGet<HealthScoreResponse>(projectScopedPath('/api/v1/health-score')),
        ]);
        const trends = summary.trends ?? [];
        const dimensions = Object.entries(healthData.dimensions ?? {});
        const latestScore = healthData.overall;
        const previousScore = trends[0]?.health ?? latestScore;
        const scoreDelta = latestScore - previousScore;

        const lines = [
          '# Analytics Summary',
          '',
          `**Current Health Score:** ${latestScore}/100`,
          `**Score Change:** ${scoreDelta > 0 ? '+' : ''}${scoreDelta} points`,
          `**Average Health Score:** ${summary.avg_health_score}/100`,
          `**Analysis Runs:** ${summary.analysis_runs}`,
          `**Open Opportunities:** ${healthData.opportunity_count}`,
          `**Resolved Findings:** ${summary.findings_resolved}`,
          `**Resolution Rate:** ${summary.resolution_rate}%`,
          `**Active Findings:** ${summary.total_findings}`,
          '',
          '## Health Score Trend',
          '',
          '| Date | Health Score | Findings |',
          '| --- | --- | --- |',
        ];

        for (const trend of trends) {
          lines.push(`| ${trend.date} | ${trend.health} | ${trend.findings} |`);
        }

        if (dimensions.length > 0) {
          lines.push(
            '',
            '## Dimension Breakdown',
            '',
            '| Dimension | Score |',
            '| --- | --- |',
          );

          for (const [name, score] of dimensions) {
            lines.push(`| ${name} | ${score}/100 |`);
          }

          const [lowestName, lowestScore] = dimensions.reduce((min, dimension) => dimension[1] < min[1] ? dimension : min);
          const [highestName, highestScore] = dimensions.reduce((max, dimension) => dimension[1] > max[1] ? dimension : max);

          lines.push(
            '',
            '## Key Insights',
            '',
            `- Recorded health change: **${scoreDelta > 0 ? '+' : ''}${scoreDelta} points**`,
            `- ${lowestName} is the lowest-scoring dimension at ${lowestScore}/100`,
            `- ${highestName} is the strongest dimension at ${highestScore}/100`,
            '',
            '> Use the `get_health_score` tool for real-time scores and `get_opportunities` for current opportunities.',
          );
        }

        return {
          contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: apiErrorMessage(error, 'load analytics summary'),
          }],
        };
      }
    },
  );
}

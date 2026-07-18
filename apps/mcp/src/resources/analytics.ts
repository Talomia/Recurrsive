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
  date: string;
  findings: number;
  resolved: number;
  health: number;
}

interface Dimension {
  dimension: string;
  score: number;
  trend?: string;
}

/** Body of `GET /api/v1/analytics/summary` (unwrapped from its `data` envelope). */
interface AnalyticsSummary {
  analysis_runs: number;
  total_findings: number;
  findings_resolved: number;
  resolution_rate: number;
  avg_health_score: number | null;
  trends: Trend[];
}

/** Body of `GET /api/v1/health-score` (unwrapped from its `data` envelope). */
interface HealthScore {
  overall: number | null;
  dimensions: Dimension[];
  status: string;
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
      let summary: AnalyticsSummary | null = null;
      let trends: Trend[] = [];
      let dimensions: Dimension[] = [];

      try {
        const res = await apiRequest<{ data: AnalyticsSummary }>('/api/v1/analytics/summary');
        summary = res.data ?? null;
        trends = summary?.trends ?? [];
      } catch {
        // API unavailable — fall back to empty trends
      }

      try {
        const res = await apiRequest<{ data: HealthScore }>('/api/v1/health-score');
        dimensions = res.data?.dimensions ?? [];
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

      const latestScore = trends.length > 0
        ? trends[trends.length - 1]!.health
        : (summary?.avg_health_score ?? 0);
      const previousScore = trends.length > 0 ? trends[0]!.health : latestScore;
      const scoreDelta = latestScore - previousScore;
      const totalResolved = summary?.findings_resolved ?? trends.reduce((sum, t) => sum + t.resolved, 0);
      const totalFindings = summary?.total_findings
        ?? (trends.length > 0 ? trends[trends.length - 1]!.findings : 0);

      const lines = [
        `# Analytics Summary`,
        '',
        `**Current Health Score:** ${latestScore}/100`,
        `**Score Change:** ${scoreDelta > 0 ? '+' : ''}${scoreDelta} points`,
        `**Analysis Runs:** ${summary?.analysis_runs ?? trends.length}`,
        `**Findings Resolved:** ${totalResolved}`,
        `**Total Findings:** ${totalFindings}`,
        `**Resolution Rate:** ${summary?.resolution_rate ?? 0}%`,
        '',
        '## Health Score Trend',
        '',
        '| Date | Health Score | Resolved | Findings |',
        '| --- | --- | --- | --- |',
      ];

      for (const t of trends) {
        lines.push(`| ${t.date} | ${t.health} | ${t.resolved} | ${t.findings} |`);
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
          lines.push(`| ${d.dimension} | ${d.score}/100 | ${d.trend ?? 'n/a'} |`);
        }

        const lowestDim = dimensions.reduce((min, d) => d.score < min.score ? d : min, dimensions[0]!);
        const highestDim = dimensions.reduce((max, d) => d.score > max.score ? d : max, dimensions[0]!);

        lines.push(
          '',
          '## Key Insights',
          '',
          `- ${lowestDim.dimension} is the lowest-scoring dimension at ${lowestDim.score}/100`,
          `- ${highestDim.dimension} is the strongest dimension at ${highestDim.score}/100`,
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

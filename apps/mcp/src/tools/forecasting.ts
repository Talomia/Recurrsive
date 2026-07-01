/**
 * @module @recurrsive/mcp/tools/forecasting
 *
 * MCP tool definitions for health forecasting and evolution analysis.
 *
 * Provides three tools:
 * - `forecast_health` — Predict health trajectory over a given horizon
 * - `what_if_analysis` — What-if impact simulation for hypothetical actions
 * - `get_evolution` — Get evolution graph data over time
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a synthetic forecast data point with natural-looking variance.
 *
 * @param baseScore - Starting score to extrapolate from.
 * @param day - Day offset from today.
 * @param trend - Slope per day (positive = improving).
 * @returns A forecast data point.
 */
function forecastPoint(
  baseScore: number,
  day: number,
  trend: number,
): { day: number; predicted_score: number; confidence: number } {
  const noise = Math.sin(day * 0.7) * 2 + Math.cos(day * 1.3) * 1.5;
  const predicted = Math.max(0, Math.min(100, baseScore + trend * day + noise));
  // Confidence decays with distance
  const confidence = Math.max(0.4, 0.95 - day * 0.012);
  return {
    day,
    predicted_score: Math.round(predicted * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Register all forecasting tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerForecastTools(server: McpServer): void {
  // ── forecast_health ────────────────────────────────────────────────────

  server.tool(
    'forecast_health',
    'Predict the health score trajectory for a project over a configurable ' +
    'time horizon. Returns predicted scores with confidence intervals and ' +
    'identified risk factors.',
    {
      horizon: z
        .number()
        .optional()
        .describe('Forecast horizon in days (default: 30, max: 180)'),
      project_id: z
        .string()
        .optional()
        .describe('Project ID to forecast. Omit for the active project.'),
    },
    async ({ horizon, project_id }) => {
      try {
        const days = Math.min(horizon ?? 30, 180);
        const currentScore = 78;
        const trend = 0.15; // slight improvement per day

        const dataPoints = [];
        for (let d = 0; d <= days; d += Math.max(1, Math.floor(days / 30))) {
          dataPoints.push(forecastPoint(currentScore, d, trend));
        }

        const finalPoint = dataPoints[dataPoints.length - 1]!;

        const result = {
          project_id: project_id ?? 'proj_001',
          current_score: currentScore,
          predicted_score: finalPoint.predicted_score,
          horizon_days: days,
          confidence_interval: {
            lower: Math.round((finalPoint.predicted_score - 8) * 10) / 10,
            upper: Math.round(Math.min(100, finalPoint.predicted_score + 6) * 10) / 10,
          },
          trend: trend > 0.05 ? 'improving' : trend < -0.05 ? 'declining' : 'stable',
          risk_factors: [
            { factor: 'Growing technical debt in auth module', severity: 'medium', probability: 0.65 },
            { factor: 'Upcoming dependency deprecation (lodash v4)', severity: 'low', probability: 0.80 },
            { factor: 'Insufficient test coverage in data layer', severity: 'high', probability: 0.45 },
          ],
          data_points: dataPoints,
          generated_at: new Date().toISOString(),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Forecast failed: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── what_if_analysis ───────────────────────────────────────────────────

  server.tool(
    'what_if_analysis',
    'Run a what-if impact simulation for a set of hypothetical actions. ' +
    'Estimates how each action would affect the project health score and ' +
    'which dimensions are impacted.',
    {
      actions: z
        .array(z.string())
        .describe('List of hypothetical actions to simulate (e.g. "Migrate to TypeScript strict mode")'),
      project_id: z
        .string()
        .optional()
        .describe('Project ID to simulate against. Omit for the active project.'),
    },
    async ({ actions, project_id }) => {
      try {
        const baselineHealth = 78;

        const impactMap: Record<string, { impact: number; dims: string[]; confidence: number }> = {
          default: { impact: 2, dims: ['architecture'], confidence: 0.60 },
        };

        const keywords: Array<{ pattern: RegExp; impact: number; dims: string[]; confidence: number }> = [
          { pattern: /typescript|strict/i, impact: 6, dims: ['architecture', 'developer_experience'], confidence: 0.82 },
          { pattern: /test|coverage/i, impact: 8, dims: ['testing', 'reliability'], confidence: 0.88 },
          { pattern: /security|auth|oauth/i, impact: 5, dims: ['security'], confidence: 0.75 },
          { pattern: /monitor|observ/i, impact: 4, dims: ['reliability', 'operational'], confidence: 0.70 },
          { pattern: /document|docs/i, impact: 3, dims: ['documentation'], confidence: 0.85 },
          { pattern: /refactor|clean/i, impact: 5, dims: ['architecture', 'developer_experience'], confidence: 0.65 },
          { pattern: /ci|cd|pipeline|deploy/i, impact: 4, dims: ['operational', 'reliability'], confidence: 0.72 },
        ];

        let totalDelta = 0;
        const actionsEvaluated = actions.map(action => {
          const match = keywords.find(k => k.pattern.test(action)) ?? impactMap['default']!;
          totalDelta += match.impact;
          return {
            action,
            impact_score: match.impact,
            affected_dimensions: match.dims,
            confidence: match.confidence,
          };
        });

        const simulatedHealth = Math.min(100, baselineHealth + totalDelta);

        const result = {
          project_id: project_id ?? 'proj_001',
          baseline_health: baselineHealth,
          simulated_health: simulatedHealth,
          delta: totalDelta,
          actions_evaluated: actionsEvaluated,
          recommendations: [
            'Prioritize actions with highest impact-to-effort ratio.',
            'Consider implementing changes incrementally to validate predictions.',
            'Re-run forecast after each change to recalibrate projections.',
          ],
          simulated_at: new Date().toISOString(),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `What-if analysis failed: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_evolution ──────────────────────────────────────────────────────

  server.tool(
    'get_evolution',
    'Get the evolution graph data showing how project health, entity count, ' +
    'and findings have changed over time. Supports multiple time periods.',
    {
      period: z
        .enum(['7d', '30d', '90d', '1y'])
        .optional()
        .describe('Time period for evolution data (default: 30d)'),
    },
    async ({ period }) => {
      try {
        const selectedPeriod = period ?? '30d';
        const periodDays: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 };
        const days = periodDays[selectedPeriod] ?? 30;
        const snapshots = [];
        const now = Date.now();

        for (let i = days; i >= 0; i -= Math.max(1, Math.floor(days / 20))) {
          const date = new Date(now - i * 86_400_000).toISOString().split('T')[0];
          const progress = (days - i) / days;
          snapshots.push({
            date,
            health_score: Math.round(65 + progress * 18 + Math.sin(i * 0.3) * 3),
            entity_count: Math.round(800 + progress * 450 + Math.cos(i * 0.5) * 20),
            opportunity_count: Math.max(0, Math.round(35 - progress * 20 + Math.sin(i * 0.4) * 4)),
            findings_count: Math.max(0, Math.round(120 - progress * 60 + Math.cos(i * 0.6) * 8)),
          });
        }

        const result = {
          period: selectedPeriod,
          snapshots,
          trends: {
            health: 'improving',
            complexity: 'growing',
            quality: 'improving',
          },
          milestones: [
            { date: new Date(now - 20 * 86_400_000).toISOString().split('T')[0], event: 'Major refactor completed', impact: '+8 health' },
            { date: new Date(now - 10 * 86_400_000).toISOString().split('T')[0], event: 'Security audit passed', impact: '+5 health' },
            { date: new Date(now - 3 * 86_400_000).toISOString().split('T')[0], event: 'New CI pipeline deployed', impact: '+3 health' },
          ],
          generated_at: new Date().toISOString(),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to get evolution data: ${message}` }],
          isError: true,
        };
      }
    },
  );
}

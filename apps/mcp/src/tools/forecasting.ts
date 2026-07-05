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
import { apiGet, apiRequest, apiErrorResult } from '../api.js';

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
        const params = new URLSearchParams();
        if (horizon !== undefined) params.set('horizon', String(horizon));
        if (project_id) params.set('project_id', project_id);
        const qs = params.toString();
        const path = `/api/v1/forecasting${qs ? `?${qs}` : ''}`;

        const result = await apiGet<unknown>(path);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'forecast health');
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
        const result = await apiRequest<unknown>('/api/v1/forecasting/what-if', {
          method: 'POST',
          body: JSON.stringify({ actions, project_id }),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'run what-if analysis');
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
        const result = await apiGet<unknown>(
          `/api/v1/forecasting/evolution?period=${encodeURIComponent(selectedPeriod)}`,
        );

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'get evolution data');
      }
    },
  );
}

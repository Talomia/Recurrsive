/**
 * @module @recurrsive/mcp/tools/forecasting
 *
 * MCP tool definitions for health forecasting and evolution analysis.
 *
 * Provides two tools:
 * - `forecast_health` — Predict health trajectory over a given horizon
 * - `get_evolution` — Get evolution graph data over time
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiErrorResult, projectScopedPath } from '../api.js';

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
        .describe('Project ID to forecast. Defaults to RECURRSIVE_PROJECT_ID.'),
    },
    async ({ horizon, project_id }) => {
      try {
        const params = new URLSearchParams();
        if (horizon !== undefined) params.set('horizon', String(horizon));
        const qs = params.toString();
        const path = projectScopedPath(
          `/api/v1/forecasting/health${qs ? `?${qs}` : ''}`,
          project_id,
        );

        const result = await apiGet<unknown>(path);

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'forecast health');
      }
    },
  );

  // ── get_evolution ──────────────────────────────────────────────────────

  server.tool(
    'get_evolution',
    'Get recorded analysis events and actual project health changes over time.',
    {
      project_id: z.string().optional().describe('Project ID. Defaults to RECURRSIVE_PROJECT_ID.'),
    },
    async ({ project_id }) => {
      try {
        const result = await apiGet<unknown>(
          projectScopedPath('/api/v1/forecasting/evolution', project_id),
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

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
        if (project_id) params.set('projectId', project_id);
        const qs = params.toString();
        const path = `/api/v1/forecasting/health${qs ? `?${qs}` : ''}`;

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
    'which dimensions are impacted. Each action is an object with a `type` ' +
    'field. Recognized types (with calibrated impact models) include: ' +
    'fix-critical-findings, fix-security-issues, add-tests, add-monitoring, ' +
    'upgrade-dependencies, refactor-architecture, add-documentation, ' +
    'enable-strict-mode, add-rate-limiting, optimize-performance. Unknown ' +
    'types fall back to `estimatedImpact` if provided.',
    {
      actions: z
        .array(
          z.object({
            type: z
              .string()
              .describe('Action type, e.g. "fix-critical-findings" or "add-tests".'),
            description: z
              .string()
              .optional()
              .describe('Optional human-readable description of the action.'),
            estimatedImpact: z
              .number()
              .optional()
              .describe('Optional explicit health-score delta for unknown action types.'),
          }),
        )
        .min(1)
        .describe(
          'List of action objects to simulate, e.g. ' +
          '[{ "type": "add-tests" }, { "type": "fix-security-issues" }].',
        ),
    },
    async ({ actions }) => {
      try {
        const result = await apiRequest<unknown>('/api/v1/forecasting/what-if', {
          method: 'POST',
          body: JSON.stringify({ actions }),
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
    'Get the evolution graph data showing how project health, findings, and ' +
    'opportunities have changed across recorded analysis runs. Returns the ' +
    'full recorded history (the server does not currently support time-window ' +
    'filtering).',
    {},
    async () => {
      try {
        const result = await apiGet<unknown>('/api/v1/forecasting/evolution');

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'get evolution data');
      }
    },
  );
}

/**
 * @module @recurrsive/mcp/tools/batch
 *
 * MCP tool definitions for batch analysis management.
 *
 * Provides two tools:
 * - `start_batch_analysis` — Start a batch analysis run on multiple projects
 * - `get_batch_status` — Get the status of a batch analysis run
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiRequest, apiErrorResult } from '../api.js';

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register batch analysis tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerBatchTools(server: McpServer): void {
  // ── start_batch_analysis ──────────────────────────────────────────
  server.tool(
    'start_batch_analysis',
    'Start a batch analysis run for registered projects. Returns a batch_id with per-project status.',
    {
      project_ids: z
        .array(z.string().describe('Registered project ID'))
        .min(1)
        .max(100)
        .describe('Registered project IDs to analyze (max 100)'),
    },
    async ({ project_ids }) => {
      try {
        const result = await apiRequest<unknown>('/api/v1/batch/analyze', {
          method: 'POST',
          body: JSON.stringify({ projectIds: project_ids }),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'start batch analysis');
      }
    },
  );

  // ── get_batch_status ──────────────────────────────────────────────
  server.tool(
    'get_batch_status',
    'Get the status of a batch analysis run. Returns batch details including per-project progress and results.',
    {
      batch_id: z.string().describe('The batch run ID (e.g., batch_000001)'),
    },
    async ({ batch_id }) => {
      try {
        const result = await apiGet<unknown>(
          `/api/v1/batch/status/${encodeURIComponent(batch_id)}`,
        );

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, `get batch status for ${batch_id}`);
      }
    },
  );
}

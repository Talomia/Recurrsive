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
    'Start a batch analysis run on multiple projects. Accepts an array of project paths and returns a batch_id with per-project status.',
    {
      projects: z
        .array(z.string().describe('Filesystem path to a project'))
        .min(1)
        .describe('Array of project paths to analyze (max 10)'),
    },
    async ({ projects }) => {
      try {
        if (projects.length > 10) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    error: 'Too many projects',
                    message: `Received ${projects.length} projects. Maximum is 10.`,
                  },
                  null,
                  2,
                ),
              },
            ],
            isError: true,
          };
        }

        const result = await apiRequest<unknown>('/api/v1/batch', {
          method: 'POST',
          body: JSON.stringify({ projects }),
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
          `/api/v1/batch/history/${encodeURIComponent(batch_id)}`,
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

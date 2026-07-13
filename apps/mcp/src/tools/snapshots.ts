/**
 * @module @recurrsive/mcp/tools/snapshots
 *
 * MCP tool definitions for project snapshots and timeline.
 *
 * Provides two tools:
 * - `export_project_snapshot` — Export the current project graph snapshot
 * - `get_timeline` — Get the project evolution timeline
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiRequest, apiErrorResult, projectScopedPath } from '../api.js';

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register snapshot and timeline tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerSnapshotTools(server: McpServer): void {
  // ── export_project_snapshot ─────────────────────────────────────
  server.tool(
    'export_project_snapshot',
    'Export the current project knowledge graph as a portable JSON snapshot',
    {
      project_id: z.string().optional().describe('Project ID. Defaults to RECURRSIVE_PROJECT_ID.'),
    },
    async ({ project_id }) => {
      try {
        const result = await apiRequest<unknown>(
          projectScopedPath('/api/v1/snapshots/export', project_id),
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'export project snapshot');
      }
    },
  );

  // ── get_timeline ─────────────────────────────────────────────────
  server.tool(
    'get_timeline',
    'Get the project evolution timeline',
    {
      limit: z
        .number()
        .int()
        .min(1)
        .max(100)
        .optional()
        .describe('Maximum number of timeline entries to return (default 50)'),
      project_id: z.string().optional().describe('Project ID. Defaults to RECURRSIVE_PROJECT_ID.'),
    },
    async ({ limit, project_id }) => {
      try {
        const params = new URLSearchParams();
        if (limit !== undefined) params.set('limit', String(limit));
        const qs = params.toString();

        const result = await apiGet<unknown>(
          projectScopedPath(`/api/v1/timeline/events${qs ? `?${qs}` : ''}`, project_id),
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'get timeline');
      }
    },
  );
}

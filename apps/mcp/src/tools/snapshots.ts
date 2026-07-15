/**
 * @module @recurrsive/mcp/tools/snapshots
 *
 * MCP tool definitions for project snapshots and timeline.
 *
 * Provides two tools:
 * - `take_snapshot` — Take a snapshot of current project health metrics
 * - `get_timeline` — Get the project evolution timeline
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiGet, apiRequest, apiErrorResult } from '../api.js';

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register snapshot and timeline tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerSnapshotTools(server: McpServer): void {
  // ── take_snapshot ────────────────────────────────────────────────
  server.tool(
    'take_snapshot',
    'Take a snapshot of the current project state by exporting the knowledge ' +
    'graph — all entities and relationships plus summary stats. The result can ' +
    'be saved and later re-imported. Requires an analysis to have been run on ' +
    'the server.',
    {},
    async () => {
      try {
        const result = await apiRequest<unknown>('/api/v1/snapshots/export', {
          method: 'POST',
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'export snapshot');
      }
    },
  );

  // ── get_timeline ─────────────────────────────────────────────────
  server.tool(
    'get_timeline',
    'Get the project evolution timeline — snapshots and derived trend series ' +
    'recorded across analysis runs on the server.',
    {},
    async () => {
      try {
        const result = await apiGet<unknown>('/api/v1/timeline');

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

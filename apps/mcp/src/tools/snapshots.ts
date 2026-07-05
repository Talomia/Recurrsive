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
import { z } from 'zod';
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
    'Take a snapshot of current project health metrics',
    {
      label: z
        .string()
        .optional()
        .describe('Optional label for the snapshot (e.g., "pre-refactor", "v2.1-release")'),
    },
    async ({ label }) => {
      try {
        const body: Record<string, string> = {};
        if (label) body['label'] = label;

        const result = await apiRequest<unknown>('/api/v1/snapshots', {
          method: 'POST',
          body: JSON.stringify(body),
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'take snapshot');
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
        .optional()
        .describe('Maximum number of timeline entries to return (default 10)'),
    },
    async ({ limit }) => {
      try {
        const params = new URLSearchParams();
        if (limit !== undefined) params.set('limit', String(limit));
        const qs = params.toString();

        const result = await apiGet<unknown>(`/api/v1/snapshots${qs ? `?${qs}` : ''}`);

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

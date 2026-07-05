/**
 * @module @recurrsive/mcp/tools/search
 *
 * MCP tool definitions for codebase search and audit trail.
 *
 * Provides two tools:
 * - `search_codebase` — Search findings, opportunities, and entities by keyword
 * - `get_audit_events` — Retrieve recent audit trail events
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiErrorResult } from '../api.js';

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register search and audit tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerSearchTools(server: McpServer): void {
  // ── search_codebase ──────────────────────────────────────────────
  server.tool(
    'search_codebase',
    'Search findings, opportunities, and entities by keyword',
    {
      query: z.string().describe('Search query string'),
      scope: z
        .enum(['findings', 'opportunities', 'entities'])
        .optional()
        .describe('Limit search to a specific scope'),
    },
    async ({ query, scope }) => {
      try {
        const params = new URLSearchParams();
        params.set('q', query);
        if (scope) params.set('scope', scope);

        const result = await apiGet<unknown>(`/api/v1/search?${params.toString()}`);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'search codebase');
      }
    },
  );

  // ── get_audit_events ─────────────────────────────────────────────
  server.tool(
    'get_audit_events',
    'Retrieve recent audit trail events',
    {
      type: z
        .string()
        .optional()
        .describe('Filter by event type (e.g., analysis.started, policy.evaluated)'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of events to return (default 20)'),
    },
    async ({ type, limit }) => {
      try {
        const params = new URLSearchParams();
        if (type) params.set('type', type);
        if (limit !== undefined) params.set('limit', String(limit));
        const qs = params.toString();

        const result = await apiGet<unknown>(`/api/v1/search/audit${qs ? `?${qs}` : ''}`);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'get audit events');
      }
    },
  );
}

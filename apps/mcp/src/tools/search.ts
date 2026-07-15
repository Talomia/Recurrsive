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
    'Retrieve recent audit-trail events (API access log). Optionally filter by ' +
    'action class. Requires analyst-level credentials.',
    {
      action: z
        .enum(['read', 'write', 'delete', 'auth', 'admin'])
        .optional()
        .describe('Filter by action class: read, write, delete, auth, admin'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of events to return (default 100, max 1000)'),
    },
    async ({ action, limit }) => {
      try {
        const params = new URLSearchParams();
        if (action) params.set('action', action);
        if (limit !== undefined) params.set('limit', String(limit));
        const qs = params.toString();

        const result = await apiGet<unknown>(`/api/v1/audit${qs ? `?${qs}` : ''}`);

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

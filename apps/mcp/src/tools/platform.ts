/**
 * @module @recurrsive/mcp/tools/platform
 *
 * MCP tool definitions for platform management operations.
 *
 * Provides two tools:
 * - `get_benchmarks` — Get cloud benchmarking data
 * - `list_secrets` — List secrets metadata (NEVER exposes values)
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { apiGet, apiErrorResult } from '../api.js';

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Register all platform management tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerPlatformTools(server: McpServer): void {
  // ── get_benchmarks ─────────────────────────────────────────────────────

  server.tool(
    'get_benchmarks',
    'Get aggregate, self-hosted analysis benchmark data collected by this deployment.',
    {},
    async () => {
      try {
        const result = await apiGet<unknown>('/api/v1/cloud/benchmarks/report');

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'get benchmarks');
      }
    },
  );

  // ── list_secrets ───────────────────────────────────────────────────────

  server.tool(
    'list_secrets',
    'List secrets metadata including name, scope, rotation policy, and status. ' +
    'IMPORTANT: This tool NEVER exposes secret values — only metadata is returned.',
    {},
    async () => {
      try {
        const secrets = await apiGet<unknown[]>('/api/v1/secrets');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              {
                _warning: 'Secret values are never exposed through this API. Only metadata is returned.',
                secrets,
                total: secrets.length,
              },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'list secrets');
      }
    },
  );
}

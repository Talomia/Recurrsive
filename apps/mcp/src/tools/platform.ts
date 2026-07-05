/**
 * @module @recurrsive/mcp/tools/platform
 *
 * MCP tool definitions for platform management operations.
 *
 * Provides four tools:
 * - `list_plugins` — List installed plugins with status and hooks
 * - `list_tenants` — List tenants with tiers and quota usage
 * - `get_benchmarks` — Get cloud benchmarking data
 * - `list_secrets` — List secrets metadata (NEVER exposes values)
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
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
  // ── list_plugins ───────────────────────────────────────────────────────

  server.tool(
    'list_plugins',
    'List all installed plugins with their status, hooks, and configuration ' +
    'schemas. Optionally filter by status (enabled/disabled).',
    {
      status: z
        .string()
        .optional()
        .describe('Filter by plugin status: enabled, disabled'),
    },
    async ({ status }) => {
      try {
        const plugins = await apiGet<unknown[]>('/api/v1/plugins/installed');

        const filtered = status
          ? plugins.filter((p: unknown) => (p as Record<string, unknown>)['status'] === status)
          : plugins;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { plugins: filtered, total: filtered.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'list plugins');
      }
    },
  );

  // ── list_tenants ───────────────────────────────────────────────────────

  server.tool(
    'list_tenants',
    'List all tenants with their tier, status, and quota usage. Shows current ' +
    'resource utilization against allocated quotas.',
    {},
    async () => {
      try {
        const tenants = await apiGet<unknown[]>('/api/v1/tenants');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { tenants, total: tenants.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'list tenants');
      }
    },
  );

  // ── get_benchmarks ─────────────────────────────────────────────────────

  server.tool(
    'get_benchmarks',
    'Get cloud benchmarking data comparing analysis performance across ' +
    'providers. Optionally filter by cloud provider (aws, gcp, azure).',
    {
      provider: z
        .string()
        .optional()
        .describe('Cloud provider filter: aws, gcp, azure'),
    },
    async ({ provider }) => {
      try {
        const path = provider
          ? `/api/v1/benchmarks?provider=${encodeURIComponent(provider)}`
          : '/api/v1/benchmarks';
        const result = await apiGet<unknown>(path);

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

/**
 * @module @recurrsive/mcp/tools/experiments
 *
 * MCP tool definitions for engineering experiment management.
 *
 * Provides two tools:
 * - `list_experiments` — List all engineering experiments
 * - `create_experiment` — Create a new engineering experiment
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
 * Register experiment tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerExperimentTools(server: McpServer): void {
  // ── list_experiments ──────────────────────────────────────────────
  server.tool(
    'list_experiments',
    'List all engineering experiments. Optionally filter by status (pending, running, completed, failed).',
    {
      status: z
        .string()
        .optional()
        .describe('Filter experiments by status (pending, running, completed, failed)'),
    },
    async ({ status }) => {
      try {
        const path = status
          ? `/api/v1/experiments?status=${encodeURIComponent(status)}`
          : '/api/v1/experiments';
        const result = await apiGet<unknown>(path);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'list experiments');
      }
    },
  );

  // ── create_experiment ─────────────────────────────────────────────
  server.tool(
    'create_experiment',
    'Create a new engineering experiment with a hypothesis and variant definitions. Returns the created experiment.',
    {
      name: z.string().describe('Name of the experiment'),
      hypothesis: z.string().describe('The hypothesis being tested'),
      variants: z
        .array(z.string().describe('Variant name'))
        .min(2)
        .describe('Array of variant names (minimum 2, e.g. ["Control", "Treatment"])'),
    },
    async ({ name, hypothesis, variants }) => {
      try {
        const result = await apiRequest<unknown>('/api/v1/experiments', {
          method: 'POST',
          body: JSON.stringify({ name, hypothesis, variants }),
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'create experiment');
      }
    },
  );
}

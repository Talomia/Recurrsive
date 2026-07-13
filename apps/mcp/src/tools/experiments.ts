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
import { apiData, apiGet, apiErrorResult, projectScopedPath } from '../api.js';

const variantSchema = z.object({
  name: z.string().min(1).describe('Variant name'),
  analyzers: z.array(z.string()).min(1).describe('Enabled analyzer IDs'),
  collectors: z.array(z.string()).min(1).describe('Enabled collector IDs; must include git'),
  include_reasoning: z.boolean().optional().describe('Whether to run multi-agent reasoning'),
});

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
      project_id: z.string().optional().describe('Project ID. Defaults to RECURRSIVE_PROJECT_ID.'),
    },
    async ({ status, project_id }) => {
      try {
        const path = status
          ? `/api/v1/experiments?status=${encodeURIComponent(status)}`
          : '/api/v1/experiments';
        const result = await apiGet<unknown>(projectScopedPath(path, project_id));

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
      description: z.string().optional().describe('Optional experiment description'),
      variants: z
        .array(variantSchema)
        .length(2)
        .describe('Exactly two isolated analyzer/collector configurations'),
      project_id: z.string().optional().describe('Project ID. Defaults to RECURRSIVE_PROJECT_ID.'),
    },
    async ({ name, hypothesis, description, variants, project_id }) => {
      try {
        const result = await apiData<unknown>(projectScopedPath('/api/v1/experiments', project_id), {
          method: 'POST',
          body: JSON.stringify({
            name,
            hypothesis,
            description,
            variants: variants.map(({ include_reasoning, ...variant }) => ({
              ...variant,
              includeReasoning: include_reasoning,
            })),
          }),
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

/**
 * @module @recurrsive/mcp/tools/export
 *
 * MCP tool definitions for data export and analysis run comparison.
 *
 * Provides two tools:
 * - `export_report` — Export analysis data in various formats
 * - `compare_analysis_runs` — Compare two analysis runs to identify changes
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiData, apiGet, apiErrorResult, projectScopedPath } from '../api.js';

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register export and comparison tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerExportTools(server: McpServer): void {
  // ── export_report ───────────────────────────────────────────────────
  server.tool(
    'export_report',
    'Export analysis data in various formats',
    {
      format: z
        .enum(['json', 'csv', 'markdown'])
        .describe('Export format'),
      scope: z
        .enum(['findings', 'opportunities', 'health', 'all'])
        .describe('Data scope to export'),
      project_id: z.string().optional().describe('Project ID. Defaults to RECURRSIVE_PROJECT_ID.'),
    },
    async ({ format, scope, project_id }) => {
      try {
        const result = await apiData<unknown>(projectScopedPath('/api/v1/export', project_id), {
          method: 'POST',
          body: JSON.stringify({ format, scope }),
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'export report');
      }
    },
  );

  // ── compare_analysis_runs ───────────────────────────────────────────
  server.tool(
    'compare_analysis_runs',
    'Compare two analysis runs to identify changes',
    {
      baseline_run: z.string().describe('History ID of the baseline analysis run'),
      target_run: z.string().describe('History ID of the target analysis run'),
      project_id: z.string().optional().describe('Project ID. Defaults to RECURRSIVE_PROJECT_ID.'),
    },
    async ({ baseline_run, target_run, project_id }) => {
      try {
        const params = new URLSearchParams();
        params.set('run_a', baseline_run);
        params.set('run_b', target_run);

        const result = await apiGet<unknown>(
          projectScopedPath(`/api/v1/analysis/compare?${params.toString()}`, project_id),
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'compare analysis runs');
      }
    },
  );
}

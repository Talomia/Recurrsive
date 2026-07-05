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
import { apiGet, apiErrorResult } from '../api.js';

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
    },
    async ({ format, scope }) => {
      try {
        const params = new URLSearchParams();
        params.set('format', format);
        params.set('scope', scope);

        const result = await apiGet<unknown>(`/api/v1/reports/exports?${params.toString()}`);

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
      baseline_run: z
        .number()
        .describe('Run number of the baseline analysis'),
      target_run: z
        .number()
        .describe('Run number of the target analysis to compare against'),
    },
    async ({ baseline_run, target_run }) => {
      try {
        const params = new URLSearchParams();
        params.set('baseline', String(baseline_run));
        params.set('target', String(target_run));

        const result = await apiGet<unknown>(
          `/api/v1/reports/exports/compare?${params.toString()}`,
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

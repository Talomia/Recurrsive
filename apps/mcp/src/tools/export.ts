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
import { apiGet, apiRequest, apiRequestText, apiErrorResult } from '../api.js';

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
        // Create the export server-side, then download the generated content.
        const created = await apiRequest<{
          data: { export_id: string; download_url: string; record_count: number };
        }>('/api/v1/export', {
          method: 'POST',
          body: JSON.stringify({ format, scope }),
        });

        const record = created.data;
        const content = await apiRequestText(record.download_url);

        const header = `Export ${record.export_id} — format=${format}, scope=${scope}, `
          + `records=${record.record_count}\n`
          + `${'-'.repeat(60)}\n`;

        return {
          content: [{
            type: 'text' as const,
            text: header + content,
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
    'Compare the most recent analysis run against an earlier run from history, ' +
    'reporting added/removed findings and opportunities. Requires at least two ' +
    'analysis runs to have been recorded on the server.',
    {
      baseline_run: z
        .number()
        .optional()
        .describe(
          'History index of the baseline run to compare the latest run against. ' +
          'Omit to compare against the immediately preceding run.',
        ),
    },
    async ({ baseline_run }) => {
      try {
        const params = new URLSearchParams();
        if (baseline_run !== undefined) params.set('baseline', String(baseline_run));
        const qs = params.toString();

        const result = await apiGet<unknown>(
          `/api/v1/analysis/compare${qs ? `?${qs}` : ''}`,
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

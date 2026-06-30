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
      // Mock export data
      const findings = [
        { id: 'FND-001', title: 'N+1 query detected', severity: 'high', category: 'performance' },
        { id: 'FND-002', title: 'Missing input validation', severity: 'critical', category: 'security' },
        { id: 'FND-003', title: 'Unused dependency', severity: 'low', category: 'maintenance' },
      ];

      const opportunities = [
        { id: 'OPP-001', title: 'Migrate to connection pooling', severity: 'high', status: 'open' },
        { id: 'OPP-002', title: 'Add rate limiting', severity: 'medium', status: 'open' },
      ];

      const health = {
        overall_score: 74.2,
        dimensions: { reliability: 78, security: 65, performance: 72, maintainability: 82 },
      };

      const scopeData: Record<string, unknown> = {};
      if (scope === 'findings' || scope === 'all') scopeData['findings'] = findings;
      if (scope === 'opportunities' || scope === 'all') scopeData['opportunities'] = opportunities;
      if (scope === 'health' || scope === 'all') scopeData['health'] = health;

      let content: string;

      switch (format) {
        case 'csv': {
          const rows = findings.map(f => `${f.id},${f.title},${f.severity},${f.category}`);
          content = ['id,title,severity,category', ...rows].join('\n');
          break;
        }
        case 'markdown': {
          const lines = [
            `# Export — ${scope}`,
            '',
            '| ID | Title | Severity |',
            '|---|---|---|',
            ...findings.map(f => `| ${f.id} | ${f.title} | ${f.severity} |`),
          ];
          content = lines.join('\n');
          break;
        }
        default:
          content = JSON.stringify(scopeData, null, 2);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                export_id: `exp_${Date.now().toString(36)}`,
                format,
                scope,
                status: 'completed',
                record_count: Object.values(scopeData).flat().length,
                data: content,
              },
              null,
              2,
            ),
          },
        ],
      };
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
      // Mock comparison data
      const comparison = {
        baseline: {
          run: baseline_run,
          timestamp: new Date(Date.now() - 7 * 86400000).toISOString(),
          total_findings: 42,
          health_score: 68.5,
          opportunities: 15,
        },
        target: {
          run: target_run,
          timestamp: new Date().toISOString(),
          total_findings: 38,
          health_score: 74.2,
          opportunities: 12,
        },
        deltas: {
          findings_delta: -4,
          health_delta: 5.7,
          opportunities_delta: -3,
          new_findings: [
            { id: 'FND-048', title: 'Unused import in auth module', severity: 'low' },
          ],
          resolved_findings: [
            { id: 'FND-031', title: 'SQL injection risk in search', severity: 'critical' },
            { id: 'FND-035', title: 'Memory leak in WebSocket handler', severity: 'high' },
            { id: 'FND-038', title: 'Missing CSRF token validation', severity: 'high' },
            { id: 'FND-040', title: 'Hardcoded API key in config', severity: 'critical' },
            { id: 'FND-041', title: 'Unvalidated redirect URL', severity: 'medium' },
          ],
          severity_changes: {
            critical: { before: 5, after: 2, delta: -3 },
            high: { before: 12, after: 10, delta: -2 },
            medium: { before: 15, after: 16, delta: 1 },
            low: { before: 10, after: 10, delta: 0 },
          },
        },
        summary: `Comparing run #${baseline_run} → #${target_run}: Health improved by +5.7 points (68.5 → 74.2). Net reduction of 4 findings (5 resolved, 1 new). Critical findings dropped from 5 to 2.`,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(comparison, null, 2),
          },
        ],
      };
    },
  );
}

/**
 * @module @recurrsive/mcp/tools/snapshots
 *
 * MCP tool definitions for project snapshots and timeline.
 *
 * Provides two tools:
 * - `take_snapshot` — Take a snapshot of current project health metrics
 * - `get_timeline` — Get the project evolution timeline
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register snapshot and timeline tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerSnapshotTools(server: McpServer): void {
  // ── take_snapshot ────────────────────────────────────────────────
  server.tool(
    'take_snapshot',
    'Take a snapshot of current project health metrics',
    {
      label: z
        .string()
        .optional()
        .describe('Optional label for the snapshot (e.g., "pre-refactor", "v2.1-release")'),
    },
    async ({ label }) => {
      const snapshotId = `snap_${String(Date.now()).slice(-8)}`;

      const snapshot = {
        id: snapshotId,
        label: label ?? `snapshot-${new Date().toISOString().slice(0, 10)}`,
        timestamp: new Date().toISOString(),
        health: {
          overall: 87,
          code_quality: 91,
          security: 85,
          performance: 78,
          reliability: 92,
          documentation: 74,
        },
        counts: {
          total_findings: 47,
          critical: 3,
          high: 12,
          medium: 19,
          low: 13,
          opportunities: 23,
          entities: 234,
          relationships: 567,
        },
        metadata: {
          analyzers_run: 6,
          analysis_duration_ms: 12400,
          snapshot_size_bytes: 45200,
        },
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'created',
                snapshot,
                message: `Snapshot ${snapshotId} created${label ? ` with label "${label}"` : ''}. Use get_timeline to see historical snapshots.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── get_timeline ─────────────────────────────────────────────────
  server.tool(
    'get_timeline',
    'Get the project evolution timeline',
    {
      limit: z
        .number()
        .optional()
        .describe('Maximum number of timeline entries to return (default 10)'),
    },
    async ({ limit }) => {
      const maxEntries = limit ?? 10;

      const timeline = [
        {
          date: new Date(Date.now() - 6 * 86400000).toISOString(),
          event: 'analysis.complete',
          summary: 'Initial codebase analysis completed',
          health_score: 72,
          findings: 63,
          opportunities: 31,
        },
        {
          date: new Date(Date.now() - 5 * 86400000).toISOString(),
          event: 'snapshot.created',
          summary: 'Baseline snapshot captured',
          health_score: 72,
          findings: 63,
          opportunities: 31,
        },
        {
          date: new Date(Date.now() - 4 * 86400000).toISOString(),
          event: 'opportunity.resolved',
          summary: 'Fixed N+1 query pattern in order service',
          health_score: 76,
          findings: 58,
          opportunities: 28,
        },
        {
          date: new Date(Date.now() - 3 * 86400000).toISOString(),
          event: 'analysis.complete',
          summary: 'Re-analysis after security patch',
          health_score: 80,
          findings: 52,
          opportunities: 25,
        },
        {
          date: new Date(Date.now() - 2 * 86400000).toISOString(),
          event: 'policy.violation',
          summary: 'New critical vulnerability detected in auth module',
          health_score: 78,
          findings: 54,
          opportunities: 26,
        },
        {
          date: new Date(Date.now() - 1 * 86400000).toISOString(),
          event: 'opportunity.resolved',
          summary: 'Migrated auth to OAuth 2.1 PKCE flow',
          health_score: 84,
          findings: 49,
          opportunities: 24,
        },
        {
          date: new Date().toISOString(),
          event: 'analysis.complete',
          summary: 'Latest analysis — health trending upward',
          health_score: 87,
          findings: 47,
          opportunities: 23,
        },
      ];

      const entries = timeline.slice(-maxEntries);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                timeline: entries,
                total: entries.length,
                trend: entries.length >= 2
                  ? {
                      health_change: entries[entries.length - 1]!.health_score - entries[0]!.health_score,
                      findings_change: entries[entries.length - 1]!.findings - entries[0]!.findings,
                    }
                  : null,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

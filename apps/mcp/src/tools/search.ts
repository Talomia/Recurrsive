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
      // Mock search results — in production, this would query the server
      const allResults = [
        {
          type: 'finding',
          name: 'N+1 query in order processing',
          relevance: 0.95,
          id: 'FND-2847',
          description: 'Detected N+1 query pattern causing latency spikes',
        },
        {
          type: 'opportunity',
          name: 'Migrate to OAuth 2.1 PKCE',
          relevance: 0.88,
          id: 'OPP-2847',
          description: 'Security improvement via modern authentication flow',
        },
        {
          type: 'entity',
          name: 'AuthService',
          relevance: 0.82,
          id: 'ENT-0042',
          description: 'Core authentication service module',
        },
        {
          type: 'finding',
          name: 'Missing rate limiting on API endpoints',
          relevance: 0.78,
          id: 'FND-2851',
          description: 'API endpoints lack rate limiting protection',
        },
        {
          type: 'entity',
          name: 'OrderProcessor',
          relevance: 0.75,
          id: 'ENT-0089',
          description: 'Order processing pipeline orchestrator',
        },
      ];

      const filtered = scope
        ? allResults.filter(r => r.type === scope.replace(/s$/, ''))
        : allResults;

      // Simple relevance filtering by query
      const results = filtered.filter(
        r =>
          r.name.toLowerCase().includes(query.toLowerCase()) ||
          r.description.toLowerCase().includes(query.toLowerCase()) ||
          query === '*',
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                query,
                scope: scope ?? 'all',
                results: results.length > 0 ? results : filtered.slice(0, 3),
                total: results.length > 0 ? results.length : filtered.slice(0, 3).length,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── get_audit_events ─────────────────────────────────────────────
  server.tool(
    'get_audit_events',
    'Retrieve recent audit trail events',
    {
      type: z
        .string()
        .optional()
        .describe('Filter by event type (e.g., analysis.started, policy.evaluated)'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of events to return (default 20)'),
    },
    async ({ type, limit }) => {
      const maxEvents = limit ?? 20;

      const allEvents = [
        {
          id: 'evt_001',
          type: 'analysis.started',
          actor: 'system',
          description: 'Full analysis pipeline initiated',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          metadata: { target: '/src', analyzers: 6 },
        },
        {
          id: 'evt_002',
          type: 'analysis.complete',
          actor: 'system',
          description: 'Analysis completed successfully',
          timestamp: new Date(Date.now() - 3000000).toISOString(),
          metadata: { findings: 47, duration_ms: 12400 },
        },
        {
          id: 'evt_003',
          type: 'policy.evaluated',
          actor: 'policy-engine',
          description: 'Policy compliance check executed',
          timestamp: new Date(Date.now() - 2400000).toISOString(),
          metadata: { policies: 5, violations: 2 },
        },
        {
          id: 'evt_004',
          type: 'opportunity.created',
          actor: 'reasoning-engine',
          description: 'New improvement opportunity identified',
          timestamp: new Date(Date.now() - 1800000).toISOString(),
          metadata: { opportunity_id: 'OPP-2847', severity: 'critical' },
        },
        {
          id: 'evt_005',
          type: 'snapshot.created',
          actor: 'system',
          description: 'Knowledge graph snapshot exported',
          timestamp: new Date(Date.now() - 1200000).toISOString(),
          metadata: { entities: 234, relationships: 567 },
        },
      ];

      const filtered = type
        ? allEvents.filter(e => e.type === type)
        : allEvents;

      const events = filtered.slice(0, maxEvents);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                events,
                total: events.length,
                limit: maxEvents,
                filter: type ?? 'all',
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

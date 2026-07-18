/**
 * @module @recurrsive/mcp/tools/intelligence
 *
 * MCP tool definitions for intelligence and simulation operations.
 *
 * Provides four tools:
 * - `list_simulations` — List simulations with status filters
 * - `run_simulation` — Run a new simulation (monte_carlo, scenario, stress_test, chaos)
 * - `get_confidence` — Get confidence calibration overview
 * - `list_intelligence_packs` — List domain intelligence packs
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiRequest, apiErrorResult } from '../api.js';

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Register all intelligence and simulation tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerIntelligenceTools(server: McpServer): void {
  // ── list_simulations ───────────────────────────────────────────────────

  server.tool(
    'list_simulations',
    'List all simulations with their status and result summaries. ' +
    'Optionally filter by status (pending, running, completed, failed).',
    {
      status: z
        .string()
        .optional()
        .describe('Filter by status: pending, running, completed, failed'),
    },
    async ({ status }) => {
      try {
        // The server returns all simulations; apply the status filter here so
        // the advertised filter actually takes effect (the endpoint ignores
        // query params).
        const all = await apiGet<Array<{ status?: string }>>('/api/v1/simulations');
        const simulations = status
          ? all.filter((s) => s.status === status)
          : all;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { simulations, total: simulations.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'list simulations');
      }
    },
  );

  // ── run_simulation ─────────────────────────────────────────────────────

  server.tool(
    'run_simulation',
    'Start a new simulation run. Supported types: monte_carlo (probabilistic ' +
    'outcome modeling), scenario (deterministic what-if), stress_test (load ' +
    'and capacity testing), chaos (failure injection analysis).',
    {
      type: z
        .string()
        .describe('Simulation type: monte_carlo, scenario, stress_test, chaos'),
      name: z
        .string()
        .describe('Human-readable name for this simulation run'),
      parameters: z
        .record(z.unknown())
        .optional()
        .describe('Optional parameters for the simulation (type-specific)'),
    },
    async ({ type, name, parameters }) => {
      try {
        const result = await apiRequest<unknown>('/api/v1/simulations', {
          method: 'POST',
          body: JSON.stringify({ type, name, parameters: parameters ?? {} }),
        });

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'run simulation');
      }
    },
  );

  // ── get_confidence ─────────────────────────────────────────────────────

  server.tool(
    'get_confidence',
    'Get the confidence calibration overview showing how well the system\'s ' +
    'predictions match actual outcomes across all dimensions.',
    {},
    async () => {
      try {
        const result = await apiGet<unknown>('/api/v1/confidence/overview');

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return apiErrorResult(error, 'get confidence data');
      }
    },
  );

  // ── list_intelligence_packs ────────────────────────────────────────────

  server.tool(
    'list_intelligence_packs',
    'List available domain intelligence packs. Each pack bundles specialized ' +
    'analyzers and rules for a specific domain (e.g. security, compliance, AI).',
    {
      domain: z
        .string()
        .optional()
        .describe('Filter by domain: infrastructure, security, ai, compliance'),
    },
    async ({ domain }) => {
      try {
        // Filter client-side — the endpoint returns all packs and ignores query
        // params, so filtering here keeps the advertised `domain` filter honest.
        const all = await apiGet<Array<{ domain?: string }>>('/api/v1/intelligence-packs');
        const packs = domain
          ? all.filter((p) => p.domain === domain)
          : all;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { packs, total: packs.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'list intelligence packs');
      }
    },
  );
}

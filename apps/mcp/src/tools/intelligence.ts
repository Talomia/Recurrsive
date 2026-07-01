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

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const DEMO_SIMULATIONS = [
  {
    id: 'sim_001',
    name: 'Auth service failure cascade',
    type: 'chaos',
    status: 'completed',
    created_at: new Date(Date.now() - 86_400_000 * 3).toISOString(),
    completed_at: new Date(Date.now() - 86_400_000 * 3 + 45_000).toISOString(),
    result_summary: '3 critical cascading failures detected across 12 services',
  },
  {
    id: 'sim_002',
    name: 'Peak load stress test (10x)',
    type: 'stress_test',
    status: 'completed',
    created_at: new Date(Date.now() - 86_400_000 * 2).toISOString(),
    completed_at: new Date(Date.now() - 86_400_000 * 2 + 120_000).toISOString(),
    result_summary: 'System degrades at 7.2x baseline; OOM at 9.1x',
  },
  {
    id: 'sim_003',
    name: 'Database migration risk assessment',
    type: 'monte_carlo',
    status: 'completed',
    created_at: new Date(Date.now() - 86_400_000).toISOString(),
    completed_at: new Date(Date.now() - 86_400_000 + 300_000).toISOString(),
    result_summary: '87% probability of successful migration within 4h window',
  },
  {
    id: 'sim_004',
    name: 'Multi-region failover scenario',
    type: 'scenario',
    status: 'running',
    created_at: new Date(Date.now() - 600_000).toISOString(),
    completed_at: null,
    result_summary: null,
  },
  {
    id: 'sim_005',
    name: 'Cost optimization impact',
    type: 'scenario',
    status: 'pending',
    created_at: new Date(Date.now() - 120_000).toISOString(),
    completed_at: null,
    result_summary: null,
  },
];

const DEMO_PACKS = [
  {
    id: 'pack_001',
    name: 'Cloud Infrastructure',
    domain: 'infrastructure',
    version: '2.4.1',
    description: 'Analyzers for AWS, GCP, and Azure infrastructure patterns',
    analyzers_count: 18,
    rules_count: 124,
    installed: true,
    last_updated: '2026-06-15T08:00:00Z',
  },
  {
    id: 'pack_002',
    name: 'Security Posture',
    domain: 'security',
    version: '3.1.0',
    description: 'OWASP, CVE, and supply chain security analysis rules',
    analyzers_count: 24,
    rules_count: 312,
    installed: true,
    last_updated: '2026-06-20T12:00:00Z',
  },
  {
    id: 'pack_003',
    name: 'AI/ML Quality',
    domain: 'ai',
    version: '1.8.0',
    description: 'Model quality, prompt engineering, and AI pipeline analysis',
    analyzers_count: 12,
    rules_count: 67,
    installed: true,
    last_updated: '2026-06-10T09:30:00Z',
  },
  {
    id: 'pack_004',
    name: 'FinTech Compliance',
    domain: 'compliance',
    version: '1.2.3',
    description: 'PCI-DSS, SOX, and financial regulation compliance checks',
    analyzers_count: 9,
    rules_count: 85,
    installed: false,
    last_updated: '2026-05-28T14:00:00Z',
  },
  {
    id: 'pack_005',
    name: 'Healthcare HIPAA',
    domain: 'compliance',
    version: '2.0.0',
    description: 'HIPAA compliance and PHI data handling analysis',
    analyzers_count: 11,
    rules_count: 96,
    installed: false,
    last_updated: '2026-06-01T10:00:00Z',
  },
];

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
        const filtered = status
          ? DEMO_SIMULATIONS.filter(s => s.status === status)
          : DEMO_SIMULATIONS;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { simulations: filtered, total: filtered.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to list simulations: ${message}` }],
          isError: true,
        };
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
        const estimatedMinutes: Record<string, number> = {
          monte_carlo: 5,
          scenario: 2,
          stress_test: 10,
          chaos: 8,
        };

        const result = {
          id: `sim_${Date.now().toString(36)}`,
          name,
          type,
          status: 'running',
          parameters: parameters ?? {},
          started_at: new Date().toISOString(),
          estimated_completion: new Date(
            Date.now() + (estimatedMinutes[type] ?? 5) * 60_000,
          ).toISOString(),
          message: `Simulation "${name}" (${type}) has been queued and is now running.`,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to run simulation: ${message}` }],
          isError: true,
        };
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
        const result = {
          overall_confidence: 0.82,
          calibration_score: 0.88,
          dimensions: [
            { name: 'architecture', confidence: 0.85, sample_size: 142, accuracy: 0.89 },
            { name: 'security', confidence: 0.91, sample_size: 98, accuracy: 0.93 },
            { name: 'performance', confidence: 0.74, sample_size: 215, accuracy: 0.78 },
            { name: 'reliability', confidence: 0.80, sample_size: 167, accuracy: 0.84 },
            { name: 'testing', confidence: 0.87, sample_size: 73, accuracy: 0.90 },
            { name: 'documentation', confidence: 0.68, sample_size: 45, accuracy: 0.72 },
          ],
          recent_predictions: [
            { prediction: 'Auth refactor reduces incident rate by 40%', actual_outcome: '38% reduction observed', confidence_at_prediction: 0.78, was_correct: true },
            { prediction: 'Cache layer improves p95 latency by 60%', actual_outcome: '52% improvement observed', confidence_at_prediction: 0.65, was_correct: true },
            { prediction: 'Migration completes within 2h window', actual_outcome: 'Completed in 3.2h', confidence_at_prediction: 0.55, was_correct: false },
            { prediction: 'No regression from TypeScript strict mode', actual_outcome: 'Zero regressions after 2 weeks', confidence_at_prediction: 0.82, was_correct: true },
          ],
          generated_at: new Date().toISOString(),
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to get confidence data: ${message}` }],
          isError: true,
        };
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
        const filtered = domain
          ? DEMO_PACKS.filter(p => p.domain === domain)
          : DEMO_PACKS;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { packs: filtered, total: filtered.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to list intelligence packs: ${message}` }],
          isError: true,
        };
      }
    },
  );
}

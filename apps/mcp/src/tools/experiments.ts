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

// ---------------------------------------------------------------------------
// In-memory experiment store
// ---------------------------------------------------------------------------

interface ExperimentVariant {
  name: string;
  config: Record<string, unknown>;
}

interface ExperimentMetricResult {
  name: string;
  variant_a: number;
  variant_b: number;
  improvement: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  hypothesis: string;
  variants: ExperimentVariant[];
  metrics: ExperimentMetricResult[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  conclusion: string | null;
}

let nextId = 6;

const experiments: Map<string, Experiment> = new Map([
  [
    'exp_001',
    {
      id: 'exp_001',
      name: 'Strict Import Rules',
      description: 'Test whether enforcing strict import rules improves overall codebase health scores.',
      status: 'completed' as const,
      hypothesis: 'Enforcing strict import rules will improve health scores by reducing circular dependencies.',
      variants: [
        { name: 'Control', config: { strict_imports: false } },
        { name: 'Strict Mode', config: { strict_imports: true, ban_circular: true } },
      ],
      metrics: [
        { name: 'Health Score', variant_a: 78, variant_b: 90, improvement: 12 },
        { name: 'Circular Deps', variant_a: 14, variant_b: 3, improvement: -78.6 },
      ],
      created_at: '2026-06-10T08:00:00Z',
      started_at: '2026-06-10T09:00:00Z',
      completed_at: '2026-06-18T17:00:00Z',
      conclusion: 'Positive result: +12% health score improvement.',
    },
  ],
  [
    'exp_002',
    {
      id: 'exp_002',
      name: 'Auto-Fix Security',
      description: 'Evaluate automatic security vulnerability fixing using AI-generated patches.',
      status: 'running' as const,
      hypothesis: 'Automated security fixes will reduce mean-time-to-remediation by 60%.',
      variants: [
        { name: 'Manual Review', config: { auto_fix: false } },
        { name: 'AI Auto-Fix', config: { auto_fix: true, confidence_threshold: 0.85 } },
      ],
      metrics: [
        { name: 'MTTR (hours)', variant_a: 48, variant_b: 19.2, improvement: -60 },
        { name: 'Fix Rate', variant_a: 72, variant_b: 89, improvement: 23.6 },
      ],
      created_at: '2026-06-20T10:00:00Z',
      started_at: '2026-06-20T12:00:00Z',
      completed_at: null,
      conclusion: null,
    },
  ],
  [
    'exp_003',
    {
      id: 'exp_003',
      name: 'Parallel Analyzers',
      description: 'Test running code analyzers in parallel vs sequential.',
      status: 'completed' as const,
      hypothesis: 'Running analyzers in parallel will reduce total analysis time by 50%.',
      variants: [
        { name: 'Sequential', config: { parallel: false } },
        { name: 'Parallel (4x)', config: { parallel: true, max_workers: 4 } },
      ],
      metrics: [
        { name: 'Analysis Time (s)', variant_a: 120, variant_b: 58, improvement: -51.7 },
        { name: 'Findings Detected', variant_a: 47, variant_b: 46, improvement: -2.1 },
      ],
      created_at: '2026-06-05T14:00:00Z',
      started_at: '2026-06-05T15:00:00Z',
      completed_at: '2026-06-12T16:00:00Z',
      conclusion: 'Neutral result: 52% speed improvement but doubled memory usage.',
    },
  ],
  [
    'exp_004',
    {
      id: 'exp_004',
      name: 'Batch Scheduling',
      description: 'Evaluate different scheduling strategies for batch analysis.',
      status: 'pending' as const,
      hypothesis: 'Priority-based scheduling will improve resource utilization by 30%.',
      variants: [
        { name: 'FIFO', config: { scheduler: 'fifo' } },
        { name: 'Priority Queue', config: { scheduler: 'priority' } },
      ],
      metrics: [],
      created_at: '2026-06-28T09:00:00Z',
      started_at: null,
      completed_at: null,
      conclusion: null,
    },
  ],
  [
    'exp_005',
    {
      id: 'exp_005',
      name: 'Custom Policies',
      description: 'Test whether team-customizable policy rules improve compliance rates.',
      status: 'completed' as const,
      hypothesis: 'Custom policies tailored to team conventions will increase compliance rates.',
      variants: [
        { name: 'Built-in Only', config: { custom_policies: false } },
        { name: 'Custom + Built-in', config: { custom_policies: true } },
      ],
      metrics: [
        { name: 'Compliance Rate', variant_a: 75, variant_b: 83, improvement: 8 },
        { name: 'False Positives', variant_a: 15, variant_b: 8, improvement: -46.7 },
      ],
      created_at: '2026-06-01T10:00:00Z',
      started_at: '2026-06-01T11:00:00Z',
      completed_at: '2026-06-08T18:00:00Z',
      conclusion: 'Positive result: +8% compliance improvement.',
    },
  ],
]);

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
      let results = Array.from(experiments.values());

      if (status) {
        results = results.filter((e) => e.status === status);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                experiments: results.map((e) => ({
                  id: e.id,
                  name: e.name,
                  status: e.status,
                  hypothesis: e.hypothesis,
                  variants: e.variants.map((v) => v.name),
                  metrics_count: e.metrics.length,
                  created_at: e.created_at,
                  conclusion: e.conclusion,
                })),
                total: results.length,
              },
              null,
              2,
            ),
          },
        ],
      };
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
      const id = `exp_${String(nextId++).padStart(3, '0')}`;
      const now = new Date().toISOString();

      const experiment: Experiment = {
        id,
        name,
        description: '',
        status: 'pending',
        hypothesis,
        variants: variants.map((v, i) => ({
          name: v,
          config: { variant_index: i },
        })),
        metrics: [],
        created_at: now,
        started_at: null,
        completed_at: null,
        conclusion: null,
      };

      experiments.set(id, experiment);

      // Enforce max store size
      if (experiments.size > 100) {
        const oldest = experiments.keys().next().value as string;
        experiments.delete(oldest);
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'created',
                experiment: {
                  id: experiment.id,
                  name: experiment.name,
                  hypothesis: experiment.hypothesis,
                  status: experiment.status,
                  variants: experiment.variants.map((v) => v.name),
                  created_at: experiment.created_at,
                },
                message: `Experiment ${id} "${name}" created with ${variants.length} variants.`,
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

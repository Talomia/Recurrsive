/**
 * @module @recurrsive/mcp/tools/batch
 *
 * MCP tool definitions for batch analysis management.
 *
 * Provides two tools:
 * - `start_batch_analysis` — Start a batch analysis run on multiple projects
 * - `get_batch_status` — Get the status of a batch analysis run
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// In-memory batch store (matches server-side pattern)
// ---------------------------------------------------------------------------

interface BatchProject {
  path: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  error?: string;
}

interface BatchRun {
  batch_id: string;
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed';
  projects: BatchProject[];
  created_at: string;
  completed_at: string | null;
}

const batchRuns: Map<string, BatchRun> = new Map();
let nextBatchId = 1;

function generateBatchId(): string {
  return `batch_${String(nextBatchId++).padStart(6, '0')}`;
}

/**
 * Simulate sequential analysis of projects in a batch.
 */
function simulateBatchAnalysis(batchId: string): void {
  const batch = batchRuns.get(batchId);
  if (!batch) return;

  batch.status = 'running';

  let projectIndex = 0;

  function processNext(): void {
    const currentBatch = batchRuns.get(batchId);
    if (!currentBatch || projectIndex >= currentBatch.projects.length) {
      if (currentBatch) {
        const allCompleted = currentBatch.projects.every((p) => p.status === 'completed');
        const allFailed = currentBatch.projects.every((p) => p.status === 'failed');
        currentBatch.status = allCompleted ? 'completed' : allFailed ? 'failed' : 'partial';
        currentBatch.completed_at = new Date().toISOString();
      }
      return;
    }

    const project = currentBatch.projects[projectIndex];
    if (!project) return;

    project.status = 'running';
    project.started_at = new Date().toISOString();

    const duration = 1000 + Math.random() * 2000;
    setTimeout(() => {
      if (Math.random() > 0.1) {
        project.status = 'completed';
      } else {
        project.status = 'failed';
        project.error = 'Analysis failed: unable to parse project configuration';
      }
      project.completed_at = new Date().toISOString();
      projectIndex++;
      processNext();
    }, duration);
  }

  processNext();
}

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register batch analysis tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerBatchTools(server: McpServer): void {
  // ── start_batch_analysis ──────────────────────────────────────────
  server.tool(
    'start_batch_analysis',
    'Start a batch analysis run on multiple projects. Accepts an array of project paths and returns a batch_id with per-project status.',
    {
      projects: z
        .array(z.string().describe('Filesystem path to a project'))
        .min(1)
        .describe('Array of project paths to analyze (max 10)'),
    },
    async ({ projects }) => {
      if (projects.length > 10) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: 'Too many projects',
                  message: `Received ${projects.length} projects. Maximum is 10.`,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      const batchId = generateBatchId();
      const now = new Date().toISOString();

      const batchRun: BatchRun = {
        batch_id: batchId,
        status: 'pending',
        projects: projects.map((path) => ({
          path,
          status: 'pending' as const,
          started_at: null,
          completed_at: null,
        })),
        created_at: now,
        completed_at: null,
      };

      batchRuns.set(batchId, batchRun);

      // Enforce max history
      if (batchRuns.size > 50) {
        const oldest = batchRuns.keys().next().value as string;
        batchRuns.delete(oldest);
      }

      // Start simulation asynchronously
      simulateBatchAnalysis(batchId);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'accepted',
                batch_id: batchId,
                batch_status: 'pending',
                projects: batchRun.projects.map((p) => ({
                  path: p.path,
                  status: p.status,
                })),
                message: `Batch ${batchId} submitted with ${projects.length} project(s). Analysis will begin shortly.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── get_batch_status ──────────────────────────────────────────────
  server.tool(
    'get_batch_status',
    'Get the status of a batch analysis run. Returns batch details including per-project progress and results.',
    {
      batch_id: z.string().describe('The batch run ID (e.g., batch_000001)'),
    },
    async ({ batch_id }) => {
      const batch = batchRuns.get(batch_id);

      if (!batch) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  error: 'Not found',
                  message: `Batch run ${batch_id} not found. Use start_batch_analysis to create a new batch.`,
                },
                null,
                2,
              ),
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                batch_id: batch.batch_id,
                status: batch.status,
                created_at: batch.created_at,
                completed_at: batch.completed_at,
                projects: batch.projects.map((p) => ({
                  path: p.path,
                  status: p.status,
                  started_at: p.started_at,
                  completed_at: p.completed_at,
                  error: p.error,
                })),
                summary: {
                  total: batch.projects.length,
                  completed: batch.projects.filter((p) => p.status === 'completed').length,
                  failed: batch.projects.filter((p) => p.status === 'failed').length,
                  pending: batch.projects.filter((p) => p.status === 'pending').length,
                  running: batch.projects.filter((p) => p.status === 'running').length,
                },
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

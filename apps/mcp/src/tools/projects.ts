/**
 * @module @recurrsive/mcp/tools/projects
 *
 * MCP tool definitions for project management operations.
 *
 * Provides three tools:
 * - `list_projects` — List all projects with health scores
 * - `get_project` — Get project details by ID
 * - `compare_project_health` — Compare health across projects
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { apiGet, apiErrorResult } from '../api.js';

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Register all project management tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerProjectTools(server: McpServer): void {
  // ── list_projects ──────────────────────────────────────────────────────

  server.tool(
    'list_projects',
    'List all registered projects and their current metadata.',
    {},
    async () => {
      try {
        const projects = await apiGet<unknown[]>('/api/v1/projects');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { projects, total: projects.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'list projects');
      }
    },
  );

  // ── get_project ────────────────────────────────────────────────────────

  server.tool(
    'get_project',
    'Get detailed information about a specific project including health ' +
    'dimensions, recent findings, and team members.',
    {
      id: z.string().describe('Project ID to retrieve (e.g. proj_001)'),
    },
    async ({ id }) => {
      try {
        const project = await apiGet<unknown>(`/api/v1/projects/${encodeURIComponent(id)}`);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(project, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, `get project ${id}`);
      }
    },
  );

  // ── compare_project_health ─────────────────────────────────────────────

  server.tool(
    'compare_project_health',
    'Compare health scores and maturity dimensions across multiple projects. ' +
    'Returns a comparison matrix with trends.',
    {
      project_ids: z
        .array(z.string())
        .optional()
        .describe('Optional list of project IDs to compare. Omit to compare all.'),
    },
    async ({ project_ids }) => {
      try {
        const comparison = await apiGet<Array<{ id: string }>>('/api/v1/projects/compare/health');
        const selected = project_ids?.length
          ? comparison.filter((project) => project_ids.includes(project.id))
          : comparison;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(selected, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'compare projects');
      }
    },
  );
}

/**
 * @module @recurrsive/mcp/tools/projects
 *
 * MCP tool definitions for project management operations.
 *
 * Provides these tools:
 * - `list_projects` — List all projects with health scores
 * - `get_project` — Get project details by ID
 * - `compare_project_health` — Compare health across projects
 * - `create_project` — Create a project on the server
 * - `trigger_server_analysis` — Run a server-side analysis of a project
 * - `get_analysis_status` — Poll the running/last analysis status
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
 * Register all project management tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerProjectTools(server: McpServer): void {
  // ── list_projects ──────────────────────────────────────────────────────

  server.tool(
    'list_projects',
    'List all projects with their health scores, language, framework, and ' +
    'last-analysis time.',
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
    'Get a project record: name, slug, description, repository, language, ' +
    'framework, health score, and last-analysis time. (For that project\'s ' +
    'findings/opportunities, use list_findings / get_opportunities scoped to it.)',
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
    'Compare current health scores across projects, ranked high-to-low, with ' +
    'the fleet average. (Point-in-time scores — this does not include trends.)',
    {
      project_ids: z
        .array(z.string())
        .optional()
        .describe('Optional list of project IDs to compare. Omit to compare all.'),
    },
    async ({ project_ids }) => {
      try {
        const comparison = await apiGet<{
          data: Array<{ id: string; [key: string]: unknown }>;
          total: number;
          avgHealth: number;
        }>('/api/v1/projects/compare/health');

        // The endpoint compares all projects; narrow to the requested ids here
        // when the caller passes a subset.
        const result = project_ids && project_ids.length > 0
          ? {
              ...comparison,
              data: comparison.data.filter((p) => project_ids.includes(p.id)),
            }
          : comparison;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'compare projects');
      }
    },
  );

  // ── create_project ─────────────────────────────────────────────────────
  server.tool(
    'create_project',
    'Create a new project on the Recurrsive server. Returns the project record ' +
    '(including its id) — pass that id to trigger_server_analysis to analyze it.',
    {
      name: z.string().describe('Human-readable project name'),
      repository: z.string().optional().describe('Git repository URL (used as the default analysis target)'),
      description: z.string().optional().describe('Optional project description'),
      language: z.string().optional().describe('Primary language, if known'),
    },
    async ({ name, repository, description, language }) => {
      try {
        const result = await apiRequest<unknown>('/api/v1/projects', {
          method: 'POST',
          body: JSON.stringify({
            name,
            ...(repository ? { repository } : {}),
            ...(description ? { description } : {}),
            ...(language ? { language } : {}),
          }),
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return apiErrorResult(error, 'create project');
      }
    },
  );

  // ── trigger_server_analysis ────────────────────────────────────────────
  server.tool(
    'trigger_server_analysis',
    'Run a full analysis ON THE RECURRSIVE SERVER for a project: the server ' +
    'clones the git repository, runs all analyzers, and persists findings, ' +
    'opportunities, health, and the knowledge graph under the given project id. ' +
    'This is asynchronous — poll get_analysis_status, then read results with the ' +
    'server-backed tools scoped to project_id. (Distinct from analyze_project, ' +
    'which runs a local in-process analysis on a filesystem path.)',
    {
      git_url: z.string().describe('Git repository URL to clone and analyze'),
      project_id: z.string().describe('Project id to store results under (scopes all downstream queries)'),
      include_reasoning: z
        .boolean()
        .optional()
        .describe('Also run the multi-specialist reasoning stage (slower, richer opportunities)'),
    },
    async ({ git_url, project_id, include_reasoning }) => {
      try {
        const result = await apiRequest<unknown>('/api/v1/analyze', {
          method: 'POST',
          body: JSON.stringify({
            gitUrl: git_url,
            projectId: project_id,
            ...(include_reasoning ? { include_reasoning: true } : {}),
          }),
        });
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return apiErrorResult(error, 'trigger server analysis');
      }
    },
  );

  // ── get_analysis_status ────────────────────────────────────────────────
  server.tool(
    'get_analysis_status',
    'Get the current server-side analysis status (phase, progress %, message). ' +
    'Poll this after trigger_server_analysis until phase is "complete" or "error".',
    {},
    async () => {
      try {
        const result = await apiGet<unknown>('/api/v1/analysis/status');
        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
      } catch (error) {
        return apiErrorResult(error, 'get analysis status');
      }
    },
  );
}

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

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const DEMO_PROJECTS = [
  {
    id: 'proj_001',
    name: 'recurrsive-core',
    description: 'Core analysis engine and knowledge graph',
    status: 'active',
    health_score: 87,
    last_analyzed: new Date(Date.now() - 3_600_000).toISOString(),
    entity_count: 1_243,
    opportunity_count: 12,
    repository: 'github.com/recurrsive/core',
    branch: 'main',
    created_at: '2025-09-15T10:00:00Z',
  },
  {
    id: 'proj_002',
    name: 'recurrsive-dashboard',
    description: 'Web dashboard for visualization and management',
    status: 'active',
    health_score: 74,
    last_analyzed: new Date(Date.now() - 7_200_000).toISOString(),
    entity_count: 856,
    opportunity_count: 19,
    repository: 'github.com/recurrsive/dashboard',
    branch: 'main',
    created_at: '2025-10-01T14:30:00Z',
  },
  {
    id: 'proj_003',
    name: 'recurrsive-api',
    description: 'REST and GraphQL API gateway',
    status: 'active',
    health_score: 91,
    last_analyzed: new Date(Date.now() - 1_800_000).toISOString(),
    entity_count: 432,
    opportunity_count: 5,
    repository: 'github.com/recurrsive/api',
    branch: 'main',
    created_at: '2025-11-12T09:00:00Z',
  },
  {
    id: 'proj_004',
    name: 'recurrsive-legacy-importer',
    description: 'Legacy codebase migration tooling',
    status: 'archived',
    health_score: 52,
    last_analyzed: new Date(Date.now() - 86_400_000 * 30).toISOString(),
    entity_count: 2_104,
    opportunity_count: 47,
    repository: 'github.com/recurrsive/legacy-importer',
    branch: 'main',
    created_at: '2025-06-20T08:00:00Z',
  },
  {
    id: 'proj_005',
    name: 'recurrsive-ml-pipeline',
    description: 'ML model training and inference pipeline',
    status: 'active',
    health_score: 68,
    last_analyzed: new Date(Date.now() - 14_400_000).toISOString(),
    entity_count: 615,
    opportunity_count: 23,
    repository: 'github.com/recurrsive/ml-pipeline',
    branch: 'develop',
    created_at: '2026-01-05T11:00:00Z',
  },
];

const DIMENSIONS = [
  { name: 'architecture', score: 85, level: 'managed' },
  { name: 'security', score: 92, level: 'optimizing' },
  { name: 'reliability', score: 78, level: 'managed' },
  { name: 'performance', score: 71, level: 'defined' },
  { name: 'testing', score: 88, level: 'managed' },
  { name: 'documentation', score: 64, level: 'defined' },
  { name: 'developer_experience', score: 80, level: 'managed' },
];

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
    'List all projects with their health scores, entity counts, and ' +
    'opportunity counts. Optionally filter by status (active/archived).',
    {
      status: z
        .string()
        .optional()
        .describe('Filter by project status: active, archived'),
    },
    async ({ status }) => {
      try {
        const filtered = status
          ? DEMO_PROJECTS.filter(p => p.status === status)
          : DEMO_PROJECTS;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { projects: filtered, total: filtered.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to list projects: ${message}` }],
          isError: true,
        };
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
        const project = DEMO_PROJECTS.find(p => p.id === id);
        if (!project) {
          return {
            content: [{ type: 'text' as const, text: `Project not found: ${id}` }],
            isError: true,
          };
        }

        const detail = {
          ...project,
          dimensions: DIMENSIONS,
          recent_findings: [
            { id: 'FND-3001', title: 'Unused dependency detected', severity: 'low', category: 'architecture' },
            { id: 'FND-3002', title: 'Missing error boundary', severity: 'medium', category: 'reliability' },
            { id: 'FND-3003', title: 'Hardcoded timeout value', severity: 'low', category: 'performance' },
          ],
          team_members: [
            { name: 'Alice Chen', role: 'lead', contributions: 142 },
            { name: 'Bob Martinez', role: 'contributor', contributions: 87 },
            { name: 'Carol Zhang', role: 'reviewer', contributions: 56 },
          ],
        };

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(detail, null, 2),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to get project: ${message}` }],
          isError: true,
        };
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
        const projects = project_ids
          ? DEMO_PROJECTS.filter(p => project_ids.includes(p.id))
          : DEMO_PROJECTS;

        const trends = ['improving', 'stable', 'declining', 'improving', 'stable'];

        const comparison = projects.map((p, i) => ({
          id: p.id,
          name: p.name,
          overall_health: p.health_score,
          trend: trends[i % trends.length],
          dimensions: {
            architecture: p.health_score + Math.floor(Math.random() * 10) - 5,
            security: p.health_score + Math.floor(Math.random() * 8),
            reliability: p.health_score - Math.floor(Math.random() * 6),
            testing: p.health_score + Math.floor(Math.random() * 5) - 2,
            documentation: p.health_score - Math.floor(Math.random() * 12),
          },
          entity_count: p.entity_count,
          opportunity_count: p.opportunity_count,
        }));

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { comparison, compared_at: new Date().toISOString() },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to compare projects: ${message}` }],
          isError: true,
        };
      }
    },
  );
}

/**
 * @module @recurrsive/mcp/tools/platform
 *
 * MCP tool definitions for platform management operations.
 *
 * Provides four tools:
 * - `list_plugins` — List installed plugins with status and hooks
 * - `list_tenants` — List tenants with tiers and quota usage
 * - `get_benchmarks` — Get cloud benchmarking data
 * - `list_secrets` — List secrets metadata (NEVER exposes values)
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const DEMO_PLUGINS = [
  {
    id: 'plg_001',
    name: 'github-integration',
    version: '3.2.1',
    description: 'GitHub repository sync, PR analysis, and webhook integration',
    status: 'enabled',
    author: 'Recurrsive Team',
    installed_at: '2026-02-10T09:00:00Z',
    hooks: ['analysis.pre', 'analysis.post', 'opportunity.created', 'webhook.github'],
    config_schema: { repo_pattern: 'string', auto_analyze: 'boolean', branch_filter: 'string[]' },
  },
  {
    id: 'plg_002',
    name: 'slack-notifications',
    version: '2.1.0',
    description: 'Slack alerts for critical findings, opportunities, and reports',
    status: 'enabled',
    author: 'Recurrsive Team',
    installed_at: '2026-03-05T14:30:00Z',
    hooks: ['opportunity.created', 'analysis.complete', 'alert.critical'],
    config_schema: { webhook_url: 'string', channel: 'string', mention_on_critical: 'boolean' },
  },
  {
    id: 'plg_003',
    name: 'jira-sync',
    version: '1.4.2',
    description: 'Bi-directional sync of opportunities with Jira issues',
    status: 'enabled',
    author: 'Community',
    installed_at: '2026-04-12T11:00:00Z',
    hooks: ['opportunity.created', 'opportunity.status_changed'],
    config_schema: { project_key: 'string', issue_type: 'string', auto_create: 'boolean' },
  },
  {
    id: 'plg_004',
    name: 'custom-analyzers',
    version: '1.0.0',
    description: 'User-defined custom analysis rules and patterns',
    status: 'disabled',
    author: 'Community',
    installed_at: '2026-05-20T16:00:00Z',
    hooks: ['analysis.pre', 'analysis.post'],
    config_schema: { rules_path: 'string', severity_override: 'string' },
  },
  {
    id: 'plg_005',
    name: 'datadog-exporter',
    version: '2.0.3',
    description: 'Export metrics and traces to Datadog APM',
    status: 'enabled',
    author: 'Recurrsive Team',
    installed_at: '2026-01-28T08:45:00Z',
    hooks: ['analysis.complete', 'metric.collected'],
    config_schema: { api_key_ref: 'string', site: 'string', tags: 'string[]' },
  },
];

const DEMO_TENANTS = [
  {
    id: 'tenant_001',
    name: 'Acme Corp',
    tier: 'enterprise',
    status: 'active',
    quota: {
      projects_max: 50, projects_used: 12,
      analyses_per_day_max: 200, analyses_per_day_used: 47,
      storage_gb_max: 500, storage_gb_used: 128.4,
    },
    created_at: '2025-08-01T00:00:00Z',
    last_active: new Date(Date.now() - 300_000).toISOString(),
  },
  {
    id: 'tenant_002',
    name: 'StartupXYZ',
    tier: 'pro',
    status: 'active',
    quota: {
      projects_max: 10, projects_used: 4,
      analyses_per_day_max: 50, analyses_per_day_used: 12,
      storage_gb_max: 50, storage_gb_used: 8.7,
    },
    created_at: '2026-01-15T00:00:00Z',
    last_active: new Date(Date.now() - 7_200_000).toISOString(),
  },
  {
    id: 'tenant_003',
    name: 'OpenSource Contributor',
    tier: 'free',
    status: 'active',
    quota: {
      projects_max: 3, projects_used: 2,
      analyses_per_day_max: 5, analyses_per_day_used: 1,
      storage_gb_max: 5, storage_gb_used: 1.2,
    },
    created_at: '2026-04-10T00:00:00Z',
    last_active: new Date(Date.now() - 86_400_000).toISOString(),
  },
  {
    id: 'tenant_004',
    name: 'MegaCorp Industries',
    tier: 'enterprise',
    status: 'active',
    quota: {
      projects_max: 100, projects_used: 67,
      analyses_per_day_max: 500, analyses_per_day_used: 234,
      storage_gb_max: 2000, storage_gb_used: 1_247.3,
    },
    created_at: '2025-06-01T00:00:00Z',
    last_active: new Date(Date.now() - 60_000).toISOString(),
  },
];

const DEMO_SECRETS = [
  {
    id: 'sec_001',
    name: 'RECURRSIVE_LLM_API_KEY',
    scope: 'global',
    created_at: '2025-10-01T00:00:00Z',
    last_rotated: '2026-06-01T00:00:00Z',
    rotation_policy: '90d',
    status: 'active',
    type: 'api_key',
  },
  {
    id: 'sec_002',
    name: 'GITHUB_APP_PRIVATE_KEY',
    scope: 'global',
    created_at: '2025-11-15T00:00:00Z',
    last_rotated: '2026-05-15T00:00:00Z',
    rotation_policy: '180d',
    status: 'active',
    type: 'certificate',
  },
  {
    id: 'sec_003',
    name: 'DATABASE_CONNECTION_TOKEN',
    scope: 'project',
    created_at: '2026-01-10T00:00:00Z',
    last_rotated: '2026-06-10T00:00:00Z',
    rotation_policy: '30d',
    status: 'active',
    type: 'token',
  },
  {
    id: 'sec_004',
    name: 'SLACK_WEBHOOK_SECRET',
    scope: 'global',
    created_at: '2026-03-01T00:00:00Z',
    last_rotated: '2026-03-01T00:00:00Z',
    rotation_policy: '365d',
    status: 'active',
    type: 'token',
  },
  {
    id: 'sec_005',
    name: 'LEGACY_SERVICE_PASSWORD',
    scope: 'project',
    created_at: '2025-07-01T00:00:00Z',
    last_rotated: '2025-12-01T00:00:00Z',
    rotation_policy: '90d',
    status: 'expired',
    type: 'password',
  },
];

// ---------------------------------------------------------------------------
// Tool Registration
// ---------------------------------------------------------------------------

/**
 * Register all platform management tools with the MCP server.
 *
 * @param server - The MCP server instance to register tools on.
 */
export function registerPlatformTools(server: McpServer): void {
  // ── list_plugins ───────────────────────────────────────────────────────

  server.tool(
    'list_plugins',
    'List all installed plugins with their status, hooks, and configuration ' +
    'schemas. Optionally filter by status (enabled/disabled).',
    {
      status: z
        .string()
        .optional()
        .describe('Filter by plugin status: enabled, disabled'),
    },
    async ({ status }) => {
      try {
        const filtered = status
          ? DEMO_PLUGINS.filter(p => p.status === status)
          : DEMO_PLUGINS;

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { plugins: filtered, total: filtered.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to list plugins: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── list_tenants ───────────────────────────────────────────────────────

  server.tool(
    'list_tenants',
    'List all tenants with their tier, status, and quota usage. Shows current ' +
    'resource utilization against allocated quotas.',
    {},
    async () => {
      try {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              { tenants: DEMO_TENANTS, total: DEMO_TENANTS.length },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to list tenants: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── get_benchmarks ─────────────────────────────────────────────────────

  server.tool(
    'get_benchmarks',
    'Get cloud benchmarking data comparing analysis performance across ' +
    'providers. Optionally filter by cloud provider (aws, gcp, azure).',
    {
      provider: z
        .string()
        .optional()
        .describe('Cloud provider filter: aws, gcp, azure'),
    },
    async ({ provider }) => {
      try {
        const allResults = [
          { metric: 'analysis_throughput', value: 1_247, unit: 'entities/sec', percentile: 92, baseline: 1_000, provider: 'aws' },
          { metric: 'graph_query_latency', value: 12.4, unit: 'ms', percentile: 88, baseline: 20, provider: 'aws' },
          { metric: 'reasoning_time', value: 3.2, unit: 'sec', percentile: 75, baseline: 5.0, provider: 'aws' },
          { metric: 'analysis_throughput', value: 1_389, unit: 'entities/sec', percentile: 95, baseline: 1_000, provider: 'gcp' },
          { metric: 'graph_query_latency', value: 9.8, unit: 'ms', percentile: 93, baseline: 20, provider: 'gcp' },
          { metric: 'reasoning_time', value: 2.8, unit: 'sec', percentile: 82, baseline: 5.0, provider: 'gcp' },
          { metric: 'analysis_throughput', value: 1_102, unit: 'entities/sec', percentile: 78, baseline: 1_000, provider: 'azure' },
          { metric: 'graph_query_latency', value: 15.1, unit: 'ms', percentile: 80, baseline: 20, provider: 'azure' },
          { metric: 'reasoning_time', value: 3.9, unit: 'sec', percentile: 68, baseline: 5.0, provider: 'azure' },
        ];

        const results = provider
          ? allResults.filter(r => r.provider === provider)
          : allResults;

        const result = {
          timestamp: new Date().toISOString(),
          provider: provider ?? 'all',
          results,
          summary: {
            overall_score: 85,
            top_performer: 'gcp',
            recommendations: [
              'GCP shows best throughput for analysis workloads.',
              'AWS provides most consistent latency across metrics.',
              'Consider multi-cloud strategy for resilience.',
            ],
          },
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to get benchmarks: ${message}` }],
          isError: true,
        };
      }
    },
  );

  // ── list_secrets ───────────────────────────────────────────────────────

  server.tool(
    'list_secrets',
    'List secrets metadata including name, scope, rotation policy, and status. ' +
    'IMPORTANT: This tool NEVER exposes secret values — only metadata is returned.',
    {},
    async () => {
      try {
        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(
              {
                _warning: 'Secret values are never exposed through this API. Only metadata is returned.',
                secrets: DEMO_SECRETS,
                total: DEMO_SECRETS.length,
              },
              null,
              2,
            ),
          }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Failed to list secrets: ${message}` }],
          isError: true,
        };
      }
    },
  );
}

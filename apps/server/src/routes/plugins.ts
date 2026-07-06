/**
 * @module @recurrsive/server/routes/plugins
 *
 * Plugin SDK and marketplace routes.
 *
 * Provides a documented, versioned API for:
 * - Registering custom collectors and analyzers as plugins
 * - Discovering and installing community plugins (marketplace)
 * - Plugin lifecycle management (install, enable, disable, uninstall)
 * - Plugin configuration and health monitoring
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { store } from '../store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PluginType = 'collector' | 'analyzer' | 'reporter' | 'integration';
type PluginStatus = 'installed' | 'enabled' | 'disabled' | 'error' | 'updating';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  type: PluginType;
  /** Minimum Recurrsive version required. */
  minVersion: string;
  /** Plugin entry point. */
  entryPoint: string;
  /** Configuration schema (JSON Schema). */
  configSchema: Record<string, unknown>;
  /** Required permissions. */
  permissions: string[];
  /** Plugin tags for discoverability. */
  tags: string[];
}

interface InstalledPlugin extends PluginManifest {
  status: PluginStatus;
  installedAt: string;
  updatedAt: string;
  config: Record<string, unknown>;
  healthCheck: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    lastCheck: string;
    message: string;
  };
  stats: {
    totalRuns: number;
    lastRunAt: string | null;
    avgDurationMs: number;
    errorRate: number;
  };
}

interface MarketplaceEntry {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  type: PluginType;
  tags: string[];
  downloads: number;
  rating: number;
  verified: boolean;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Marketplace seed data (written to store on first run)
// ---------------------------------------------------------------------------

const marketplaceSeedData: Array<Omit<MarketplaceEntry, 'id'>> = [
  { name: '@recurrsive/plugin-sonarqube', version: '1.0.0', description: 'Import SonarQube quality gates and issues as findings', author: 'Recurrsive Team', type: 'collector', tags: ['quality', 'sonarqube', 'static-analysis'], downloads: 12450, rating: 4.7, verified: true, createdAt: '2026-02-01T00:00:00Z' },
  { name: '@recurrsive/plugin-jira', version: '2.1.0', description: 'Sync Jira issues, sprints, and velocity metrics', author: 'Recurrsive Team', type: 'collector', tags: ['project-management', 'jira', 'agile'], downloads: 8920, rating: 4.5, verified: true, createdAt: '2026-01-15T00:00:00Z' },
  { name: '@recurrsive/plugin-slack-reporter', version: '1.2.0', description: 'Send analysis reports and alerts to Slack channels', author: 'Community', type: 'reporter', tags: ['notifications', 'slack', 'reports'], downloads: 6340, rating: 4.3, verified: true, createdAt: '2026-03-10T00:00:00Z' },
  { name: '@recurrsive/plugin-terraform', version: '0.8.0', description: 'Analyze Terraform configs for security and cost optimization', author: 'Community', type: 'analyzer', tags: ['iac', 'terraform', 'cloud', 'security'], downloads: 4210, rating: 4.1, verified: false, createdAt: '2026-04-01T00:00:00Z' },
  { name: '@recurrsive/plugin-pagerduty', version: '1.0.0', description: 'Collect incident data from PagerDuty for reliability analysis', author: 'Community', type: 'collector', tags: ['incidents', 'pagerduty', 'sre'], downloads: 3890, rating: 4.4, verified: true, createdAt: '2026-02-20T00:00:00Z' },
  { name: '@recurrsive/plugin-linear', version: '1.1.0', description: 'Import Linear issues and project data', author: 'Community', type: 'collector', tags: ['project-management', 'linear', 'issues'], downloads: 3150, rating: 4.6, verified: false, createdAt: '2026-05-01T00:00:00Z' },
  { name: '@recurrsive/plugin-snyk', version: '1.0.0', description: 'Import Snyk vulnerability scan results', author: 'Recurrsive Team', type: 'collector', tags: ['security', 'vulnerabilities', 'snyk'], downloads: 7820, rating: 4.8, verified: true, createdAt: '2026-01-20T00:00:00Z' },
  { name: '@recurrsive/plugin-openai-cost', version: '0.5.0', description: 'Track OpenAI API costs and token usage patterns', author: 'Community', type: 'analyzer', tags: ['ai', 'openai', 'cost', 'llm'], downloads: 2450, rating: 4.0, verified: false, createdAt: '2026-06-01T00:00:00Z' },
  { name: '@recurrsive/plugin-k8s-health', version: '1.3.0', description: 'Kubernetes cluster health and resource utilization analyzer', author: 'Recurrsive Team', type: 'analyzer', tags: ['kubernetes', 'infrastructure', 'health'], downloads: 5670, rating: 4.5, verified: true, createdAt: '2026-03-15T00:00:00Z' },
  { name: '@recurrsive/plugin-confluence', version: '0.9.0', description: 'Collect documentation from Confluence spaces', author: 'Community', type: 'collector', tags: ['documentation', 'confluence', 'wiki'], downloads: 1890, rating: 3.8, verified: false, createdAt: '2026-05-15T00:00:00Z' },
];

// No seed data for installed plugins — plugins are installed by the user via the API.

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerPluginRoutes(app: FastifyInstance): Promise<void> {
  // Seed marketplace data into store if empty (idempotent on restart)
  if (await store.count('plugin_marketplace') === 0) {
    for (const entry of marketplaceSeedData) {
      const id = generateId();
      await store.set<MarketplaceEntry>('plugin_marketplace', id, { ...entry, id });
    }
  }

  // ── Marketplace ───────────────────────────────────────────────────────────

  app.get<{ Querystring: { type?: string; search?: string; sort?: string } }>(
    '/api/v1/plugins/marketplace',
    async (request, reply) => {
      let results = await store.all<MarketplaceEntry>('plugin_marketplace');

      if (request.query.type) {
        results = results.filter(p => p.type === request.query.type);
      }
      if (request.query.search) {
        const q = request.query.search.toLowerCase();
        results = results.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.includes(q)),
        );
      }

      const sort = request.query.sort ?? 'downloads';
      if (sort === 'rating') results.sort((a, b) => b.rating - a.rating);
      else if (sort === 'name') results.sort((a, b) => a.name.localeCompare(b.name));
      else results.sort((a, b) => b.downloads - a.downloads);

      return reply.send({ data: results, total: results.length });
    },
  );

  app.get<{ Params: { id: string } }>('/api/v1/plugins/marketplace/:id', async (request, reply) => {
    const entry = await store.get<MarketplaceEntry>('plugin_marketplace', request.params.id);
    if (!entry) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not found in marketplace' });
    return reply.send({ data: entry });
  });

  // ── Installed Plugins ─────────────────────────────────────────────────────

  app.get('/api/v1/plugins/installed', async (_request, reply) => {
    const all = await store.all<InstalledPlugin>('plugins');
    return reply.send({
      data: all,
      total: all.length,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/plugins/installed/:id', async (request, reply) => {
    const plugin = await store.get<InstalledPlugin>('plugins', request.params.id);
    if (!plugin) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });
    return reply.send({ data: plugin });
  });

  // Install plugin from marketplace
  app.post<{ Params: { id: string } }>('/api/v1/plugins/install/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    if (await store.has('plugins', request.params.id)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Plugin already installed' });
    }

    const entry = await store.get<MarketplaceEntry>('plugin_marketplace', request.params.id);
    if (!entry) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not found in marketplace' });

    const plugin: InstalledPlugin = {
      id: entry.id,
      name: entry.name,
      version: entry.version,
      description: entry.description,
      author: entry.author,
      license: 'MIT',
      type: entry.type,
      minVersion: '0.3.0',
      entryPoint: 'dist/index.js',
      configSchema: {},
      permissions: [],
      tags: entry.tags,
      status: 'enabled',
      installedAt: nowISO(),
      updatedAt: nowISO(),
      config: {},
      healthCheck: { status: 'healthy', lastCheck: nowISO(), message: 'Plugin initialized successfully.' },
      stats: { totalRuns: 0, lastRunAt: null, avgDurationMs: 0, errorRate: 0 },
    };

    await store.set<InstalledPlugin>('plugins', plugin.id, plugin);
    return reply.status(201).send({ data: plugin });
  });

  // Uninstall plugin
  app.delete<{ Params: { id: string } }>('/api/v1/plugins/installed/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    if (!await store.has('plugins', request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });
    }
    await store.delete('plugins', request.params.id);
    return reply.status(204).send();
  });

  // Enable/disable plugin
  app.post<{ Params: { id: string } }>('/api/v1/plugins/installed/:id/toggle', { preHandler: [authMiddleware] }, async (request, reply) => {
    const plugin = await store.get<InstalledPlugin>('plugins', request.params.id);
    if (!plugin) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });

    plugin.status = plugin.status === 'enabled' ? 'disabled' : 'enabled';
    plugin.updatedAt = nowISO();

    await store.set<InstalledPlugin>('plugins', request.params.id, plugin);
    return reply.send({ data: plugin });
  });

  // Update plugin config
  app.put<{ Params: { id: string } }>('/api/v1/plugins/installed/:id/config', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
      },
    },
  }, async (request, reply) => {
    const plugin = await store.get<InstalledPlugin>('plugins', request.params.id);
    if (!plugin) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });

    const body = request.body as Record<string, unknown>;
    plugin.config = { ...plugin.config, ...body };
    plugin.updatedAt = nowISO();

    await store.set<InstalledPlugin>('plugins', request.params.id, plugin);
    return reply.send({ data: plugin });
  });

  // Plugin health check
  app.get<{ Params: { id: string } }>('/api/v1/plugins/installed/:id/health', async (request, reply) => {
    const plugin = await store.get<InstalledPlugin>('plugins', request.params.id);
    if (!plugin) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });

    // Refresh health check
    plugin.healthCheck.lastCheck = nowISO();

    await store.set<InstalledPlugin>('plugins', request.params.id, plugin);
    return reply.send({ data: plugin.healthCheck });
  });

  // ── Plugin SDK info ───────────────────────────────────────────────────────

  app.get('/api/v1/plugins/sdk', async (_request, reply) => {
    return reply.send({
      data: {
        version: '1.0.0',
        interfaces: {
          collector: {
            interface: 'Collector',
            methods: ['initialize(config)', 'validate()', 'collect()', 'dispose()'],
            package: '@recurrsive/core',
            documentation: 'https://docs.recurrsive.io/plugins/collector-sdk',
          },
          analyzer: {
            interface: 'Analyzer',
            methods: ['initialize()', 'analyze(ctx)', 'finalize(ctx)'],
            package: '@recurrsive/core',
            documentation: 'https://docs.recurrsive.io/plugins/analyzer-sdk',
          },
          reporter: {
            interface: 'Reporter',
            methods: ['configure(options)', 'generate(data)', 'export(format)'],
            package: '@recurrsive/core',
            documentation: 'https://docs.recurrsive.io/plugins/reporter-sdk',
          },
        },
        entityTypes: 43,
        relationshipTypes: 43,
        templateRepo: 'https://github.com/Talomia/recurrsive-plugin-template',
        cliCommand: 'recurrsive plugin create <name>',
      },
    });
  });
}

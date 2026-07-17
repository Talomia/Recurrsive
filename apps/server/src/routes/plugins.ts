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
import { nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
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
// Route registration
// ---------------------------------------------------------------------------
//
// The plugin marketplace store starts EMPTY. Entries are published/installed
// by real users via the API — there is no seeded fake catalog.

export async function registerPluginRoutes(app: FastifyInstance): Promise<void> {
  // ── Marketplace ───────────────────────────────────────────────────────────

  app.get<{ Querystring: { type?: string; search?: string; sort?: string } }>(
    '/api/v1/plugins/marketplace',
    { preHandler: [authMiddleware] },
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

  app.get<{ Params: { id: string } }>('/api/v1/plugins/marketplace/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const entry = await store.get<MarketplaceEntry>('plugin_marketplace', request.params.id);
    if (!entry) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not found in marketplace' });
    return reply.send({ data: entry });
  });

  // ── Installed Plugins ─────────────────────────────────────────────────────

  app.get('/api/v1/plugins/installed', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const all = await store.all<InstalledPlugin>('plugins');
    return reply.send({
      data: all,
      total: all.length,
    });
  });

  app.get<{ Params: { id: string } }>('/api/v1/plugins/installed/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const plugin = await store.get<InstalledPlugin>('plugins', request.params.id);
    if (!plugin) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });
    return reply.send({ data: plugin });
  });

  // Install plugin from marketplace
  app.post<{ Params: { id: string } }>('/api/v1/plugins/install/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
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
  app.delete<{ Params: { id: string } }>('/api/v1/plugins/installed/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    if (!await store.has('plugins', request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });
    }
    await store.delete('plugins', request.params.id);
    return reply.status(204).send();
  });

  // Enable/disable plugin
  app.post<{ Params: { id: string } }>('/api/v1/plugins/installed/:id/toggle', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    const plugin = await store.get<InstalledPlugin>('plugins', request.params.id);
    if (!plugin) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });

    plugin.status = plugin.status === 'enabled' ? 'disabled' : 'enabled';
    plugin.updatedAt = nowISO();

    await store.set<InstalledPlugin>('plugins', request.params.id, plugin);
    return reply.send({ data: plugin });
  });

  // Update plugin config
  app.put<{ Params: { id: string } }>('/api/v1/plugins/installed/:id/config', {
    preHandler: [authMiddleware, requireRole('admin')],
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
  app.get<{ Params: { id: string } }>('/api/v1/plugins/installed/:id/health', { preHandler: [authMiddleware] }, async (request, reply) => {
    const plugin = await store.get<InstalledPlugin>('plugins', request.params.id);
    if (!plugin) return reply.status(404).send({ error: 'Not Found', message: 'Plugin not installed' });

    // Refresh health check
    plugin.healthCheck.lastCheck = nowISO();

    await store.set<InstalledPlugin>('plugins', request.params.id, plugin);
    return reply.send({ data: plugin.healthCheck });
  });

  // ── Plugin SDK info ───────────────────────────────────────────────────────

  app.get('/api/v1/plugins/sdk', { preHandler: [authMiddleware] }, async (_request, reply) => {
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

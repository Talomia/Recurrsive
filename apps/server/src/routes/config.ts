/** Effective runtime and project configuration routes. */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { requireProjectScope } from '../project-analysis.js';
import { store } from '../store.js';

export interface PlatformSettings {
  /** Default for optional reasoning when a caller does not choose explicitly. */
  enable_reasoning: boolean;
}

const DEFAULT_SETTINGS: PlatformSettings = { enable_reasoning: true };

export async function getPlatformSettings(): Promise<PlatformSettings> {
  return { ...DEFAULT_SETTINGS, ...(await store.get<Partial<PlatformSettings>>('platform_settings', 'default') ?? {}) };
}

export async function registerConfigRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/config', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const settings = await getPlatformSettings();
    return reply.send({
      data: {
        project: {
          id: project.id,
          name: project.name,
          root: project.repository,
          language: project.language,
        },
        graph: { provider: process.env['GRAPH_PROVIDER'] ?? 'sqlite', isolatedByProject: true },
        analysis: {
          analyzers: project.settings.analyzers,
          collectors: project.settings.collectors,
          defaultIncludeReasoning: settings.enable_reasoning,
          serializedWorker: true,
        },
        report: { formats: ['markdown', 'html', 'json', 'sarif'] },
      },
    });
  });

  app.patch('/api/v1/config', {
    preHandler: [authMiddleware, requireRole('admin')],
    schema: {
      body: {
        type: 'object',
        required: ['enable_reasoning'],
        properties: { enable_reasoning: { type: 'boolean' } },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const settings = request.body as PlatformSettings;
    await store.set('platform_settings', 'default', settings);
    return reply.send({ data: settings, message: 'Platform defaults updated.' });
  });

  app.get('/api/v1/config/features', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    return reply.send({
      data: {
        analyzers: project.settings.analyzers.map((id) => ({ id, enabled: true })),
        collectors: project.settings.collectors.map((id) => ({ id, enabled: true })),
        summary: {
          enabled_analyzers: project.settings.analyzers.length,
          enabled_collectors: project.settings.collectors.length,
        },
      },
    });
  });

  app.get('/api/v1/settings/sections', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({
      data: [{
        icon: 'Shield',
        title: 'Analysis defaults',
        description: 'Defaults used when an analysis request does not make an explicit choice.',
        settings: [{ label: 'Include reasoning', key: 'enable_reasoning', type: 'toggle', defaultValue: true }],
      }],
    });
  });

  app.get('/api/v1/settings', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({ data: await getPlatformSettings() });
  });

  app.get('/api/v1/settings/preferences', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const settings = await getPlatformSettings();
    return reply.send({ data: { analysis: settings } });
  });
}

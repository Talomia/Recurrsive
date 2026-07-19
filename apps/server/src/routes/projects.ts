/**
 * @module @recurrsive/server/routes/projects
 *
 * Multi-project support routes.
 *
 * Provides CRUD operations for managing multiple projects within
 * a single Recurrsive instance. Each project has its own analysis
 * context, findings, and opportunities.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  repository: string;
  language: string;
  framework: string;
  /**
   * Health score from the most recent analysis, or null when the project has
   * never been analyzed. Never a placeholder 0 — that would read as a real
   * (terrible) score.
   */
  healthScore: number | null;
  lastAnalysis: string | null;
  createdAt: string;
  updatedAt: string;
  settings: {
    analyzers: string[];
    collectors: string[];
    autoAnalyze: boolean;
    notifyOnCritical: boolean;
  };
}

// No seed data — projects are created by the user via the API.

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  // List all projects
  app.get('/api/v1/projects', { preHandler: [authMiddleware] }, async (_request, reply) => {
    try {
      const list = (await store.all<Project>('projects'))
        .sort((a, b) => a.name.localeCompare(b.name));

      return reply.status(200).send({
        data: list,
        total: list.length,
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to list projects.' });
    }
  });

  // ── Static sub-paths MUST be registered BEFORE the parametric `:id` route ──
  // Fastify matches parametric routes first if registered first, so
  // `/api/v1/projects/compare/health` would match `:id = "compare"` if
  // `:id` is registered before the static path.

  // Get project health comparison (across all projects)
  app.get('/api/v1/projects/compare/health', { preHandler: [authMiddleware] }, async (_request, reply) => {
    try {
      const comparison = (await store.all<Project>('projects')).map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        healthScore: p.healthScore ?? null,
        // Surface WHY a score is missing instead of a silent null/zero.
        analysisStatus: typeof p.healthScore === 'number' ? 'analyzed' as const : 'not_analyzed' as const,
        language: p.language,
        framework: p.framework,
        lastAnalysis: p.lastAnalysis,
      }));

      // Only analyzed projects participate in ranking math and the average —
      // folding unanalyzed projects in as zeros would fabricate both.
      const analyzed = comparison.filter(c => typeof c.healthScore === 'number');
      const ranked = [
        ...analyzed.sort((a, b) => (b.healthScore as number) - (a.healthScore as number)),
        ...comparison.filter(c => c.healthScore === null),
      ];

      return reply.status(200).send({
        data: ranked,
        total: comparison.length,
        analyzedCount: analyzed.length,
        avgHealth: analyzed.length > 0
          ? Math.round(analyzed.reduce((s, p) => s + (p.healthScore as number), 0) / analyzed.length)
          : null,
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to compare projects.' });
    }
  });

  // Get single project — registered AFTER static sub-paths
  app.get<{ Params: { id: string } }>('/api/v1/projects/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const project = await store.get<Project>('projects', request.params.id);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }
      return reply.status(200).send({ data: project });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to get project.' });
    }
  });

  // Get findings for a specific project
  app.get<{ Params: { id: string } }>('/api/v1/projects/:id/findings', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const project = await store.get<Project>('projects', request.params.id);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      let cache = await store.get<any>('analysis_cache', project.id);
      if (!cache) {
        cache = await store.get<any>('analysis_cache', project.repository);
      }

      return reply.status(200).send({
        data: cache?.findings ?? [],
        total: cache?.findings?.length ?? 0,
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to get project findings.' });
    }
  });

  // Get opportunities for a specific project
  app.get<{ Params: { id: string } }>('/api/v1/projects/:id/opportunities', { preHandler: [authMiddleware] }, async (request, reply) => {
    try {
      const project = await store.get<Project>('projects', request.params.id);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      let cache = await store.get<any>('analysis_cache', project.id);
      if (!cache) {
        cache = await store.get<any>('analysis_cache', project.repository);
      }

      return reply.status(200).send({
        data: cache?.opportunities ?? [],
        total: cache?.opportunities?.length ?? 0,
      });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to get project opportunities.' });
    }
  });


  // Create project
  app.post('/api/v1/projects', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          repository: { type: 'string', minLength: 1 },
          gitUrl: { type: 'string', minLength: 1 },
          slug: { type: 'string' },
          description: { type: 'string' },
          language: { type: 'string' },
          framework: { type: 'string' },
          settings: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<Project> & { gitUrl?: string };
      const repository = body.repository ?? body.gitUrl;

      if (!body.name || !repository) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'name and repository (or gitUrl) are required',
        });
      }

      const id = generateId();
      const now = nowISO();
      const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

      const project: Project = {
        id,
        name: body.name,
        slug,
        description: body.description ?? '',
        repository: repository,
        language: body.language ?? 'Unknown',
        framework: body.framework ?? 'Unknown',
        // Not analyzed yet — null, not a fake score of 0.
        healthScore: null,
        lastAnalysis: null,
        createdAt: now,
        updatedAt: now,
        settings: body.settings ?? {
          analyzers: ['architecture', 'ai', 'performance', 'security', 'reliability'],
          collectors: ['git'],
          autoAnalyze: false,
          notifyOnCritical: true,
        },
      };

      await store.set('projects', id, project);
      return reply.status(201).send({ data: project });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create project.' });
    }
  });

  // Update project
  app.put<{ Params: { id: string } }>('/api/v1/projects/:id', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          slug: { type: 'string' },
          description: { type: 'string' },
          repository: { type: 'string' },
          language: { type: 'string' },
          framework: { type: 'string' },
          settings: { type: 'object' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    try {
      const project = await store.get<Project>('projects', request.params.id);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }

      const body = request.body as Partial<Project>;
      const updated: Project = {
        ...project,
        name: body.name ?? project.name,
        slug: body.slug ?? project.slug,
        description: body.description ?? project.description,
        repository: body.repository ?? project.repository,
        language: body.language ?? project.language,
        framework: body.framework ?? project.framework,
        settings: body.settings ?? project.settings,
        updatedAt: nowISO(),
      };

      await store.set('projects', updated.id, updated);
      return reply.status(200).send({ data: updated });
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update project.' });
    }
  });

  // Delete project
  app.delete<{ Params: { id: string } }>('/api/v1/projects/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    try {
      if (!await store.has('projects', request.params.id)) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }
      await store.delete('projects', request.params.id);
      return reply.status(204).send();
    } catch (err) {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete project.' });
    }
  });
}

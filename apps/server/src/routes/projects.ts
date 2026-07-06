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
  healthScore: number;
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
    const list = (await store.all<Project>('projects'))
      .sort((a, b) => a.name.localeCompare(b.name));

    return reply.send({
      data: list,
      total: list.length,
    });
  });

  // Get single project
  app.get<{ Params: { id: string } }>('/api/v1/projects/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await store.get<Project>('projects', request.params.id);
    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }
    return reply.send({ data: project });
  });

  // Create project
  app.post('/api/v1/projects', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'repository'],
        properties: {
          name: { type: 'string', minLength: 1 },
          repository: { type: 'string', minLength: 1 },
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
    const body = request.body as Partial<Project>;
    if (!body.name || !body.repository) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and repository are required' });
    }

    const id = generateId();
    const now = nowISO();
    const slug = body.slug ?? body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const project: Project = {
      id,
      name: body.name,
      slug,
      description: body.description ?? '',
      repository: body.repository,
      language: body.language ?? 'Unknown',
      framework: body.framework ?? 'Unknown',
      healthScore: 0,
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
  });

  // Update project
  app.put<{ Params: { id: string } }>('/api/v1/projects/:id', {
    preHandler: [authMiddleware],
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
    return reply.send({ data: updated });
  });

  // Delete project
  app.delete<{ Params: { id: string } }>('/api/v1/projects/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    if (!await store.has('projects', request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }
    await store.delete('projects', request.params.id);
    return reply.status(204).send();
  });

  // Get project health comparison (across all projects)
  app.get('/api/v1/projects/compare/health', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const comparison = (await store.all<Project>('projects')).map(p => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      healthScore: p.healthScore,
      language: p.language,
      framework: p.framework,
      lastAnalysis: p.lastAnalysis,
    }));

    return reply.send({
      data: comparison.sort((a, b) => b.healthScore - a.healthScore),
      total: comparison.length,
      avgHealth: comparison.length > 0
        ? Math.round(comparison.reduce((s, p) => s + p.healthScore, 0) / comparison.length)
        : 0,
    });
  });
}

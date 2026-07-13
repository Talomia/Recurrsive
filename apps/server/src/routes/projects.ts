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
import path from 'node:path';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { store } from '../store.js';
import type { AnalysisCache } from '../state.js';
import { state } from '../state.js';
import { deleteProjectGraph } from '../project-graph.js';
import { requireRole } from '../middleware/rbac.js';
import { isScheduleRunActive } from './scheduling.js';

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
  };
}

const ANALYZER_IDS = [
  'architecture.structural', 'ai.quality', 'performance.general', 'cost.optimization',
  'reliability.resilience', 'security.vulnerabilities', 'data.schema-quality',
  'docs.completeness', 'ux.quality', 'product.health', 'dependency.vulnerabilities',
  'api-contract.quality', 'ai.runtime',
] as const;
const COLLECTOR_IDS = ['git', 'documentation', 'environment', 'cicd', 'database'] as const;

function validSettings(settings: Project['settings']): string | null {
  if (!settings.analyzers.length) return 'At least one analyzer must be enabled.';
  if (!settings.collectors.includes('git')) return 'The git collector is required for source analysis.';
  const badAnalyzers = settings.analyzers.filter((id) => !(ANALYZER_IDS as readonly string[]).includes(id));
  const badCollectors = settings.collectors.filter((id) => !(COLLECTOR_IDS as readonly string[]).includes(id));
  if (badAnalyzers.length) return `Unknown analyzers: ${badAnalyzers.join(', ')}`;
  if (badCollectors.length) return `Unknown collectors: ${badCollectors.join(', ')}`;
  return null;
}

function validRepository(repository: string): string | null {
  if (/^http:\/\//i.test(repository)) return 'Repository URLs must use HTTPS.';
  if (/^https:\/\//i.test(repository)) {
    try {
      const url = new URL(repository);
      if (url.protocol !== 'https:') return 'Repository URLs must use HTTPS.';
      if (url.username || url.password) return 'Repository credentials must not be embedded in the URL.';
      const configuredHosts = process.env['RECURRSIVE_ALLOWED_GIT_HOSTS']
        ?.split(',').map((host) => host.trim().toLowerCase()).filter(Boolean);
      const allowedHosts = configuredHosts?.length ? configuredHosts : ['github.com', 'gitlab.com', 'bitbucket.org'];
      return allowedHosts.includes(url.hostname.toLowerCase())
        ? null
        : `Git host "${url.hostname}" is not allowed.`;
    } catch {
      return 'Repository URL is invalid.';
    }
  }
  if (!path.isAbsolute(repository)) return 'Local repositories must use an absolute path.';
  const configuredPaths = process.env['RECURRSIVE_ALLOWED_PATHS']
    ?.split(',').map((prefix) => prefix.trim()).filter(Boolean);
  const allowedPaths = configuredPaths?.length ? configuredPaths : ['/app', '/tmp/recurrsive-repos'];
  const resolved = path.resolve(repository);
  return allowedPaths.some((prefix) => {
    const allowed = path.resolve(prefix);
    return resolved === allowed || resolved.startsWith(`${allowed}${path.sep}`);
  }) ? null : 'Local repository is outside RECURRSIVE_ALLOWED_PATHS.';
}

async function conflictingProject(slug: string, repository: string, excludeId?: string): Promise<Project | null> {
  return (await store.all<Project>('projects')).find((project) =>
    project.id !== excludeId && (project.slug === slug || project.repository === repository),
  ) ?? null;
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
    } catch {
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
        healthScore: p.healthScore,
        language: p.language,
        framework: p.framework,
        lastAnalysis: p.lastAnalysis,
      }));

      return reply.status(200).send({
        data: comparison.sort((a, b) => b.healthScore - a.healthScore),
        total: comparison.length,
        avgHealth: comparison.length > 0
          ? Math.round(comparison.reduce((s, p) => s + p.healthScore, 0) / comparison.length)
          : 0,
      });
    } catch {
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
    } catch {
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

      const cache = await store.get<AnalysisCache>('analysis_cache', project.id);

      return reply.status(200).send({
        data: cache?.findings ?? [],
        total: cache?.findings?.length ?? 0,
      });
    } catch {
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

      const cache = await store.get<AnalysisCache>('analysis_cache', project.id);

      return reply.status(200).send({
        data: cache?.opportunities ?? [],
        total: cache?.opportunities?.length ?? 0,
      });
    } catch {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to get project opportunities.' });
    }
  });


  // Create project
  app.post('/api/v1/projects', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          repository: { type: 'string', minLength: 1, maxLength: 2048 },
          gitUrl: { type: 'string', minLength: 1, maxLength: 2048 },
          slug: { type: 'string', maxLength: 120 },
          description: { type: 'string', maxLength: 4000 },
          language: { type: 'string', maxLength: 80 },
          framework: { type: 'string', maxLength: 80 },
          settings: {
            type: 'object',
            required: ['analyzers', 'collectors'],
            properties: {
              analyzers: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: [...ANALYZER_IDS] } },
              collectors: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: [...COLLECTOR_IDS] } },
            },
            additionalProperties: false,
          },
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
      const name = body.name.trim();
      if (!name) return reply.status(400).send({ error: 'Bad Request', message: 'Project name cannot be blank.' });
      const slug = body.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Slug must contain lowercase letters, numbers, and single hyphens.' });
      }
      const repositoryError = validRepository(repository);
      if (repositoryError) return reply.status(400).send({ error: 'Bad Request', message: repositoryError });
      const conflict = await conflictingProject(slug, repository);
      if (conflict) {
        return reply.status(409).send({
          error: 'Conflict',
          message: conflict.slug === slug ? 'A project with this slug already exists.' : 'This repository is already registered.',
        });
      }

      const project: Project = {
        id,
        name,
        slug,
        description: body.description ?? '',
        repository: repository,
        language: body.language ?? 'Unknown',
        framework: body.framework ?? 'Unknown',
        healthScore: 0,
        lastAnalysis: null,
        createdAt: now,
        updatedAt: now,
        settings: body.settings ?? {
          analyzers: [...ANALYZER_IDS],
          collectors: [...COLLECTOR_IDS],
        },
      };

      const settingsError = validSettings(project.settings);
      if (settingsError) return reply.status(400).send({ error: 'Bad Request', message: settingsError });

      await store.set('projects', id, project);
      return reply.status(201).send({ data: project });
    } catch {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to create project.' });
    }
  });

  // Update project
  app.put<{ Params: { id: string } }>('/api/v1/projects/:id', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          slug: { type: 'string', maxLength: 120 },
          description: { type: 'string', maxLength: 4000 },
          repository: { type: 'string', maxLength: 2048 },
          language: { type: 'string', maxLength: 80 },
          framework: { type: 'string', maxLength: 80 },
          settings: {
            type: 'object',
            properties: {
              analyzers: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: [...ANALYZER_IDS] } },
              collectors: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string', enum: [...COLLECTOR_IDS] } },
            },
            additionalProperties: false,
          },
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
      if (body.name !== undefined && !body.name.trim()) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Project name cannot be blank.' });
      }
      const updated: Project = {
        ...project,
        name: body.name?.trim() ?? project.name,
        slug: body.slug ?? project.slug,
        description: body.description ?? project.description,
        repository: body.repository ?? project.repository,
        language: body.language ?? project.language,
        framework: body.framework ?? project.framework,
        settings: body.settings ? { ...project.settings, ...body.settings } : project.settings,
        updatedAt: nowISO(),
      };

      const settingsError = validSettings(updated.settings);
      if (settingsError) return reply.status(400).send({ error: 'Bad Request', message: settingsError });
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(updated.slug)) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Slug must contain lowercase letters, numbers, and single hyphens.' });
      }
      const repositoryError = validRepository(updated.repository);
      if (repositoryError) return reply.status(400).send({ error: 'Bad Request', message: repositoryError });
      const conflict = await conflictingProject(updated.slug, updated.repository, updated.id);
      if (conflict) {
        return reply.status(409).send({
          error: 'Conflict',
          message: conflict.slug === updated.slug ? 'A project with this slug already exists.' : 'This repository is already registered.',
        });
      }

      await store.set('projects', updated.id, updated);
      return reply.status(200).send({ data: updated });
    } catch {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to update project.' });
    }
  });

  // Delete project
  app.delete<{ Params: { id: string } }>('/api/v1/projects/:id', { preHandler: [authMiddleware, requireRole('admin')] }, async (request, reply) => {
    try {
      const project = await store.get<Project>('projects', request.params.id);
      if (!project) {
        return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
      }
      const scheduleEntries = (await store.entries<{ projectId?: string }>('schedules'))
        .filter(([, value]) => value.projectId === project.id);
      const runEntries = (await store.entries<{ projectId?: string }>('schedule_runs'))
        .filter(([, value]) => value.projectId === project.id);
      const exportEntries = (await store.entries<{ projectId?: string }>('exports'))
        .filter(([, value]) => value.projectId === project.id);
      const experimentEntries = (await store.entries<{ projectId?: string; status?: string }>('experiments'))
        .filter(([, value]) => value.projectId === project.id);
      const batchEntries = (await store.entries<{ status?: string; projects?: Array<{ projectId?: string }> }>('batches'))
        .filter(([, value]) => value.projects?.some((entry) => entry.projectId === project.id));
      const analysisStatus = state.getAnalysisStatus();
      const analysisActive = analysisStatus.projectId === project.id &&
        ['collecting', 'parsing', 'analyzing', 'reasoning'].includes(analysisStatus.phase);
      const backgroundActive = experimentEntries.some(([, value]) => value.status === 'running') ||
        batchEntries.some(([, value]) => value.status === 'pending' || value.status === 'running') ||
        scheduleEntries.some(([id]) => isScheduleRunActive(id));
      if (analysisActive || backgroundActive) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Wait for active analysis, batch, experiment, and scheduled-report work to finish before deleting this project.',
        });
      }
      if (state.getProjectId() === project.id) await state.dispose();

      await deleteProjectGraph(project.id);
      await Promise.all([
        ...['analysis_cache', 'analysis_history', 'analysis_status', 'finding_states'].map((table) => store.delete(table, project.id)),
        ...scheduleEntries.map(([id]) => store.delete('schedules', id)),
        ...runEntries.flatMap(([id]) => [store.delete('schedule_runs', id), store.delete('report_artifacts', id)]),
        ...exportEntries.map(([id]) => store.delete('exports', id)),
        ...experimentEntries.map(([id]) => store.delete('experiments', id)),
        ...batchEntries.map(([id]) => store.delete('batches', id)),
      ]);
      await store.delete('projects', project.id);
      return reply.status(204).send();
    } catch {
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to delete project.' });
    }
  });
}

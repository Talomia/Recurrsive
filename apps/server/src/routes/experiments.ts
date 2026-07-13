/** Project-scoped, isolated analyzer configuration experiments. */

import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { createLogger, generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { requireProjectScope } from '../project-analysis.js';
import { store } from '../store.js';
import { state, type AnalysisCache } from '../state.js';
import { calculateHealthScore } from '../analysis-metrics.js';
import { deleteProjectGraph } from '../project-graph.js';
import { releaseAnalysisWorker, tryAcquireAnalysisWorker } from '../analysis-coordinator.js';

const logger = createLogger({ context: { component: 'server:routes:experiments' } });

interface ExperimentVariant {
  name: string;
  analyzers: string[];
  collectors: string[];
  includeReasoning: boolean;
}

interface VariantResult {
  name: string;
  findingCount: number;
  opportunityCount: number;
  criticalFindingCount: number;
  healthScore: number;
  durationMs: number;
  analyzedAt: string;
}

interface ExperimentMetric {
  name: 'health_score' | 'findings' | 'critical_findings' | 'opportunities' | 'duration_ms';
  variant_a: number;
  variant_b: number;
  difference: number;
  improvement_percent: number | null;
  preferred: 'a' | 'b' | 'tie';
}

export interface Experiment {
  id: string;
  projectId: string;
  name: string;
  description: string;
  hypothesis: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  variants: [ExperimentVariant, ExperimentVariant];
  results: VariantResult[];
  metrics: ExperimentMetric[];
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  conclusion: string | null;
}

interface ProjectRecord {
  id: string;
  name: string;
  repository: string;
  settings: { analyzers: string[]; collectors: string[] };
}

const allowedPrefixes = (process.env['RECURRSIVE_ALLOWED_PATHS']?.split(',').map((value) => value.trim()).filter(Boolean))
  ?? ['/app', '/tmp/recurrsive-repos/'];

function safeLocalPath(repository: string): boolean {
  const resolved = path.resolve(repository);
  return allowedPrefixes.some((prefix) => resolved === path.resolve(prefix) || resolved.startsWith(`${path.resolve(prefix)}${path.sep}`));
}

function preferred(metric: ExperimentMetric['name'], a: number, b: number): ExperimentMetric['preferred'] {
  if (a === b) return 'tie';
  const lowerIsBetter = metric === 'findings' || metric === 'critical_findings' || metric === 'duration_ms';
  return lowerIsBetter ? (a < b ? 'a' : 'b') : (a > b ? 'a' : 'b');
}

function compareResults(a: VariantResult, b: VariantResult): ExperimentMetric[] {
  const values: Array<[ExperimentMetric['name'], number, number]> = [
    ['health_score', a.healthScore, b.healthScore],
    ['findings', a.findingCount, b.findingCount],
    ['critical_findings', a.criticalFindingCount, b.criticalFindingCount],
    ['opportunities', a.opportunityCount, b.opportunityCount],
    ['duration_ms', a.durationMs, b.durationMs],
  ];
  return values.map(([name, variantA, variantB]) => ({
    name,
    variant_a: variantA,
    variant_b: variantB,
    difference: variantB - variantA,
    improvement_percent: variantA === 0 ? null : Math.round(((variantB - variantA) / Math.abs(variantA)) * 10_000) / 100,
    preferred: preferred(name, variantA, variantB),
  }));
}

function resultFor(name: string, cache: AnalysisCache): VariantResult {
  return {
    name,
    findingCount: cache.findings.length,
    opportunityCount: cache.opportunities.length,
    criticalFindingCount: cache.findings.filter((finding) => finding.severity === 'critical').length,
    healthScore: calculateHealthScore(cache).overall,
    durationMs: cache.durationMs,
    analyzedAt: cache.analyzedAt,
  };
}

async function cleanupExperimentRun(projectId: string): Promise<void> {
  if (state.getProjectId() === projectId) await state.dispose();
  await deleteProjectGraph(projectId);
  await Promise.all([
    store.delete('analysis_cache', projectId),
    store.delete('analysis_history', projectId),
    store.delete('analysis_status', projectId),
    store.delete('finding_states', projectId),
  ]);
}

async function runExperiment(experimentId: string, project: ProjectRecord): Promise<void> {
  const experiment = await store.get<Experiment>('experiments', experimentId);
  if (!experiment) {
    releaseAnalysisWorker(experimentId);
    return;
  }

  experiment.status = 'running';
  experiment.startedAt = nowISO();
  experiment.error = null;
  await store.set('experiments', experiment.id, experiment);

  let clonedPath: string | null = null;
  try {
    let repositoryPath = project.repository;
    if (/^https:\/\//i.test(project.repository)) {
      clonedPath = await state.cloneRepo(project.repository);
      repositoryPath = clonedPath;
    } else if (!safeLocalPath(project.repository)) {
      throw new Error(`Repository path is outside RECURRSIVE_ALLOWED_PATHS.`);
    }

    const results: VariantResult[] = [];
    for (let index = 0; index < experiment.variants.length; index++) {
      const variant = experiment.variants[index]!;
      const isolatedProjectId = `experiment:${experiment.id}:${index}`;
      try {
        if (state.isInitialized()) await state.dispose();
        await state.initialize(repositoryPath, `${project.name} — ${variant.name}`, isolatedProjectId);
        const cache = await state.runAnalysis(variant.analyzers, variant.includeReasoning, variant.collectors);
        results.push(resultFor(variant.name, cache));
      } finally {
        await cleanupExperimentRun(isolatedProjectId);
      }
    }

    const current = await store.get<Experiment>('experiments', experiment.id);
    if (!current) return;
    current.results = results;
    current.metrics = compareResults(results[0]!, results[1]!);
    current.status = 'completed';
    current.completedAt = nowISO();
    current.conclusion = current.metrics
      .map((metric) => `${metric.name}: ${metric.preferred === 'tie' ? 'tie' : `${metric.preferred === 'a' ? current.variants[0].name : current.variants[1].name} preferred`}`)
      .join('; ');
    await store.set('experiments', current.id, current);
  } catch (error) {
    const current = await store.get<Experiment>('experiments', experiment.id);
    if (current) {
      current.status = 'failed';
      current.error = error instanceof Error ? error.message : String(error);
      current.completedAt = nowISO();
      await store.set('experiments', current.id, current);
    }
    logger.error(`Experiment ${experiment.id} failed: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (clonedPath) await state.cleanupClone(clonedPath);
    releaseAnalysisWorker(experiment.id);
  }
}

function validVariant(variant: ExperimentVariant, project: ProjectRecord): string | null {
  if (!variant.name.trim()) return 'Each variant needs a name.';
  if (!variant.analyzers.length) return `Variant “${variant.name}” needs at least one analyzer.`;
  if (!variant.collectors.includes('git')) return `Variant “${variant.name}” must include the git collector.`;
  const invalidAnalyzers = variant.analyzers.filter((id) => !project.settings.analyzers.includes(id));
  const invalidCollectors = variant.collectors.filter((id) => !project.settings.collectors.includes(id));
  if (invalidAnalyzers.length) return `Variant “${variant.name}” uses disabled analyzers: ${invalidAnalyzers.join(', ')}.`;
  if (invalidCollectors.length) return `Variant “${variant.name}” uses disabled collectors: ${invalidCollectors.join(', ')}.`;
  return null;
}

export async function registerExperimentRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/experiments', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const status = (request.query as { status?: string }).status;
    const experiments = (await store.all<Experiment>('experiments'))
      .filter((experiment) => experiment.projectId === project.id && (!status || experiment.status === status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return reply.send({ data: experiments, total: experiments.length });
  });

  app.post('/api/v1/experiments', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object', required: ['name', 'hypothesis', 'variants'], additionalProperties: false,
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 120 },
          description: { type: 'string', maxLength: 2_000 },
          hypothesis: { type: 'string', minLength: 1, maxLength: 2_000 },
          variants: { type: 'array', minItems: 2, maxItems: 2, items: {
            type: 'object', required: ['name', 'analyzers', 'collectors'], additionalProperties: false,
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 80 },
              analyzers: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } },
              collectors: { type: 'array', minItems: 1, uniqueItems: true, items: { type: 'string' } },
              includeReasoning: { type: 'boolean' },
            },
          } },
        },
      },
    },
  }, async (request, reply) => {
    const project = await requireProjectScope(request) as ProjectRecord;
    const body = request.body as Pick<Experiment, 'name' | 'description' | 'hypothesis'> & { variants: ExperimentVariant[] };
    const variants = body.variants.map((variant) => ({ ...variant, includeReasoning: variant.includeReasoning ?? true })) as [ExperimentVariant, ExperimentVariant];
    if (variants[0].name === variants[1].name) return reply.status(400).send({ error: 'Bad Request', message: 'Variant names must be unique.' });
    for (const variant of variants) {
      const error = validVariant(variant, project);
      if (error) return reply.status(400).send({ error: 'Bad Request', message: error });
    }
    const experiment: Experiment = {
      id: generateId(), projectId: project.id, name: body.name, description: body.description ?? '', hypothesis: body.hypothesis,
      status: 'pending', variants, results: [], metrics: [], createdAt: nowISO(), startedAt: null, completedAt: null,
      error: null, conclusion: null,
    };
    await store.set('experiments', experiment.id, experiment);
    return reply.status(201).send({ data: experiment });
  });

  app.get<{ Params: { id: string } }>('/api/v1/experiments/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const experiment = await store.get<Experiment>('experiments', request.params.id);
    if (!experiment || experiment.projectId !== project.id) return reply.status(404).send({ error: 'Not Found', message: 'Experiment not found.' });
    return reply.send({ data: experiment });
  });

  app.post<{ Params: { id: string } }>('/api/v1/experiments/:id/run', { preHandler: [authMiddleware, requireRole('analyst')] }, async (request, reply) => {
    const project = await requireProjectScope(request) as ProjectRecord;
    const experiment = await store.get<Experiment>('experiments', request.params.id);
    if (!experiment || experiment.projectId !== project.id) return reply.status(404).send({ error: 'Not Found', message: 'Experiment not found.' });
    if (experiment.status === 'running') return reply.status(409).send({ error: 'Conflict', message: 'Experiment is already running.' });
    if (!tryAcquireAnalysisWorker(experiment.id)) return reply.status(409).send({ error: 'Conflict', message: 'Another analysis job is running.' });
    experiment.status = 'running';
    experiment.results = [];
    experiment.metrics = [];
    experiment.startedAt = nowISO();
    experiment.completedAt = null;
    experiment.error = null;
    await store.set('experiments', experiment.id, experiment);
    setImmediate(() => void runExperiment(experiment.id, project));
    return reply.status(202).send({ data: experiment });
  });

  app.delete<{ Params: { id: string } }>('/api/v1/experiments/:id', { preHandler: [authMiddleware, requireRole('analyst')] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const experiment = await store.get<Experiment>('experiments', request.params.id);
    if (!experiment || experiment.projectId !== project.id) return reply.status(404).send({ error: 'Not Found', message: 'Experiment not found.' });
    if (experiment.status === 'running') return reply.status(409).send({ error: 'Conflict', message: 'A running experiment cannot be deleted.' });
    await store.delete('experiments', experiment.id);
    return reply.status(204).send();
  });
}

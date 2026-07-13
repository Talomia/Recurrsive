import type { FastifyRequest } from 'fastify';
import type { AnalysisCache, AnalysisHistoryEntry } from './state.js';
import { store } from './store.js';
import { getProjectGraph } from './project-graph.js';

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  repository: string;
  language: string;
  settings: { analyzers: string[]; collectors: string[] };
}

export class ProjectScopeError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'ProjectScopeError';
    this.statusCode = statusCode;
  }
}

/** Preserve project-scope status codes when route handlers wrap operational errors. */
export function rethrowProjectScopeError(error: unknown): void {
  if (error instanceof ProjectScopeError) throw error;
}

export interface ResolvedAnalysis {
  cache: AnalysisCache | null;
  persistenceKey: string | null;
  projectId: string | null;
}

export interface FindingWorkflowState {
  status: 'open' | 'resolved' | 'suppressed';
  assignee: string;
  updatedAt: string;
}

export type FindingWorkflowStates = Record<string, FindingWorkflowState>;

export function projectIdFromRequest(request: FastifyRequest): string | null {
  const query = request.query as { projectId?: unknown } | undefined;
  return typeof query?.projectId === 'string' && query.projectId.trim()
    ? query.projectId.trim()
    : null;
}

/** Require and validate the registered project scope for a product read. */
export async function requireProjectScope(request: FastifyRequest): Promise<ProjectRecord> {
  const projectId = projectIdFromRequest(request);
  if (!projectId) {
    throw new ProjectScopeError('The projectId query parameter is required.');
  }
  const project = await store.get<ProjectRecord>('projects', projectId);
  if (!project) throw new ProjectScopeError('Project not found.', 404);
  return project;
}

export async function resolveProjectGraph(request: FastifyRequest) {
  const project = await requireProjectScope(request);
  return getProjectGraph(project.id);
}

/** Resolve persisted results exclusively by registered project ID. */
export async function resolveAnalysis(request: FastifyRequest): Promise<ResolvedAnalysis> {
  const project = await requireProjectScope(request);
  const cache = await store.get<AnalysisCache>('analysis_cache', project.id);
  return { cache, persistenceKey: project.id, projectId: project.id };
}

export async function persistResolvedAnalysis(
  resolved: ResolvedAnalysis,
  cache: AnalysisCache,
): Promise<void> {
  if (resolved.persistenceKey) await store.set('analysis_cache', resolved.persistenceKey, cache);
}

export async function resolveAnalysisHistory(request: FastifyRequest): Promise<AnalysisHistoryEntry[]> {
  const project = await requireProjectScope(request);
  return (await store.get<AnalysisHistoryEntry[]>('analysis_history', project.id)) ?? [];
}

export async function resolveFindingStates(resolved: ResolvedAnalysis): Promise<FindingWorkflowStates> {
  if (!resolved.persistenceKey) return {};
  return (await store.get<FindingWorkflowStates>('finding_states', resolved.persistenceKey)) ?? {};
}

export async function persistFindingStates(
  resolved: ResolvedAnalysis,
  states: FindingWorkflowStates,
): Promise<void> {
  if (!resolved.persistenceKey) throw new Error('A project scope is required to update a finding.');
  await store.set('finding_states', resolved.persistenceKey, states);
}

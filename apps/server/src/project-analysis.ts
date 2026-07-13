import type { FastifyRequest } from 'fastify';
import { state, type AnalysisCache, type AnalysisHistoryEntry } from './state.js';
import { store } from './store.js';

interface ProjectRecord {
  id: string;
  repository: string;
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

/** Resolve persisted results by project ID, falling back to active state. */
export async function resolveAnalysis(request: FastifyRequest): Promise<ResolvedAnalysis> {
  const projectId = projectIdFromRequest(request);
  if (projectId) {
    const direct = await store.get<AnalysisCache>('analysis_cache', projectId);
    if (direct) return { cache: direct, persistenceKey: projectId, projectId };

    const project = await store.get<ProjectRecord>('projects', projectId);
    if (project) {
      const byRepository = await store.get<AnalysisCache>('analysis_cache', project.repository);
      return { cache: byRepository, persistenceKey: projectId, projectId };
    }
    return { cache: null, persistenceKey: projectId, projectId };
  }

  return {
    cache: state.getAnalysisCache(),
    persistenceKey: state.isInitialized() ? state.getProjectPath() : null,
    projectId: null,
  };
}

export async function persistResolvedAnalysis(
  resolved: ResolvedAnalysis,
  cache: AnalysisCache,
): Promise<void> {
  if (resolved.persistenceKey) await store.set('analysis_cache', resolved.persistenceKey, cache);
}

export async function resolveAnalysisHistory(request: FastifyRequest): Promise<AnalysisHistoryEntry[]> {
  const projectId = projectIdFromRequest(request);
  if (projectId) {
    return (await store.get<AnalysisHistoryEntry[]>('analysis_history', projectId)) ?? [];
  }
  return state.getAnalysisHistory();
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

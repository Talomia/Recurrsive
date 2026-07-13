/**
 * @module Experiments API
 *
 * Experiments and analysis run comparisons.
 */

import { ApiError, apiFetch } from './client';

// ─── Experiment Types ────────────────────────────────────────────────────────

export interface ExperimentVariant {
  name: string;
  config: Record<string, unknown>;
}

export interface ExperimentMetric {
  name: string;
  variant_a: number;
  variant_b: number;
  improvement: number;
}

export interface DashboardExperiment {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  hypothesis: string;
  variants: ExperimentVariant[];
  metrics: ExperimentMetric[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  conclusion: string | null;
}

// ─── Analysis Run Comparison Types ───────────────────────────────────────────

export interface AnalysisRunCategory {
  name: string;
  count: number;
}

export interface AnalysisRun {
  id: string;
  label: string;
  date: string;
  health_score: number;
  findings: number;
  opportunities: number;
  duration_ms: number;
  categories: AnalysisRunCategory[];
}

export interface ComparisonData {
  runA: AnalysisRun;
  runB: AnalysisRun;
  health_delta: number;
  findings_delta: number;
  opportunities_delta: number;
  duration_delta_ms: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get all experiments from `GET /api/v1/experiments`.
 */
export async function getExperiments(status?: string): Promise<DashboardExperiment[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch<DashboardExperiment[]>(`/api/v1/experiments${query}`);
}

/**
 * Get a single experiment by ID from `GET /api/v1/experiments/:id`.
 */
export async function getExperiment(id: string): Promise<DashboardExperiment | null> {
  try {
    return await apiFetch<DashboardExperiment>(
      `/api/v1/experiments/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Server shape returned by `GET /api/v1/analysis/history`.
 */
interface ServerAnalysisHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  findingCount: number;
  opportunityCount: number;
  healthScore: number | null;
  includeReasoning: boolean;
  status: 'success' | 'error';
  error: string | null;
}

/**
 * Get all analysis runs for comparison selection.
 *
 * Transforms the server's `AnalysisHistoryEntry` shape into the dashboard's
 * `AnalysisRun` shape expected by the comparisons page.
 */
export async function getAnalysisRuns(): Promise<AnalysisRun[]> {
  const res = await apiFetch<{ data: ServerAnalysisHistoryEntry[]; total: number }>(
    "/api/v1/analysis/history",
    { unwrap: false },
  );
  const entries = (res.data ?? []).filter((entry) => entry.status === 'success' && entry.healthScore !== null);
  return entries.map((entry) => {
      const date = new Date(entry.startedAt);
      const label = `Run ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      return {
        id: entry.id,
        label,
        date: entry.startedAt,
        health_score: entry.healthScore ?? 0,
        findings: entry.findingCount,
        opportunities: entry.opportunityCount,
        duration_ms: entry.durationMs,
        categories: [] as AnalysisRunCategory[],
      };
  });
}

/**
 * Get comparison data between two analysis runs.
 */
export async function getComparisonData(
  runAId: string,
  runBId: string,
): Promise<ComparisonData | null> {
  try {
    return await apiFetch<ComparisonData>(
      `/api/v1/analysis/compare?run_a=${encodeURIComponent(runAId)}&run_b=${encodeURIComponent(runBId)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Create a new experiment via `POST /api/v1/experiments`.
 */
export async function createExperiment(data: {
  name: string;
  description?: string;
  hypothesis?: string;
  variants?: ExperimentVariant[];
}): Promise<DashboardExperiment> {
  return await apiFetch<DashboardExperiment>('/api/v1/experiments', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Update an experiment's status via `PUT /api/v1/experiments/:id/status`.
 */
export async function updateExperimentStatus(
  id: string,
  data: { status: 'pending' | 'running' | 'completed' | 'failed'; conclusion?: string },
): Promise<DashboardExperiment> {
  return await apiFetch<DashboardExperiment>(
    `/api/v1/experiments/${encodeURIComponent(id)}/status`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

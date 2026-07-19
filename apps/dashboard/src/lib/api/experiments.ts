/**
 * @module Experiments API
 *
 * Experiments and analysis run comparisons.
 */

import { apiFetch, ApiError } from './client';

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

export interface AnalysisRun {
  id: string;
  label: string;
  date: string;
  /** Canonical health score for the run (null for failed runs). */
  health_score: number | null;
  findings: number;
  opportunities: number;
}

export interface ComparisonData {
  runA: AnalysisRun;
  runB: AnalysisRun;
  health_delta: number;
  findings_delta: number;
  opportunities_delta: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get all experiments from `GET /api/v1/experiments`. Throws on failure.
 */
export async function getExperiments(status?: string): Promise<DashboardExperiment[]> {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return await apiFetch<DashboardExperiment[]>(`/api/v1/experiments${query}`);
}

/**
 * Get a single experiment by ID from `GET /api/v1/experiments/:id`.
 *
 * Returns null only for a genuine 404 (so the page can render "Not Found");
 * other failures throw so a broken server surfaces as an error instead.
 */
export async function getExperiment(id: string): Promise<DashboardExperiment | null> {
  try {
    return await apiFetch<DashboardExperiment>(
      `/api/v1/experiments/${encodeURIComponent(id)}`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
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
  includeReasoning: boolean;
  healthScore: number | null;
  status: 'success' | 'failed';
  error: string | null;
}

/**
 * Get all analysis runs for comparison selection.
 *
 * Transforms the server's `AnalysisHistoryEntry` shape into the dashboard's
 * `AnalysisRun` shape. Only fields the server actually records per run are
 * surfaced — the health score is the canonical one stored with the run, not a
 * fabricated approximation.
 */
export async function getAnalysisRuns(): Promise<AnalysisRun[]> {
  const res = await apiFetch<{ data: ServerAnalysisHistoryEntry[]; total: number }>(
    "/api/v1/analysis/history",
    { unwrap: false },
  );
  const entries = res.data ?? [];
  return entries
    .filter((entry) => entry.status === 'success')
    .map((entry) => {
      const date = new Date(entry.startedAt);
      const label = `Run ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      return {
        id: entry.id,
        label,
        date: entry.startedAt,
        health_score: entry.healthScore,
        findings: entry.findingCount,
        opportunities: entry.opportunityCount,
      };
    });
}

/**
 * Compute a comparison between two analysis runs.
 *
 * The server's `/analysis/compare` endpoint only diffs the current cache
 * against a baseline history index, so it cannot compare two arbitrary runs.
 * Every field needed here — health, findings, opportunities — is already
 * recorded on each run, so the deltas are computed directly from the two
 * selected runs instead of inventing data the backend does not track.
 */
export function getComparisonData(
  runA: AnalysisRun,
  runB: AnalysisRun,
): ComparisonData {
  return {
    runA,
    runB,
    health_delta: (runB.health_score ?? 0) - (runA.health_score ?? 0),
    findings_delta: runB.findings - runA.findings,
    opportunities_delta: runB.opportunities - runA.opportunities,
  };
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

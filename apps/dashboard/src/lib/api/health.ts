/**
 * @module Health API
 *
 * Health score metrics, performance metrics, and dimension data.
 */

import { apiFetch, ApiError } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

/**
 * Health metrics for the overview dashboard.
 *
 * Every field is a MEASURED value from the server — there are no synthesized
 * trends, invented "new this week" counts, or fabricated tech-debt dollars.
 * When no analysis has run, `analyzed` is false and the score fields are null
 * so the UI can render "Not analyzed yet" rather than a misleading 0/100.
 */
export interface HealthMetrics {
  /** Whether at least one analysis has been recorded for the active project. */
  analyzed: boolean;
  /** Canonical health score (0-100), or null when not analyzed. */
  healthScore: number | null;
  /** Code-quality dimension score (0-100), or null when unavailable. */
  qualityScore: number | null;
  /** AI-readiness dimension score (0-100), or null when unavailable. */
  aiQualityScore: number | null;
  /** Real count of open findings. */
  findingCount: number;
  /** Real count of opportunities. */
  opportunityCount: number;
  /** ISO timestamp of the last analysis, or null. */
  analyzedAt: string | null;
}

/** An empty, not-analyzed HealthMetrics value (no data yet — not an error). */
export const EMPTY_HEALTH_METRICS: HealthMetrics = {
  analyzed: false,
  healthScore: null,
  qualityScore: null,
  aiQualityScore: null,
  findingCount: 0,
  opportunityCount: 0,
  analyzedAt: null,
};

export interface PerformanceMetric {
  label: string;
  value: string;
  unit: string;
  trend: number;
  data: { value: number }[];
}

export interface ServiceStatus {
  name: string;
  /** Real init-derived status: 'up' once initialized, else 'idle'. */
  status: "up" | "idle";
  last_check: string;
}

export interface HealthDashboardData {
  /** Overall health for the project, or null when not analyzed. */
  overall_score: number | null;
  /** Real process memory metrics (no fabricated percentages). */
  memory: {
    rss_bytes: number;
    heap_total_bytes: number;
    heap_used_bytes: number;
    usage_percent: number;
  };
  /** Real process uptime in seconds. */
  uptime_seconds: number;
  services: ServiceStatus[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get health metrics from `GET /api/v1/health-score`.
 *
 * Server returns the canonical health score plus per-dimension breakdown,
 * finding/opportunity counts, and `analyzed_at`. When no analysis has run the
 * server reports `status: 'not_analyzed'` with a null score.
 *
 * A "not analyzed" result (200 with null score, or a 503 "not initialized")
 * is returned as {@link EMPTY_HEALTH_METRICS} — a genuine empty state. Any
 * other failure (network error, 500) is re-thrown so callers can render a
 * distinct error state instead of a misleading empty dashboard.
 */
export async function getHealthMetrics(): Promise<HealthMetrics> {
  let raw: {
    overall_health?: number | null;
    overall?: number | null;
    status?: string;
    dimensions?: Record<string, number>;
    finding_count?: number;
    opportunity_count?: number;
    analyzed_at?: string | null;
  };

  try {
    raw = await apiFetch("/api/v1/health-score");
  } catch (err) {
    // 503 = server has no analysis yet → treat as an honest empty state.
    if (err instanceof ApiError && err.status === 503) {
      return { ...EMPTY_HEALTH_METRICS };
    }
    // Anything else is a real failure — let the caller show an error state.
    throw err;
  }

  const score = raw.overall_health ?? raw.overall ?? null;
  const analyzed = raw.status !== 'not_analyzed' && score != null && raw.analyzed_at != null;

  if (!analyzed) {
    return {
      ...EMPTY_HEALTH_METRICS,
      // Surface real counts even before a full score is available.
      findingCount: raw.finding_count ?? 0,
      opportunityCount: raw.opportunity_count ?? 0,
    };
  }

  const codeQuality = raw.dimensions?.code_quality ?? raw.dimensions?.documentation;
  const aiQuality = raw.dimensions?.ai_readiness ?? raw.dimensions?.security;

  return {
    analyzed: true,
    healthScore: score,
    qualityScore: codeQuality ?? null,
    aiQualityScore: aiQuality ?? null,
    findingCount: raw.finding_count ?? 0,
    opportunityCount: raw.opportunity_count ?? 0,
    analyzedAt: raw.analyzed_at ?? null,
  };
}

/**
 * Get performance metrics from `GET /api/v1/metrics/performance`.
 * Throws on failure.
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetric[]> {
  return await apiFetch<PerformanceMetric[]>("/api/v1/metrics/performance");
}

/**
 * Get system health dashboard data.
 *
 * Throws on failure — returning zeroed memory/uptime would render fabricated
 * telemetry (0 MB, 0s uptime) as if it were measured.
 */
export async function getHealthDashboard(): Promise<HealthDashboardData> {
  return await apiFetch<HealthDashboardData>("/api/v1/health/dashboard");
}

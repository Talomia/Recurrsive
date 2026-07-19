/**
 * @module Analysis API
 *
 * Analysis runs, findings, and findings summary.
 */

import { apiFetch, ApiError } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FindingEvidence {
  id: string;
  type: string;
  source: string;
  description: string;
  data?: Record<string, unknown>;
  entity_ids: string[];
  collected_at: string;
  confidence: number;
}

export interface FindingLocation {
  file: string;
  start_line?: number;
  end_line?: number;
  start_column?: number;
  end_column?: number;
  repository?: string;
  commit?: string;
}

export interface FindingImpact {
  summary?: string;
  metrics?: Array<{
    name: string;
    current_value?: string | number;
    expected_value?: string | number;
    change_percent?: number;
    direction?: string;
  }>;
  affected_services?: string[];
  affected_users?: string;
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  analyzer_id: string;
  evidence: FindingEvidence[];
  locations: FindingLocation[];
  suggested_fix?: string;
  estimated_impact?: FindingImpact;
  confidence: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface FindingsSummary {
  total: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  by_analyzer: Record<string, number>;
}

export interface FindingsPageItem {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  status: "open" | "resolved" | "suppressed";
  assignee: string;
  created_at: string;
}

export interface FindingsPageData {
  findings: FindingsPageItem[];
  stats: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface AnalyticsCategory {
  name: string;
  count: number;
  percentage: number;
}

export interface AnalyticsTrendPoint {
  date: string;
  findings: number;
  /**
   * Always null — the server does not record per-run resolution counts, and
   * refuses to fabricate them. Do not chart this field.
   */
  resolved: number | null;
  health: number;
}

export interface AnalyticsSummary {
  analysis_runs: number;
  total_findings: number;
  findings_resolved: number;
  resolution_rate: number;
  /** Mean health score over scored runs, or null when nothing was analyzed. */
  avg_health_score: number | null;
  trends: AnalyticsTrendPoint[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get analysis status from `GET /api/v1/analysis/status`.
 *
 * Throws on failure — an unreachable server is not the same as "idle".
 */
export async function getAnalysisStatus(): Promise<{
  phase: string;
  progress: number;
  message: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}> {
  return await apiFetch<{
    phase: string;
    progress: number;
    message: string;
    startedAt: string | null;
    completedAt: string | null;
    error: string | null;
  }>("/api/v1/analysis/status");
}

/**
 * Get findings summary from `GET /api/v1/findings/summary`.
 *
 * A 404 means no analysis has run yet — a genuine empty summary. Other
 * failures throw so callers can render an error state.
 */
export async function getFindingsSummary(): Promise<FindingsSummary> {
  try {
    return await apiFetch<FindingsSummary>("/api/v1/findings/summary");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) {
      return { total: 0, by_severity: {}, by_category: {}, by_analyzer: {} };
    }
    throw err;
  }
}

/**
 * Get paginated findings from `GET /api/v1/findings`.
 */
export async function getFindings(params?: {
  severity?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<{ findings: Finding[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.severity) query.set("severity", params.severity);
  if (params?.category) query.set("category", params.category);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const qs = query.toString();
  const path = `/api/v1/findings${qs ? `?${qs}` : ""}`;

  try {
    const res = await apiFetch<{ data: Finding[]; total: number }>(path, { unwrap: false });
    return { findings: res.data ?? [], total: res.total ?? 0 };
  } catch (err) {
    // 404 = no analysis results exist yet — a genuinely empty list.
    if (err instanceof ApiError && err.status === 404) {
      return { findings: [], total: 0 };
    }
    throw err;
  }
}

/**
 * Get a single finding by ID from `GET /api/v1/findings/:id`.
 *
 * Returns null only for a genuine 404; other failures throw.
 */
export async function getFinding(id: string): Promise<Finding | null> {
  try {
    return await apiFetch<Finding>(
      `/api/v1/findings/${encodeURIComponent(id)}`,
    );
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Get findings page data with stats and filterable list.
 *
 * Throws on failure so the page can distinguish a server error from a
 * genuinely empty result set (no findings yet).
 */
export async function getFindingsPage(): Promise<FindingsPageData> {
  return await apiFetch<FindingsPageData>("/api/v1/findings/page");
}

/**
 * Get analytics summary from `GET /api/v1/analytics/summary`.
 *
 * Throws on failure so the analytics page can show its error banner instead
 * of rendering fabricated zeros. The server itself answers honestly when
 * nothing has been analyzed (zero counts, null health).
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return await apiFetch<AnalyticsSummary>("/api/v1/analytics/summary");
}

/**
 * Get analytics categories from `GET /api/v1/analytics/top-categories`.
 * Throws on failure.
 */
export async function getAnalyticsCategories(): Promise<AnalyticsCategory[]> {
  return await apiFetch<AnalyticsCategory[]>("/api/v1/analytics/top-categories");
}

// ─── Analysis Triggers ──────────────────────────────────────────────────────

export interface AnalysisResult {
  status: string;
  message: string;
  analysisId?: string;
}

/**
 * True when a repository string is a remote git URL (vs. a local filesystem path
 * on the server, e.g. a mounted repo under /app).
 */
function isGitUrl(repository: string): boolean {
  return /^https?:\/\//i.test(repository) ||
    repository.startsWith('git@') ||
    repository.includes('github.com') ||
    repository.includes('gitlab.com');
}

/**
 * Trigger a single-project analysis via `POST /api/v1/analyze`.
 *
 * @param repository - The repository to analyze: a remote git URL (cloned by the
 *   server) or a local filesystem path (analyzed in place). The correct request
 *   field (`gitUrl` vs `path`) is chosen automatically — sending a local path as
 *   `gitUrl` would make the server try to clone it and fail.
 * @param projectId - The project the results belong to. REQUIRED for results to
 *   surface on that project's pages — the server persists the analysis cache and
 *   writes back the project's health under this id. Omitting it lands the results
 *   in the implicit 'default' bucket where no project page reads them.
 */
export async function triggerAnalysis(
  repository: string,
  projectId?: string,
): Promise<AnalysisResult> {
  const target = isGitUrl(repository) ? { gitUrl: repository } : { path: repository };
  return await apiFetch<AnalysisResult>('/api/v1/analyze', {
    method: 'POST',
    body: JSON.stringify({ ...target, ...(projectId ? { projectId } : {}) }),
    headers: { 'Content-Type': 'application/json' },
    unwrap: false,
  });
}


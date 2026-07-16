/**
 * @module Analysis API
 *
 * Analysis runs, findings, and findings summary.
 */

import { apiFetch } from './client';

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
  resolved: number;
  health: number;
}

export interface AnalyticsSummary {
  analysis_runs: number;
  total_findings: number;
  findings_resolved: number;
  resolution_rate: number;
  avg_health_score: number;
  trends: AnalyticsTrendPoint[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get analysis status from `GET /api/v1/analysis/status`.
 */
export async function getAnalysisStatus(): Promise<{
  phase: string;
  progress: number;
  message: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}> {
  try {
    return await apiFetch<{
      phase: string;
      progress: number;
      message: string;
      startedAt: string | null;
      completedAt: string | null;
      error: string | null;
    }>("/api/v1/analysis/status");
  } catch {
    return {
      phase: "idle",
      progress: 0,
      message: "No analysis running",
      startedAt: null,
      completedAt: null,
      error: null,
    };
  }
}

/**
 * Get findings summary from `GET /api/v1/findings/summary`.
 */
export async function getFindingsSummary(): Promise<FindingsSummary> {
  try {
    return await apiFetch<FindingsSummary>("/api/v1/findings/summary");
  } catch {
    return { total: 0, by_severity: {}, by_category: {}, by_analyzer: {} };
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
  } catch {
    return { findings: [], total: 0 };
  }
}

/**
 * Get a single finding by ID from `GET /api/v1/findings/:id`.
 */
export async function getFinding(id: string): Promise<Finding | null> {
  try {
    return await apiFetch<Finding>(
      `/api/v1/findings/${encodeURIComponent(id)}`,
    );
  } catch {
    return null;
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
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  try {
    return await apiFetch<AnalyticsSummary>("/api/v1/analytics/summary");
  } catch {
    return {
      analysis_runs: 0,
      total_findings: 0,
      findings_resolved: 0,
      resolution_rate: 0,
      avg_health_score: 0,
      trends: [],
    };
  }
}

/**
 * Get analytics categories from `GET /api/v1/analytics/top-categories`.
 */
export async function getAnalyticsCategories(): Promise<AnalyticsCategory[]> {
  try {
    return await apiFetch<AnalyticsCategory[]>("/api/v1/analytics/top-categories");
  } catch {
    return [];
  }
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


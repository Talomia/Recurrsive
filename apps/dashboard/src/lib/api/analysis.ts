/**
 * @module Analysis API
 *
 * Analysis runs, findings, and findings summary.
 */

import { ApiError, apiFetch } from './client';

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
  return apiFetch<{
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
 */
export async function getFindingsSummary(): Promise<FindingsSummary> {
  return apiFetch<FindingsSummary>("/api/v1/findings/summary");
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

  const res = await apiFetch<{ data: Finding[]; total: number }>(path, { unwrap: false });
  return { findings: res.data ?? [], total: res.total ?? 0 };
}

/**
 * Get a single finding by ID from `GET /api/v1/findings/:id`.
 */
export async function getFinding(id: string): Promise<Finding | null> {
  try {
    return await apiFetch<Finding>(
      `/api/v1/findings/${encodeURIComponent(id)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Get findings page data with stats and filterable list.
 */
export async function getFindingsPage(): Promise<FindingsPageData> {
  return apiFetch<FindingsPageData>("/api/v1/findings/page");
}

/**
 * Get analytics summary from `GET /api/v1/analytics/summary`.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  return apiFetch<AnalyticsSummary>("/api/v1/analytics/summary");
}

/**
 * Get analytics categories from `GET /api/v1/analytics/top-categories`.
 */
export async function getAnalyticsCategories(): Promise<AnalyticsCategory[]> {
  return apiFetch<AnalyticsCategory[]>("/api/v1/analytics/top-categories");
}

// ─── Analysis Triggers ──────────────────────────────────────────────────────

export interface AnalysisResult {
  status: string;
  message: string;
  analysisId?: string;
}

/**
 * Trigger a single-project analysis via `POST /api/v1/analyze`.
 *
 * @param gitUrl - The repository URL to analyze.
 */
export async function triggerAnalysis(projectId: string): Promise<AnalysisResult> {
  return await apiFetch<AnalysisResult>('/api/v1/analyze', {
    method: 'POST',
    body: JSON.stringify({ projectId }),
    headers: { 'Content-Type': 'application/json' },
    unwrap: false,
  });
}

/**
 * @module Reports API
 *
 * Timeline, snapshots, search, export, scheduling, and reports.
 *
 * Read functions PROPAGATE failure (throw) so pages can render a real error
 * state — an unreachable server must never masquerade as an empty timeline.
 */

import { apiFetch } from './client';

// ─── Timeline Types ──────────────────────────────────────────────────────────

export interface TimelinePoint {
  date: string;
  healthScore: number;
  quality: number;
  reliability: number;
  performance: number;
}

export interface AnalysisHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  findingCount: number;
  opportunityCount: number;
  includeReasoning: boolean;
  status: "success" | "error";
  error: string | null;
}

export interface MaturityScoreEntry {
  dimension: string;
  level: string;
  score: number;
  trend: "improving" | "stable" | "declining";
  evidence: string[];
  recommendations: string[];
}

export interface SnapshotDelta {
  new_opportunities: number;
  resolved_opportunities: number;
  new_risks: number;
  resolved_risks: number;
  maturity_changes: Array<{
    dimension: string;
    previous_score: number;
    current_score: number;
  }>;
}

export interface EvolutionSnapshot {
  id: string;
  timestamp: string;
  maturity_scores: MaturityScoreEntry[];
  overall_health: number;
  opportunity_count: number;
  debt_count: number;
  risk_count: number;
  top_opportunities: string[];
  changes_since_last: SnapshotDelta;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
}

export interface TrendSeries {
  dimension: string;
  data_points: TrendDataPoint[];
}

export interface TrendData {
  series: TrendSeries[];
  total: number;
}

export interface ProjectSnapshot {
  id: string;
  date: string;
  health_score: number;
  /**
   * Count of risk-type opportunities in the snapshot (`risk_count` server
   * field). This is NOT a findings count — the snapshot does not record one.
   */
  risks_count: number;
  opportunities_count: number;
  summary: string;
  dimensions: Record<string, number>;
}

// ─── Search Types ────────────────────────────────────────────────────────────

export interface SearchResult {
  type: string;
  id: string;
  name: string;
  match: string;
  score: number;
}

// ─── Scheduling Types ────────────────────────────────────────────────────────

/** Report output formats supported by the server's report generator. */
export type ScheduleReportFormat = 'html' | 'markdown' | 'json' | 'sarif' | 'pdf';

/**
 * A scheduled report as stored by the server (`ScheduledReport`).
 */
export interface ReportSchedule {
  id: string;
  name: string;
  description: string;
  /** Cron expression, e.g. `0 9 * * 1`. */
  schedule: string;
  timezone: string;
  formats: ScheduleReportFormat[];
  analyzers: string[];
  recipients: string[];
  sections: string[];
  includeExecutiveSummary: boolean;
  projectId?: string;
  status: 'active' | 'paused' | 'error';
  lastRunAt: string | null;
  nextRunAt: string;
  totalRuns: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * A schedule run as stored by the server (`ReportRun`).
 */
export interface ScheduleRunHistory {
  id: string;
  scheduleId: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  format: ScheduleReportFormat;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  sizeBytes: number;
  downloadUrl: string | null;
  error: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get timeline data from `GET /api/v1/timeline/trends`.
 *
 * Server returns trend series grouped by dimension. We transform this
 * into flat TimelinePoint objects for the dashboard charts.
 * Throws on failure.
 */
export async function getTimeline(): Promise<TimelinePoint[]> {
  // Server shape: { dimension, data_points: [{ timestamp, value }] }[]
  const trends = await apiFetch<
    { dimension: string; data_points: { timestamp: string; value: number }[] }[]
  >("/api/v1/timeline/trends");

  if (!Array.isArray(trends) || trends.length === 0) return [];

  // Build a lookup: dimension → { timestamp → value }
  const dimMap = new Map<string, Map<string, number>>();
  const allTimestamps = new Set<string>();

  for (const trend of trends) {
    const map = new Map<string, number>();
    for (const pt of trend.data_points ?? []) {
      map.set(pt.timestamp, pt.value);
      allTimestamps.add(pt.timestamp);
    }
    dimMap.set(trend.dimension, map);
  }

  // Convert to flat TimelinePoint array sorted by date
  const sorted = [...allTimestamps].sort();
  return sorted.map((ts) => ({
    date: ts,
    healthScore: dimMap.get('overall_health')?.get(ts) ?? 0,
    quality: dimMap.get('documentation')?.get(ts) ?? dimMap.get('code_quality')?.get(ts) ?? 0,
    reliability: dimMap.get('reliability')?.get(ts) ?? 0,
    performance: dimMap.get('architecture')?.get(ts) ?? 0,
  }));
}

/**
 * Get analysis history from `GET /api/v1/analysis/history`. Throws on failure.
 */
export async function getTimelineHistory(): Promise<AnalysisHistoryEntry[]> {
  const result = await apiFetch<AnalysisHistoryEntry[]>("/api/v1/analysis/history");
  return Array.isArray(result) ? result : [];
}

/**
 * Get evolution snapshots from `GET /api/v1/timeline/snapshots`. Throws on failure.
 */
export async function getTimelineSnapshots(): Promise<EvolutionSnapshot[]> {
  const result = await apiFetch<EvolutionSnapshot[]>("/api/v1/timeline/snapshots");
  return Array.isArray(result) ? result : [];
}

/**
 * Get trend data from `GET /api/v1/timeline/trends`. Throws on failure.
 */
export async function getTimelineTrends(): Promise<TrendData> {
  // apiFetch unwraps { data: [...] } → returns the raw TrendSeries[]
  const raw = await apiFetch<TrendSeries[] | TrendData>("/api/v1/timeline/trends");
  if (Array.isArray(raw)) {
    return { series: raw, total: raw.length };
  }
  // If the API ever returns { series, total } directly
  return raw && 'series' in raw ? raw : { series: [], total: 0 };
}

/**
 * Get project snapshots for the timeline page. Throws on failure.
 */
export async function getSnapshots(): Promise<ProjectSnapshot[]> {
  // Server returns EvolutionSnapshot[], transform to ProjectSnapshot[]
  const raw = await apiFetch<EvolutionSnapshot[]>("/api/v1/timeline/snapshots");
  if (!Array.isArray(raw)) return [];
  return raw.map(snap => ({
    id: snap.id,
    date: snap.timestamp,
    health_score: snap.overall_health ?? 0,
    risks_count: snap.risk_count ?? 0,
    opportunities_count: snap.opportunity_count ?? 0,
    summary: snap.top_opportunities?.[0] ?? '',
    dimensions: Object.fromEntries(
      (snap.maturity_scores ?? []).map(s => [s.dimension, s.score])
    ),
  }));
}

/**
 * Trigger a report download from `GET /api/v1/reports/:format`.
 * Returns a RELATIVE, same-origin URL so a browser `<a href download>`
 * navigation goes through the dashboard proxy (which promotes the
 * `recurrsive_token` cookie to an Authorization header). An absolute
 * `${BASE_URL}` here would target the upstream API directly, where the
 * dashboard-scoped cookie isn't sent and a plain navigation can't attach a
 * Bearer header — so every report download 401'd. Formats: markdown, html,
 * sarif, json.
 */
export function getReportUrl(format: string): string {
  return `/api/v1/reports/${encodeURIComponent(format)}`;
}

/**
 * Full-text search across all resource types via `GET /api/v1/search`.
 * Throws on failure.
 */
export async function searchAll(
  query: string,
  scope?: string,
): Promise<SearchResult[]> {
  const params = new URLSearchParams();
  params.set("q", query);
  if (scope) params.set("scope", scope);

  return await apiFetch<SearchResult[]>(
    `/api/v1/search?${params.toString()}`,
  );
}

/** Get all report schedules. Throws on failure. */
export async function getSchedules(): Promise<ReportSchedule[]> {
  return await apiFetch<ReportSchedule[]>('/api/v1/schedules');
}

/** Get the global schedule run history. Throws on failure. */
export async function getScheduleHistory(): Promise<ScheduleRunHistory[]> {
  return await apiFetch<ScheduleRunHistory[]>('/api/v1/schedules/history');
}

// ─── Schedule Mutations ──────────────────────────────────────────────────────

export interface CreateSchedulePayload {
  name: string;
  description?: string;
  schedule: string;
  timezone?: string;
  /** Output formats — the server field is `formats` (an array). */
  formats?: string[];
  recipients?: string[];
  projectId?: string;
}

/**
 * Create a new scheduled report via `POST /api/v1/schedules`.
 */
export async function createSchedule(data: CreateSchedulePayload): Promise<ReportSchedule> {
  return await apiFetch<ReportSchedule>('/api/v1/schedules', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * Toggle a schedule between active/paused via `POST /api/v1/schedules/:id/toggle`.
 */
export async function toggleSchedule(id: string): Promise<ReportSchedule> {
  return await apiFetch<ReportSchedule>(`/api/v1/schedules/${encodeURIComponent(id)}/toggle`, {
    method: 'POST',
  });
}

/**
 * Delete a schedule via `DELETE /api/v1/schedules/:id`.
 */
export async function deleteSchedule(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/schedules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    unwrap: false,
  });
}

/**
 * Trigger an immediate run for a schedule via `POST /api/v1/schedules/:id/run`.
 */
export async function runScheduleNow(id: string): Promise<ScheduleRunHistory> {
  return await apiFetch<ScheduleRunHistory>(`/api/v1/schedules/${encodeURIComponent(id)}/run`, {
    method: 'POST',
  });
}

// ─── Reports Page Analysis History ───────────────────────────────────────────

export interface ReportsAnalysisHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  findingCount: number;
  opportunityCount: number;
  status: string;
}

/**
 * Get analysis history for the reports page from `GET /api/v1/analysis/history`.
 * Throws on failure.
 */
export async function getReportsAnalysisHistory(): Promise<ReportsAnalysisHistoryEntry[]> {
  return await apiFetch<ReportsAnalysisHistoryEntry[]>('/api/v1/analysis/history');
}

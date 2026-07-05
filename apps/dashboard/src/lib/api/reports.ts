/**
 * @module Reports API
 *
 * Timeline, snapshots, search, export, scheduling, and reports.
 */

import { apiFetch, BASE_URL } from './client';

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
  findings_count: number;
  opportunities_count: number;
  trigger: "manual" | "scheduled" | "ci";
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

export interface ReportSchedule {
  id: string;
  name: string;
  reportType: 'executive' | 'technical' | 'compliance' | 'custom';
  cron: string;
  cronHuman: string;
  status: 'active' | 'paused';
  nextRun: string;
  recipients: string[];
  format: 'pdf' | 'html' | 'csv';
  createdBy: string;
}

export interface ScheduleRunHistory {
  id: string;
  scheduleId: string;
  scheduleName: string;
  status: 'success' | 'failed' | 'running';
  startedAt: string;
  completedAt: string | null;
  fileSize: string;
  downloadUrl: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get timeline data from `GET /api/v1/timeline/trends`.
 */
export async function getTimeline(): Promise<TimelinePoint[]> {
  try {
    return await apiFetch<TimelinePoint[]>("/api/v1/timeline/trends");
  } catch {
    return [];
  }
}

/**
 * Get analysis history from `GET /api/v1/analysis/history`.
 */
export async function getTimelineHistory(): Promise<AnalysisHistoryEntry[]> {
  try {
    return await apiFetch<AnalysisHistoryEntry[]>("/api/v1/analysis/history");
  } catch {
    return [];
  }
}

/**
 * Get evolution snapshots from `GET /api/v1/timeline/snapshots`.
 */
export async function getTimelineSnapshots(): Promise<EvolutionSnapshot[]> {
  try {
    return await apiFetch<EvolutionSnapshot[]>("/api/v1/timeline/snapshots");
  } catch {
    return [];
  }
}

/**
 * Get trend data from `GET /api/v1/timeline/trends`.
 */
export async function getTimelineTrends(): Promise<TrendData> {
  try {
    return await apiFetch<TrendData>("/api/v1/timeline/trends");
  } catch {
    return { series: [], total: 0 };
  }
}

/**
 * Get project snapshots for the timeline page.
 */
export async function getSnapshots(): Promise<ProjectSnapshot[]> {
  try {
    return await apiFetch<ProjectSnapshot[]>("/api/v1/timeline/snapshots");
  } catch {
    return [];
  }
}

/**
 * Trigger a report download from `GET /api/v1/reports/:format`.
 * Returns the download URL. Formats: markdown, html, sarif, json.
 */
export function getReportUrl(format: string): string {
  return `${BASE_URL}/api/v1/reports/${encodeURIComponent(format)}`;
}

/**
 * Full-text search across all resource types via `GET /api/v1/search`.
 */
export async function searchAll(
  query: string,
  scope?: string,
): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams();
    params.set("q", query);
    if (scope) params.set("scope", scope);

    return await apiFetch<SearchResult[]>(
      `/api/v1/search?${params.toString()}`,
    );
  } catch {
    return [];
  }
}

export async function getSchedules(): Promise<ReportSchedule[]> {
  try {
    return await apiFetch<ReportSchedule[]>('/api/v1/schedules');
  } catch {
    return [];
  }
}

export async function getScheduleHistory(): Promise<ScheduleRunHistory[]> {
  try {
    return await apiFetch<ScheduleRunHistory[]>('/api/v1/schedules/history');
  } catch {
    return [];
  }
}

// ─── Schedule Mutations ──────────────────────────────────────────────────────

export interface CreateSchedulePayload {
  name: string;
  description?: string;
  schedule: string;
  timezone?: string;
  format?: string;
  recipients?: string[];
  scope?: string;
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
  return await apiFetch<ReportSchedule>(`/api/v1/schedules/${id}/toggle`, {
    method: 'POST',
  });
}

/**
 * Delete a schedule via `DELETE /api/v1/schedules/:id`.
 */
export async function deleteSchedule(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/schedules/${id}`, {
    method: 'DELETE',
    unwrap: false,
  });
}

/**
 * Trigger an immediate run for a schedule via `POST /api/v1/schedules/:id/run`.
 */
export async function runScheduleNow(id: string): Promise<ScheduleRunHistory> {
  return await apiFetch<ScheduleRunHistory>(`/api/v1/schedules/${id}/run`, {
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
 */
export async function getReportsAnalysisHistory(): Promise<ReportsAnalysisHistoryEntry[]> {
  try {
    return await apiFetch<ReportsAnalysisHistoryEntry[]>('/api/v1/analysis/history');
  } catch {
    return [];
  }
}

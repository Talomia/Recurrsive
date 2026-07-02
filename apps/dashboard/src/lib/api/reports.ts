/**
 * @module Reports API
 *
 * Timeline, snapshots, search, export, scheduling, and reports.
 */

import { apiFetch, BASE_URL, seededRandom } from './client';

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

// ─── Timeline Mock Data ──────────────────────────────────────────────────────

function generateTimeline(): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = 29 - i;
    const noise = (s: number) => seededRandom(i * 137 + s) * 6 - 3;
    const monthDay = `${String(6).padStart(2, "0")}/${String(day + 1).padStart(2, "0")}`;
    points.push({
      date: monthDay,
      healthScore: Math.round(78 + day * 0.4 + noise(0)),
      quality: Math.round(82 + day * 0.3 + noise(1)),
      reliability: Math.round(91 + day * 0.15 + noise(2)),
      performance: Math.round(73 + day * 0.35 + noise(3)),
    });
  }
  return points;
}

const MOCK_TIMELINE = generateTimeline();

const MOCK_ANALYSIS_HISTORY: AnalysisHistoryEntry[] = [
  { id: "run-001", startedAt: "2026-06-30T10:00:00Z", completedAt: "2026-06-30T10:02:34Z", durationMs: 154000, findingCount: 47, opportunityCount: 23, includeReasoning: true, status: "success", error: null },
  { id: "run-002", startedAt: "2026-06-29T09:00:00Z", completedAt: "2026-06-29T09:01:48Z", durationMs: 108000, findingCount: 42, opportunityCount: 19, includeReasoning: false, status: "success", error: null },
  { id: "run-003", startedAt: "2026-06-28T14:30:00Z", completedAt: "2026-06-28T14:32:12Z", durationMs: 132000, findingCount: 51, opportunityCount: 25, includeReasoning: true, status: "success", error: null },
  { id: "run-004", startedAt: "2026-06-27T08:15:00Z", completedAt: "2026-06-27T08:16:55Z", durationMs: 115000, findingCount: 38, opportunityCount: 17, includeReasoning: false, status: "success", error: null },
  { id: "run-005", startedAt: "2026-06-25T16:00:00Z", completedAt: "2026-06-25T16:02:20Z", durationMs: 140000, findingCount: 55, opportunityCount: 28, includeReasoning: true, status: "success", error: null },
];

const MOCK_SNAPSHOTS: EvolutionSnapshot[] = [
  {
    id: "snap-001", timestamp: "2026-06-30T10:02:34Z",
    maturity_scores: [
      { dimension: "architecture", level: "defined", score: 72, trend: "improving", evidence: ["Clean module boundaries"], recommendations: ["Reduce circular deps"] },
      { dimension: "security", level: "developing", score: 58, trend: "improving", evidence: ["OAuth 2.0 in use"], recommendations: ["Migrate to PKCE flow"] },
      { dimension: "reliability", level: "managed", score: 85, trend: "stable", evidence: ["Retry patterns in place"], recommendations: ["Add circuit breakers"] },
      { dimension: "testing", level: "developing", score: 62, trend: "improving", evidence: ["Unit test coverage 68%"], recommendations: ["Add integration tests"] },
    ],
    overall_health: 87, opportunity_count: 23, debt_count: 8, risk_count: 5,
    top_opportunities: ["OPP-2847", "OPP-2843", "OPP-2839"],
    changes_since_last: { new_opportunities: 4, resolved_opportunities: 2, new_risks: 1, resolved_risks: 0, maturity_changes: [{ dimension: "architecture", previous_score: 68, current_score: 72 }, { dimension: "security", previous_score: 54, current_score: 58 }] },
  },
  {
    id: "snap-002", timestamp: "2026-06-29T09:01:48Z",
    maturity_scores: [
      { dimension: "architecture", level: "defined", score: 68, trend: "stable", evidence: ["Module structure improving"], recommendations: ["Extract shared utils"] },
      { dimension: "security", level: "developing", score: 54, trend: "stable", evidence: ["Basic auth in place"], recommendations: ["Enable MFA"] },
      { dimension: "reliability", level: "managed", score: 84, trend: "stable", evidence: ["Error handling present"], recommendations: ["Add health checks"] },
    ],
    overall_health: 82, opportunity_count: 19, debt_count: 7, risk_count: 4,
    top_opportunities: ["OPP-2843", "OPP-2835"],
    changes_since_last: { new_opportunities: 2, resolved_opportunities: 3, new_risks: 0, resolved_risks: 1, maturity_changes: [{ dimension: "architecture", previous_score: 65, current_score: 68 }] },
  },
  {
    id: "snap-003", timestamp: "2026-06-28T14:32:12Z",
    maturity_scores: [
      { dimension: "architecture", level: "developing", score: 65, trend: "improving", evidence: ["Service boundaries defined"], recommendations: ["Document APIs"] },
      { dimension: "security", level: "initial", score: 48, trend: "declining", evidence: ["Deprecated auth flow"], recommendations: ["Upgrade OAuth library"] },
    ],
    overall_health: 76, opportunity_count: 25, debt_count: 10, risk_count: 6,
    top_opportunities: ["OPP-2847", "OPP-2843", "OPP-2839", "OPP-2835"],
    changes_since_last: { new_opportunities: 5, resolved_opportunities: 1, new_risks: 2, resolved_risks: 0, maturity_changes: [] },
  },
];

const MOCK_TREND_DATA: TrendData = {
  series: [
    { dimension: "overall_health", data_points: [{ timestamp: "2026-06-25T16:02:20Z", value: 71 }, { timestamp: "2026-06-27T08:16:55Z", value: 74 }, { timestamp: "2026-06-28T14:32:12Z", value: 76 }, { timestamp: "2026-06-29T09:01:48Z", value: 82 }, { timestamp: "2026-06-30T10:02:34Z", value: 87 }] },
    { dimension: "architecture", data_points: [{ timestamp: "2026-06-25T16:02:20Z", value: 60 }, { timestamp: "2026-06-27T08:16:55Z", value: 63 }, { timestamp: "2026-06-28T14:32:12Z", value: 65 }, { timestamp: "2026-06-29T09:01:48Z", value: 68 }, { timestamp: "2026-06-30T10:02:34Z", value: 72 }] },
    { dimension: "security", data_points: [{ timestamp: "2026-06-25T16:02:20Z", value: 45 }, { timestamp: "2026-06-27T08:16:55Z", value: 47 }, { timestamp: "2026-06-28T14:32:12Z", value: 48 }, { timestamp: "2026-06-29T09:01:48Z", value: 54 }, { timestamp: "2026-06-30T10:02:34Z", value: 58 }] },
    { dimension: "reliability", data_points: [{ timestamp: "2026-06-25T16:02:20Z", value: 80 }, { timestamp: "2026-06-27T08:16:55Z", value: 82 }, { timestamp: "2026-06-28T14:32:12Z", value: 83 }, { timestamp: "2026-06-29T09:01:48Z", value: 84 }, { timestamp: "2026-06-30T10:02:34Z", value: 85 }] },
  ],
  total: 4,
};

const MOCK_PROJECT_SNAPSHOTS: ProjectSnapshot[] = [
  { id: "snap-2026-06-30", date: "2026-06-30T10:02:34Z", health_score: 87, findings_count: 47, opportunities_count: 23, trigger: "scheduled", summary: "Steady improvement in architecture and security dimensions. 4 new opportunities identified.", dimensions: { architecture: 72, security: 58, reliability: 85, testing: 62 } },
  { id: "snap-2026-06-29", date: "2026-06-29T09:01:48Z", health_score: 82, findings_count: 42, opportunities_count: 19, trigger: "scheduled", summary: "Moderate progress with 3 opportunities resolved. Queue latency slightly elevated.", dimensions: { architecture: 68, security: 54, reliability: 84, testing: 60 } },
  { id: "snap-2026-06-28", date: "2026-06-28T14:32:12Z", health_score: 76, findings_count: 51, opportunities_count: 25, trigger: "manual", summary: "Spike in findings after new analyzer rules added. Security score dropped due to deprecated auth flow.", dimensions: { architecture: 65, security: 48, reliability: 83, testing: 58 } },
  { id: "snap-2026-06-27", date: "2026-06-27T08:16:55Z", health_score: 74, findings_count: 38, opportunities_count: 17, trigger: "scheduled", summary: "Baseline analysis after infrastructure changes. Reliability improved after circuit breaker addition.", dimensions: { architecture: 63, security: 47, reliability: 82, testing: 55 } },
  { id: "snap-2026-06-25", date: "2026-06-25T16:02:20Z", health_score: 71, findings_count: 55, opportunities_count: 28, trigger: "ci", summary: "CI-triggered analysis after major merge. High number of findings from new code paths.", dimensions: { architecture: 60, security: 45, reliability: 80, testing: 52 } },
  { id: "snap-2026-06-23", date: "2026-06-23T10:30:00Z", health_score: 69, findings_count: 48, opportunities_count: 22, trigger: "manual", summary: "Manual analysis requested by team lead. Focus on performance bottlenecks.", dimensions: { architecture: 58, security: 44, reliability: 78, testing: 50 } },
  { id: "snap-2026-06-20", date: "2026-06-20T08:00:00Z", health_score: 65, findings_count: 52, opportunities_count: 30, trigger: "scheduled", summary: "Weekly scheduled analysis. Architecture score improving after refactoring sprint.", dimensions: { architecture: 55, security: 42, reliability: 76, testing: 48 } },
  { id: "snap-2026-06-15", date: "2026-06-15T14:00:00Z", health_score: 60, findings_count: 58, opportunities_count: 35, trigger: "scheduled", summary: "Initial baseline scan of the codebase. Identified key areas for improvement.", dimensions: { architecture: 50, security: 38, reliability: 72, testing: 45 } },
];

// ─── Search Mock Data ────────────────────────────────────────────────────────

const MOCK_SEARCH_RESULTS: SearchResult[] = [
  { type: "opportunity", id: "OPP-2847", name: "Migrate legacy authentication to OAuth 2.1 PKCE flow", match: "OAuth 2.1 PKCE migration for improved security", score: 0.97 },
  { type: "finding", id: "FND-0042", name: "N+1 query pattern in order processing", match: "Detected N+1 query pattern causing 340% latency increase", score: 0.93 },
  { type: "entity", id: "ent_auth_service", name: "auth-service", match: "Authentication microservice handling OAuth flows", score: 0.89 },
  { type: "policy", id: "builtin-security", name: "Security Policies", match: "Ensure security-related findings are prioritized", score: 0.85 },
  { type: "experiment", id: "exp_002", name: "Auto-Fix Security", match: "Evaluate automatic security vulnerability fixing", score: 0.82 },
  { type: "entity", id: "ent_payment_gw", name: "payment-gateway", match: "External payment gateway integration module", score: 0.78 },
  { type: "finding", id: "FND-0019", name: "Docker image size exceeds 1.2GB", match: "Production images include build dependencies", score: 0.74 },
  { type: "opportunity", id: "OPP-2835", name: "Implement circuit breaker for payment gateway", match: "Circuit breaker pattern for external service resilience", score: 0.71 },
];

// ─── Scheduling Mock Data ────────────────────────────────────────────────────

const MOCK_SCHEDULES: ReportSchedule[] = [
  { id: 'sc1', name: 'Weekly Executive Summary', reportType: 'executive', cron: '0 9 * * 1', cronHuman: 'Every Monday at 9:00 AM', status: 'active', nextRun: '2026-07-07T09:00:00Z', recipients: ['ceo@acme.com', 'cto@acme.com'], format: 'pdf', createdBy: 'admin@recurrsive.dev' },
  { id: 'sc2', name: 'Daily Technical Report', reportType: 'technical', cron: '0 6 * * *', cronHuman: 'Every day at 6:00 AM', status: 'active', nextRun: '2026-07-02T06:00:00Z', recipients: ['team@recurrsive.dev'], format: 'html', createdBy: 'alice@recurrsive.dev' },
  { id: 'sc3', name: 'Monthly Compliance Audit', reportType: 'compliance', cron: '0 8 1 * *', cronHuman: '1st of every month at 8:00 AM', status: 'active', nextRun: '2026-08-01T08:00:00Z', recipients: ['compliance@acme.com'], format: 'pdf', createdBy: 'admin@recurrsive.dev' },
  { id: 'sc4', name: 'Bi-weekly Metrics Export', reportType: 'custom', cron: '0 10 1,15 * *', cronHuman: '1st & 15th at 10:00 AM', status: 'paused', nextRun: '2026-07-15T10:00:00Z', recipients: ['data@recurrsive.dev'], format: 'csv', createdBy: 'bob@recurrsive.dev' },
];

const MOCK_SCHEDULE_HISTORY: ScheduleRunHistory[] = [
  { id: 'r1', scheduleId: 'sc1', scheduleName: 'Weekly Executive Summary', status: 'success', startedAt: '2026-06-30T09:00:00Z', completedAt: '2026-06-30T09:02:15Z', fileSize: '2.4 MB', downloadUrl: '#' },
  { id: 'r2', scheduleId: 'sc2', scheduleName: 'Daily Technical Report', status: 'success', startedAt: '2026-07-01T06:00:00Z', completedAt: '2026-07-01T06:01:30Z', fileSize: '1.1 MB', downloadUrl: '#' },
  { id: 'r3', scheduleId: 'sc3', scheduleName: 'Monthly Compliance Audit', status: 'success', startedAt: '2026-07-01T08:00:00Z', completedAt: '2026-07-01T08:05:42Z', fileSize: '5.8 MB', downloadUrl: '#' },
  { id: 'r4', scheduleId: 'sc2', scheduleName: 'Daily Technical Report', status: 'failed', startedAt: '2026-06-30T06:00:00Z', completedAt: '2026-06-30T06:00:45Z', fileSize: '—', downloadUrl: '' },
  { id: 'r5', scheduleId: 'sc1', scheduleName: 'Weekly Executive Summary', status: 'success', startedAt: '2026-06-23T09:00:00Z', completedAt: '2026-06-23T09:02:00Z', fileSize: '2.3 MB', downloadUrl: '#' },
];

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get timeline data from `GET /api/v1/timeline/trends`.
 */
export async function getTimeline(): Promise<TimelinePoint[]> {
  try {
    const raw = await apiFetch<{
      data: Array<{
        dimension: string;
        data_points: Array<{ timestamp: string; value: number }>;
      }>;
    } | null>("/api/v1/timeline/trends", null);

    if (!raw?.data?.length) return MOCK_TIMELINE;

    // Transpose dimension-keyed data into date-keyed TimelinePoints
    const dateMap = new Map<string, TimelinePoint>();

    for (const dim of raw.data) {
      for (const pt of dim.data_points) {
        const date = pt.timestamp.slice(5, 10).replace("-", "/"); // "2026-06-15" → "06/15"
        if (!dateMap.has(date)) {
          dateMap.set(date, { date, healthScore: 0, quality: 0, reliability: 0, performance: 0 });
        }
        const entry = dateMap.get(date)!;
        if (dim.dimension.includes("health") || dim.dimension.includes("overall")) entry.healthScore = Math.round(pt.value);
        else if (dim.dimension.includes("quality") || dim.dimension.includes("code")) entry.quality = Math.round(pt.value);
        else if (dim.dimension.includes("reliability") || dim.dimension.includes("sre")) entry.reliability = Math.round(pt.value);
        else if (dim.dimension.includes("performance") || dim.dimension.includes("perf")) entry.performance = Math.round(pt.value);
      }
    }

    const points = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return points.length > 0 ? points : MOCK_TIMELINE;
  } catch {
    return MOCK_TIMELINE;
  }
}

/**
 * Get analysis history from `GET /api/v1/analysis/history`.
 */
export async function getTimelineHistory(): Promise<AnalysisHistoryEntry[]> {
  try {
    const raw = await apiFetch<{ data: AnalysisHistoryEntry[] } | null>("/api/v1/analysis/history", null);
    if (!raw?.data?.length) return MOCK_ANALYSIS_HISTORY;
    return raw.data;
  } catch {
    return MOCK_ANALYSIS_HISTORY;
  }
}

/**
 * Get evolution snapshots from `GET /api/v1/timeline/snapshots`.
 */
export async function getTimelineSnapshots(): Promise<EvolutionSnapshot[]> {
  try {
    const raw = await apiFetch<{ data: EvolutionSnapshot[]; total: number } | null>("/api/v1/timeline/snapshots", null);
    if (!raw?.data?.length) return MOCK_SNAPSHOTS;
    return raw.data;
  } catch {
    return MOCK_SNAPSHOTS;
  }
}

/**
 * Get trend data from `GET /api/v1/timeline/trends`.
 */
export async function getTimelineTrends(): Promise<TrendData> {
  try {
    const raw = await apiFetch<{ data: TrendSeries[]; total: number } | null>("/api/v1/timeline/trends", null);
    if (!raw?.data?.length) return MOCK_TREND_DATA;
    return { series: raw.data, total: raw.total };
  } catch {
    return MOCK_TREND_DATA;
  }
}

/**
 * Get project snapshots for the timeline page.
 */
export async function getSnapshots(): Promise<ProjectSnapshot[]> {
  try {
    const raw = await apiFetch<{ data: ProjectSnapshot[]; total: number } | null>("/api/v1/snapshots", null);
    if (!raw?.data?.length) return MOCK_PROJECT_SNAPSHOTS;
    return raw.data;
  } catch {
    return MOCK_PROJECT_SNAPSHOTS;
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

    const raw = await apiFetch<{ data: SearchResult[]; total: number } | null>(
      `/api/v1/search?${params.toString()}`,
      null,
    );

    if (raw?.data?.length) return raw.data;
  } catch {
    // Fall through to mock filtering
  }

  // Filter mock results by query (case-insensitive substring match)
  const q = query.toLowerCase();
  let results = MOCK_SEARCH_RESULTS.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.match.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q),
  );

  // Apply scope filter if provided
  if (scope) {
    results = results.filter((r) => r.type === scope);
  }

  // Return all mock results if query is too broad (fallback)
  return results.length > 0 ? results : MOCK_SEARCH_RESULTS;
}

export async function getSchedules(): Promise<ReportSchedule[]> {
  try {
    const res = await apiFetch<{ schedules: ReportSchedule[] } | null>('/api/v1/schedules', null);
    if (res?.schedules) return res.schedules;
  } catch { /* fall through */ }
  return MOCK_SCHEDULES;
}

export async function getScheduleHistory(): Promise<ScheduleRunHistory[]> {
  try {
    const res = await apiFetch<{ runs: ScheduleRunHistory[] } | null>('/api/v1/schedules/history', null);
    if (res?.runs) return res.runs;
  } catch { /* fall through */ }
  return MOCK_SCHEDULE_HISTORY;
}

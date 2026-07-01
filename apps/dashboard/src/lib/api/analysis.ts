/**
 * @module Analysis API
 *
 * Analysis runs, findings, batch operations, and analytics.
 */

import { apiFetch, seededRandom } from "./client.js";

// ─── Finding Types ───────────────────────────────────────────────────────────

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
  resolved: number;
  categories: AnalysisRunCategory[];
}

export interface ComparisonData {
  runA: AnalysisRun;
  runB: AnalysisRun;
  health_delta: number;
  findings_delta: number;
  resolution_rate_a: number;
  resolution_rate_b: number;
  resolution_rate_delta: number;
  new_findings: number;
  findings_resolved: number;
}

// ─── Batch Types ─────────────────────────────────────────────────────────────

export interface BatchProject {
  path: string;
  status: "pending" | "running" | "completed" | "failed";
  findings_count?: number;
  opportunities_count?: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface BatchRun {
  batch_id: string;
  status: "pending" | "running" | "completed" | "partial" | "failed";
  projects: BatchProject[];
  created_at: string;
  completed_at?: string;
}

export interface BatchJobTask {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at?: string;
  completed_at?: string;
  error?: string;
  findings_count?: number;
}

export interface BatchJobDetail {
  batch_id: string;
  name: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  items_processed: number;
  total_items: number;
  duration_ms: number;
  started_at: string;
  completed_at?: string;
  tasks: BatchJobTask[];
  errors: string[];
}

// ─── Analytics Types ─────────────────────────────────────────────────────────

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

export interface AnalyticsCategory {
  name: string;
  count: number;
  percentage: number;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_FINDINGS_SUMMARY: FindingsSummary = {
  total: 47,
  by_severity: { critical: 3, high: 12, medium: 19, low: 13 },
  by_category: { security: 8, performance: 11, architecture: 9, reliability: 7, cost: 5, documentation: 7 },
  by_analyzer: { architecture: 9, security: 8, performance: 11, cost: 5, reliability: 7, documentation: 7 },
};

const MOCK_FINDINGS_PAGE: FindingsPageData = {
  findings: [
    { id: "FND-001", title: "SQL injection vulnerability in user search endpoint", severity: "critical", category: "Security", status: "open", assignee: "Alice Chen", created_at: "2026-06-30T08:12:00Z" },
    { id: "FND-002", title: "Hardcoded API key in configuration module", severity: "critical", category: "Security", status: "open", assignee: "Bob Kim", created_at: "2026-06-29T14:30:00Z" },
    { id: "FND-003", title: "Memory leak in WebSocket connection handler", severity: "high", category: "Performance", status: "open", assignee: "Carol Diaz", created_at: "2026-06-29T09:15:00Z" },
    { id: "FND-004", title: "Missing rate limiting on public API endpoints", severity: "high", category: "Security", status: "open", assignee: "Alice Chen", created_at: "2026-06-28T16:45:00Z" },
    { id: "FND-005", title: "Circular dependency between order and inventory modules", severity: "medium", category: "Architecture", status: "resolved", assignee: "Dave Patel", created_at: "2026-06-28T11:20:00Z" },
    { id: "FND-006", title: "Unhandled promise rejection in payment callback", severity: "high", category: "Reliability", status: "open", assignee: "Eve Torres", created_at: "2026-06-27T15:00:00Z" },
    { id: "FND-007", title: "Missing CSRF protection on state-changing endpoints", severity: "medium", category: "Security", status: "suppressed", assignee: "Alice Chen", created_at: "2026-06-27T10:30:00Z" },
    { id: "FND-008", title: "Excessive logging causing disk space issues", severity: "low", category: "Operations", status: "resolved", assignee: "Frank Nguyen", created_at: "2026-06-26T14:15:00Z" },
    { id: "FND-009", title: "Deprecated crypto algorithm in token generation", severity: "medium", category: "Security", status: "open", assignee: "Bob Kim", created_at: "2026-06-26T09:00:00Z" },
    { id: "FND-010", title: "Missing health check endpoint for load balancer", severity: "low", category: "Reliability", status: "open", assignee: "Carol Diaz", created_at: "2026-06-25T17:30:00Z" },
  ],
  stats: { total: 10, critical: 2, high: 3, medium: 3, low: 2 },
};

const MOCK_ANALYSIS_RUNS: AnalysisRun[] = [
  {
    id: "run_001",
    label: "Run #1",
    date: "2026-06-20T08:00:00Z",
    health_score: 71,
    findings: 55,
    resolved: 18,
    categories: [
      { name: "Security", count: 12 },
      { name: "Performance", count: 16 },
      { name: "Architecture", count: 10 },
      { name: "Reliability", count: 9 },
      { name: "Cost", count: 8 },
    ],
  },
  {
    id: "run_002",
    label: "Run #2",
    date: "2026-06-23T10:30:00Z",
    health_score: 76,
    findings: 48,
    resolved: 22,
    categories: [
      { name: "Security", count: 10 },
      { name: "Performance", count: 14 },
      { name: "Architecture", count: 9 },
      { name: "Reliability", count: 8 },
      { name: "Cost", count: 7 },
    ],
  },
  {
    id: "run_003",
    label: "Run #3",
    date: "2026-06-25T14:15:00Z",
    health_score: 80,
    findings: 42,
    resolved: 28,
    categories: [
      { name: "Security", count: 8 },
      { name: "Performance", count: 12 },
      { name: "Architecture", count: 8 },
      { name: "Reliability", count: 7 },
      { name: "Cost", count: 7 },
    ],
  },
  {
    id: "run_004",
    label: "Run #4",
    date: "2026-06-28T09:00:00Z",
    health_score: 84,
    findings: 38,
    resolved: 31,
    categories: [
      { name: "Security", count: 6 },
      { name: "Performance", count: 11 },
      { name: "Architecture", count: 8 },
      { name: "Reliability", count: 6 },
      { name: "Cost", count: 7 },
    ],
  },
  {
    id: "run_005",
    label: "Run #5",
    date: "2026-06-30T10:00:00Z",
    health_score: 87,
    findings: 34,
    resolved: 29,
    categories: [
      { name: "Security", count: 5 },
      { name: "Performance", count: 9 },
      { name: "Architecture", count: 7 },
      { name: "Reliability", count: 6 },
      { name: "Cost", count: 7 },
    ],
  },
];

const MOCK_BATCH_RUNS: BatchRun[] = [
  {
    batch_id: "batch_000003",
    status: "running",
    projects: [
      {
        path: "/home/user/projects/api-gateway",
        status: "completed",
        findings_count: 12,
        opportunities_count: 4,
        started_at: "2026-06-30T14:00:00Z",
        completed_at: "2026-06-30T14:02:15Z",
      },
      {
        path: "/home/user/projects/auth-service",
        status: "running",
        findings_count: 0,
        opportunities_count: 0,
        started_at: "2026-06-30T14:02:16Z",
      },
      {
        path: "/home/user/projects/payment-service",
        status: "pending",
      },
    ],
    created_at: "2026-06-30T14:00:00Z",
  },
  {
    batch_id: "batch_000002",
    status: "completed",
    projects: [
      {
        path: "/home/user/projects/web-client",
        status: "completed",
        findings_count: 23,
        opportunities_count: 8,
        started_at: "2026-06-29T10:00:00Z",
        completed_at: "2026-06-29T10:03:45Z",
      },
      {
        path: "/home/user/projects/admin-portal",
        status: "completed",
        findings_count: 15,
        opportunities_count: 5,
        started_at: "2026-06-29T10:03:46Z",
        completed_at: "2026-06-29T10:06:12Z",
      },
      {
        path: "/home/user/projects/notification-service",
        status: "completed",
        findings_count: 8,
        opportunities_count: 3,
        started_at: "2026-06-29T10:06:13Z",
        completed_at: "2026-06-29T10:08:00Z",
      },
    ],
    created_at: "2026-06-29T10:00:00Z",
    completed_at: "2026-06-29T10:08:00Z",
  },
  {
    batch_id: "batch_000001",
    status: "partial",
    projects: [
      {
        path: "/home/user/projects/order-service",
        status: "completed",
        findings_count: 19,
        opportunities_count: 6,
        started_at: "2026-06-28T08:00:00Z",
        completed_at: "2026-06-28T08:02:30Z",
      },
      {
        path: "/home/user/projects/inventory-service",
        status: "failed",
        error: "Analysis failed: unable to parse project configuration",
        started_at: "2026-06-28T08:02:31Z",
        completed_at: "2026-06-28T08:03:10Z",
      },
      {
        path: "/home/user/projects/search-service",
        status: "completed",
        findings_count: 11,
        opportunities_count: 4,
        started_at: "2026-06-28T08:03:11Z",
        completed_at: "2026-06-28T08:05:00Z",
      },
    ],
    created_at: "2026-06-28T08:00:00Z",
    completed_at: "2026-06-28T08:05:00Z",
  },
];

const MOCK_BATCH_JOB_DETAILS: Record<string, BatchJobDetail> = {
  batch_000003: {
    batch_id: "batch_000003",
    name: "Multi-Repo Analysis — Sprint 12",
    status: "running",
    progress_percent: 45,
    items_processed: 1,
    total_items: 3,
    duration_ms: 135000,
    started_at: "2026-06-30T14:00:00Z",
    tasks: [
      { id: "task-001", name: "api-gateway analysis", status: "completed", started_at: "2026-06-30T14:00:00Z", completed_at: "2026-06-30T14:02:15Z", findings_count: 12 },
      { id: "task-002", name: "auth-service analysis", status: "running", started_at: "2026-06-30T14:02:16Z" },
      { id: "task-003", name: "payment-service analysis", status: "pending" },
    ],
    errors: [],
  },
  batch_000002: {
    batch_id: "batch_000002",
    name: "Frontend Services Scan",
    status: "completed",
    progress_percent: 100,
    items_processed: 3,
    total_items: 3,
    duration_ms: 480000,
    started_at: "2026-06-29T10:00:00Z",
    completed_at: "2026-06-29T10:08:00Z",
    tasks: [
      { id: "task-004", name: "web-client analysis", status: "completed", started_at: "2026-06-29T10:00:00Z", completed_at: "2026-06-29T10:03:45Z", findings_count: 23 },
      { id: "task-005", name: "admin-portal analysis", status: "completed", started_at: "2026-06-29T10:03:46Z", completed_at: "2026-06-29T10:06:12Z", findings_count: 15 },
      { id: "task-006", name: "notification-service analysis", status: "completed", started_at: "2026-06-29T10:06:13Z", completed_at: "2026-06-29T10:08:00Z", findings_count: 8 },
    ],
    errors: [],
  },
  batch_000001: {
    batch_id: "batch_000001",
    name: "Backend Services Audit",
    status: "failed",
    progress_percent: 67,
    items_processed: 2,
    total_items: 3,
    duration_ms: 300000,
    started_at: "2026-06-28T08:00:00Z",
    completed_at: "2026-06-28T08:05:00Z",
    tasks: [
      { id: "task-007", name: "order-service analysis", status: "completed", started_at: "2026-06-28T08:00:00Z", completed_at: "2026-06-28T08:02:30Z", findings_count: 19 },
      { id: "task-008", name: "inventory-service analysis", status: "failed", started_at: "2026-06-28T08:02:31Z", completed_at: "2026-06-28T08:03:10Z", error: "Analysis failed: unable to parse project configuration" },
      { id: "task-009", name: "search-service analysis", status: "completed", started_at: "2026-06-28T08:03:11Z", completed_at: "2026-06-28T08:05:00Z", findings_count: 11 },
    ],
    errors: ["inventory-service: Analysis failed — unable to parse project configuration. Check .recurrsive.yaml for syntax errors."],
  },
};

function generateAnalyticsTrends(): AnalyticsTrendPoint[] {
  const points: AnalyticsTrendPoint[] = [];
  const baseDate = new Date("2026-04-06");

  for (let week = 0; week < 12; week++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + week * 7);
    const dateStr = date.toISOString().slice(0, 10);

    const noise = (s: number) => seededRandom(week * 137 + s) * 8 - 4;
    const findings = Math.round(30 + week * 1.5 + noise(0));
    const resolved = Math.round(findings * (0.45 + week * 0.015 + noise(1) * 0.03));
    const health = Math.round(68 + week * 0.8 + noise(2));

    points.push({
      date: dateStr,
      findings: Math.max(findings, 10),
      resolved: Math.max(Math.min(resolved, findings), 0),
      health: Math.max(Math.min(health, 100), 50),
    });
  }

  return points;
}

const MOCK_ANALYTICS_TRENDS = generateAnalyticsTrends();

const MOCK_ANALYTICS_SUMMARY: AnalyticsSummary = (() => {
  const totalFindings = MOCK_ANALYTICS_TRENDS.reduce((s, t) => s + t.findings, 0);
  const totalResolved = MOCK_ANALYTICS_TRENDS.reduce((s, t) => s + t.resolved, 0);
  const avgHealth =
    Math.round(
      (MOCK_ANALYTICS_TRENDS.reduce((s, t) => s + t.health, 0) / MOCK_ANALYTICS_TRENDS.length) * 10,
    ) / 10;

  return {
    analysis_runs: 47,
    total_findings: totalFindings,
    findings_resolved: totalResolved,
    resolution_rate: Math.round((totalResolved / totalFindings) * 1000) / 10,
    avg_health_score: avgHealth,
    trends: MOCK_ANALYTICS_TRENDS,
  };
})();

const MOCK_ANALYTICS_CATEGORIES: AnalyticsCategory[] = [
  { name: "Security", count: 42, percentage: 13.5 },
  { name: "Performance", count: 68, percentage: 21.8 },
  { name: "Architecture", count: 54, percentage: 17.3 },
  { name: "Reliability", count: 39, percentage: 12.5 },
  { name: "Cost", count: 28, percentage: 9.0 },
  { name: "Documentation", count: 35, percentage: 11.2 },
  { name: "Testing", count: 26, percentage: 8.3 },
  { name: "DevOps", count: 20, percentage: 6.4 },
];

// ─── API Functions ───────────────────────────────────────────────────────────

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
    const raw = await apiFetch<{
      data: {
        phase: string;
        progress: number;
        message: string;
        startedAt: string | null;
        completedAt: string | null;
        error: string | null;
      };
    } | null>("/api/v1/analysis/status", null);

    return raw?.data ?? {
      phase: "idle",
      progress: 0,
      message: "No analysis running",
      startedAt: null,
      completedAt: null,
      error: null,
    };
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
  return apiFetch("/api/v1/findings/summary", MOCK_FINDINGS_SUMMARY);
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

  return apiFetch(path, { findings: [], total: 0 });
}

/**
 * Get a single finding by ID from `GET /api/v1/findings/:id`.
 */
export async function getFinding(id: string): Promise<Finding | null> {
  try {
    const finding = await apiFetch<Finding | null>(
      `/api/v1/findings/${encodeURIComponent(id)}`,
      null,
    );
    return finding;
  } catch {
    return null;
  }
}

/**
 * Get findings page data with stats and filterable list.
 */
export async function getFindingsPage(): Promise<FindingsPageData> {
  try {
    const raw = await apiFetch<{ data: FindingsPageData } | null>(
      "/api/v1/findings/page",
      null,
    );
    return raw?.data ?? MOCK_FINDINGS_PAGE;
  } catch {
    return MOCK_FINDINGS_PAGE;
  }
}

/**
 * Get all analysis runs for comparison selection.
 */
export async function getAnalysisRuns(): Promise<AnalysisRun[]> {
  try {
    const raw = await apiFetch<{
      data: AnalysisRun[];
    } | null>("/api/v1/analysis/runs", null);

    if (!raw?.data?.length) return MOCK_ANALYSIS_RUNS;
    return raw.data;
  } catch {
    return MOCK_ANALYSIS_RUNS;
  }
}

/**
 * Get comparison data between two analysis runs.
 */
export async function getComparisonData(
  runAId: string,
  runBId: string,
): Promise<ComparisonData | null> {
  try {
    const raw = await apiFetch<{
      data: ComparisonData;
    } | null>(`/api/v1/analysis/compare?run_a=${encodeURIComponent(runAId)}&run_b=${encodeURIComponent(runBId)}`, null);

    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock computation
  }

  // Compute from mock data
  const runA = MOCK_ANALYSIS_RUNS.find((r) => r.id === runAId);
  const runB = MOCK_ANALYSIS_RUNS.find((r) => r.id === runBId);

  if (!runA || !runB) return null;

  const resRateA = runA.findings > 0 ? (runA.resolved / runA.findings) * 100 : 0;
  const resRateB = runB.findings > 0 ? (runB.resolved / runB.findings) * 100 : 0;

  return {
    runA,
    runB,
    health_delta: runB.health_score - runA.health_score,
    findings_delta: runB.findings - runA.findings,
    resolution_rate_a: Math.round(resRateA * 10) / 10,
    resolution_rate_b: Math.round(resRateB * 10) / 10,
    resolution_rate_delta: Math.round((resRateB - resRateA) * 10) / 10,
    new_findings: Math.max(0, runB.findings - runA.resolved),
    findings_resolved: Math.max(0, runA.findings - runB.findings + runB.resolved - runA.resolved),
  };
}

/**
 * Get batch analysis history from `GET /api/v1/batch/history`.
 *
 * Server returns: `{ data: BatchRun[], total }`
 */
export async function getBatchHistory(): Promise<BatchRun[]> {
  try {
    const raw = await apiFetch<{
      data: BatchRun[];
      total: number;
    } | null>("/api/v1/batch/history", null);

    if (!raw?.data?.length) return MOCK_BATCH_RUNS;
    return raw.data;
  } catch {
    return MOCK_BATCH_RUNS;
  }
}

/**
 * Get status of a specific batch run from `GET /api/v1/batch/status/:id`.
 *
 * Server returns: `{ data: BatchRun }`
 */
export async function getBatchStatus(id: string): Promise<BatchRun | null> {
  try {
    const raw = await apiFetch<{
      data: BatchRun;
    } | null>(`/api/v1/batch/status/${encodeURIComponent(id)}`, null);

    if (!raw?.data) {
      return MOCK_BATCH_RUNS.find((b) => b.batch_id === id) ?? null;
    }
    return raw.data;
  } catch {
    return MOCK_BATCH_RUNS.find((b) => b.batch_id === id) ?? null;
  }
}

/**
 * Get a single batch job detail by ID.
 */
export async function getBatchJob(id: string): Promise<BatchJobDetail | null> {
  try {
    const raw = await apiFetch<{ data: BatchJobDetail } | null>(
      `/api/v1/batch/${encodeURIComponent(id)}`,
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_BATCH_JOB_DETAILS[id] ?? null;
}

/**
 * Get analytics summary from `GET /api/v1/analytics/summary`.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  try {
    const raw = await apiFetch<AnalyticsSummary | null>(
      "/api/v1/analytics/summary",
      null,
    );

    return raw ?? MOCK_ANALYTICS_SUMMARY;
  } catch {
    return MOCK_ANALYTICS_SUMMARY;
  }
}

/**
 * Get analytics categories from `GET /api/v1/analytics/top-categories`.
 */
export async function getAnalyticsCategories(): Promise<AnalyticsCategory[]> {
  try {
    const raw = await apiFetch<{
      categories: AnalyticsCategory[];
    } | null>("/api/v1/analytics/top-categories", null);

    if (!raw?.categories?.length) return MOCK_ANALYTICS_CATEGORIES;
    return raw.categories;
  } catch {
    return MOCK_ANALYTICS_CATEGORIES;
  }
}

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

// ─── Mock Data ───────────────────────────────────────────────────────────────

import { seededRandom } from './client';

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

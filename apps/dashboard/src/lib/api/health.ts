/**
 * @module Health API
 *
 * Health score, dimension data, performance metrics, and system health dashboard.
 */

import { apiFetch, miniSparkline } from "./client.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HealthMetrics {
  healthScore: number;
  healthTrend: number;
  qualityScore: number;
  qualityTrend: number;
  opportunities: number;
  newOpportunities: number;
  techDebt: number;
  techDebtTrend: number;
  aiQualityScore: number;
  aiQualityTrend: number;
}

export interface PerformanceMetric {
  label: string;
  value: string;
  unit: string;
  trend: number;
  data: { value: number }[];
}

export interface SystemNode {
  id: string;
  name: string;
  type: string;
  health: number;
  connections: string[];
}

export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency_ms?: number;
  uptime_percent?: number;
  last_check: string;
}

export interface HealthDashboardData {
  overall_score: number;
  api_latency_ms: number;
  memory_usage_percent: number;
  cpu_usage_percent: number;
  uptime_days: number;
  services: ServiceStatus[];
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_HEALTH: HealthMetrics = {
  healthScore: 87,
  healthTrend: 4.2,
  qualityScore: 91,
  qualityTrend: 2.1,
  opportunities: 23,
  newOpportunities: 7,
  techDebt: 142500,
  techDebtTrend: -8.3,
  aiQualityScore: 94,
  aiQualityTrend: 1.8,
};

const MOCK_PERFORMANCE: PerformanceMetric[] = [
  {
    label: "Avg Response Time",
    value: "142",
    unit: "ms",
    trend: -12.5,
    data: miniSparkline(150, 14, 20),
  },
  {
    label: "Total Requests",
    value: "2.4M",
    unit: "req",
    trend: 8.3,
    data: miniSparkline(2200, 14, 300),
  },
  {
    label: "Error Rate",
    value: "0.12",
    unit: "%",
    trend: -23.1,
    data: miniSparkline(0.15, 14, 0.05),
  },
  {
    label: "Availability",
    value: "99.97",
    unit: "%",
    trend: 0.02,
    data: miniSparkline(99.95, 14, 0.03),
  },
];

const MOCK_HEALTH_DASHBOARD: HealthDashboardData = {
  overall_score: 92,
  api_latency_ms: 142,
  memory_usage_percent: 67,
  cpu_usage_percent: 34,
  uptime_days: 42,
  services: [
    { name: "Database (PostgreSQL)", status: "healthy", latency_ms: 8, uptime_percent: 99.99, last_check: "2026-06-30T20:40:00Z" },
    { name: "Cache (Redis)", status: "healthy", latency_ms: 2, uptime_percent: 99.98, last_check: "2026-06-30T20:40:00Z" },
    { name: "Queue (RabbitMQ)", status: "degraded", latency_ms: 45, uptime_percent: 99.85, last_check: "2026-06-30T20:40:00Z" },
    { name: "Storage (S3)", status: "healthy", latency_ms: 22, uptime_percent: 99.99, last_check: "2026-06-30T20:40:00Z" },
  ],
};

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Get health metrics from `GET /api/v1/health-score`.
 *
 * Server returns: `{ overall_health, dimensions, snapshot, finding_count, opportunity_count, analyzed_at }`
 * Dashboard needs: `HealthMetrics` shape with scores and trends.
 */
export async function getHealthMetrics(): Promise<HealthMetrics> {
  try {
    const raw = await apiFetch<{
      overall_health: number;
      dimensions: Record<string, number>;
      health_trend: number;
      tech_debt: number;
      finding_count: number;
      opportunity_count: number;
    } | null>("/api/v1/health-score", null);

    if (!raw) return MOCK_HEALTH;

    const healthTrend = raw.health_trend ?? 0;
    const codeQuality = raw.dimensions?.code_quality ?? raw.dimensions?.documentation ?? 91;
    const aiQuality = raw.dimensions?.ai_readiness ?? raw.dimensions?.security ?? 94;

    return {
      healthScore: raw.overall_health,
      healthTrend,
      qualityScore: codeQuality,
      qualityTrend: healthTrend > 0 ? healthTrend * 0.5 : 0,
      opportunities: raw.opportunity_count,
      newOpportunities: Math.min(7, raw.opportunity_count),
      techDebt: raw.tech_debt ?? raw.finding_count * 3000,
      techDebtTrend: healthTrend > 0 ? -healthTrend * 2 : 0,
      aiQualityScore: aiQuality,
      aiQualityTrend: healthTrend > 0 ? healthTrend * 0.4 : 0,
    };
  } catch {
    return MOCK_HEALTH;
  }
}

/**
 * Get performance metrics from `GET /api/v1/metrics/performance`.
 * Falls back to mock data when the server is unavailable.
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetric[]> {
  const raw = await apiFetch<{ data: PerformanceMetric[] } | null>(
    "/api/v1/metrics/performance",
    null,
  );
  if (raw?.data) return raw.data;
  return MOCK_PERFORMANCE;
}

/**
 * Get system health dashboard data.
 */
export async function getHealthDashboard(): Promise<HealthDashboardData> {
  try {
    const raw = await apiFetch<{ data: HealthDashboardData } | null>(
      "/api/v1/health/dashboard",
      null,
    );
    return raw?.data ?? MOCK_HEALTH_DASHBOARD;
  } catch {
    return MOCK_HEALTH_DASHBOARD;
  }
}

/**
 * @module Health API
 *
 * Health score metrics, performance metrics, and dimension data.
 */

import { apiFetch } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HealthMetrics {
  healthScore: number;
  healthTrend: number;
  documentationScore: number;
  securityScore: number;
  opportunities: number;
  findingCount: number;
  analyzedAt: string | null;
}

export interface PerformanceMetric {
  label: string;
  value: string;
  unit: string;
  trend: number;
  data: { value: number }[];
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

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get health metrics from `GET /api/v1/health-score`.
 *
 * Server returns: `{ overall_health, dimensions, snapshot, finding_count, opportunity_count, analyzed_at }`
 * Dashboard needs: `HealthMetrics` shape with scores and trends.
 */
export async function getHealthMetrics(projectId?: string): Promise<HealthMetrics> {
  const raw = await apiFetch<{
    overall_health: number;
    dimensions: Record<string, number>;
    health_trend: number;
    finding_count: number;
    opportunity_count: number;
    analyzed_at: string | null;
  }>("/api/v1/health-score", { projectId });

  return {
    healthScore: raw.overall_health,
    healthTrend: raw.health_trend ?? 0,
    documentationScore: raw.dimensions?.documentation ?? 0,
    securityScore: raw.dimensions?.security ?? 0,
    opportunities: raw.opportunity_count,
    findingCount: raw.finding_count,
    analyzedAt: raw.analyzed_at ?? null,
  };
}

/**
 * Get performance metrics from `GET /api/v1/metrics/performance`.
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetric[]> {
  return apiFetch<PerformanceMetric[]>("/api/v1/metrics/performance");
}

/**
 * Get system health dashboard data.
 */
export async function getHealthDashboard(projectId?: string): Promise<HealthDashboardData> {
  return apiFetch<HealthDashboardData>("/api/v1/health/dashboard", { projectId });
}

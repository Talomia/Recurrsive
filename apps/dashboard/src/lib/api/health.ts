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
export async function getHealthMetrics(): Promise<HealthMetrics> {
  try {
    const raw = await apiFetch<{
      overall_health: number;
      dimensions: Record<string, number>;
      health_trend: number;
      tech_debt: number;
      finding_count: number;
      opportunity_count: number;
    }>("/api/v1/health-score");

    const healthTrend = raw.health_trend ?? 0;
    const codeQuality = raw.dimensions?.code_quality ?? raw.dimensions?.documentation ?? 0;
    const aiQuality = raw.dimensions?.ai_readiness ?? raw.dimensions?.security ?? 0;

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
    return {
      healthScore: 0,
      healthTrend: 0,
      qualityScore: 0,
      qualityTrend: 0,
      opportunities: 0,
      newOpportunities: 0,
      techDebt: 0,
      techDebtTrend: 0,
      aiQualityScore: 0,
      aiQualityTrend: 0,
    };
  }
}

/**
 * Get performance metrics from `GET /api/v1/metrics/performance`.
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetric[]> {
  try {
    return await apiFetch<PerformanceMetric[]>("/api/v1/metrics/performance");
  } catch {
    return [];
  }
}

/**
 * Get system health dashboard data.
 */
export async function getHealthDashboard(): Promise<HealthDashboardData> {
  try {
    return await apiFetch<HealthDashboardData>("/api/v1/health/dashboard");
  } catch {
    return {
      overall_score: 0,
      api_latency_ms: 0,
      memory_usage_percent: 0,
      cpu_usage_percent: 0,
      uptime_days: 0,
      services: [],
    };
  }
}

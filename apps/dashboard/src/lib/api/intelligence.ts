/**
 * @module Intelligence API
 *
 * Forecasting and confidence analysis.
 */

import { apiFetch } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ForecastData {
  available: boolean;
  requiredHistoryPoints: number;
  currentScore: number;
  trend: 'improving' | 'declining' | 'stable' | 'insufficient-data';
  trendStrength: number;
  confidence: number;
  history: Array<{ date: string; score: number }>;
  forecast: Array<{ date: string; predicted: number; lowerBound: number; upperBound: number }>;
  targets: Array<{ target: number; daysToReach: number | null; reachable: boolean }>;
  regression: { slope: number; intercept: number; r2: number };
}

export interface EvolutionEvent {
  id: string;
  date: string;
  type: 'analysis';
  title: string;
  description: string;
  healthImpact: number;
  learnings: string[];
}

export interface EvolutionData {
  events: EvolutionEvent[];
  trajectory: Array<{ date: string; score: number; event: string }>;
  currentScore: number;
  totalAnalyses: number;
  netHealthChange: number;
  allLearnings: string[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get health forecast data from `GET /api/v1/forecasting/health`.
 */
export async function getForecast(): Promise<ForecastData> {
  return apiFetch<ForecastData>("/api/v1/forecasting/health");
}

/**
 * Get evolution graph data from `GET /api/v1/forecasting/evolution`.
 */
export async function getEvolution(): Promise<EvolutionData> {
  return apiFetch<EvolutionData>("/api/v1/forecasting/evolution");
}

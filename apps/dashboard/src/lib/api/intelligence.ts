/**
 * @module Intelligence API
 *
 * Forecasting, simulation, confidence, and what-if analysis.
 */

import { apiFetch } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ForecastData {
  currentScore: number;
  trend: 'improving' | 'declining' | 'stable';
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
  type: 'decision' | 'milestone' | 'incident' | 'experiment';
  title: string;
  description: string;
  outcome: string;
  healthImpact: number;
  learnings: string[];
}

export interface EvolutionData {
  events: EvolutionEvent[];
  trajectory: Array<{ date: string; score: number; event: string }>;
  currentScore: number;
  totalDecisions: number;
  totalMilestones: number;
  totalIncidents: number;
  totalExperiments: number;
  netHealthImpact: number;
  allLearnings: string[];
}

export interface WhatIfResult {
  currentScore: number;
  projectedScore: number;
  totalImpact: number;
  actions: Array<{
    id: string;
    type: string;
    description: string;
    impact: {
      healthScoreDelta: number;
      confidence: number;
      timeToRealize: string;
      affectedDimensions: string[];
    };
  }>;
  summary: {
    highestImpact: string | null;
    totalActions: number;
    avgConfidence: number;
    recommendation: string;
  };
}

export interface SimulationScenario {
  id: string;
  name: string;
  type: 'monte-carlo' | 'stress-test' | 'what-if' | 'chaos';
  status: 'completed' | 'running' | 'queued' | 'failed';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number;
  duration: string;
  createdAt: string;
  metrics: { label: string; value: string }[];
  timeline: { time: string; label: string; impact: number }[];
}

export interface ConfidenceData {
  brierScore: number;
  brierTrend: number;
  totalPredictions: number;
  accuracy: number;
  calibration: { predicted: string; count: number; actualRate: number; deviation: number }[];
  analyzerAccuracy: { name: string; accuracy: number; predictions: number }[];
  recentPredictions: { id: string; description: string; predicted: number; actual: boolean; date: string; source: string }[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get health forecast data from `GET /api/v1/forecasting/health`.
 */
export async function getForecast(): Promise<ForecastData> {
  try {
    return await apiFetch<ForecastData>("/api/v1/forecasting/health");
  } catch {
    return {
      currentScore: 0, trend: 'stable', trendStrength: 0, confidence: 0,
      history: [], forecast: [], targets: [],
      regression: { slope: 0, intercept: 0, r2: 0 },
    };
  }
}

/**
 * Get evolution graph data from `GET /api/v1/forecasting/evolution`.
 */
export async function getEvolution(): Promise<EvolutionData> {
  try {
    return await apiFetch<EvolutionData>("/api/v1/forecasting/evolution");
  } catch {
    return {
      events: [], trajectory: [], currentScore: 0,
      totalDecisions: 0, totalMilestones: 0, totalIncidents: 0, totalExperiments: 0,
      netHealthImpact: 0, allLearnings: [],
    };
  }
}

/**
 * Simulate what-if impact via `POST /api/v1/forecasting/what-if`.
 */
export async function getWhatIfAnalysis(params: {
  actions: Array<{ type: string; description: string }>;
}): Promise<WhatIfResult> {
  try {
    return await apiFetch<WhatIfResult>("/api/v1/forecasting/what-if", {
      method: "POST",
      body: JSON.stringify(params),
    });
  } catch {
    return {
      currentScore: 0, projectedScore: 0, totalImpact: 0, actions: [],
      summary: { highestImpact: null, totalActions: 0, avgConfidence: 0, recommendation: '' },
    };
  }
}

export async function getSimulations(): Promise<SimulationScenario[]> {
  try {
    return await apiFetch<SimulationScenario[]>('/api/v1/simulations', { unwrap: false });
  } catch {
    return [];
  }
}

export async function getSimulation(id: string): Promise<SimulationScenario | null> {
  try {
    return await apiFetch<SimulationScenario>(`/api/v1/simulations/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

export async function createSimulation(params: {
  name: string;
  type: SimulationScenario['type'];
}): Promise<SimulationScenario> {
  return apiFetch<SimulationScenario>('/api/v1/simulations', {
    method: 'POST',
    body: JSON.stringify(params),
    unwrap: false,
  });
}

export async function getConfidenceData(): Promise<ConfidenceData> {
  try {
    return await apiFetch<ConfidenceData>('/api/v1/confidence/overview');
  } catch {
    return {
      brierScore: 0, brierTrend: 0, totalPredictions: 0, accuracy: 0,
      calibration: [], analyzerAccuracy: [], recentPredictions: [],
    };
  }
}

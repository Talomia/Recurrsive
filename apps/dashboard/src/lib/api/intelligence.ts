/**
 * @module Intelligence API
 *
 * Forecasting, simulation, confidence, and what-if analysis.
 */

import { apiFetch, ApiError } from './client';

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
  /** `not_simulated`: the server recorded the scenario but ran no dynamic simulation. */
  status: 'completed' | 'running' | 'queued' | 'failed' | 'not_simulated';
  /** `unknown` when the server produced no risk assessment (no analysis data). */
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | 'unknown';
  impactScore: number;
  duration: string;
  createdAt: string;
  metrics: { label: string; value: string }[];
  timeline: { time: string; label: string; impact: number }[];
}

export interface ConfidenceData {
  /** Null when no prediction data is available (nothing measured yet). */
  brierScore: number | null;
  /** Null — the server does not track a Brier trend, so none can be reported. */
  brierTrend: number | null;
  totalPredictions: number | null;
  accuracy: number | null;
  calibration: { predicted: string; count: number; actualRate: number; deviation: number }[];
  analyzerAccuracy: { name: string; accuracy: number; predictions: number; brierScore: number }[];
  recentPredictions: { id: string; description: string; predicted: number; actual: boolean | null; date: string; source: string }[];
}

// ─── Server response shapes (for internal mapping) ──────────────────────────

/** Shape returned by `GET /api/v1/confidence/overview` after envelope unwrap. */
interface ServerOverviewResponse {
  totalPredictions: number;
  resolved: number;
  pending: number;
  overallBrierScore: number;
  overallAccuracy: number;
  calibrationCurve: {
    range: string;
    count: number;
    avgPredicted: number;
    actualRate: number;
    calibrationError: number;
  }[];
  analyzerScores: {
    analyzerId: string;
    totalPredictions: number;
    resolved: number;
    pending: number;
    brierScore: number;
    accuracy: number;
  }[];
  bestCalibrated: string | null;
  worstCalibrated: string | null;
}

/** Shape returned by `GET /api/v1/confidence/predictions` after envelope unwrap. */
interface ServerPrediction {
  id: string;
  analyzerId: string;
  findingId: string;
  description: string;
  predictedProbability: number;
  actualOutcome: boolean | null;
  severity: string;
  predictedAt: string;
  resolvedAt: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get health forecast data from `GET /api/v1/forecasting/health`.
 *
 * Throws on failure — a zeroed forecast (score 0, flat trend) would render
 * fabricated statistics.
 */
export async function getForecast(): Promise<ForecastData> {
  return await apiFetch<ForecastData>("/api/v1/forecasting/health");
}

/**
 * Get evolution graph data from `GET /api/v1/forecasting/evolution`.
 * Throws on failure.
 */
export async function getEvolution(): Promise<EvolutionData> {
  return await apiFetch<EvolutionData>("/api/v1/forecasting/evolution");
}

/**
 * Simulate what-if impact via `POST /api/v1/forecasting/what-if`.
 * Throws on failure so callers can surface an error instead of a zeroed result.
 */
export async function getWhatIfAnalysis(params: {
  actions: Array<{ type: string; description: string }>;
}): Promise<WhatIfResult> {
  return await apiFetch<WhatIfResult>("/api/v1/forecasting/what-if", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

/** Server-side simulation shape (differs from dashboard's SimulationScenario). */
interface ServerSimulation {
  id: string;
  name: string;
  description: string;
  type: string;
  parameters: Record<string, unknown>;
  status: string;
  /**
   * A static severity-derived risk assessment (basis: 'severity_prior'), or
   * null when the project has no analysis data. The server runs no dynamic
   * simulation, so there is no timeline and no outcome metrics.
   */
  results: {
    is_estimate?: boolean;
    basis?: string;
    note?: string;
    impactScore: number;
    riskLevel: string;
    findings: Array<{ area: string; impact: string; probability: number; recommendation: string }>;
    /** Legacy field — the server no longer emits a timeline. */
    timeline?: Array<{ timestamp: string; event: string; metric: string; value: number }>;
  } | null;
  createdAt: string;
  completedAt: string | null;
}

/** Map simulation type strings between server and dashboard. */
const SIM_TYPE_MAP: Record<string, SimulationScenario['type']> = {
  'traffic-replay': 'monte-carlo',
  'load-test': 'stress-test',
  'failure-injection': 'chaos',
  'dependency-change': 'what-if',
  'architecture-change': 'what-if',
};

/** Get simulation scenarios. Throws on failure. */
export async function getSimulations(): Promise<SimulationScenario[]> {
  const res = await apiFetch<{ data: ServerSimulation[]; total: number }>(
    '/api/v1/simulations',
    { unwrap: false },
  );
  const sims = res.data ?? [];
  return sims.map((s) => {
      const results = s.results;
      // Only surface honest, severity-derived signals, labeled as estimates.
      // Absolute-unit predictions (latency/cost/availability) are intentionally
      // not shown — the server no longer fabricates them.
      const metrics: SimulationScenario['metrics'] = results
        ? [
            { label: 'Impact Score (severity-derived estimate)', value: `${results.impactScore}/10` },
            { label: 'Risk Level (severity-derived estimate)', value: results.riskLevel },
            { label: 'Basis', value: 'static severity prior — no dynamic simulation ran' },
          ]
        : [];
      const timeline: SimulationScenario['timeline'] = (results?.timeline ?? []).map((t) => ({
        time: t.timestamp,
        label: t.event,
        impact: t.value,
      }));
      // Compute duration from createdAt → completedAt
      let duration = '—';
      if (s.createdAt && s.completedAt) {
        const ms = new Date(s.completedAt).getTime() - new Date(s.createdAt).getTime();
        duration = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
      }
      return {
        id: s.id,
        name: s.name,
        type: SIM_TYPE_MAP[s.type] ?? 'what-if',
        status: (s.status === 'pending' ? 'queued' : s.status) as SimulationScenario['status'],
        // No results means no risk assessment exists — say 'unknown' rather
        // than defaulting to a rosy 'low'.
        riskLevel: (results?.riskLevel ?? 'unknown') as SimulationScenario['riskLevel'],
        impactScore: results?.impactScore ?? 0,
        duration,
        createdAt: s.createdAt,
        metrics,
        timeline,
      };
    });
}

/**
 * Get a single simulation. Returns null only for a genuine 404; other
 * failures throw.
 */
export async function getSimulation(id: string): Promise<SimulationScenario | null> {
  try {
    return await apiFetch<SimulationScenario>(`/api/v1/simulations/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
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

/**
 * Fetch confidence overview + recent predictions and map to dashboard shape.
 *
 * Server endpoints:
 *   - `GET /api/v1/confidence/overview`     → overview metrics
 *   - `GET /api/v1/confidence/predictions`  → recent prediction list
 */
export async function getConfidenceData(): Promise<ConfidenceData> {
  // Fetch overview and recent predictions in parallel. Failure PROPAGATES —
  // an unreachable server must surface as an error, not as "no predictions".
  const [overview, predictionsRaw] = await Promise.all([
    apiFetch<ServerOverviewResponse>('/api/v1/confidence/overview'),
    apiFetch<ServerPrediction[]>('/api/v1/confidence/predictions'),
  ]);

  return {
      brierScore: overview.overallBrierScore,
      // The server does not track a Brier trend. null means "not tracked" —
      // a 0 here would falsely claim a measured flat trend.
      brierTrend: null,
      totalPredictions: overview.totalPredictions,
      accuracy: overview.overallAccuracy,

      // Map calibrationCurve → calibration (range→predicted, calibrationError→deviation)
      calibration: (overview.calibrationCurve ?? []).map(b => ({
        predicted: b.range,
        count: b.count,
        actualRate: b.actualRate,
        deviation: b.calibrationError,
      })),

      // Map analyzerScores → analyzerAccuracy, carrying the server's REAL
      // per-analyzer Brier score (the pages must not re-invent it from accuracy).
      analyzerAccuracy: (overview.analyzerScores ?? []).map(a => ({
        name: a.analyzerId,
        accuracy: a.accuracy,
        predictions: a.totalPredictions,
        brierScore: a.brierScore,
      })),

      // Map server predictions → dashboard recentPredictions shape
      recentPredictions: (predictionsRaw ?? []).slice(0, 20).map(p => ({
        id: p.id,
        description: p.description,
        predicted: p.predictedProbability,
        actual: p.actualOutcome,
        date: p.predictedAt,
        source: p.analyzerId,
      })),
  };
}

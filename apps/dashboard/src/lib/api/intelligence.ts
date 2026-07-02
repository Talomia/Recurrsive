/**
 * @module Intelligence API
 *
 * Forecasting, simulation, confidence, and what-if analysis.
 */

import { apiFetch, BASE_URL, seededRandom } from './client';

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

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_FORECAST: ForecastData = {
  currentScore: 84,
  trend: 'improving',
  trendStrength: 0.32,
  confidence: 0.78,
  history: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    score: Math.round((72 + i * 0.4 + (seededRandom(i * 137) * 6 - 3)) * 10) / 10,
  })),
  forecast: Array.from({ length: 30 }, (_, i) => {
    const predicted = Math.min(100, 84 + (i + 1) * 0.32);
    const uncertainty = Math.min(15, (i + 1) * 0.25);
    return {
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      predicted: Math.round(predicted * 10) / 10,
      lowerBound: Math.round(Math.max(0, predicted - uncertainty) * 10) / 10,
      upperBound: Math.round(Math.min(100, predicted + uncertainty) * 10) / 10,
    };
  }),
  targets: [
    { target: 90, daysToReach: 19, reachable: true },
    { target: 80, daysToReach: 0, reachable: true },
    { target: 70, daysToReach: 0, reachable: true },
    { target: 60, daysToReach: 0, reachable: true },
  ],
  regression: { slope: 0.32, intercept: 71.5, r2: 0.78 },
};

const MOCK_EVOLUTION: EvolutionData = {
  events: [
    {
      id: 'evo-001', date: '2026-01-15', type: 'decision',
      title: 'Adopt multi-agent reasoning architecture',
      description: 'Replaced single-pass analysis with 19-specialist debate engine.',
      outcome: 'positive', healthImpact: 12,
      learnings: ['Debate protocol significantly improved finding accuracy', 'Specialist diversity matters more than count'],
    },
    {
      id: 'evo-002', date: '2026-02-20', type: 'milestone',
      title: 'Knowledge graph migration to dual-backend',
      description: 'Added SQLite alongside Apache AGE for development workflows.',
      outcome: 'positive', healthImpact: 5,
      learnings: ['SQLite backend eliminates PostgreSQL dependency for dev', 'Query interface abstraction was key to clean migration'],
    },
    {
      id: 'evo-003', date: '2026-03-10', type: 'incident',
      title: 'Dependency vulnerability in oauth-lib v3',
      description: 'OWASP A07:2021 flagged during automated scan.',
      outcome: 'resolved', healthImpact: -8,
      learnings: ['Automated dependency scanning caught this early', 'Need policy for mandatory lockfile updates'],
    },
    {
      id: 'evo-004', date: '2026-04-05', type: 'decision',
      title: 'Add JWT auth + RBAC to REST API',
      description: 'Enterprise-grade authentication with role-based access control.',
      outcome: 'positive', healthImpact: 7,
      learnings: ['API key support essential for CI/CD integration', 'Three-tier RBAC (admin/analyst/viewer) covers most use cases'],
    },
    {
      id: 'evo-005', date: '2026-05-15', type: 'experiment',
      title: 'TypeScript strict mode trial',
      description: 'Enabled strict mode in @recurrsive/core as a pilot.',
      outcome: 'positive', healthImpact: 3,
      learnings: ['Found 12 type-safety issues', 'strictNullChecks was the highest-value flag'],
    },
    {
      id: 'evo-006', date: '2026-06-01', type: 'decision',
      title: 'Expand collectors to GitLab + telemetry',
      description: 'Added GitLab CI/CD and OpenTelemetry data collection.',
      outcome: 'positive', healthImpact: 6,
      learnings: ['Collector interface abstraction makes new integrations fast', 'Governance filtering is critical for enterprise adoption'],
    },
    {
      id: 'evo-007', date: '2026-06-20', type: 'milestone',
      title: 'Dashboard executive intelligence view',
      description: 'Added KPI dashboards, risk assessment, and trend visualization.',
      outcome: 'positive', healthImpact: 4,
      learnings: ['Executive stakeholders need different data than engineers', 'Health score trend is the single most-watched metric'],
    },
  ],
  trajectory: [
    { date: '2026-01-15', score: 67, event: 'Adopt multi-agent reasoning architecture' },
    { date: '2026-02-20', score: 72, event: 'Knowledge graph migration to dual-backend' },
    { date: '2026-03-10', score: 64, event: 'Dependency vulnerability in oauth-lib v3' },
    { date: '2026-04-05', score: 71, event: 'Add JWT auth + RBAC to REST API' },
    { date: '2026-05-15', score: 74, event: 'TypeScript strict mode trial' },
    { date: '2026-06-01', score: 80, event: 'Expand collectors to GitLab + telemetry' },
    { date: '2026-06-20', score: 84, event: 'Dashboard executive intelligence view' },
  ],
  currentScore: 84,
  totalDecisions: 3,
  totalMilestones: 2,
  totalIncidents: 1,
  totalExperiments: 1,
  netHealthImpact: 29,
  allLearnings: [
    'Debate protocol significantly improved finding accuracy',
    'Specialist diversity matters more than count',
    'SQLite backend eliminates PostgreSQL dependency for dev',
    'Query interface abstraction was key to clean migration',
    'Automated dependency scanning caught this early',
    'Need policy for mandatory lockfile updates',
    'API key support essential for CI/CD integration',
    'Three-tier RBAC (admin/analyst/viewer) covers most use cases',
    'Found 12 type-safety issues',
    'strictNullChecks was the highest-value flag',
    'Collector interface abstraction makes new integrations fast',
    'Governance filtering is critical for enterprise adoption',
    'Executive stakeholders need different data than engineers',
    'Health score trend is the single most-watched metric',
  ],
};

const MOCK_WHAT_IF: WhatIfResult = {
  currentScore: 78,
  projectedScore: 89.5,
  totalImpact: 11.5,
  actions: [
    {
      id: 'wia-001', type: 'fix-critical-findings', description: 'Fix Critical Findings',
      impact: { healthScoreDelta: 8.5, confidence: 0.9, timeToRealize: '7 days', affectedDimensions: ['security', 'reliability'] },
    },
    {
      id: 'wia-002', type: 'add-tests', description: 'Add Test Coverage',
      impact: { healthScoreDelta: 4.2, confidence: 0.85, timeToRealize: '14 days', affectedDimensions: ['testing', 'reliability', 'developer_experience'] },
    },
  ],
  summary: {
    highestImpact: 'fix-critical-findings',
    totalActions: 2,
    avgConfidence: 0.88,
    recommendation: 'Strong improvement potential. Prioritize the highest-confidence actions first.',
  },
};

const MOCK_SIMULATIONS: SimulationScenario[] = [
  {
    id: 'sim-001', name: 'Dependency Cascade Failure', type: 'chaos',
    status: 'completed', riskLevel: 'critical', impactScore: 92, duration: '4m 12s',
    createdAt: '2026-06-30', metrics: [{ label: 'Affected Services', value: '14' }, { label: 'Recovery Time', value: '38m' }],
    timeline: [{ time: '0:00', label: 'Inject failure', impact: -5 }, { time: '0:45', label: 'Cascade begins', impact: -32 }, { time: '2:10', label: 'Alert triggered', impact: 0 }, { time: '4:12', label: 'Recovery complete', impact: 18 }],
  },
  {
    id: 'sim-002', name: 'Traffic Spike 10x', type: 'stress-test',
    status: 'completed', riskLevel: 'high', impactScore: 74, duration: '8m 03s',
    createdAt: '2026-06-29', metrics: [{ label: 'P99 Latency', value: '2.4s' }, { label: 'Error Rate', value: '3.1%' }],
    timeline: [{ time: '0:00', label: 'Ramp up traffic', impact: -2 }, { time: '3:00', label: 'Peak load', impact: -28 }, { time: '6:00', label: 'Auto-scale kicks in', impact: 12 }, { time: '8:03', label: 'Stabilized', impact: 5 }],
  },
  {
    id: 'sim-003', name: 'Config Drift Projection', type: 'what-if',
    status: 'completed', riskLevel: 'medium', impactScore: 45, duration: '1m 58s',
    createdAt: '2026-06-28', metrics: [{ label: 'Drift Items', value: '7' }, { label: 'Compliance Gap', value: '12%' }],
    timeline: [{ time: '0:00', label: 'Baseline captured', impact: 0 }, { time: '0:30', label: 'Drift injected', impact: -15 }, { time: '1:58', label: 'Report generated', impact: 0 }],
  },
  {
    id: 'sim-004', name: 'Cost Optimization Model', type: 'monte-carlo',
    status: 'running', riskLevel: 'low', impactScore: 28, duration: '—',
    createdAt: '2026-07-01', metrics: [{ label: 'Iterations', value: '4,200 / 10,000' }, { label: 'Est. Savings', value: '$12.4k/mo' }],
    timeline: [{ time: '0:00', label: 'Sampling started', impact: 0 }],
  },
  {
    id: 'sim-005', name: 'Security Posture Breach', type: 'chaos',
    status: 'queued', riskLevel: 'high', impactScore: 0, duration: '—',
    createdAt: '2026-07-01', metrics: [],
    timeline: [],
  },
];

const MOCK_CONFIDENCE: ConfidenceData = {
  brierScore: 0.142,
  brierTrend: -0.018,
  totalPredictions: 2847,
  accuracy: 87.3,
  calibration: [
    { predicted: '0-10%', count: 312, actualRate: 4.2, deviation: -3.8 },
    { predicted: '10-20%', count: 198, actualRate: 14.1, deviation: -0.9 },
    { predicted: '20-30%', count: 245, actualRate: 26.5, deviation: 1.5 },
    { predicted: '30-40%', count: 187, actualRate: 33.2, deviation: -1.8 },
    { predicted: '40-50%', count: 156, actualRate: 46.8, deviation: 1.8 },
    { predicted: '50-60%', count: 289, actualRate: 54.3, deviation: -0.7 },
    { predicted: '60-70%', count: 334, actualRate: 67.1, deviation: 2.1 },
    { predicted: '70-80%', count: 412, actualRate: 73.8, deviation: -1.2 },
    { predicted: '80-90%', count: 398, actualRate: 86.4, deviation: 1.4 },
    { predicted: '90-100%', count: 316, actualRate: 94.6, deviation: 0.6 },
  ],
  analyzerAccuracy: [
    { name: 'DependencyAnalyzer', accuracy: 94.2, predictions: 412 },
    { name: 'SecurityAnalyzer', accuracy: 91.8, predictions: 356 },
    { name: 'PerformanceAnalyzer', accuracy: 88.5, predictions: 289 },
    { name: 'CodeQualityAnalyzer', accuracy: 86.1, predictions: 534 },
    { name: 'AIRuntimeAnalyzer', accuracy: 82.4, predictions: 178 },
  ],
  recentPredictions: [
    { id: 'pred-1', description: 'CVE-2026-1234 exploitable in production', predicted: 0.89, actual: true, date: '2026-06-30', source: 'SecurityAnalyzer' },
    { id: 'pred-2', description: 'Memory leak in auth service', predicted: 0.72, actual: true, date: '2026-06-29', source: 'PerformanceAnalyzer' },
    { id: 'pred-3', description: 'Breaking API change in v3.2', predicted: 0.45, actual: false, date: '2026-06-28', source: 'APIContractAnalyzer' },
  ],
};

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get health forecast data from `GET /api/v1/forecasting/health`.
 */
export async function getForecast(): Promise<ForecastData> {
  try {
    const raw = await apiFetch<{ data: ForecastData } | null>(
      "/api/v1/forecasting/health",
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_FORECAST;
}

/**
 * Get evolution graph data from `GET /api/v1/forecasting/evolution`.
 */
export async function getEvolution(): Promise<EvolutionData> {
  try {
    const raw = await apiFetch<{ data: EvolutionData } | null>(
      "/api/v1/forecasting/evolution",
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_EVOLUTION;
}

/**
 * Simulate what-if impact via `POST /api/v1/forecasting/what-if`.
 */
export async function getWhatIfAnalysis(params: {
  actions: Array<{ type: string; description: string }>;
}): Promise<WhatIfResult> {
  try {
    const res = await fetch(`${BASE_URL}/api/v1/forecasting/what-if`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = (await res.json()) as { data: WhatIfResult };
    if (json?.data) return json.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_WHAT_IF;
}

export async function getSimulations(): Promise<SimulationScenario[]> {
  try {
    const res = await apiFetch<{ simulations: SimulationScenario[] } | null>(
      '/api/v1/simulations', null,
    );
    if (res?.simulations) return res.simulations;
  } catch {
    // Fall through to mock
  }
  return MOCK_SIMULATIONS;
}

export async function getSimulation(id: string): Promise<SimulationScenario | null> {
  try {
    const raw = await apiFetch<SimulationScenario | null>(`/api/v1/simulations/${id}`, null);
    if (raw) return raw;
  } catch {
    // Fall through to mock
  }
  return MOCK_SIMULATIONS.find(s => s.id === id) ?? null;
}

export async function createSimulation(params: {
  name: string;
  type: SimulationScenario['type'];
}): Promise<SimulationScenario> {
  const res = await fetch(`${BASE_URL}/api/v1/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create simulation: ${res.status}`);
  return (await res.json()) as SimulationScenario;
}

export async function getConfidenceData(): Promise<ConfidenceData> {
  try {
    const res = await apiFetch<ConfidenceData | null>('/api/v1/confidence', null);
    if (res) return res;
  } catch { /* fall through */ }
  return MOCK_CONFIDENCE;
}

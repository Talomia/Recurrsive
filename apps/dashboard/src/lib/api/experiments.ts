/**
 * @module Experiments API
 *
 * Experiments and analysis run comparisons.
 */

import { apiFetch } from './client';

// ─── Experiment Types ────────────────────────────────────────────────────────

export interface ExperimentVariant {
  name: string;
  config: Record<string, unknown>;
}

export interface ExperimentMetric {
  name: string;
  variant_a: number;
  variant_b: number;
  improvement: number;
}

export interface DashboardExperiment {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  hypothesis: string;
  variants: ExperimentVariant[];
  metrics: ExperimentMetric[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  conclusion: string | null;
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

// ─── Experiment Mock Data ────────────────────────────────────────────────────

const MOCK_EXPERIMENTS: DashboardExperiment[] = [
  {
    id: "exp_001",
    name: "Strict Import Rules",
    description: "Test whether enforcing strict import rules improves overall codebase health scores by reducing circular dependencies and unused imports.",
    status: "completed",
    hypothesis: "Enforcing strict import rules will improve health scores by reducing circular dependencies.",
    variants: [
      { name: "Control", config: { strict_imports: false } },
      { name: "Strict Mode", config: { strict_imports: true, ban_circular: true } },
    ],
    metrics: [
      { name: "Health Score", variant_a: 78, variant_b: 90, improvement: 12 },
      { name: "Circular Deps", variant_a: 14, variant_b: 3, improvement: -78.6 },
      { name: "Build Time", variant_a: 45, variant_b: 42, improvement: -6.7 },
    ],
    created_at: "2026-06-10T08:00:00Z",
    started_at: "2026-06-10T09:00:00Z",
    completed_at: "2026-06-18T17:00:00Z",
    conclusion: "Positive result: +12% health score improvement. Strict import rules significantly reduced circular dependencies with minimal build time impact.",
  },
  {
    id: "exp_002",
    name: "Auto-Fix Security",
    description: "Evaluate automatic security vulnerability fixing using AI-generated patches compared to manual review.",
    status: "running",
    hypothesis: "Automated security fixes will reduce mean-time-to-remediation by 60% without introducing regressions.",
    variants: [
      { name: "Manual Review", config: { auto_fix: false, review_required: true } },
      { name: "AI Auto-Fix", config: { auto_fix: true, confidence_threshold: 0.85 } },
    ],
    metrics: [
      { name: "MTTR (hours)", variant_a: 48, variant_b: 19.2, improvement: -60 },
      { name: "Fix Rate", variant_a: 72, variant_b: 89, improvement: 23.6 },
      { name: "Regression Rate", variant_a: 2.1, variant_b: 3.4, improvement: 61.9 },
    ],
    created_at: "2026-06-20T10:00:00Z",
    started_at: "2026-06-20T12:00:00Z",
    completed_at: null,
    conclusion: null,
  },
  {
    id: "exp_003",
    name: "Parallel Analyzers",
    description: "Test running code analyzers in parallel vs sequential to measure impact on analysis accuracy and speed.",
    status: "completed",
    hypothesis: "Running analyzers in parallel will reduce total analysis time by 50% without sacrificing accuracy.",
    variants: [
      { name: "Sequential", config: { parallel: false, max_workers: 1 } },
      { name: "Parallel (4x)", config: { parallel: true, max_workers: 4 } },
    ],
    metrics: [
      { name: "Analysis Time (s)", variant_a: 120, variant_b: 58, improvement: -51.7 },
      { name: "Findings Detected", variant_a: 47, variant_b: 46, improvement: -2.1 },
      { name: "Memory Usage (MB)", variant_a: 256, variant_b: 512, improvement: 100 },
    ],
    created_at: "2026-06-05T14:00:00Z",
    started_at: "2026-06-05T15:00:00Z",
    completed_at: "2026-06-12T16:00:00Z",
    conclusion: "Neutral result: 52% speed improvement but doubled memory usage. Findings accuracy was equivalent. Recommend parallel mode only for CI environments.",
  },
  {
    id: "exp_004",
    name: "Batch Scheduling",
    description: "Evaluate different scheduling strategies for batch analysis of multiple repositories.",
    status: "pending",
    hypothesis: "Priority-based scheduling will improve resource utilization by 30% compared to FIFO ordering.",
    variants: [
      { name: "FIFO", config: { scheduler: "fifo" } },
      { name: "Priority Queue", config: { scheduler: "priority", weight_by: "last_analysis_age" } },
    ],
    metrics: [],
    created_at: "2026-06-28T09:00:00Z",
    started_at: null,
    completed_at: null,
    conclusion: null,
  },
  {
    id: "exp_005",
    name: "Custom Policies",
    description: "Test whether team-customizable policy rules improve compliance rates compared to the default built-in policy set.",
    status: "completed",
    hypothesis: "Custom policies tailored to team conventions will increase compliance rates by at least 10%.",
    variants: [
      { name: "Built-in Only", config: { custom_policies: false } },
      { name: "Custom + Built-in", config: { custom_policies: true, team_rules: 12 } },
    ],
    metrics: [
      { name: "Compliance Rate", variant_a: 75, variant_b: 83, improvement: 8 },
      { name: "False Positives", variant_a: 15, variant_b: 8, improvement: -46.7 },
      { name: "Policy Violations", variant_a: 23, variant_b: 12, improvement: -47.8 },
    ],
    created_at: "2026-06-01T10:00:00Z",
    started_at: "2026-06-01T11:00:00Z",
    completed_at: "2026-06-08T18:00:00Z",
    conclusion: "Positive result: +8% compliance improvement with 47% fewer false positives. Custom policies allow teams to encode domain-specific rules.",
  },
];

// ─── Analysis Run Mock Data ──────────────────────────────────────────────────

const MOCK_ANALYSIS_RUNS: AnalysisRun[] = [
  {
    id: "run_001", label: "Run #1", date: "2026-06-20T08:00:00Z", health_score: 71, findings: 55, resolved: 18,
    categories: [{ name: "Security", count: 12 }, { name: "Performance", count: 16 }, { name: "Architecture", count: 10 }, { name: "Reliability", count: 9 }, { name: "Cost", count: 8 }],
  },
  {
    id: "run_002", label: "Run #2", date: "2026-06-23T10:30:00Z", health_score: 76, findings: 48, resolved: 22,
    categories: [{ name: "Security", count: 10 }, { name: "Performance", count: 14 }, { name: "Architecture", count: 9 }, { name: "Reliability", count: 8 }, { name: "Cost", count: 7 }],
  },
  {
    id: "run_003", label: "Run #3", date: "2026-06-25T14:15:00Z", health_score: 80, findings: 42, resolved: 28,
    categories: [{ name: "Security", count: 8 }, { name: "Performance", count: 12 }, { name: "Architecture", count: 8 }, { name: "Reliability", count: 7 }, { name: "Cost", count: 7 }],
  },
  {
    id: "run_004", label: "Run #4", date: "2026-06-28T09:00:00Z", health_score: 84, findings: 38, resolved: 31,
    categories: [{ name: "Security", count: 6 }, { name: "Performance", count: 11 }, { name: "Architecture", count: 8 }, { name: "Reliability", count: 6 }, { name: "Cost", count: 7 }],
  },
  {
    id: "run_005", label: "Run #5", date: "2026-06-30T10:00:00Z", health_score: 87, findings: 34, resolved: 29,
    categories: [{ name: "Security", count: 5 }, { name: "Performance", count: 9 }, { name: "Architecture", count: 7 }, { name: "Reliability", count: 6 }, { name: "Cost", count: 7 }],
  },
];

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get all experiments from `GET /api/v1/experiments`.
 */
export async function getExperiments(status?: string): Promise<DashboardExperiment[]> {
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const raw = await apiFetch<{
      data: DashboardExperiment[];
      total: number;
    } | null>(`/api/v1/experiments${query}`, null);

    if (!raw?.data?.length) return MOCK_EXPERIMENTS;
    return raw.data;
  } catch {
    return MOCK_EXPERIMENTS;
  }
}

/**
 * Get a single experiment by ID from `GET /api/v1/experiments/:id`.
 */
export async function getExperiment(id: string): Promise<DashboardExperiment | null> {
  try {
    const raw = await apiFetch<{
      data: DashboardExperiment;
    } | null>(`/api/v1/experiments/${encodeURIComponent(id)}`, null);

    if (!raw?.data) {
      return MOCK_EXPERIMENTS.find((e) => e.id === id) ?? null;
    }
    return raw.data;
  } catch {
    return MOCK_EXPERIMENTS.find((e) => e.id === id) ?? null;
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

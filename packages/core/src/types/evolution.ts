import { z } from 'zod';

// ---------------------------------------------------------------------------
// Maturity Enums
// ---------------------------------------------------------------------------

/**
 * Dimensions across which software maturity is measured.
 */
export const MaturityDimensionSchema = z.enum([
  'architecture',
  'ai',
  'security',
  'operational',
  'product',
  'developer_experience',
  'reliability',
  'data',
  'documentation',
  'testing',
]);

/** Inferred TypeScript type for {@link MaturityDimensionSchema}. */
export type MaturityDimension = z.infer<typeof MaturityDimensionSchema>;

/**
 * Five-level maturity model inspired by CMMI.
 */
export const MaturityLevelSchema = z.enum([
  'initial',
  'developing',
  'defined',
  'managed',
  'optimizing',
]);

/** Inferred TypeScript type for {@link MaturityLevelSchema}. */
export type MaturityLevel = z.infer<typeof MaturityLevelSchema>;

// ---------------------------------------------------------------------------
// Maturity Score
// ---------------------------------------------------------------------------

/**
 * A single maturity score for one dimension, including evidence and
 * recommended next steps.
 */
export interface MaturityScore {
  /** Which dimension this score covers. */
  dimension: MaturityDimension;
  /** Current maturity level. */
  level: MaturityLevel;
  /** Numeric score (0–100). */
  score: number;
  /** Directional trend since last snapshot. */
  trend: 'improving' | 'stable' | 'declining';
  /** Evidence supporting this score. */
  evidence: string[];
  /** Recommendations for reaching the next maturity level. */
  recommendations: string[];
}

// ---------------------------------------------------------------------------
// Evolution Snapshot
// ---------------------------------------------------------------------------

/** Captures per-dimension maturity changes between snapshots. */
export interface MaturityChange {
  /** Which dimension changed. */
  dimension: MaturityDimension;
  /** Previous numeric score. */
  previous_score: number;
  /** Current numeric score. */
  current_score: number;
}

/** Delta counters between two adjacent snapshots. */
export interface SnapshotDelta {
  /** Number of new opportunities since last snapshot. */
  new_opportunities: number;
  /** Number of resolved opportunities since last snapshot. */
  resolved_opportunities: number;
  /** Number of new risks since last snapshot. */
  new_risks: number;
  /** Number of resolved risks since last snapshot. */
  resolved_risks: number;
  /** Per-dimension maturity changes. */
  maturity_changes: MaturityChange[];
}

/**
 * A point-in-time snapshot of the project's evolutionary state.
 */
export interface EvolutionSnapshot {
  /** Unique identifier. */
  id: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Per-dimension maturity scores. */
  maturity_scores: MaturityScore[];
  /** Aggregate health score (0–100). */
  overall_health: number;
  /** Total open opportunities. */
  opportunity_count: number;
  /** Total open debt items. */
  debt_count: number;
  /** Total open risk items. */
  risk_count: number;
  /** IDs of the highest-priority opportunities. */
  top_opportunities: string[];
  /** Changes since the previous snapshot. */
  changes_since_last: SnapshotDelta;
}

// ---------------------------------------------------------------------------
// Evolution Timeline
// ---------------------------------------------------------------------------

/** A single data point in a trend series. */
export interface TrendDataPoint {
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Numeric value at this point. */
  value: number;
}

/** A named trend series. */
export interface TrendSeries {
  /** Dimension or metric name. */
  dimension: string;
  /** Ordered data points. */
  data_points: TrendDataPoint[];
}

/**
 * The full evolutionary timeline of a project — a sequence of
 * snapshots with derived trend lines.
 */
export interface EvolutionTimeline {
  /** Project identifier. */
  project_id: string;
  /** Ordered list of evolution snapshots. */
  snapshots: EvolutionSnapshot[];
  /** Derived trend series for each dimension. */
  trends: TrendSeries[];
}

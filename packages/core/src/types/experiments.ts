import { z } from 'zod';

// ---------------------------------------------------------------------------
// Experiment Status
// ---------------------------------------------------------------------------

/**
 * Lifecycle status of an experiment.
 */
export const ExperimentStatusSchema = z.enum([
  'draft',
  'ready',
  'running',
  'completed',
  'cancelled',
  'failed',
]);

/** Inferred TypeScript type for {@link ExperimentStatusSchema}. */
export type ExperimentStatus = z.infer<typeof ExperimentStatusSchema>;

// ---------------------------------------------------------------------------
// Experiment Components
// ---------------------------------------------------------------------------

/**
 * A single variant (treatment or control) within an experiment.
 */
export interface ExperimentVariant {
  /** Unique identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of what this variant changes. */
  description: string;
  /** Configuration overrides for this variant. */
  configuration: Record<string, unknown>;
  /** Whether this is the control (baseline) variant. */
  is_control: boolean;
}

/**
 * A metric being tracked in an experiment.
 */
export interface ExperimentMetric {
  /** Metric name. */
  name: string;
  /** Metric category. */
  type: 'latency' | 'cost' | 'quality' | 'error_rate' | 'throughput' | 'custom';
  /** Unit of measurement (e.g. `'ms'`, `'USD'`, `'%'`). */
  unit: string;
  /** Whether a higher value is desirable. */
  higher_is_better: boolean;
}

/**
 * Observed metric results for a single variant.
 */
export interface MetricObservation {
  /** The metric definition. */
  metric: ExperimentMetric;
  /** Observed value. */
  value: number;
  /** Number of samples. */
  sample_size: number;
  /** 95% confidence interval [lower, upper]. */
  confidence_interval: [number, number];
}

/**
 * Per-variant result summary.
 */
export interface ExperimentResult {
  /** Variant ID this result applies to. */
  variant_id: string;
  /** Observed metrics. */
  metrics: MetricObservation[];
  /** Whether this variant was declared the winner. */
  winner: boolean;
}

// ---------------------------------------------------------------------------
// Experiment
// ---------------------------------------------------------------------------

/**
 * An Experiment validates an opportunity's expected impact by
 * comparing variants (typically a control vs. one or more treatments)
 * across measured metrics.
 */
export interface Experiment {
  /** Unique identifier. */
  id: string;
  /** ID of the opportunity this experiment validates. */
  opportunity_id: string;
  /** Human-readable title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** The hypothesis being tested. */
  hypothesis: string;
  /** Variants under test. */
  variants: ExperimentVariant[];
  /** Metrics being measured. */
  metrics: ExperimentMetric[];
  /** Current experiment status. */
  status: ExperimentStatus;
  /** Per-variant results (populated after completion). */
  results: ExperimentResult[];
  /** Planned experiment duration (e.g. `'7d'`). */
  duration: string;
  /** Traffic allocation per variant (variant_id → percentage). */
  traffic_split: Record<string, number>;
  /** ISO-8601 creation timestamp. */
  created_at: string;
  /** ISO-8601 start timestamp. */
  started_at?: string;
  /** ISO-8601 completion timestamp. */
  completed_at?: string;
}

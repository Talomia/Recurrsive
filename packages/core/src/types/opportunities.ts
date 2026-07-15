import { z } from 'zod';

// ---------------------------------------------------------------------------
// Category & Severity Enums
// ---------------------------------------------------------------------------

/**
 * High-level categories that an opportunity, risk, or debt item can
 * belong to. Used for filtering, routing to specialist agents, and
 * dashboard grouping.
 */
export const OpportunityCategorySchema = z.enum([
  'architecture',
  'performance',
  'security',
  'cost',
  'ai_quality',
  'reliability',
  'ux',
  'accessibility',
  'privacy',
  'compliance',
  'developer_experience',
  'product',
  'data',
  'documentation',
  'infrastructure',
]);

/** Inferred TypeScript type for {@link OpportunityCategorySchema}. */
export type OpportunityCategory = z.infer<typeof OpportunityCategorySchema>;

/**
 * Discriminates whether a finding represents a proactive improvement
 * (opportunity), a forward-looking risk, or existing technical debt.
 */
export const OpportunityTypeSchema = z.enum(['opportunity', 'risk', 'debt']);

/** Inferred TypeScript type for {@link OpportunityTypeSchema}. */
export type OpportunityType = z.infer<typeof OpportunityTypeSchema>;

/**
 * Severity level following a five-tier model from critical down to
 * informational.
 */
export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low', 'info']);

/** Inferred TypeScript type for {@link SeveritySchema}. */
export type Severity = z.infer<typeof SeveritySchema>;

/**
 * Lifecycle status of an opportunity from initial proposal through
 * validation or archival.
 */
export const OpportunityStatusSchema = z.enum([
  'proposed',
  'accepted',
  'rejected',
  'in_progress',
  'implemented',
  'validated',
  'archived',
]);

/** Inferred TypeScript type for {@link OpportunityStatusSchema}. */
export type OpportunityStatus = z.infer<typeof OpportunityStatusSchema>;

// ---------------------------------------------------------------------------
// Supporting Schemas
// ---------------------------------------------------------------------------

/**
 * A piece of evidence supporting (or refuting) a finding or
 * opportunity. Links back to entities in the knowledge graph via
 * `entity_ids`.
 */
export const EvidenceSchema = z.object({
  /** Globally unique identifier (UUID v4). */
  id: z.string().uuid(),
  /** Kind of evidence. */
  type: z.enum([
    'code',
    'telemetry',
    'metric',
    'trace',
    'log',
    'test',
    'review',
    'ticket',
    'benchmark',
    'historical',
    'simulation',
  ]),
  /** Human-readable source label (e.g. collector or analyzer ID). */
  source: z.string(),
  /** Natural language description of the evidence. */
  description: z.string(),
  /** Arbitrary structured data payload. */
  data: z.record(z.unknown()).optional(),
  /** IDs of knowledge-graph entities this evidence relates to. */
  entity_ids: z.array(z.string().uuid()),
  /** ISO-8601 timestamp of when this evidence was collected. */
  collected_at: z.string().datetime(),
  /** Confidence in the evidence quality (0–1). */
  confidence: z.number().min(0).max(1),
});

/** Inferred TypeScript type for {@link EvidenceSchema}. */
export type Evidence = z.infer<typeof EvidenceSchema>;

/**
 * Quantified impact assessment for an opportunity.
 */
export const ImpactSchema = z.object({
  /** One-line summary of the impact. */
  summary: z.string(),
  /**
   * Metrics affected by this opportunity.
   *
   * A metric may be either MEASURED (derived from evidence values actually
   * present in the collected input) or an ESTIMATE (a model-generated
   * projection). Estimates MUST set `is_estimate: true` and SHOULD attach the
   * `assumptions` they rest on. Consumers must never present an estimate as a
   * measured before/after value. A metric with no `current_value` has no
   * measured baseline and must not be rendered as a false before/after.
   */
  metrics: z.array(
    z.object({
      name: z.string(),
      current_value: z.union([z.string(), z.number()]).optional(),
      expected_value: z.union([z.string(), z.number()]).optional(),
      change_percent: z.number().optional(),
      direction: z.enum(['increase', 'decrease', 'unchanged']).optional(),
      /** True when this metric is a model-generated projection, not a measurement. */
      is_estimate: z.boolean().optional(),
      /** Assumptions the estimate rests on (required in spirit when `is_estimate`). */
      assumptions: z.array(z.string()).optional(),
    }),
  ),
  /** Service names affected. */
  affected_services: z.array(z.string()),
  /** Description of affected user segment. */
  affected_users: z.string().optional(),
  /** Qualitative business value statement. */
  business_value: z.string().optional(),
  /** Cost of inaction per unit time (compound interest metaphor). */
  interest_rate: z.string().optional(),
});

/** Inferred TypeScript type for {@link ImpactSchema}. */
export type Impact = z.infer<typeof ImpactSchema>;

/**
 * T-shirt sizing and dependency info for effort estimation.
 */
export const EffortEstimateSchema = z.object({
  /** Rough t-shirt size. */
  t_shirt: z.enum(['xs', 's', 'm', 'l', 'xl']),
  /** Estimated engineering hours. */
  estimated_hours: z.number().optional(),
  /** Estimated calendar days. */
  estimated_days: z.number().optional(),
  /** Skills / expertise areas required. */
  skills_required: z.array(z.string()),
  /** IDs of prerequisite opportunities. */
  dependencies: z.array(z.string()),
});

/** Inferred TypeScript type for {@link EffortEstimateSchema}. */
export type EffortEstimate = z.infer<typeof EffortEstimateSchema>;

/**
 * Risk assessment for implementing an opportunity.
 */
export const RiskAssessmentSchema = z.object({
  /** Overall risk level. */
  level: z.enum(['critical', 'high', 'medium', 'low', 'negligible']),
  /** Narrative description of the risk. */
  description: z.string(),
  /** Concrete mitigation steps. */
  mitigations: z.array(z.string()),
  /** Estimated cost or consequence of taking no action (the "interest rate" of inaction). */
  cost_of_inaction: z.string().optional(),
});

/** Inferred TypeScript type for {@link RiskAssessmentSchema}. */
export type RiskAssessment = z.infer<typeof RiskAssessmentSchema>;

/**
 * Plan for validating that an implemented opportunity achieved its
 * expected impact.
 */
export const ValidationPlanSchema = z.object({
  /** Ordered validation steps. */
  steps: z.array(
    z.object({
      description: z.string(),
      type: z.enum([
        'automated_test',
        'manual_test',
        'a_b_test',
        'benchmark',
        'review',
        'monitoring',
      ]),
      duration: z.string().optional(),
    }),
  ),
  /** Criteria that must be met for the opportunity to be considered validated. */
  success_criteria: z.array(z.string()),
  /** How long to monitor after deployment. */
  monitoring_duration: z.string().optional(),
});

/** Inferred TypeScript type for {@link ValidationPlanSchema}. */
export type ValidationPlan = z.infer<typeof ValidationPlanSchema>;

/**
 * Rollback plan in case the implementation causes regressions.
 */
export const RollbackPlanSchema = z.object({
  /** Deployment/rollback strategy. */
  strategy: z.enum(['automatic', 'manual', 'feature_flag', 'blue_green', 'canary']),
  /** Ordered rollback steps. */
  steps: z.array(z.string()),
  /** Estimated time to complete rollback. */
  estimated_duration: z.string().optional(),
  /** Description of potential data-level side-effects. */
  data_impact: z.string().optional(),
});

/** Inferred TypeScript type for {@link RollbackPlanSchema}. */
export type RollbackPlan = z.infer<typeof RollbackPlanSchema>;

/**
 * Provenance information tracking which agents proposed, supported,
 * or dissented on an opportunity.
 */
export const AgentProvenanceSchema = z.object({
  /** Agent ID that originally proposed this opportunity. */
  proposer: z.string(),
  /** Agent IDs that supported the proposal. */
  supporters: z.array(z.string()),
  /** Agents that disagreed, with reasons. */
  dissenters: z.array(
    z.object({
      agent_id: z.string(),
      reason: z.string(),
    }),
  ),
  /** Aggregate consensus score (0–1). */
  consensus_score: z.number().min(0).max(1),
  /** Optional link to the full reasoning trace/log. */
  reasoning_trace: z.string().optional(),
});

/** Inferred TypeScript type for {@link AgentProvenanceSchema}. */
export type AgentProvenance = z.infer<typeof AgentProvenanceSchema>;

/**
 * Precise source-code location for a finding or opportunity.
 */
export const SourceLocationSchema = z.object({
  /** File path (relative to repository root). */
  file: z.string(),
  start_line: z.number().optional(),
  end_line: z.number().optional(),
  start_column: z.number().optional(),
  end_column: z.number().optional(),
  repository: z.string().optional(),
  commit: z.string().optional(),
});

/** Inferred TypeScript type for {@link SourceLocationSchema}. */
export type SourceLocation = z.infer<typeof SourceLocationSchema>;

/**
 * Result of a traffic-replay or shadow simulation that validates
 * expected impact before deployment.
 */
export const SimulationResultSchema = z.object({
  /** ISO-8601 timestamp of when the simulation was executed. */
  ran_at: z.string().datetime(),
  /** Number of traffic samples used. */
  traffic_sample_size: z.number(),
  /** Per-metric simulation outcomes. */
  results: z.array(
    z.object({
      metric: z.string(),
      baseline: z.number(),
      simulated: z.number(),
      change_percent: z.number(),
    }),
  ),
  /** Overall confidence in the simulation result (0–1). */
  confidence: z.number().min(0).max(1),
  /** Description of the simulation methodology. */
  methodology: z.string(),
});

/** Inferred TypeScript type for {@link SimulationResultSchema}. */
export type SimulationResult = z.infer<typeof SimulationResultSchema>;

// ---------------------------------------------------------------------------
// THE OPPORTUNITY — the core output of the entire system
// ---------------------------------------------------------------------------

/**
 * An Opportunity is the primary output artefact of the Recurrsive
 * runtime.  It represents a concrete, evidence-backed suggestion for
 * improving the target software system — whether that is a proactive
 * improvement, an identified risk, or existing technical debt.
 *
 * Every opportunity goes through a lifecycle:
 *   proposed → accepted/rejected → in_progress → implemented → validated → archived
 */
export const OpportunitySchema = z.object({
  /** Globally unique identifier (UUID v4). */
  id: z.string().uuid(),
  /** Human-readable title. */
  title: z.string(),
  /** Whether this is an opportunity, risk, or debt item. */
  type: OpportunityTypeSchema,
  /** High-level category. */
  category: OpportunityCategorySchema,
  /** Severity / priority. */
  severity: SeveritySchema,
  /** Clear statement of the problem or gap. */
  problem: z.string(),
  /** Supporting evidence from collectors and analyzers. */
  evidence: z.array(EvidenceSchema),
  /** Actionable recommendation. */
  recommendation: z.string(),
  /** Quantified expected impact. */
  expected_impact: ImpactSchema,
  /** Overall confidence in the opportunity (0–1). */
  confidence: z.number().min(0).max(1),
  /** Effort estimation. */
  effort: EffortEstimateSchema,
  /** Risk assessment for implementing this change. */
  risk: RiskAssessmentSchema,
  /** How to validate success post-implementation. */
  validation: ValidationPlanSchema,
  /** How to roll back if things go wrong. */
  rollback: RollbackPlanSchema,
  /** Which agents proposed / debated this opportunity. */
  reasoning: AgentProvenanceSchema,
  /** Source locations relevant to this opportunity. */
  locations: z.array(SourceLocationSchema),
  /** Optional simulation result. */
  simulation: SimulationResultSchema.optional(),
  /** IDs of related opportunities. */
  related: z.array(z.string().uuid()),
  /** Current lifecycle status. */
  status: OpportunityStatusSchema,
  /** Human- or agent-authored reason for acceptance/rejection. */
  decision_reason: z.string().optional(),
  /** Assumptions made during analysis — critical for trust and explainability. */
  assumptions: z.array(z.string()).optional(),
  /** Free-form tags for filtering and grouping. */
  tags: z.array(z.string()).optional(),
  /** Measured impact after implementation (filled post-validation). */
  actual_impact: ImpactSchema.optional(),
  /** ISO-8601 creation timestamp. */
  created_at: z.string().datetime(),
  /** ISO-8601 last-update timestamp. */
  updated_at: z.string().datetime(),
  /** ISO-8601 timestamp of when the change was deployed. */
  implemented_at: z.string().datetime().optional(),
  /** ISO-8601 timestamp of when validation completed. */
  validated_at: z.string().datetime().optional(),
});

/** Inferred TypeScript type for {@link OpportunitySchema}. */
export type Opportunity = z.infer<typeof OpportunitySchema>;

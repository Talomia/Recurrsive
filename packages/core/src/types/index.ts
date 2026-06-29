/**
 * @module @recurrsive/core/types
 *
 * Barrel export for all Recurrsive type definitions and Zod schemas.
 *
 * @packageDocumentation
 */

// Entities
export {
  EntityTypeSchema,
  EntitySchema,
  SourceLocationRefSchema,
  type EntityType,
  type Entity,
  type SourceLocationRef,
} from './entities.js';

// Relationships
export {
  RelationTypeSchema,
  RelationshipSchema,
  type RelationType,
  type Relationship,
} from './relationships.js';

// Opportunities (core output)
export {
  OpportunityCategorySchema,
  OpportunityTypeSchema,
  SeveritySchema,
  OpportunityStatusSchema,
  EvidenceSchema,
  ImpactSchema,
  EffortEstimateSchema,
  RiskAssessmentSchema,
  ValidationPlanSchema,
  RollbackPlanSchema,
  AgentProvenanceSchema,
  SourceLocationSchema,
  SimulationResultSchema,
  OpportunitySchema,
  type OpportunityCategory,
  type OpportunityType,
  type Severity,
  type OpportunityStatus,
  type Evidence,
  type Impact,
  type EffortEstimate,
  type RiskAssessment,
  type ValidationPlan,
  type RollbackPlan,
  type AgentProvenance,
  type SourceLocation,
  type SimulationResult,
  type Opportunity,
} from './opportunities.js';

// Findings
export { FindingSchema, type Finding } from './findings.js';

// Analyzers
export {
  AnalyzerMetadataSchema,
  type GraphClient,
  type AnalysisHistory,
  type AnalyzerConfig,
  type AnalysisContext,
  type ProjectInfo,
  type Analyzer,
  type AnalyzerMetadata,
} from './analyzers.js';

// Collectors
export {
  CollectorTypeSchema,
  CollectorStatusSchema,
  CollectorMetadataSchema,
  type CollectorType,
  type CollectorStatus,
  type CollectorError,
  type CollectorRunMetadata,
  type CollectorResult,
  type CollectorCredentials,
  type DataGovernance,
  type CollectorSchedule,
  type CollectorConfig,
  type Collector,
  type CollectorMetadata,
} from './collectors.js';

// Reasoning
export {
  SpecialistRoleSchema,
  type SpecialistRole,
  type Hypothesis,
  type DebateChallenge,
  type DebateResponse,
  type DebateRound,
  type HypothesisRanking,
  type ConsensusResult,
  type ReasoningConfig,
} from './reasoning.js';

// Evolution
export {
  MaturityDimensionSchema,
  MaturityLevelSchema,
  type MaturityDimension,
  type MaturityLevel,
  type MaturityScore,
  type MaturityChange,
  type SnapshotDelta,
  type EvolutionSnapshot,
  type TrendDataPoint,
  type TrendSeries,
  type EvolutionTimeline,
} from './evolution.js';

// Experiments
export {
  ExperimentStatusSchema,
  type ExperimentStatus,
  type ExperimentVariant,
  type ExperimentMetric,
  type MetricObservation,
  type ExperimentResult,
  type Experiment,
} from './experiments.js';

// Policy
export {
  PolicyActionSchema,
  PolicyScopeSchema,
  type PolicyAction,
  type PolicyScope,
  type PolicyRule,
  type PolicyEvaluation,
  type PolicySet,
} from './policy.js';

// Config
export { RecurrsiveConfigSchema, type RecurrsiveConfig } from './config.js';

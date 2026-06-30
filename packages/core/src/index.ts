/**
 * @module @recurrsive/core
 *
 * Core type system, Zod schemas, utilities, and constants for the
 * Recurrsive engineering intelligence platform.
 *
 * This package contains no runtime logic beyond utilities — it is the
 * shared vocabulary that all other Recurrsive packages depend on.
 *
 * @packageDocumentation
 */

// ─── Types & Schemas ─────────────────────────────────────────────────────────

export {
  // Entities
  EntityTypeSchema,
  EntitySchema,
  SourceLocationRefSchema,
  type EntityType,
  type Entity,
  type SourceLocationRef,
  // Relationships
  RelationTypeSchema,
  RelationshipSchema,
  type RelationType,
  type Relationship,
  // Opportunities
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
  // Findings
  FindingSchema,
  type Finding,
  // Analyzers
  AnalyzerMetadataSchema,
  type GraphClient,
  type AnalysisHistory,
  type AnalyzerConfig,
  type AnalysisContext,
  type ProjectInfo,
  type Analyzer,
  type AnalyzerMetadata,
  // Collectors
  CollectorTypeSchema,
  CollectorStatusSchema,
  CollectorMetadataSchema,
  type CollectorType,
  type CollectorStatus,
  type CollectorError as CollectorErrorType,
  type CollectorRunMetadata,
  type CollectorResult,
  type CollectorCredentials,
  type DataGovernance,
  type CollectorSchedule,
  type CollectorConfig,
  type Collector,
  type CollectorMetadata,
  // Reasoning
  SpecialistRoleSchema,
  type SpecialistRole,
  type Hypothesis,
  type DebateChallenge,
  type DebateResponse,
  type DebateRound,
  type HypothesisRanking,
  type ConsensusResult,
  type ReasoningConfig,
  // Evolution
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
  // Experiments
  ExperimentStatusSchema,
  type ExperimentStatus,
  type ExperimentVariant,
  type ExperimentMetric,
  type MetricObservation,
  type ExperimentResult,
  type Experiment,
  // Policy
  PolicyActionSchema,
  PolicyScopeSchema,
  type PolicyAction,
  type PolicyScope,
  type PolicyRule,
  type PolicyEvaluation,
  type PolicySet,
  // Config
  RecurrsiveConfigSchema,
  type RecurrsiveConfig,
} from './types/index.js';

// ─── Utilities ───────────────────────────────────────────────────────────────

export {
  generateId,
  isValidId,
  qualifiedName,
  nowISO,
  toISO,
  fromISO,
  durationMs,
  formatDuration,
  isOlderThan,
  Logger,
  createLogger,
  type LogLevel,
  type LogEntry,
  type LoggerOptions,
  RecurrsiveError,
  CollectorError,
  AnalyzerError,
  ReasoningError,
  GraphError,
  ConfigError,
  ValidationError,
  retry,
  contentHash,
  batchProcess,
  type RetryConfig,
  sanitizeInput,
  validateEmail,
  validateUrl,
  truncate,
  slugify,
  deepMerge,
  debounce,
} from './utils/index.js';

// ─── Constants ───────────────────────────────────────────────────────────────

export {
  VERSION,
  CONFIG_VERSION,
  DEFAULT_OUTPUT_DIRECTORY,
  DEFAULT_OUTPUT_FORMAT,
  DEFAULT_GRAPH_PROVIDER,
  DEFAULT_LLM_PROVIDER,
  DEFAULT_LLM_MODEL,
  DEFAULT_LLM_TEMPERATURE,
  DEFAULT_MAX_DEBATE_ROUNDS,
  DEFAULT_MIN_CONSENSUS_SCORE,
  DEFAULT_RETENTION_DAYS,
  CONFIG_FILE_NAMES,
  SEVERITY_WEIGHTS,
  MATURITY_LEVEL_WEIGHTS,
  EFFORT_WEIGHTS,
} from './constants/index.js';

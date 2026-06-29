/**
 * @module @recurrsive/core/schemas
 *
 * Re-export of all Zod schemas for convenient programmatic access.
 * Import from `@recurrsive/core` for types + schemas, or from this
 * sub-path for schemas only.
 *
 * @packageDocumentation
 */

// Entities
export { EntityTypeSchema, EntitySchema, SourceLocationRefSchema } from '../types/entities.js';

// Relationships
export { RelationTypeSchema, RelationshipSchema } from '../types/relationships.js';

// Opportunities
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
} from '../types/opportunities.js';

// Findings
export { FindingSchema } from '../types/findings.js';

// Analyzers
export { AnalyzerMetadataSchema } from '../types/analyzers.js';

// Collectors
export {
  CollectorTypeSchema,
  CollectorStatusSchema,
  CollectorMetadataSchema,
} from '../types/collectors.js';

// Reasoning
export { SpecialistRoleSchema } from '../types/reasoning.js';

// Evolution
export { MaturityDimensionSchema, MaturityLevelSchema } from '../types/evolution.js';

// Experiments
export { ExperimentStatusSchema } from '../types/experiments.js';

// Policy
export { PolicyActionSchema, PolicyScopeSchema } from '../types/policy.js';

// Config
export { RecurrsiveConfigSchema } from '../types/config.js';

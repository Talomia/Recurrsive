import { z } from 'zod';
import {
  OpportunityCategorySchema,
  SeveritySchema,
  SourceLocationSchema,
  EvidenceSchema,
  ImpactSchema,
} from './opportunities.js';

/**
 * A Finding is the output of an individual analyzer before the
 * reasoning engine promotes it into a full {@link Opportunity}.
 *
 * Findings are raw, unranked observations. The reasoning engine
 * aggregates, deduplicates, and enriches findings into prioritised
 * opportunities through multi-agent debate.
 */
export const FindingSchema = z.object({
  /** Globally unique identifier (UUID v4). */
  id: z.string().uuid(),
  /** Identifier of the analyzer that produced this finding. */
  analyzer_id: z.string(),
  /** Human-readable title. */
  title: z.string(),
  /** Detailed description of the finding. */
  description: z.string(),
  /** Severity / priority. */
  severity: SeveritySchema,
  /** High-level category. */
  category: OpportunityCategorySchema,
  /** Supporting evidence. */
  evidence: z.array(EvidenceSchema),
  /** Relevant source locations. */
  locations: z.array(SourceLocationSchema),
  /** Optional suggestion for how to fix the issue. */
  suggested_fix: z.string().optional(),
  /** Partial impact estimate (may be incomplete at finding stage). */
  estimated_impact: ImpactSchema.partial().optional(),
  /** Analyzer's confidence in this finding (0–1). */
  confidence: z.number().min(0).max(1),
  /** Tags for filtering and grouping. */
  tags: z.array(z.string()),
  /** Arbitrary structured metadata from the analyzer. */
  metadata: z.record(z.unknown()).optional(),
  /** ISO-8601 creation timestamp. */
  created_at: z.string().datetime(),
});

/** Inferred TypeScript type for {@link FindingSchema}. */
export type Finding = z.infer<typeof FindingSchema>;

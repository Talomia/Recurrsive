import { z } from 'zod';

/**
 * All relationship (edge) types in the Recurrsive knowledge graph.
 *
 * Relationships connect two entities and carry semantic meaning about
 * the nature of the connection.
 */
export const RelationTypeSchema = z.enum([
  // Code relationships
  'contains',
  'imports',
  'exports',
  'calls',
  'implements',
  'extends',
  'overrides',
  'references',
  'instantiates',
  // AI relationships
  'uses_model',
  'uses_tool',
  'has_prompt',
  'invokes_agent',
  'retrieves_from',
  'embeds_with',
  'evaluates_with',
  // Data relationships
  'queries_table',
  'writes_to',
  'reads_from',
  'migrates',
  // Infrastructure relationships
  'depends_on',
  'deploys_to',
  'routes_to',
  'caches',
  'load_balances',
  'scales_with',
  // Organizational relationships
  'owns',
  'maintains',
  'reviews',
  // Flow relationships
  'triggers',
  'produces',
  'consumes',
  'transforms',
  'monitors',
  'alerts_on',
  // Evolution relationships
  'supersedes',
  'conflicts_with',
  'enables',
  'blocks',
  // Testing & validation relationships
  'tests',
  'validates',
  'authenticates',
  'rate_limits',
]);

/** Discriminated union of all relationship type string literals. */
export type RelationType = z.infer<typeof RelationTypeSchema>;

/**
 * A directed edge in the Recurrsive knowledge graph.
 *
 * Every relationship connects a `source_id` entity to a `target_id`
 * entity, carries a confidence score (0–1), and records which
 * collector or analyzer produced it.
 */
export const RelationshipSchema = z.object({
  /** Globally unique identifier (UUID v4). */
  id: z.string().uuid(),
  /** Semantic type of this relationship. */
  type: RelationTypeSchema,
  /** UUID of the source (origin) entity. */
  source_id: z.string().uuid(),
  /** UUID of the target (destination) entity. */
  target_id: z.string().uuid(),
  /** Arbitrary key-value properties. */
  properties: z.record(z.unknown()),
  /** Confidence score between 0 (no confidence) and 1 (certain). */
  confidence: z.number().min(0).max(1).default(1),
  /** Identifier of the collector/analyzer that produced this relationship. */
  source: z.string(),
  /** ISO-8601 creation timestamp. */
  created_at: z.string().datetime(),
  /** ISO-8601 last-update timestamp. */
  updated_at: z.string().datetime(),
});

/** Inferred TypeScript type for {@link RelationshipSchema}. */
export type Relationship = z.infer<typeof RelationshipSchema>;

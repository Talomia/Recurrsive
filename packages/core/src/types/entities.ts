import { z } from 'zod';

/**
 * All entity types representable in the Recurrsive knowledge graph.
 *
 * Entities are the nodes of the graph. Each entity type maps to a
 * distinct concept across code, AI, data, infrastructure, and
 * organizational domains.
 */
export const EntityTypeSchema = z.enum([
  'repository',
  'file',
  'function',
  'class',
  'module',
  'endpoint',
  'prompt',
  'agent',
  'tool',
  'model',
  'dataset',
  'table',
  'collection',
  'query',
  'index',
  'dependency',
  'config',
  'secret',
  'mcp_server',
  'mcp_tool',
  'mcp_resource',
  'workflow',
  'pipeline',
  'job',
  'step',
  'user',
  'team',
  'organization',
  'incident',
  'alert',
  'cost_metric',
  'business_metric',
  'performance_metric',
  'infrastructure_resource',
  'deployment',
  'environment',
  'experiment',
  'feature_flag',
  'evaluation',
  'document',
  'adr',
  'rfc',
  'api_contract',
]);

/** Discriminated union of all entity type string literals. */
export type EntityType = z.infer<typeof EntityTypeSchema>;

/**
 * Source location metadata pinpointing where an entity was found in
 * the source tree.
 */
export const SourceLocationRefSchema = z.object({
  file: z.string().optional(),
  start_line: z.number().optional(),
  end_line: z.number().optional(),
  start_column: z.number().optional(),
  end_column: z.number().optional(),
  repository: z.string().optional(),
  commit: z.string().optional(),
});

/** Inferred TypeScript type for {@link SourceLocationRefSchema}. */
export type SourceLocationRef = z.infer<typeof SourceLocationRefSchema>;

/**
 * A single node in the Recurrsive knowledge graph.
 *
 * Every entity carries a UUID, a type discriminator, human-readable
 * names, provenance information (which collector produced it), and
 * an extensible properties bag.
 */
export const EntitySchema = z.object({
  /** Globally unique identifier (UUID v4). */
  id: z.string().uuid(),
  /** Discriminated entity type. */
  type: EntityTypeSchema,
  /** Short human-readable name. */
  name: z.string(),
  /** Fully qualified name (e.g. `repo:file:class:method`). */
  qualified_name: z.string(),
  /** Optional longer description. */
  description: z.string().optional(),
  /** Identifier of the collector that produced this entity. */
  source: z.string(),
  /** Where in the source tree this entity was found. */
  source_location: SourceLocationRefSchema.optional(),
  /** Arbitrary key-value properties specific to the entity type. */
  properties: z.record(z.unknown()),
  /** Free-form tags for filtering and grouping. */
  tags: z.array(z.string()),
  /** ISO-8601 creation timestamp. */
  created_at: z.string().datetime(),
  /** ISO-8601 last-update timestamp. */
  updated_at: z.string().datetime(),
  /** ISO-8601 timestamp of when this entity was last observed. */
  last_seen_at: z.string().datetime(),
});

/** Inferred TypeScript type for {@link EntitySchema}. */
export type Entity = z.infer<typeof EntitySchema>;

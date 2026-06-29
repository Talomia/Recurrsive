import { z } from 'zod';
import type { Finding } from './findings.js';
import type { Entity, EntityType } from './entities.js';
import type { Relationship } from './relationships.js';
import type { OpportunityCategory } from './opportunities.js';

// ---------------------------------------------------------------------------
// Graph Client Interface
// ---------------------------------------------------------------------------

/**
 * Read-only client for querying the Recurrsive knowledge graph.
 *
 * Analyzers receive a `GraphClient` through their {@link AnalysisContext}
 * and use it to inspect entities and relationships that collectors
 * have ingested.
 */
export interface GraphClient {
  /**
   * Retrieve a single entity by ID.
   * @param id - UUID of the entity.
   * @returns The entity, or `null` if not found.
   */
  getEntity(id: string): Promise<Entity | null>;

  /**
   * List entities of a given type, optionally filtered by properties.
   * @param type - The entity type to query.
   * @param filter - Optional key-value filter applied to `properties`.
   * @returns Matching entities.
   */
  getEntities(type: EntityType, filter?: Record<string, unknown>): Promise<Entity[]>;

  /**
   * Get all relationships connected to an entity.
   * @param entityId - UUID of the entity.
   * @param direction - Edge direction filter (default: `'both'`).
   * @returns Matching relationships.
   */
  getRelationships(
    entityId: string,
    direction?: 'in' | 'out' | 'both',
  ): Promise<Relationship[]>;

  /**
   * Execute a raw graph query (Cypher-style).
   * @param cypher - Query string.
   * @param params - Optional bind parameters.
   * @returns Array of result rows.
   */
  query(cypher: string, params?: Record<string, unknown>): Promise<unknown[]>;

  /**
   * Walk the graph outward from `entityId` up to `depth` hops.
   * @param entityId - Starting entity UUID.
   * @param depth - Maximum traversal depth (default: 1).
   * @returns Subgraph of entities and relationships.
   */
  getNeighbors(
    entityId: string,
    depth?: number,
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }>;
}

// ---------------------------------------------------------------------------
// Analysis History Interface
// ---------------------------------------------------------------------------

/**
 * Provides access to historical analysis data so that analyzers can
 * avoid re-reporting already-known findings and can learn from past
 * accept/reject decisions.
 */
export interface AnalysisHistory {
  /**
   * Retrieve findings from the most recent run of a specific analyzer.
   * @param analyzerId - The analyzer's unique identifier.
   * @returns Previously emitted findings.
   */
  getPreviousFindings(analyzerId: string): Promise<Finding[]>;

  /**
   * List opportunity IDs that have been accepted in the past.
   * @param category - Optional category filter.
   * @returns Array of accepted opportunity UUIDs.
   */
  getAcceptedOpportunities(category?: OpportunityCategory): Promise<string[]>;

  /**
   * List opportunity IDs that have been rejected in the past.
   * @param category - Optional category filter.
   * @returns Array of rejected opportunity UUIDs.
   */
  getRejectedOpportunities(category?: OpportunityCategory): Promise<string[]>;
}

// ---------------------------------------------------------------------------
// Analyzer Config
// ---------------------------------------------------------------------------

/** Per-analyzer configuration supplied via the project config file. */
export interface AnalyzerConfig {
  /** Whether this analyzer is enabled. */
  enabled: boolean;
  /** Minimum severity threshold for findings to be emitted. */
  severity_threshold: string;
  /** Arbitrary analyzer-specific configuration. */
  custom: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Analysis Context
// ---------------------------------------------------------------------------

/** Contextual information about the project being analyzed. */
export interface ProjectInfo {
  /** Project display name. */
  name: string;
  /** Absolute path to the project root. */
  root_path: string;
  /** Programming languages detected. */
  languages: string[];
  /** Frameworks detected (e.g. `['next.js', 'express']`). */
  frameworks: string[];
  /** AI providers in use (e.g. `['openai', 'anthropic']`). */
  ai_providers: string[];
  /** Remote repository URL, if available. */
  repository_url?: string;
}

/**
 * The runtime context supplied to every analyzer during the analysis
 * lifecycle.  Provides access to the knowledge graph, configuration,
 * history, and a callback to emit findings.
 */
export interface AnalysisContext {
  /** Read-only knowledge graph client. */
  graph: GraphClient;
  /** Analyzer-specific configuration. */
  config: AnalyzerConfig;
  /** Historical analysis data. */
  history: AnalysisHistory;
  /** Project-level metadata. */
  project: ProjectInfo;
  /**
   * Emit a finding from within the analysis lifecycle.
   * @param finding - The finding to emit.
   */
  emit: (finding: Finding) => void;
}

// ---------------------------------------------------------------------------
// Analyzer Interface
// ---------------------------------------------------------------------------

/**
 * An Analyzer inspects the knowledge graph and produces raw
 * {@link Finding}s.
 *
 * The lifecycle is:
 * 1. `initialize` — one-time setup (load models, warm caches).
 * 2. `analyze` — main analysis pass; returns and/or emits findings.
 * 3. `finalize` — post-analysis cleanup and summary-level findings.
 */
export interface Analyzer {
  /** Unique identifier (e.g. `'security.dependency-audit'`). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** One-line description of what this analyzer checks. */
  description: string;
  /** SemVer version string. */
  version: string;
  /** Categories this analyzer can produce findings for. */
  categories: OpportunityCategory[];

  /**
   * One-time initialization hook.
   * @param ctx - Analysis context.
   */
  initialize(ctx: AnalysisContext): Promise<void>;

  /**
   * Main analysis pass.
   * @param ctx - Analysis context.
   * @returns Findings discovered during this pass.
   */
  analyze(ctx: AnalysisContext): Promise<Finding[]>;

  /**
   * Finalization hook for summary-level findings.
   * @param ctx - Analysis context.
   * @returns Any additional findings produced during finalization.
   */
  finalize(ctx: AnalysisContext): Promise<Finding[]>;
}

// ---------------------------------------------------------------------------
// Analyzer Metadata Schema
// ---------------------------------------------------------------------------

/**
 * Serializable metadata describing an analyzer for registry /
 * discovery purposes.
 */
export const AnalyzerMetadataSchema = z.object({
  /** Unique identifier. */
  id: z.string(),
  /** Human-readable name. */
  name: z.string(),
  /** One-line description. */
  description: z.string(),
  /** SemVer version string. */
  version: z.string(),
  /** Categories this analyzer covers. */
  categories: z.array(z.string()),
  /** Optional JSON-Schema describing the analyzer's configuration. */
  config_schema: z.record(z.unknown()).optional(),
});

/** Inferred TypeScript type for {@link AnalyzerMetadataSchema}. */
export type AnalyzerMetadata = z.infer<typeof AnalyzerMetadataSchema>;

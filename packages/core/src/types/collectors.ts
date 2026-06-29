import { z } from 'zod';
import type { Entity } from './entities.js';
import type { Relationship } from './relationships.js';

// ---------------------------------------------------------------------------
// Collector Enums
// ---------------------------------------------------------------------------

/**
 * The domain a collector operates in.
 */
export const CollectorTypeSchema = z.enum([
  'code',
  'git',
  'github',
  'gitlab',
  'bitbucket',
  'database',
  'telemetry',
  'cloud',
  'ci_cd',
  'documentation',
  'ai_provider',
  'product_analytics',
  'customer_signals',
  'business_metrics',
  'infrastructure',
  'observability',
]);

/** Inferred TypeScript type for {@link CollectorTypeSchema}. */
export type CollectorType = z.infer<typeof CollectorTypeSchema>;

/**
 * Runtime status of a collector.
 */
export const CollectorStatusSchema = z.enum([
  'idle',
  'collecting',
  'normalizing',
  'complete',
  'error',
]);

/** Inferred TypeScript type for {@link CollectorStatusSchema}. */
export type CollectorStatus = z.infer<typeof CollectorStatusSchema>;

// ---------------------------------------------------------------------------
// Collector Result
// ---------------------------------------------------------------------------

/** A single error encountered during collection. */
export interface CollectorError {
  /** Human-readable error message. */
  message: string;
  /** Optional structured details. */
  details?: unknown;
}

/** Metadata about a completed collection run. */
export interface CollectorRunMetadata {
  /** ID of the collector that ran. */
  collector_id: string;
  /** ISO-8601 timestamp of when collection completed. */
  collected_at: string;
  /** Wall-clock duration of the run in milliseconds. */
  duration_ms: number;
  /** Number of raw items processed. */
  items_processed: number;
  /** Non-fatal errors encountered during collection. */
  errors: CollectorError[];
}

/**
 * The output of a single collector run — a set of entities and
 * relationships to be merged into the knowledge graph.
 */
export interface CollectorResult {
  /** Entities discovered by this collector. */
  entities: Entity[];
  /** Relationships discovered by this collector. */
  relationships: Relationship[];
  /** Run metadata (timing, counts, errors). */
  metadata: CollectorRunMetadata;
}

// ---------------------------------------------------------------------------
// Collector Configuration
// ---------------------------------------------------------------------------

/** Credentials needed by a collector to access an external system. */
export interface CollectorCredentials {
  /** Credential scheme (e.g. `'oauth2'`, `'api_key'`, `'basic'`). */
  type: string;
  /** Key-value credential values. */
  values: Record<string, string>;
}

/**
 * Data governance rules applied during collection to redact PII,
 * exclude sensitive paths, and control retention.
 */
export interface DataGovernance {
  /** Property keys whose values should be masked. */
  masked_fields: string[];
  /** Glob patterns of paths to exclude from collection. */
  excluded_patterns: string[];
  /** Whether to run automatic PII detection. */
  pii_detection: boolean;
  /** Whether to write an audit log of collected data. */
  audit_log: boolean;
  /** Maximum number of days to retain collected data. */
  retention_days: number;
}

/** Schedule configuration for a collector. */
export interface CollectorSchedule {
  /** How often to run. */
  type: 'once' | 'periodic' | 'webhook' | 'watch';
  /** Interval in milliseconds (for `periodic`). */
  interval_ms?: number;
  /** Cron expression (for `periodic`). */
  cron?: string;
}

/** Full configuration object for a collector instance. */
export interface CollectorConfig {
  /** Optional credentials for accessing external systems. */
  credentials?: CollectorCredentials;
  /** Data governance rules. */
  governance: DataGovernance;
  /** Optional collection schedule. */
  schedule?: CollectorSchedule;
  /** Arbitrary collector-specific configuration. */
  custom: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Collector Interface
// ---------------------------------------------------------------------------

/**
 * A Collector ingests data from an external source and normalises it
 * into entities and relationships for the knowledge graph.
 *
 * Lifecycle:
 * 1. `initialize` — configure credentials, validate connectivity.
 * 2. `validate` — verify the collector can reach its data source.
 * 3. `collect` — perform the actual data collection.
 * 4. `dispose` — release resources.
 */
export interface Collector {
  /** Unique identifier (e.g. `'code.typescript'`). */
  id: string;
  /** Human-readable name. */
  name: string;
  /** One-line description. */
  description: string;
  /** Domain this collector operates in. */
  type: CollectorType;
  /** SemVer version string. */
  version: string;

  /**
   * Initialize the collector with its configuration.
   * @param config - Collector configuration.
   */
  initialize(config: CollectorConfig): Promise<void>;

  /**
   * Perform the data collection.
   * @returns Entities, relationships, and run metadata.
   */
  collect(): Promise<CollectorResult>;

  /**
   * Validate connectivity and configuration.
   * @returns Validation result with optional error messages.
   */
  validate(): Promise<{ valid: boolean; errors: string[] }>;

  /**
   * Release any held resources (connections, file handles, etc.).
   */
  dispose(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Collector Metadata Schema
// ---------------------------------------------------------------------------

/**
 * Serializable metadata describing a collector for registry /
 * discovery purposes.
 */
export const CollectorMetadataSchema = z.object({
  /** Unique identifier. */
  id: z.string(),
  /** Human-readable name. */
  name: z.string(),
  /** One-line description. */
  description: z.string(),
  /** Domain this collector operates in. */
  type: CollectorTypeSchema,
  /** SemVer version string. */
  version: z.string(),
  /** Credential keys required by this collector. */
  required_credentials: z.array(z.string()),
  /** Optional JSON-Schema describing the collector's configuration. */
  config_schema: z.record(z.unknown()).optional(),
});

/** Inferred TypeScript type for {@link CollectorMetadataSchema}. */
export type CollectorMetadata = z.infer<typeof CollectorMetadataSchema>;

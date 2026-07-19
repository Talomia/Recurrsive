/**
 * @module @recurrsive/collectors/arize/collector
 *
 * Arize Collector — intended to ingest ML observability data (models,
 * datasets, performance metrics, drift alerts) from an Arize space.
 *
 * IMPORTANT: the integration is NOT implemented yet. Arize's public
 * API is GraphQL (https://app.arize.com/graphql); the REST endpoints
 * this collector previously called (`/v1/models`, `/v1/datasets`) are
 * not part of Arize's API. Until a real GraphQL integration exists,
 * this collector returns empty results and records an explicit
 * "integration not implemented" entry in `metadata.errors` — it never
 * fabricates entities.
 *
 * @packageDocumentation
 */

import type {
  Collector,
  CollectorConfig,
  CollectorResult,
  CollectorType,
  Entity,
} from '@recurrsive/core';
import {
  nowISO,
  createLogger,
  CollectorError,
} from '@recurrsive/core';
import { GovernanceFilter } from '../base/governance.js';

const logger = createLogger({ context: { module: 'arize-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Arize project environment. */
type ArizeEnvironment = 'production' | 'staging' | 'development';

// ---------------------------------------------------------------------------
// ArizeCollector
// ---------------------------------------------------------------------------

/**
 * Placeholder for an Arize ML observability integration.
 *
 * The integration is not implemented: Arize's public API is GraphQL,
 * and no GraphQL client exists here yet. {@link collect} always
 * returns empty results with an explanatory `metadata.errors` entry —
 * it never fabricates entities or relationships.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and environment.
 * 2. {@link validate} — verify the environment is supported.
 * 3. {@link collect} — return empty results, recording why in
 *    `metadata.errors` (missing credentials or unimplemented API).
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new ArizeCollector('production');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: { arize_api_key: 'key', arize_space_key: 'space' },
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class ArizeCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'arize';
  /** @inheritdoc */
  readonly name = 'Arize Collector';
  /** @inheritdoc */
  readonly description = 'Collects ML observability data including models, datasets, performance metrics, drift detection, and alerts from Arize';
  /** @inheritdoc */
  readonly type: CollectorType = 'observability';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** Arize project environment. */
  private environment: ArizeEnvironment;
  /** Collector configuration (set during initialize). */
  private config!: CollectorConfig;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;

  /**
   * @param environment - Arize project environment (default: `'production'`).
   */
  constructor(environment: ArizeEnvironment = 'production') {
    this.environment = environment;
  }

  // -----------------------------------------------------------------------
  // Collector Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialize the collector with configuration.
   *
   * @param config - Collector configuration including governance rules.
   */
  async initialize(config: CollectorConfig): Promise<void> {
    this.config = config;
    this.governanceFilter = new GovernanceFilter(config.governance);

    if (typeof config.custom['environment'] === 'string') {
      const env = config.custom['environment'];
      if (env === 'production' || env === 'staging' || env === 'development') {
        this.environment = env;
      }
    }

    this.initialized = true;
    logger.info('ArizeCollector initialized', { environment: this.environment });
  }

  /**
   * Validate that the configured environment is supported.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const supported: ArizeEnvironment[] = ['production', 'staging', 'development'];

    if (!this.environment) {
      errors.push('Arize environment is required');
    } else if (!supported.includes(this.environment)) {
      errors.push(`'${this.environment}' is not a supported environment. Supported: ${supported.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform the full collection run.
   *
   * The Arize integration is not implemented: Arize's public API is
   * GraphQL, and no GraphQL client has been built yet. This method
   * therefore always returns empty results, recording in
   * `metadata.errors` exactly why nothing was collected (missing
   * credentials, or credentials present but the integration missing).
   * It never calls invented REST endpoints and never fabricates data.
   *
   * @returns Empty entities/relationships and run metadata explaining why.
   * @throws {CollectorError} If the collector has not been initialized.
   */
  async collect(): Promise<CollectorResult> {
    if (!this.initialized) {
      throw new CollectorError(
        'ArizeCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // --- Resolve credentials ---
    const apiKey = (this.config.custom['arize_api_key'] as string) || process.env['ARIZE_API_KEY'];
    const spaceKey = (this.config.custom['arize_space_key'] as string) || process.env['ARIZE_SPACE_KEY'];

    if (!apiKey || !spaceKey) {
      const msg = 'No Arize credentials configured (arize_api_key / arize_space_key or ARIZE_API_KEY / ARIZE_SPACE_KEY); no data collected.';
      logger.warn(msg);
      errors.push({ message: msg });
    } else {
      // Credentials are present, but there is nothing honest to call:
      // Arize's public API is GraphQL (https://app.arize.com/graphql),
      // and the REST endpoints previously used here (/v1/models,
      // /v1/datasets) are not part of Arize's API.
      const msg =
        'Arize integration not implemented: Arize exposes a GraphQL API, ' +
        'and no GraphQL client has been built for this collector yet. ' +
        'No data collected.';
      logger.warn(msg);
      errors.push({ message: msg });
    }

    // Governance masking applied for consistency (no entities to mask).
    const entities: Entity[] = [];
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    return {
      entities: maskedEntities,
      relationships: [],
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed: 0,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('ArizeCollector disposed', { environment: this.environment });
  }

  // Note: entity/relationship builders were removed together with the
  // fabricated REST calls. They should be reintroduced when a real
  // Arize GraphQL integration is implemented.
}

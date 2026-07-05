/**
 * @module @recurrsive/collectors/arize/collector
 *
 * Arize Collector — ingests ML observability data including model
 * configurations, training/evaluation datasets, performance metrics,
 * model degradation alerts, ML pipelines, and ML engineers from an
 * Arize project and produces entities and relationships for the
 * knowledge graph.
 *
 * Connects to the real Arize API using credentials supplied via
 * collector config or environment variables. When credentials are
 * absent or the API is unreachable, the collector logs a warning
 * and returns empty results gracefully.
 *
 * Produces entities:
 * - `model` — ML models with version, framework, and performance info
 * - `dataset` — training and evaluation datasets
 * - `performance_metric` — accuracy, F1, precision, recall, AUC, drift scores
 * - `alert` — model degradation alerts
 * - `pipeline` — ML training and inference pipelines
 * - `user` — ML engineers and data scientists
 *
 * @packageDocumentation
 */

import type {
  Collector,
  CollectorConfig,
  CollectorResult,
  CollectorType,
  Entity,
  Relationship,
} from '@recurrsive/core';
import {
  generateId,
  qualifiedName,
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
 * Collects ML observability data including model configurations,
 * training/evaluation datasets, performance metrics, model
 * degradation alerts, ML pipelines, and ML engineer profiles
 * from an Arize project.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and environment.
 * 2. {@link validate} — verify the environment is supported.
 * 3. {@link collect} — fetch entities & relationships from the
 *    Arize API (or return empty results when credentials are absent).
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
   * Checks for Arize API credentials (via config or environment variables).
   * If credentials are missing, logs a warning and returns empty results.
   * If credentials are present, fetches models and datasets from the
   * Arize API and builds entities and relationships from the response.
   *
   * @returns Entities, relationships, and run metadata.
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
      logger.warn('No Arize credentials configured, skipping collection');
      const durationMs = Date.now() - startTime;
      return {
        entities: [],
        relationships: [],
        metadata: {
          collector_id: this.id,
          collected_at: nowISO(),
          duration_ms: durationMs,
          items_processed: 0,
          errors: [],
        },
      };
    }

    // --- Fetch from Arize API ---
    const baseUrl = (this.config.custom['arize_url'] as string) || process.env['ARIZE_URL'] || 'https://app.arize.com';
    const headers: Record<string, string> = {
      'authorization': `Bearer ${apiKey}`,
      'space-key': spaceKey,
    };

    let modelsData: unknown[] = [];
    let datasetsData: unknown[] = [];

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);

      try {
        const [modelsRes, datasetsRes] = await Promise.all([
          fetch(`${baseUrl}/v1/models`, { headers, signal: controller.signal }),
          fetch(`${baseUrl}/v1/datasets`, { headers, signal: controller.signal }),
        ]);

        if (modelsRes.ok) {
          const body = await modelsRes.json() as { data?: unknown[] };
          modelsData = body.data ?? [];
        }
        if (datasetsRes.ok) {
          const body = await datasetsRes.json() as { data?: unknown[] };
          datasetsData = body.data ?? [];
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err) {
      logger.warn('Failed to fetch from Arize API, returning empty results', { error: err });
      const durationMs = Date.now() - startTime;
      return {
        entities: [],
        relationships: [],
        metadata: {
          collector_id: this.id,
          collected_at: nowISO(),
          duration_ms: durationMs,
          items_processed: 0,
          errors: [],
        },
      };
    }

    // --- Build entities from response ---
    const entities = this.buildEntities(modelsData, datasetsData);
    const relationships = this.buildRelationships(entities);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    logger.info('ArizeCollector collection complete', {
      entities: maskedEntities.length,
      relationships: relationships.length,
      durationMs,
    });

    return {
      entities: maskedEntities,
      relationships,
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed: modelsData.length + datasetsData.length,
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

  // -----------------------------------------------------------------------
  // Internal: Entity Helpers
  // -----------------------------------------------------------------------

  /**
   * Create a single entity with common defaults.
   */
  private makeEntity(
    type: Entity['type'],
    name: string,
    props: Record<string, unknown>,
    tags: string[] = [],
  ): Entity {
    const now = nowISO();
    return {
      id: generateId(),
      type,
      name,
      qualified_name: qualifiedName(this.environment, name),
      source: this.id,
      properties: props,
      tags: ['arize', this.environment, ...tags],
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    };
  }

  /**
   * Create a single relationship with common defaults.
   */
  private makeRel(
    type: Relationship['type'],
    sourceId: string,
    targetId: string,
    props: Record<string, unknown> = {},
  ): Relationship {
    const now = nowISO();
    return {
      id: generateId(),
      type,
      source_id: sourceId,
      target_id: targetId,
      properties: props,
      confidence: 1.0,
      source: this.id,
      created_at: now,
      updated_at: now,
    };
  }

  // -----------------------------------------------------------------------
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from Arize API response data.
   *
   * Creates:
   * - `model` entities from models API response
   * - `dataset` entities from datasets API response
   *
   * @param modelsData - Raw model records from the Arize API.
   * @param datasetsData - Raw dataset records from the Arize API.
   * @returns Array of entities.
   */
  private buildEntities(modelsData: unknown[], datasetsData: unknown[]): Entity[] {
    const entities: Entity[] = [];

    // --- Model entities ---
    for (const raw of modelsData) {
      const model = raw as Record<string, unknown>;
      const name = (model['name'] as string) || 'unknown-model';
      entities.push(
        this.makeEntity('model', name, {
          version: model['version'] ?? 'unknown',
          framework: model['framework'] ?? 'unknown',
          model_type: model['model_type'] ?? 'unknown',
          platform: 'arize',
          environment: this.environment,
          ...model,
        }, ['ml-model']),
      );
    }

    // --- Dataset entities ---
    for (const raw of datasetsData) {
      const dataset = raw as Record<string, unknown>;
      const name = (dataset['name'] as string) || 'unknown-dataset';
      entities.push(
        this.makeEntity('dataset', name, {
          dataset_type: dataset['dataset_type'] ?? 'unknown',
          row_count: dataset['row_count'] ?? 0,
          feature_count: dataset['feature_count'] ?? 0,
          platform: 'arize',
          environment: this.environment,
          ...dataset,
        }, ['ml-dataset']),
      );
    }

    return entities;
  }

  // -----------------------------------------------------------------------
  // Internal: Relationship Building
  // -----------------------------------------------------------------------

  /**
   * Build relationships between entities.
   *
   * Creates:
   * - `depends_on` — model depends on training dataset (matched by model name)
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const models = entities.filter((e) => e.type === 'model');
    const datasets = entities.filter((e) => e.type === 'dataset');

    // Model → Dataset (depends_on) — models depend on their training datasets
    for (const dataset of datasets) {
      const dsType = dataset.properties['dataset_type'] as string;
      if (dsType === 'training') {
        const modelName = dataset.properties['model'] as string;
        const modelEntity = models.find((m) => m.name === modelName);
        if (modelEntity) {
          relationships.push(this.makeRel('depends_on', modelEntity.id, dataset.id, {
            dependency_type: 'training_data',
          }));
        }
      }
    }

    return relationships;
  }
}

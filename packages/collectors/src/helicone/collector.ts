/**
 * @module @recurrsive/collectors/helicone/collector
 *
 * Helicone Collector — ingests LLM request/usage analytics data from the
 * Helicone REST API and produces entities and relationships for the
 * knowledge graph.
 *
 * When an API key is available (via `config.custom.helicone_api_key` or
 * the `HELICONE_API_KEY` environment variable), the collector queries
 * `POST /v1/request/query` and maps the response into entities. When
 * no key is configured the collector logs a warning and returns an
 * empty result set.
 *
 * Produces entities:
 * - `cost_metric` — aggregate cost per model
 * - `model` — unique LLM models observed in request data
 * - `performance_metric` — latency / token throughput per model
 * - `user` — unique users observed in request data
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

const logger = createLogger({ context: { module: 'helicone-collector' } });

// ---------------------------------------------------------------------------
// API Response Types
// ---------------------------------------------------------------------------

/** A single request object returned by the Helicone /v1/request/query API. */
interface HeliconeRequest {
  request_id: string;
  model: string;
  user_id?: string;
  cost?: number;
  latency?: number;
  completion_tokens?: number;
  prompt_tokens?: number;
  created_at: string;
}

/** Shape of the /v1/request/query response body. */
interface HeliconeQueryResponse {
  data: HeliconeRequest[];
}

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Helicone project environment. */
type HeliconeEnvironment = 'production' | 'staging' | 'development';

// ---------------------------------------------------------------------------
// HeliconeCollector
// ---------------------------------------------------------------------------

/**
 * Collects LLM request and usage analytics data from the Helicone API
 * and maps them into knowledge-graph entities and relationships.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and environment.
 * 2. {@link validate} — verify the environment is supported.
 * 3. {@link collect} — fetch data from Helicone API, build entities
 *    & relationships.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new HeliconeCollector('production');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: { helicone_api_key: 'sk-helicone-...' },
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class HeliconeCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'helicone';
  /** @inheritdoc */
  readonly name = 'Helicone Collector';
  /** @inheritdoc */
  readonly description = 'Collects LLM cost tracking and usage analytics data including cost metrics, models, performance, alerts, and rate limits from Helicone';
  /** @inheritdoc */
  readonly type: CollectorType = 'observability';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** Helicone project environment. */
  private environment: HeliconeEnvironment;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Stored collector configuration. */
  private config!: CollectorConfig;
  /** Whether this collector has been initialized. */
  private initialized = false;

  /**
   * @param environment - Helicone project environment (default: `'production'`).
   */
  constructor(environment: HeliconeEnvironment = 'production') {
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
    logger.info('HeliconeCollector initialized', { environment: this.environment });
  }

  /**
   * Validate that the configured environment is supported.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const supported: HeliconeEnvironment[] = ['production', 'staging', 'development'];

    if (!this.environment) {
      errors.push('Helicone environment is required');
    } else if (!supported.includes(this.environment)) {
      errors.push(`'${this.environment}' is not a supported environment. Supported: ${supported.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform the full collection run.
   *
   * Resolves an API key from `config.custom.helicone_api_key` or the
   * `HELICONE_API_KEY` environment variable. When no key is found the
   * method returns an empty result set with a logged warning.
   *
   * @returns Entities, relationships, and run metadata.
   * @throws {CollectorError} If the collector has not been initialized.
   */
  async collect(): Promise<CollectorResult> {
    if (!this.initialized) {
      throw new CollectorError(
        'HeliconeCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // --- Resolve API key ---
    const apiKey =
      (this.config.custom['helicone_api_key'] as string | undefined) ||
      process.env['HELICONE_API_KEY'];

    if (!apiKey) {
      logger.warn('No Helicone API key configured, skipping collection');
      return {
        entities: [],
        relationships: [],
        metadata: {
          collector_id: this.id,
          collected_at: nowISO(),
          duration_ms: Date.now() - startTime,
          items_processed: 0,
          errors: [],
        },
      };
    }

    // --- Fetch request data from Helicone API ---
    let requests: HeliconeRequest[] = [];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const response = await fetch('https://api.helicone.ai/v1/request/query', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filter: {}, offset: 0, limit: 100 }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`Helicone API returned ${response.status}: ${response.statusText}`);
      }

      const body = (await response.json()) as HeliconeQueryResponse;
      requests = body.data ?? [];
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Helicone API request failed, returning empty results', { error: message });
      return {
        entities: [],
        relationships: [],
        metadata: {
          collector_id: this.id,
          collected_at: nowISO(),
          duration_ms: Date.now() - startTime,
          items_processed: 0,
          errors: [],
        },
      };
    }

    // --- Build entities from API data ---
    const entities = this.buildEntitiesFromRequests(requests);
    const relationships = this.buildRelationships(entities);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    logger.info('HeliconeCollector collection complete', {
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
        items_processed: requests.length,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('HeliconeCollector disposed', { environment: this.environment });
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
      tags: ['helicone', this.environment, ...tags],
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
  // Internal: Entity Building from API Data
  // -----------------------------------------------------------------------

  /**
   * Build knowledge-graph entities from Helicone API request data.
   *
   * Creates:
   * - `cost_metric` entities — aggregate cost per model
   * - `model` entities — unique models observed
   * - `performance_metric` entities — avg latency per model
   * - `user` entities — unique users observed
   *
   * @param requests - Raw request objects from the Helicone API.
   * @returns Array of entities.
   */
  private buildEntitiesFromRequests(requests: HeliconeRequest[]): Entity[] {
    const entities: Entity[] = [];

    // --- Aggregate cost by model ---
    const costByModel = new Map<string, { totalCost: number; requestCount: number }>();
    for (const req of requests) {
      const model = req.model ?? 'unknown';
      const existing = costByModel.get(model) ?? { totalCost: 0, requestCount: 0 };
      existing.totalCost += req.cost ?? 0;
      existing.requestCount += 1;
      costByModel.set(model, existing);
    }

    for (const [model, agg] of costByModel) {
      entities.push(
        this.makeEntity('cost_metric', `${model}-cost`, {
          model,
          total_cost: agg.totalCost,
          request_count: agg.requestCount,
          currency: 'USD',
          environment: this.environment,
        }, ['cost']),
      );
    }

    // --- Unique model entities ---
    const uniqueModels = new Set(requests.map((r) => r.model).filter(Boolean));
    for (const model of uniqueModels) {
      entities.push(
        this.makeEntity('model', model, {
          platform: 'helicone',
          environment: this.environment,
        }, ['llm']),
      );
    }

    // --- Performance metric entities (avg latency per model) ---
    const latencyByModel = new Map<string, { total: number; count: number }>();
    for (const req of requests) {
      if (req.latency != null) {
        const model = req.model ?? 'unknown';
        const existing = latencyByModel.get(model) ?? { total: 0, count: 0 };
        existing.total += req.latency;
        existing.count += 1;
        latencyByModel.set(model, existing);
      }
    }

    for (const [model, agg] of latencyByModel) {
      entities.push(
        this.makeEntity('performance_metric', `${model}-avg-latency`, {
          metric_type: 'latency',
          value: agg.count > 0 ? agg.total / agg.count : 0,
          unit: 'ms',
          model,
          environment: this.environment,
        }, ['observability', 'latency']),
      );
    }

    // --- Unique user entities ---
    const uniqueUsers = new Set(
      requests.map((r) => r.user_id).filter((u): u is string => u != null && u !== ''),
    );
    for (const userId of uniqueUsers) {
      entities.push(
        this.makeEntity('user', userId, {
          username: userId,
          platform: 'helicone',
        }, ['developer']),
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
   * - `uses_model` — cost_metric tracks cost for a specific model
   * - `monitors` — performance_metric monitors a model
   * - `owns` — user owns an alert or config
   * - `contains` — cost_metric contains alert data for same model
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const costMetrics = entities.filter((e) => e.type === 'cost_metric');
    const models = entities.filter((e) => e.type === 'model');
    const perfMetrics = entities.filter((e) => e.type === 'performance_metric');
    const alerts = entities.filter((e) => e.type === 'alert');
    const configs = entities.filter((e) => e.type === 'config');

    // Cost Metric → Model (uses_model) — each cost metric tracks a model
    for (const cost of costMetrics) {
      const modelName = cost.properties['model'] as string;
      const modelEntity = models.find((m) => m.name === modelName);
      if (modelEntity) {
        relationships.push(this.makeRel('uses_model', cost.id, modelEntity.id, {
          cost_metric_name: cost.name,
          model_name: modelName,
        }));
      }
    }

    // Performance Metric → Model (monitors) — metrics monitor model performance
    for (const metric of perfMetrics) {
      const modelName = metric.properties['model'] as string;
      const modelEntity = models.find((m) => m.name === modelName);
      if (modelEntity) {
        relationships.push(this.makeRel('monitors', metric.id, modelEntity.id, {
          metric_type: metric.properties['metric_type'],
        }));
      }
    }

    // User → Alert (owns) — distribute alerts across users
    for (let i = 0; i < alerts.length; i++) {
      const alert = alerts[i]!;
      const user = users[i % users.length]!;
      relationships.push(this.makeRel('owns', user.id, alert.id, {
        role: 'alert_owner',
      }));
    }

    // User → Config (owns) — distribute configs across users
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i]!;
      const user = users[i % users.length]!;
      relationships.push(this.makeRel('owns', user.id, config.id, {
        role: 'config_owner',
      }));
    }

    // Cost Metric → Alert (contains) — cost metrics contain related alerts
    for (const alert of alerts) {
      const alertModel = alert.properties['model'] as string;
      const relatedCost = costMetrics.find(
        (c) => c.properties['model'] === alertModel,
      );
      if (relatedCost) {
        relationships.push(this.makeRel('contains', relatedCost.id, alert.id, {
          alert_name: alert.name,
          model_name: alertModel,
        }));
      }
    }

    // Config → Model (monitors) — rate limit configs monitor a model
    for (const config of configs) {
      const modelName = config.properties['model'] as string;
      const modelEntity = models.find((m) => m.name === modelName);
      if (modelEntity) {
        relationships.push(this.makeRel('monitors', config.id, modelEntity.id, {
          config_type: config.properties['config_type'],
        }));
      }
    }

    return relationships;
  }
}

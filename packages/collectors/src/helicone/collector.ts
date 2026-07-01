/**
 * @module @recurrsive/collectors/helicone/collector
 *
 * Helicone Collector — ingests LLM cost tracking and usage analytics
 * data including cost breakdowns, model configurations, performance
 * metrics, developer profiles, cost alerts, and rate-limit configs
 * from a Helicone project and produces entities and relationships for
 * the knowledge graph.
 *
 * Since this collector is not yet connected to the real Helicone API,
 * it generates synthetic data that mirrors the shape of real Helicone
 * API responses for development and testing purposes.
 *
 * Produces entities:
 * - `cost_metric` — daily/weekly cost breakdowns per model
 * - `model` — LLM models with pricing tiers
 * - `performance_metric` — latency, token throughput, cache hit rate
 * - `user` — developers using LLM APIs
 * - `alert` — cost overrun alerts
 * - `config` — rate limit configurations
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
// Internal Types
// ---------------------------------------------------------------------------

/** Helicone project environment. */
type HeliconeEnvironment = 'production' | 'staging' | 'development';

/** Synthetic cost metric data. */
interface MockCostMetric {
  name: string;
  period: 'daily' | 'weekly';
  model: string;
  total_cost: number;
  request_count: number;
  currency: string;
}

/** Synthetic LLM model data. */
interface MockModel {
  name: string;
  provider: string;
  context_window: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
  pricing_tier: string;
}

/** Synthetic performance metric data. */
interface MockPerformanceMetric {
  name: string;
  metric_type: 'latency' | 'token_throughput' | 'cache_hit_rate' | 'error_rate';
  value: number;
  unit: string;
  model: string;
  period: string;
}

/** Synthetic developer user data. */
interface MockUser {
  username: string;
  role: string;
  api_key_count: number;
}

/** Synthetic cost alert data. */
interface MockAlert {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  threshold_usd: number;
  current_spend_usd: number;
  model: string;
  triggered: boolean;
}

/** Synthetic rate-limit config data. */
interface MockConfig {
  name: string;
  config_type: string;
  rate_limit_rpm: number;
  rate_limit_tpm: number;
  model: string;
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_USERS: MockUser[] = [
  { username: 'dev-alice', role: 'backend_engineer', api_key_count: 3 },
  { username: 'dev-bob', role: 'ml_engineer', api_key_count: 5 },
  { username: 'ops-carol', role: 'devops', api_key_count: 2 },
];

const MOCK_MODELS: MockModel[] = [
  { name: 'gpt-4o', provider: 'openai', context_window: 128000, cost_per_1k_input: 0.005, cost_per_1k_output: 0.015, pricing_tier: 'premium' },
  { name: 'gpt-4o-mini', provider: 'openai', context_window: 128000, cost_per_1k_input: 0.00015, cost_per_1k_output: 0.0006, pricing_tier: 'standard' },
  { name: 'claude-3.5-sonnet', provider: 'anthropic', context_window: 200000, cost_per_1k_input: 0.003, cost_per_1k_output: 0.015, pricing_tier: 'premium' },
  { name: 'claude-3-haiku', provider: 'anthropic', context_window: 200000, cost_per_1k_input: 0.00025, cost_per_1k_output: 0.00125, pricing_tier: 'economy' },
];

const MOCK_COST_METRICS: MockCostMetric[] = [
  { name: 'gpt-4o-daily-cost', period: 'daily', model: 'gpt-4o', total_cost: 42.15, request_count: 2800, currency: 'USD' },
  { name: 'gpt-4o-weekly-cost', period: 'weekly', model: 'gpt-4o', total_cost: 287.90, request_count: 19600, currency: 'USD' },
  { name: 'gpt-4o-mini-daily-cost', period: 'daily', model: 'gpt-4o-mini', total_cost: 3.45, request_count: 12000, currency: 'USD' },
  { name: 'gpt-4o-mini-weekly-cost', period: 'weekly', model: 'gpt-4o-mini', total_cost: 23.80, request_count: 84000, currency: 'USD' },
  { name: 'claude-3.5-sonnet-daily-cost', period: 'daily', model: 'claude-3.5-sonnet', total_cost: 18.70, request_count: 1200, currency: 'USD' },
  { name: 'claude-3.5-sonnet-weekly-cost', period: 'weekly', model: 'claude-3.5-sonnet', total_cost: 128.50, request_count: 8400, currency: 'USD' },
  { name: 'claude-3-haiku-daily-cost', period: 'daily', model: 'claude-3-haiku', total_cost: 1.20, request_count: 5000, currency: 'USD' },
];

const MOCK_PERFORMANCE_METRICS: MockPerformanceMetric[] = [
  { name: 'gpt-4o-p50-latency', metric_type: 'latency', value: 1850, unit: 'ms', model: 'gpt-4o', period: '2026-06' },
  { name: 'gpt-4o-mini-p50-latency', metric_type: 'latency', value: 620, unit: 'ms', model: 'gpt-4o-mini', period: '2026-06' },
  { name: 'claude-3.5-sonnet-p50-latency', metric_type: 'latency', value: 1540, unit: 'ms', model: 'claude-3.5-sonnet', period: '2026-06' },
  { name: 'gpt-4o-throughput', metric_type: 'token_throughput', value: 85.4, unit: 'tokens/sec', model: 'gpt-4o', period: '2026-06' },
  { name: 'gpt-4o-mini-throughput', metric_type: 'token_throughput', value: 142.7, unit: 'tokens/sec', model: 'gpt-4o-mini', period: '2026-06' },
  { name: 'gpt-4o-cache-hit', metric_type: 'cache_hit_rate', value: 0.34, unit: 'ratio', model: 'gpt-4o', period: '2026-06' },
  { name: 'gpt-4o-mini-cache-hit', metric_type: 'cache_hit_rate', value: 0.52, unit: 'ratio', model: 'gpt-4o-mini', period: '2026-06' },
  { name: 'overall-error-rate', metric_type: 'error_rate', value: 0.018, unit: 'ratio', model: 'gpt-4o', period: '2026-06' },
];

const MOCK_ALERTS: MockAlert[] = [
  { name: 'gpt-4o-cost-overrun', severity: 'critical', threshold_usd: 250, current_spend_usd: 287.90, model: 'gpt-4o', triggered: true },
  { name: 'claude-3.5-sonnet-cost-warning', severity: 'warning', threshold_usd: 150, current_spend_usd: 128.50, model: 'claude-3.5-sonnet', triggered: false },
  { name: 'daily-budget-alert', severity: 'info', threshold_usd: 75, current_spend_usd: 65.50, model: 'gpt-4o', triggered: false },
];

const MOCK_CONFIGS: MockConfig[] = [
  { name: 'gpt-4o-rate-limit', config_type: 'rate_limit', rate_limit_rpm: 500, rate_limit_tpm: 150000, model: 'gpt-4o' },
  { name: 'gpt-4o-mini-rate-limit', config_type: 'rate_limit', rate_limit_rpm: 1000, rate_limit_tpm: 2000000, model: 'gpt-4o-mini' },
  { name: 'claude-3.5-sonnet-rate-limit', config_type: 'rate_limit', rate_limit_rpm: 300, rate_limit_tpm: 100000, model: 'claude-3.5-sonnet' },
];

// ---------------------------------------------------------------------------
// HeliconeCollector
// ---------------------------------------------------------------------------

/**
 * Collects LLM cost tracking and usage analytics data including cost
 * breakdowns, model configurations, performance metrics, developer
 * profiles, cost alerts, and rate-limit configurations from a
 * Helicone project.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and environment.
 * 2. {@link validate} — verify the environment is supported.
 * 3. {@link collect} — generate entities & relationships from
 *    synthetic Helicone data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new HeliconeCollector('production');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {},
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

    // Build entities and relationships from synthetic data
    const entities = this.buildEntities();
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
        items_processed: MOCK_COST_METRICS.length + MOCK_MODELS.length + MOCK_PERFORMANCE_METRICS.length + MOCK_USERS.length + MOCK_ALERTS.length + MOCK_CONFIGS.length,
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
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from synthetic Helicone data.
   *
   * Creates:
   * - `user` entities for developers using LLM APIs
   * - `cost_metric` entities for daily/weekly cost breakdowns per model
   * - `model` entities for LLM models with pricing tiers
   * - `performance_metric` entities for latency, throughput, cache hit rate
   * - `alert` entities for cost overrun alerts
   * - `config` entities for rate limit configurations
   *
   * @returns Array of entities.
   */
  private buildEntities(): Entity[] {
    const entities: Entity[] = [];

    // --- User entities (developers using LLM APIs) ---
    for (const user of MOCK_USERS) {
      entities.push(
        this.makeEntity('user', user.username, {
          username: user.username,
          role: user.role,
          api_key_count: user.api_key_count,
          platform: 'helicone',
        }, ['developer', user.role]),
      );
    }

    // --- Cost metric entities (daily/weekly cost breakdowns) ---
    for (const cost of MOCK_COST_METRICS) {
      entities.push(
        this.makeEntity('cost_metric', cost.name, {
          period: cost.period,
          model: cost.model,
          total_cost: cost.total_cost,
          request_count: cost.request_count,
          currency: cost.currency,
          environment: this.environment,
        }, ['cost', cost.period]),
      );
    }

    // --- Model entities (LLM models with pricing tiers) ---
    for (const model of MOCK_MODELS) {
      entities.push(
        this.makeEntity('model', model.name, {
          provider: model.provider,
          context_window: model.context_window,
          cost_per_1k_input: model.cost_per_1k_input,
          cost_per_1k_output: model.cost_per_1k_output,
          pricing_tier: model.pricing_tier,
          platform: 'helicone',
        }, ['llm', model.provider, model.pricing_tier]),
      );
    }

    // --- Performance metric entities (latency, throughput, cache hit rate) ---
    for (const metric of MOCK_PERFORMANCE_METRICS) {
      entities.push(
        this.makeEntity('performance_metric', metric.name, {
          metric_type: metric.metric_type,
          value: metric.value,
          unit: metric.unit,
          model: metric.model,
          period: metric.period,
          environment: this.environment,
        }, ['observability', metric.metric_type]),
      );
    }

    // --- Alert entities (cost overrun alerts) ---
    for (const alert of MOCK_ALERTS) {
      entities.push(
        this.makeEntity('alert', alert.name, {
          severity: alert.severity,
          threshold_usd: alert.threshold_usd,
          current_spend_usd: alert.current_spend_usd,
          model: alert.model,
          triggered: alert.triggered,
          environment: this.environment,
        }, ['cost-alert', alert.severity, alert.triggered ? 'triggered' : 'idle']),
      );
    }

    // --- Config entities (rate limit configurations) ---
    for (const config of MOCK_CONFIGS) {
      entities.push(
        this.makeEntity('config', config.name, {
          config_type: config.config_type,
          rate_limit_rpm: config.rate_limit_rpm,
          rate_limit_tpm: config.rate_limit_tpm,
          model: config.model,
          environment: this.environment,
        }, ['rate-limit', config.config_type]),
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
          period: cost.properties['period'],
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

    // User → Alert (owns) — devops users own cost alerts
    // Distribute alerts across users in round-robin fashion
    for (let i = 0; i < alerts.length; i++) {
      const alert = alerts[i]!;
      const user = users[i % users.length]!;
      relationships.push(this.makeRel('owns', user.id, alert.id, {
        role: 'alert_owner',
      }));
    }

    // User → Config (owns) — devops users own rate limit configs
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i]!;
      const user = users[i % users.length]!;
      relationships.push(this.makeRel('owns', user.id, config.id, {
        role: 'config_owner',
      }));
    }

    // Cost Metric → Alert (contains) — weekly cost metrics contain related alerts
    for (const alert of alerts) {
      const alertModel = alert.properties['model'] as string;
      // Find a weekly cost metric for the same model
      const weeklyCost = costMetrics.find(
        (c) => c.properties['model'] === alertModel && c.properties['period'] === 'weekly',
      );
      if (weeklyCost) {
        relationships.push(this.makeRel('contains', weeklyCost.id, alert.id, {
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

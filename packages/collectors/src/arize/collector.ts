/**
 * @module @recurrsive/collectors/arize/collector
 *
 * Arize Collector — ingests ML observability data including model
 * configurations, training/evaluation datasets, performance metrics,
 * model degradation alerts, ML pipelines, and ML engineers from an
 * Arize project and produces entities and relationships for the
 * knowledge graph.
 *
 * Since this collector is not yet connected to the real Arize API,
 * it generates synthetic data that mirrors the shape of real Arize
 * API responses for development and testing purposes.
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

/** Synthetic ML model data. */
interface MockModel {
  name: string;
  version: string;
  framework: string;
  model_type: string;
  accuracy: number;
  latency_ms: number;
}

/** Synthetic dataset data. */
interface MockDataset {
  name: string;
  dataset_type: 'training' | 'evaluation' | 'reference' | 'production';
  row_count: number;
  feature_count: number;
  model: string;
}

/** Synthetic performance metric data. */
interface MockPerformanceMetric {
  name: string;
  metric_type: 'accuracy' | 'f1_score' | 'precision' | 'recall' | 'auc' | 'drift_score';
  value: number;
  unit: string;
  model: string;
  period: string;
}

/** Synthetic alert data. */
interface MockAlert {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  alert_type: string;
  model: string;
  threshold: number;
  current_value: number;
}

/** Synthetic ML pipeline data. */
interface MockPipeline {
  name: string;
  description: string;
  pipeline_type: 'training' | 'inference' | 'retraining';
  step_count: number;
  avg_duration_ms: number;
  daily_runs: number;
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_USERS = ['ml-engineer-alice', 'data-scientist-bob', 'mlops-engineer-carol', 'ml-engineer-dave'];

const MOCK_MODELS: MockModel[] = [
  { name: 'fraud-detection-v3', version: '3.2.1', framework: 'xgboost', model_type: 'classification', accuracy: 0.965, latency_ms: 12 },
  { name: 'churn-predictor', version: '2.0.0', framework: 'pytorch', model_type: 'classification', accuracy: 0.891, latency_ms: 45 },
  { name: 'recommendation-engine', version: '1.5.0', framework: 'tensorflow', model_type: 'ranking', accuracy: 0.823, latency_ms: 89 },
  { name: 'demand-forecaster', version: '4.1.0', framework: 'prophet', model_type: 'regression', accuracy: 0.912, latency_ms: 234 },
  { name: 'sentiment-analyzer', version: '2.3.0', framework: 'huggingface', model_type: 'nlp', accuracy: 0.934, latency_ms: 67 },
];

const MOCK_DATASETS: MockDataset[] = [
  { name: 'fraud-training-2026', dataset_type: 'training', row_count: 500000, feature_count: 45, model: 'fraud-detection-v3' },
  { name: 'fraud-eval-q2', dataset_type: 'evaluation', row_count: 50000, feature_count: 45, model: 'fraud-detection-v3' },
  { name: 'churn-training', dataset_type: 'training', row_count: 120000, feature_count: 32, model: 'churn-predictor' },
  { name: 'churn-reference', dataset_type: 'reference', row_count: 30000, feature_count: 32, model: 'churn-predictor' },
  { name: 'recommendation-production', dataset_type: 'production', row_count: 2000000, feature_count: 68, model: 'recommendation-engine' },
  { name: 'demand-training', dataset_type: 'training', row_count: 365000, feature_count: 24, model: 'demand-forecaster' },
];

const MOCK_PERFORMANCE_METRICS: MockPerformanceMetric[] = [
  { name: 'fraud-accuracy', metric_type: 'accuracy', value: 0.965, unit: 'ratio', model: 'fraud-detection-v3', period: '2026-06' },
  { name: 'fraud-f1', metric_type: 'f1_score', value: 0.943, unit: 'ratio', model: 'fraud-detection-v3', period: '2026-06' },
  { name: 'fraud-precision', metric_type: 'precision', value: 0.957, unit: 'ratio', model: 'fraud-detection-v3', period: '2026-06' },
  { name: 'fraud-recall', metric_type: 'recall', value: 0.929, unit: 'ratio', model: 'fraud-detection-v3', period: '2026-06' },
  { name: 'churn-auc', metric_type: 'auc', value: 0.912, unit: 'ratio', model: 'churn-predictor', period: '2026-06' },
  { name: 'churn-accuracy', metric_type: 'accuracy', value: 0.891, unit: 'ratio', model: 'churn-predictor', period: '2026-06' },
  { name: 'recommendation-drift', metric_type: 'drift_score', value: 0.087, unit: 'psi', model: 'recommendation-engine', period: '2026-06' },
  { name: 'demand-accuracy', metric_type: 'accuracy', value: 0.912, unit: 'ratio', model: 'demand-forecaster', period: '2026-06' },
  { name: 'sentiment-f1', metric_type: 'f1_score', value: 0.928, unit: 'ratio', model: 'sentiment-analyzer', period: '2026-06' },
  { name: 'sentiment-drift', metric_type: 'drift_score', value: 0.042, unit: 'psi', model: 'sentiment-analyzer', period: '2026-06' },
];

const MOCK_ALERTS: MockAlert[] = [
  { name: 'recommendation-drift-alert', severity: 'warning', alert_type: 'data_drift', model: 'recommendation-engine', threshold: 0.1, current_value: 0.087 },
  { name: 'fraud-performance-degradation', severity: 'critical', alert_type: 'performance_degradation', model: 'fraud-detection-v3', threshold: 0.95, current_value: 0.943 },
  { name: 'churn-missing-features', severity: 'warning', alert_type: 'data_quality', model: 'churn-predictor', threshold: 0.01, current_value: 0.034 },
  { name: 'demand-latency-spike', severity: 'info', alert_type: 'latency', model: 'demand-forecaster', threshold: 200, current_value: 234 },
];

const MOCK_PIPELINES: MockPipeline[] = [
  { name: 'fraud-training-pipeline', description: 'End-to-end fraud model training pipeline', pipeline_type: 'training', step_count: 6, avg_duration_ms: 1800000, daily_runs: 1 },
  { name: 'fraud-inference-pipeline', description: 'Real-time fraud scoring inference pipeline', pipeline_type: 'inference', step_count: 3, avg_duration_ms: 15, daily_runs: 50000 },
  { name: 'churn-retraining-pipeline', description: 'Weekly churn model retraining pipeline', pipeline_type: 'retraining', step_count: 5, avg_duration_ms: 3600000, daily_runs: 0 },
  { name: 'recommendation-inference', description: 'Recommendation engine serving pipeline', pipeline_type: 'inference', step_count: 4, avg_duration_ms: 95, daily_runs: 120000 },
  { name: 'sentiment-training-pipeline', description: 'Sentiment model fine-tuning pipeline', pipeline_type: 'training', step_count: 4, avg_duration_ms: 7200000, daily_runs: 0 },
];

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
 * 3. {@link collect} — generate entities & relationships from
 *    synthetic Arize data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new ArizeCollector('production');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {},
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

    // Build entities and relationships from synthetic data
    const entities = this.buildEntities();
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
        items_processed: MOCK_MODELS.length + MOCK_DATASETS.length + MOCK_PERFORMANCE_METRICS.length + MOCK_ALERTS.length + MOCK_PIPELINES.length,
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
   * Build knowledge graph entities from synthetic Arize data.
   *
   * Creates:
   * - `user` entities for ML engineers and data scientists
   * - `model` entities for ML models with version, framework, performance
   * - `dataset` entities for training and evaluation datasets
   * - `performance_metric` entities for accuracy, F1, precision, recall, AUC, drift
   * - `alert` entities for model degradation alerts
   * - `pipeline` entities for ML training and inference pipelines
   *
   * @returns Array of entities.
   */
  private buildEntities(): Entity[] {
    const entities: Entity[] = [];

    // --- User entities (ML engineers / data scientists) ---
    for (const username of MOCK_USERS) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          role: 'ml_engineer',
          platform: 'arize',
        }, ['ml-engineer']),
      );
    }

    // --- Model entities (ML models) ---
    for (const model of MOCK_MODELS) {
      entities.push(
        this.makeEntity('model', model.name, {
          version: model.version,
          framework: model.framework,
          model_type: model.model_type,
          accuracy: model.accuracy,
          latency_ms: model.latency_ms,
          platform: 'arize',
          environment: this.environment,
        }, ['ml-model', model.framework, model.model_type]),
      );
    }

    // --- Dataset entities (training/evaluation datasets) ---
    for (const dataset of MOCK_DATASETS) {
      entities.push(
        this.makeEntity('dataset', dataset.name, {
          dataset_type: dataset.dataset_type,
          row_count: dataset.row_count,
          feature_count: dataset.feature_count,
          model: dataset.model,
          platform: 'arize',
          environment: this.environment,
        }, ['ml-dataset', dataset.dataset_type]),
      );
    }

    // --- Performance metric entities ---
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

    // --- Alert entities (model degradation alerts) ---
    for (const alert of MOCK_ALERTS) {
      entities.push(
        this.makeEntity('alert', alert.name, {
          severity: alert.severity,
          alert_type: alert.alert_type,
          model: alert.model,
          threshold: alert.threshold,
          current_value: alert.current_value,
          platform: 'arize',
          environment: this.environment,
        }, ['ml-alert', alert.severity, alert.alert_type]),
      );
    }

    // --- Pipeline entities (ML training/inference pipelines) ---
    for (const pipeline of MOCK_PIPELINES) {
      entities.push(
        this.makeEntity('pipeline', pipeline.name, {
          description: pipeline.description,
          pipeline_type: pipeline.pipeline_type,
          step_count: pipeline.step_count,
          avg_duration_ms: pipeline.avg_duration_ms,
          daily_runs: pipeline.daily_runs,
          environment: this.environment,
        }, ['ml-pipeline', pipeline.pipeline_type]),
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
   * - `uses_model` — pipeline uses a specific model
   * - `monitors` — performance_metric monitors a model
   * - `contains` — pipeline contains datasets
   * - `owns` — user owns a model
   * - `evaluates_with` — dataset evaluates a model
   * - `alerts_on` — alert alerts on a model
   * - `depends_on` — model depends on training dataset
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const models = entities.filter((e) => e.type === 'model');
    const datasets = entities.filter((e) => e.type === 'dataset');
    const metrics = entities.filter((e) => e.type === 'performance_metric');
    const alerts = entities.filter((e) => e.type === 'alert');
    const pipelines = entities.filter((e) => e.type === 'pipeline');

    // Pipeline → Model (uses_model) — pipelines use specific models
    const pipelineModelMap: Record<string, string> = {
      'fraud-training-pipeline': 'fraud-detection-v3',
      'fraud-inference-pipeline': 'fraud-detection-v3',
      'churn-retraining-pipeline': 'churn-predictor',
      'recommendation-inference': 'recommendation-engine',
      'sentiment-training-pipeline': 'sentiment-analyzer',
    };

    for (const pipeline of pipelines) {
      const modelName = pipelineModelMap[pipeline.name];
      if (modelName) {
        const modelEntity = models.find((m) => m.name === modelName);
        if (modelEntity) {
          relationships.push(this.makeRel('uses_model', pipeline.id, modelEntity.id, {
            pipeline_name: pipeline.name,
            model_name: modelName,
          }));
        }
      }
    }

    // Performance Metric → Model (monitors) — metrics monitor model performance
    for (const metric of metrics) {
      const modelName = metric.properties['model'] as string;
      const modelEntity = models.find((m) => m.name === modelName);
      if (modelEntity) {
        relationships.push(this.makeRel('monitors', metric.id, modelEntity.id, {
          metric_type: metric.properties['metric_type'],
        }));
      }
    }

    // Pipeline → Dataset (contains) — pipelines contain datasets
    const pipelineDatasetMap: Record<string, string[]> = {
      'fraud-training-pipeline': ['fraud-training-2026', 'fraud-eval-q2'],
      'fraud-inference-pipeline': [],
      'churn-retraining-pipeline': ['churn-training', 'churn-reference'],
      'recommendation-inference': ['recommendation-production'],
      'sentiment-training-pipeline': [],
    };

    for (const pipeline of pipelines) {
      const datasetNames = pipelineDatasetMap[pipeline.name] ?? [];
      for (const datasetName of datasetNames) {
        const datasetEntity = datasets.find((d) => d.name === datasetName);
        if (datasetEntity) {
          relationships.push(this.makeRel('contains', pipeline.id, datasetEntity.id, {
            pipeline_name: pipeline.name,
          }));
        }
      }
    }

    // User → Model (owns) — ML engineers own models
    const userModelMap: Record<string, string[]> = {
      'ml-engineer-alice': ['fraud-detection-v3', 'churn-predictor'],
      'data-scientist-bob': ['recommendation-engine', 'demand-forecaster'],
      'mlops-engineer-carol': ['sentiment-analyzer'],
      'ml-engineer-dave': [],
    };

    for (const user of users) {
      const modelNames = userModelMap[user.name] ?? [];
      for (const modelName of modelNames) {
        const modelEntity = models.find((m) => m.name === modelName);
        if (modelEntity) {
          relationships.push(this.makeRel('owns', user.id, modelEntity.id, {
            role: 'model_owner',
          }));
        }
      }
    }

    // Dataset → Model (evaluates_with) — evaluation/reference datasets evaluate models
    for (const dataset of datasets) {
      const dsType = dataset.properties['dataset_type'] as string;
      if (dsType === 'evaluation' || dsType === 'reference') {
        const modelName = dataset.properties['model'] as string;
        const modelEntity = models.find((m) => m.name === modelName);
        if (modelEntity) {
          relationships.push(this.makeRel('evaluates_with', dataset.id, modelEntity.id, {
            dataset_type: dsType,
            row_count: dataset.properties['row_count'],
          }));
        }
      }
    }

    // Alert → Model (alerts_on) — alerts fire on model degradation
    for (const alert of alerts) {
      const modelName = alert.properties['model'] as string;
      const modelEntity = models.find((m) => m.name === modelName);
      if (modelEntity) {
        relationships.push(this.makeRel('alerts_on', alert.id, modelEntity.id, {
          severity: alert.properties['severity'],
          alert_type: alert.properties['alert_type'],
        }));
      }
    }

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

/**
 * @module @recurrsive/collectors/langfuse/collector
 *
 * Langfuse Collector — ingests LLM observability data including prompt
 * templates, model configurations, performance metrics, LLM pipelines,
 * evaluation datasets, and AI engineers from a Langfuse project and
 * produces entities and relationships for the knowledge graph.
 *
 * Since this collector is not yet connected to the real Langfuse API,
 * it generates synthetic data that mirrors the shape of real Langfuse
 * API responses for development and testing purposes.
 *
 * Produces entities:
 * - `prompt` — prompt templates and versions
 * - `model` — LLM models used in traces
 * - `performance_metric` — latency, token usage, and cost metrics
 * - `pipeline` — LLM chains and workflows
 * - `user` — AI engineers and prompt authors
 * - `evaluation` — evaluation datasets and scoring runs
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

const logger = createLogger({ context: { module: 'langfuse-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Langfuse project environment. */
type LangfuseEnvironment = 'production' | 'staging' | 'development';

/** Synthetic prompt template data. */
interface MockPrompt {
  name: string;
  version: number;
  template: string;
  model: string;
  author: string;
  is_active: boolean;
}

/** Synthetic LLM model data. */
interface MockModel {
  name: string;
  provider: string;
  context_window: number;
  cost_per_1k_input: number;
  cost_per_1k_output: number;
}

/** Synthetic performance metric data. */
interface MockPerformanceMetric {
  name: string;
  metric_type: 'latency' | 'token_usage' | 'cost' | 'error_rate';
  value: number;
  unit: string;
  model: string;
  period: string;
}

/** Synthetic LLM pipeline data. */
interface MockPipeline {
  name: string;
  description: string;
  step_count: number;
  avg_latency_ms: number;
  daily_invocations: number;
}

/** Synthetic evaluation data. */
interface MockEvaluation {
  name: string;
  dataset_size: number;
  avg_score: number;
  scoring_method: string;
  model: string;
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_USERS = ['ml-engineer-alice', 'prompt-author-bob', 'ai-ops-carol'];

const MOCK_PROMPTS: MockPrompt[] = [
  { name: 'summarization-v2', version: 2, template: 'Summarize the following text:\n\n{{text}}', model: 'gpt-4o', author: 'prompt-author-bob', is_active: true },
  { name: 'code-review', version: 3, template: 'Review the following code for bugs and improvements:\n\n{{code}}', model: 'gpt-4o', author: 'prompt-author-bob', is_active: true },
  { name: 'classification', version: 1, template: 'Classify the following into categories:\n\n{{input}}', model: 'claude-3-sonnet', author: 'ml-engineer-alice', is_active: true },
  { name: 'extraction', version: 4, template: 'Extract structured data from:\n\n{{document}}', model: 'gpt-4o-mini', author: 'ml-engineer-alice', is_active: true },
  { name: 'chat-system-prompt', version: 1, template: 'You are a helpful assistant. Respond concisely.', model: 'gpt-4o', author: 'prompt-author-bob', is_active: false },
];

const MOCK_MODELS: MockModel[] = [
  { name: 'gpt-4o', provider: 'openai', context_window: 128000, cost_per_1k_input: 0.005, cost_per_1k_output: 0.015 },
  { name: 'gpt-4o-mini', provider: 'openai', context_window: 128000, cost_per_1k_input: 0.00015, cost_per_1k_output: 0.0006 },
  { name: 'claude-3-sonnet', provider: 'anthropic', context_window: 200000, cost_per_1k_input: 0.003, cost_per_1k_output: 0.015 },
  { name: 'claude-3-haiku', provider: 'anthropic', context_window: 200000, cost_per_1k_input: 0.00025, cost_per_1k_output: 0.00125 },
];

const MOCK_PERFORMANCE_METRICS: MockPerformanceMetric[] = [
  { name: 'gpt-4o-latency', metric_type: 'latency', value: 2340, unit: 'ms', model: 'gpt-4o', period: '2026-06' },
  { name: 'gpt-4o-mini-latency', metric_type: 'latency', value: 890, unit: 'ms', model: 'gpt-4o-mini', period: '2026-06' },
  { name: 'claude-3-sonnet-latency', metric_type: 'latency', value: 1870, unit: 'ms', model: 'claude-3-sonnet', period: '2026-06' },
  { name: 'gpt-4o-tokens', metric_type: 'token_usage', value: 1245000, unit: 'tokens', model: 'gpt-4o', period: '2026-06' },
  { name: 'gpt-4o-mini-tokens', metric_type: 'token_usage', value: 3890000, unit: 'tokens', model: 'gpt-4o-mini', period: '2026-06' },
  { name: 'claude-3-sonnet-tokens', metric_type: 'token_usage', value: 567000, unit: 'tokens', model: 'claude-3-sonnet', period: '2026-06' },
  { name: 'total-llm-cost', metric_type: 'cost', value: 487.32, unit: 'USD', model: 'gpt-4o', period: '2026-06' },
  { name: 'overall-error-rate', metric_type: 'error_rate', value: 0.023, unit: 'ratio', model: 'gpt-4o', period: '2026-06' },
];

const MOCK_PIPELINES: MockPipeline[] = [
  { name: 'rag-pipeline', description: 'Retrieval-augmented generation pipeline', step_count: 4, avg_latency_ms: 3200, daily_invocations: 1500 },
  { name: 'code-assistant-chain', description: 'Multi-step code review and suggestion chain', step_count: 3, avg_latency_ms: 4500, daily_invocations: 800 },
  { name: 'document-processor', description: 'Document extraction and classification workflow', step_count: 5, avg_latency_ms: 6100, daily_invocations: 350 },
  { name: 'chat-agent', description: 'Conversational agent with tool use', step_count: 2, avg_latency_ms: 2100, daily_invocations: 4200 },
];

const MOCK_EVALUATIONS: MockEvaluation[] = [
  { name: 'summarization-eval', dataset_size: 500, avg_score: 0.87, scoring_method: 'llm-as-judge', model: 'gpt-4o' },
  { name: 'code-review-eval', dataset_size: 200, avg_score: 0.92, scoring_method: 'human-annotation', model: 'gpt-4o' },
  { name: 'classification-eval', dataset_size: 1000, avg_score: 0.94, scoring_method: 'exact-match', model: 'claude-3-sonnet' },
];

// ---------------------------------------------------------------------------
// LangfuseCollector
// ---------------------------------------------------------------------------

/**
 * Collects LLM observability data including prompt templates, model
 * configurations, performance metrics, LLM pipelines, evaluation
 * datasets, and AI engineer profiles from a Langfuse project.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and environment.
 * 2. {@link validate} — verify the environment is supported.
 * 3. {@link collect} — generate entities & relationships from
 *    synthetic Langfuse data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new LangfuseCollector('production');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {},
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class LangfuseCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'langfuse';
  /** @inheritdoc */
  readonly name = 'Langfuse Collector';
  /** @inheritdoc */
  readonly description = 'Collects LLM observability data including prompts, models, traces, and evaluations from Langfuse';
  /** @inheritdoc */
  readonly type: CollectorType = 'observability';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** Langfuse project environment. */
  private environment: LangfuseEnvironment;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;

  /**
   * @param environment - Langfuse project environment (default: `'production'`).
   */
  constructor(environment: LangfuseEnvironment = 'production') {
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
    logger.info('LangfuseCollector initialized', { environment: this.environment });
  }

  /**
   * Validate that the configured environment is supported.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const supported: LangfuseEnvironment[] = ['production', 'staging', 'development'];

    if (!this.environment) {
      errors.push('Langfuse environment is required');
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
        'LangfuseCollector has not been initialized. Call initialize() first.',
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

    logger.info('LangfuseCollector collection complete', {
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
        items_processed: MOCK_PROMPTS.length + MOCK_MODELS.length + MOCK_PERFORMANCE_METRICS.length + MOCK_PIPELINES.length + MOCK_EVALUATIONS.length,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('LangfuseCollector disposed', { environment: this.environment });
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
      tags: ['langfuse', this.environment, ...tags],
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
   * Build knowledge graph entities from synthetic Langfuse data.
   *
   * Creates:
   * - `user` entities for AI engineers and prompt authors
   * - `prompt` entities for prompt templates and versions
   * - `model` entities for LLM models used in traces
   * - `performance_metric` entities for latency, token usage, cost
   * - `pipeline` entities for LLM chains and workflows
   * - `evaluation` entities for evaluation datasets and scoring
   *
   * @returns Array of entities.
   */
  private buildEntities(): Entity[] {
    const entities: Entity[] = [];

    // --- User entities (AI engineers / prompt authors) ---
    for (const username of MOCK_USERS) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          role: 'ai_engineer',
          platform: 'langfuse',
        }, ['ai-engineer']),
      );
    }

    // --- Prompt entities (prompt templates) ---
    for (const prompt of MOCK_PROMPTS) {
      entities.push(
        this.makeEntity('prompt', prompt.name, {
          version: prompt.version,
          template: prompt.template,
          model: prompt.model,
          author: prompt.author,
          is_active: prompt.is_active,
          environment: this.environment,
        }, ['prompt-template', prompt.is_active ? 'active' : 'inactive']),
      );
    }

    // --- Model entities (LLM models) ---
    for (const model of MOCK_MODELS) {
      entities.push(
        this.makeEntity('model', model.name, {
          provider: model.provider,
          context_window: model.context_window,
          cost_per_1k_input: model.cost_per_1k_input,
          cost_per_1k_output: model.cost_per_1k_output,
          platform: 'langfuse',
        }, ['llm', model.provider]),
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

    // --- Pipeline entities (LLM chains/workflows) ---
    for (const pipeline of MOCK_PIPELINES) {
      entities.push(
        this.makeEntity('pipeline', pipeline.name, {
          description: pipeline.description,
          step_count: pipeline.step_count,
          avg_latency_ms: pipeline.avg_latency_ms,
          daily_invocations: pipeline.daily_invocations,
          environment: this.environment,
        }, ['llm-pipeline', 'chain']),
      );
    }

    // --- Evaluation entities (eval datasets / scoring runs) ---
    for (const evalData of MOCK_EVALUATIONS) {
      entities.push(
        this.makeEntity('evaluation', evalData.name, {
          dataset_size: evalData.dataset_size,
          avg_score: evalData.avg_score,
          scoring_method: evalData.scoring_method,
          model: evalData.model,
          environment: this.environment,
        }, ['eval-dataset', evalData.scoring_method]),
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
   * - `uses_model` — prompt uses a specific model
   * - `contains` — pipeline contains prompts
   * - `monitors` — performance_metric monitors a model
   * - `owns` — user owns a prompt
   * - `calls` — pipeline calls a model
   * - `evaluates_with` — evaluation evaluates a model
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const prompts = entities.filter((e) => e.type === 'prompt');
    const models = entities.filter((e) => e.type === 'model');
    const metrics = entities.filter((e) => e.type === 'performance_metric');
    const pipelines = entities.filter((e) => e.type === 'pipeline');
    const evaluations = entities.filter((e) => e.type === 'evaluation');

    // Prompt → Model (uses_model) — each prompt uses a specific model
    for (const prompt of prompts) {
      const modelName = prompt.properties['model'] as string;
      const modelEntity = models.find((m) => m.name === modelName);
      if (modelEntity) {
        relationships.push(this.makeRel('uses_model', prompt.id, modelEntity.id, {
          prompt_name: prompt.name,
          model_name: modelName,
        }));
      }
    }

    // Pipeline → Prompt (contains) — pipelines contain prompts
    // Map pipelines to prompts by convention
    const pipelinePromptMap: Record<string, string[]> = {
      'rag-pipeline': ['summarization-v2', 'extraction'],
      'code-assistant-chain': ['code-review'],
      'document-processor': ['extraction', 'classification'],
      'chat-agent': ['chat-system-prompt'],
    };

    for (const pipeline of pipelines) {
      const promptNames = pipelinePromptMap[pipeline.name] ?? [];
      for (const promptName of promptNames) {
        const promptEntity = prompts.find((p) => p.name === promptName);
        if (promptEntity) {
          relationships.push(this.makeRel('contains', pipeline.id, promptEntity.id, {
            pipeline_name: pipeline.name,
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

    // User → Prompt (owns) — prompt authors own their prompts
    for (const prompt of prompts) {
      const authorName = prompt.properties['author'] as string;
      const authorEntity = users.find((u) => u.name === authorName);
      if (authorEntity) {
        relationships.push(this.makeRel('owns', authorEntity.id, prompt.id, {
          role: 'prompt_author',
        }));
      }
    }

    // Pipeline → Model (calls) — pipelines call models
    // Derive from the prompts each pipeline contains
    for (const pipeline of pipelines) {
      const promptNames = pipelinePromptMap[pipeline.name] ?? [];
      const modelNames = new Set<string>();
      for (const promptName of promptNames) {
        const promptEntity = prompts.find((p) => p.name === promptName);
        if (promptEntity) {
          modelNames.add(promptEntity.properties['model'] as string);
        }
      }
      for (const modelName of modelNames) {
        const modelEntity = models.find((m) => m.name === modelName);
        if (modelEntity) {
          relationships.push(this.makeRel('calls', pipeline.id, modelEntity.id, {
            pipeline_name: pipeline.name,
            model_name: modelName,
          }));
        }
      }
    }

    // Evaluation → Model (evaluates_with) — evaluations score model output
    for (const evalEntity of evaluations) {
      const modelName = evalEntity.properties['model'] as string;
      const modelEntity = models.find((m) => m.name === modelName);
      if (modelEntity) {
        relationships.push(this.makeRel('evaluates_with', evalEntity.id, modelEntity.id, {
          scoring_method: evalEntity.properties['scoring_method'],
          avg_score: evalEntity.properties['avg_score'],
        }));
      }
    }

    return relationships;
  }
}

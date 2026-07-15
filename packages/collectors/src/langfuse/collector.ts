/**
 * @module @recurrsive/collectors/langfuse/collector
 *
 * Langfuse Collector — ingests LLM observability data from the Langfuse
 * public API including prompt templates, model configurations, performance
 * metrics, LLM pipelines, and user profiles.
 *
 * Connects to the real Langfuse API using Basic auth with a public/secret
 * key pair. When no credentials are configured (via config.custom or
 * environment variables), the collector logs a warning and returns empty
 * results — this allows tests and development to run without a live
 * Langfuse instance.
 *
 * API endpoints used:
 * - GET /api/public/traces?limit=50
 * - GET /api/public/prompts
 *
 * Produces entities:
 * - `prompt` — prompt templates and versions
 * - `model` — LLM models observed in traces
 * - `performance_metric` — aggregate latency and token usage metrics
 * - `pipeline` — unique trace names (LLM workflows)
 * - `user` — unique user IDs from traces
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

/** Shape of a single trace returned by GET /api/public/traces. */
interface LangfuseTrace {
  id: string;
  name?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  totalCost?: number;
  latency?: number;
  input?: unknown;
  output?: unknown;
  observations?: LangfuseObservation[];
}

/** Shape of an observation nested inside a trace. */
interface LangfuseObservation {
  id: string;
  model?: string;
  usage?: {
    input?: number;
    output?: number;
    total?: number;
  };
  latency?: number;
}

/** Shape of the traces list API response. */
interface LangfuseTracesResponse {
  data: LangfuseTrace[];
  meta?: { totalItems?: number; page?: number };
}

/** Shape of a single prompt returned by GET /api/public/prompts. */
interface LangfusePrompt {
  name: string;
  version?: number;
  prompt?: string | Record<string, unknown>;
  config?: Record<string, unknown>;
  labels?: string[];
  tags?: string[];
}

/** Shape of the prompts list API response. */
interface LangfusePromptsResponse {
  data: LangfusePrompt[];
  meta?: { totalItems?: number; page?: number };
}

// ---------------------------------------------------------------------------
// LangfuseCollector
// ---------------------------------------------------------------------------

/**
 * Collects LLM observability data including prompt templates, model
 * configurations, performance metrics, LLM pipelines, and user profiles
 * from a Langfuse project via the public API.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and environment.
 * 2. {@link validate} — verify the environment is supported.
 * 3. {@link collect} — fetch data from the Langfuse API, build entities
 *    and relationships for the knowledge graph.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new LangfuseCollector('production');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {
 *     langfuse_public_key: 'pk-lf-...',
 *     langfuse_secret_key: 'sk-lf-...',
 *     langfuse_url: 'https://cloud.langfuse.com',
 *   },
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
  /** Stored configuration from initialize(). */
  private config!: CollectorConfig;

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
    this.config = config;
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
   * Attempts to fetch data from the Langfuse public API. When no
   * credentials are configured, returns empty results with a warning.
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

    // Resolve credentials from config or environment
    const publicKey =
      (this.config.custom['langfuse_public_key'] as string | undefined) ||
      process.env['LANGFUSE_PUBLIC_KEY'];
    const secretKey =
      (this.config.custom['langfuse_secret_key'] as string | undefined) ||
      process.env['LANGFUSE_SECRET_KEY'];

    // If no credentials, return empty results
    if (!publicKey || !secretKey) {
      logger.warn('No Langfuse credentials configured, skipping collection');

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

    // Resolve base URL
    const baseUrl =
      (this.config.custom['langfuse_url'] as string | undefined) ||
      process.env['LANGFUSE_URL'] ||
      'https://cloud.langfuse.com';

    // Build auth header
    const authHeader = `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`;

    let traces: LangfuseTrace[] = [];
    let prompts: LangfusePrompt[] = [];

    // Fetch traces and prompts from the API
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      try {
        const [tracesRes, promptsRes] = await Promise.all([
          fetch(`${baseUrl}/api/public/traces?limit=50`, {
            headers: { Authorization: authHeader },
            signal: controller.signal,
          }),
          fetch(`${baseUrl}/api/public/prompts`, {
            headers: { Authorization: authHeader },
            signal: controller.signal,
          }),
        ]);

        if (tracesRes.ok) {
          const tracesBody = (await tracesRes.json()) as LangfuseTracesResponse;
          traces = tracesBody.data ?? [];
        } else {
          const msg = `Traces API returned ${tracesRes.status}: ${tracesRes.statusText}`;
          logger.warn(msg);
          errors.push({ message: msg });
        }

        if (promptsRes.ok) {
          const promptsBody = (await promptsRes.json()) as LangfusePromptsResponse;
          prompts = promptsBody.data ?? [];
        } else {
          const msg = `Prompts API returned ${promptsRes.status}: ${promptsRes.statusText}`;
          logger.warn(msg);
          errors.push({ message: msg });
        }
      } finally {
        clearTimeout(timeout);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('Failed to fetch from Langfuse API', { error: message });
      errors.push({ message: `Langfuse API fetch failed: ${message}` });

      // Return empty results on fetch failure
      const durationMs = Date.now() - startTime;
      return {
        entities: [],
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

    // Build entities from API data
    const entities = this.buildEntities(traces, prompts);
    const relationships = this.buildRelationships(entities, traces);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;
    const itemsProcessed = traces.length + prompts.length;

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
        items_processed: itemsProcessed,
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
   * Build knowledge graph entities from Langfuse API data.
   *
   * Creates:
   * - `model` entities for unique models observed in traces
   * - `performance_metric` entities for aggregate latency/token metrics
   * - `pipeline` entities for unique trace names (workflows)
   * - `user` entities for unique user IDs from traces
   * - `prompt` entities from the prompts API
   *
   * @param traces - Traces fetched from the Langfuse API.
   * @param prompts - Prompts fetched from the Langfuse API.
   * @returns Array of entities.
   */
  private buildEntities(traces: LangfuseTrace[], prompts: LangfusePrompt[]): Entity[] {
    const entities: Entity[] = [];

    // --- Collect unique models from trace observations ---
    const modelNames = new Set<string>();
    const modelLatencies = new Map<string, number[]>();
    const modelTokens = new Map<string, number>();

    for (const trace of traces) {
      if (trace.observations) {
        for (const obs of trace.observations) {
          if (obs.model) {
            modelNames.add(obs.model);

            // Aggregate latency
            if (obs.latency != null) {
              const existing = modelLatencies.get(obs.model) ?? [];
              existing.push(obs.latency);
              modelLatencies.set(obs.model, existing);
            }

            // Aggregate token usage
            if (obs.usage?.total != null) {
              const existing = modelTokens.get(obs.model) ?? 0;
              modelTokens.set(obs.model, existing + obs.usage.total);
            }
          }
        }
      }
    }

    // --- Model entities ---
    for (const modelName of modelNames) {
      entities.push(
        this.makeEntity('model', modelName, {
          platform: 'langfuse',
          environment: this.environment,
        }, ['llm']),
      );
    }

    // --- Performance metric entities (aggregate per model) ---
    for (const [modelName, latencies] of modelLatencies) {
      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      entities.push(
        this.makeEntity('performance_metric', `${modelName}-avg-latency`, {
          metric_type: 'latency',
          value: Math.round(avgLatency * 100) / 100,
          unit: 'ms',
          model: modelName,
          environment: this.environment,
        }, ['observability', 'latency']),
      );
    }

    for (const [modelName, totalTokens] of modelTokens) {
      entities.push(
        this.makeEntity('performance_metric', `${modelName}-token-usage`, {
          metric_type: 'token_usage',
          value: totalTokens,
          unit: 'tokens',
          model: modelName,
          environment: this.environment,
        }, ['observability', 'token_usage']),
      );
    }

    // --- Pipeline entities (unique trace names) ---
    const traceNames = new Set<string>();
    for (const trace of traces) {
      if (trace.name) {
        traceNames.add(trace.name);
      }
    }

    for (const traceName of traceNames) {
      entities.push(
        this.makeEntity('pipeline', traceName, {
          environment: this.environment,
        }, ['llm-pipeline', 'trace']),
      );
    }

    // --- User entities (unique userIds from traces) ---
    const userIds = new Set<string>();
    for (const trace of traces) {
      if (trace.userId) {
        userIds.add(trace.userId);
      }
    }

    for (const userId of userIds) {
      entities.push(
        this.makeEntity('user', userId, {
          user_id: userId,
          platform: 'langfuse',
        }, ['trace-user']),
      );
    }

    // --- Prompt entities ---
    for (const prompt of prompts) {
      entities.push(
        this.makeEntity('prompt', prompt.name, {
          version: prompt.version,
          prompt: typeof prompt.prompt === 'string' ? prompt.prompt : JSON.stringify(prompt.prompt),
          config: prompt.config ?? {},
          labels: prompt.labels ?? [],
          environment: this.environment,
        }, ['prompt-template']),
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
   * Only relationships that are backed by actually-collected Langfuse data
   * are emitted (evidence-only):
   * - `uses_model` — prompt uses a specific model
   * - `monitors` — performance_metric monitors a model
   * - `owns` — user owns a prompt
   * - `calls` — pipeline calls a model, derived from the models observed in
   *   the trace's observations
   * - `evaluates_with` — evaluation evaluates a model
   *
   * @param entities - All entities built from this collection.
   * @param traces - Traces fetched from the Langfuse API, used to derive the
   *   real pipeline → model linkage from observation data.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[], traces: LangfuseTrace[]): Relationship[] {
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

    // Pipeline → Model (calls) — pipelines call models.
    // Derived from real collected data: each trace (pipeline) links to the
    // models observed in its observations.
    const pipelineModelNames = new Map<string, Set<string>>();
    for (const trace of traces) {
      if (!trace.name || !trace.observations) continue;
      const modelSet = pipelineModelNames.get(trace.name) ?? new Set<string>();
      for (const obs of trace.observations) {
        if (obs.model) modelSet.add(obs.model);
      }
      pipelineModelNames.set(trace.name, modelSet);
    }

    for (const pipeline of pipelines) {
      const modelNames = pipelineModelNames.get(pipeline.name) ?? new Set<string>();
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

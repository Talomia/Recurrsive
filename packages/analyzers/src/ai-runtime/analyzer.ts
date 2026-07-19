/**
 * @module @recurrsive/analyzers/ai-runtime
 *
 * AI runtime analyzer that inspects the knowledge graph for runtime
 * characteristics of AI/LLM integrations: excessive token usage,
 * missing rate limiting, missing guardrails, single model dependency,
 * missing streaming, context window overflow, missing cost tracking,
 * and stale embeddings.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

/** Approximate characters per token for estimation. */
const CHARS_PER_TOKEN = 4;

/** Threshold above which token usage is considered excessive. */
const EXCESSIVE_TOKEN_THRESHOLD = 10_000;

/** Common model context window limits (tokens). */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  'gpt-3.5-turbo': 4_096,
  'gpt-3.5-turbo-16k': 16_384,
  'gpt-4': 8_192,
  'gpt-4-32k': 32_768,
  'gpt-4-turbo': 128_000,
  'gpt-4o': 128_000,
  'claude-2': 100_000,
  'claude-3-haiku': 200_000,
  'claude-3-sonnet': 200_000,
  'claude-3-opus': 200_000,
};

/** Default context window limit when model is unknown. */
const DEFAULT_CONTEXT_LIMIT = 8_192;

/** Patterns that indicate rate limiting logic. */
const RATE_LIMIT_INDICATORS = [
  'rate-limit', 'rateLimit', 'rate_limit',
  'throttle', 'backoff', 'retry',
  'p-throttle', 'p-retry', 'bottleneck',
  'limiter', 'semaphore',
];

/** Patterns that indicate guardrail/validation logic. */
const GUARDRAIL_INDICATORS = [
  'zod', 'z.object', 'z.string', 'z.parse', '.safeParse',
  'json_schema', 'jsonSchema', 'JSON.parse',
  'schema', 'validate', 'validator',
  'guardrail', 'content_filter', 'contentFilter',
  'structured-output', 'tool_choice',
];

/** Patterns that indicate streaming usage. */
const STREAMING_INDICATORS = [
  'stream', 'streaming', 'createStream',
  'streamText', 'streamChat', 'stream: true',
  'SSE', 'ServerSentEvent', 'ReadableStream',
  'AsyncIterab', 'for await',
];

/** Patterns that indicate cost/usage tracking. */
const COST_TRACKING_INDICATORS = [
  'cost', 'usage', 'billing',
  'token_count', 'tokenCount', 'tokens_used',
  'prompt_tokens', 'completion_tokens',
  'metering', 'meter', 'track',
  'telemetry', 'observability',
  'langfuse', 'helicone', 'lunary',
];

/**
 * Analyzes AI/LLM runtime characteristics for operational and
 * resilience issues.
 *
 * ### Rules
 * 1. Excessive token usage — prompt templates exceeding 10k tokens
 * 2. Missing rate limiting — LLM calls without throttle/retry logic
 * 3. Missing guardrails — AI output used without validation
 * 4. Single model dependency — all LLM calls use the same model
 * 5. Missing streaming — large response handling without streaming
 * 6. Context window overflow — prompts that could exceed model limits
 * 7. Missing cost tracking — LLM calls without usage/cost logging
 * 8. Stale embeddings — embeddings without refresh/staleness checks
 */
export class AIRuntimeAnalyzer implements Analyzer {
  readonly id = 'ai.runtime';
  readonly name = 'AI Runtime Analyzer';
  readonly description =
    'Analyzes AI/LLM runtime characteristics including prompt quality, token usage, model selection, and guardrails.';
  readonly version = '0.1.0';
  readonly categories = ['ai_quality' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      excessiveTokens,
      missingRateLimiting,
      missingGuardrails,
      singleModel,
      missingStreaming,
      contextOverflow,
      missingCostTracking,
      staleEmbeddings,
    ] = await Promise.all([
      this.checkExcessiveTokenUsage(ctx),
      this.checkMissingRateLimiting(ctx),
      this.checkMissingGuardrails(ctx),
      this.checkSingleModelDependency(ctx),
      this.checkMissingStreaming(ctx),
      this.checkContextWindowOverflow(ctx),
      this.checkMissingCostTracking(ctx),
      this.checkStaleEmbeddings(ctx),
    ]);

    findings.push(
      ...excessiveTokens,
      ...missingRateLimiting,
      ...missingGuardrails,
      ...singleModel,
      ...missingStreaming,
      ...contextOverflow,
      ...missingCostTracking,
      ...staleEmbeddings,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(_ctx: AnalysisContext): Promise<Finding[]> {
    return [];
  }

  // ── Rule 1: Excessive Token Usage ──────────────────────────────────

  /**
   * Detect functions or modules with estimated token usage exceeding
   * the threshold by inspecting prompt template sizes in content.
   *
   * @param ctx - Analysis context.
   * @returns Findings for excessive token usage.
   */
  private async checkExcessiveTokenUsage(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const [functions, modules, prompts] = await Promise.all([
      ctx.graph.getEntities('function'),
      ctx.graph.getEntities('module'),
      ctx.graph.getEntities('prompt'),
    ]);

    const entities = [...functions, ...modules, ...prompts];

    for (const entity of entities) {
      const content =
        (entity.properties['content'] as string | undefined) ??
        (entity.properties['template'] as string | undefined) ??
        (entity.properties['body'] as string | undefined) ??
        '';

      const estimatedTokens = Math.ceil(content.length / CHARS_PER_TOKEN);

      if (estimatedTokens > EXCESSIVE_TOKEN_THRESHOLD) {
        const loc = locationFromEntity(entity);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Excessive token usage: ${entity.name}`,
            description: `${entity.type} '${entity.name}' has an estimated ${estimatedTokens} tokens in its content, exceeding the ${EXCESSIVE_TOKEN_THRESHOLD} token threshold. Large prompts increase latency, cost, and risk of context window overflow.`,
            severity: 'high',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `Estimated ${estimatedTokens} tokens (threshold: ${EXCESSIVE_TOKEN_THRESHOLD})`,
                entity_ids: [entity.id],
                confidence: 0.8,
                data: {
                  estimated_tokens: estimatedTokens,
                  char_count: content.length,
                  threshold: EXCESSIVE_TOKEN_THRESHOLD,
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Reduce token usage by extracting static content, using dynamic context injection, summarizing long passages, or splitting into multiple smaller prompts.',
            confidence: 0.8,
            tags: ['excessive-token-usage', 'ai', 'cost', 'runtime'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 2: Missing Rate Limiting ──────────────────────────────────

  /**
   * Detect LLM API calls without rate limiting, throttling, or retry
   * logic.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing rate limiting.
   */
  private async checkMissingRateLimiting(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      // Only real model/agent invocations count — a plain `calls` edge is any
      // same-file function call (the TS parser emits one per call), so
      // including it made this rule fire on virtually every function and
      // falsely assert "makes LLM API calls" about code that makes none.
      const callsModel = outRels.some(
        (r) => r.type === 'uses_model' || r.type === 'invokes_agent',
      );

      if (!callsModel) continue;

      const content =
        (fn.properties['content'] as string | undefined) ??
        (fn.properties['body'] as string | undefined) ??
        '';

      const hasRateLimiting =
        fn.properties['has_rate_limit'] === true ||
        fn.tags.includes('rate-limited') ||
        fn.tags.includes('throttled') ||
        fn.tags.includes('retry') ||
        RATE_LIMIT_INDICATORS.some((indicator) => content.includes(indicator));

      if (!hasRateLimiting) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing rate limiting: ${fn.name}`,
            description: `Function '${fn.name}' makes LLM API calls without rate limiting or retry logic. Without throttling, concurrent requests can trigger provider rate limits, causing cascading failures.`,
            severity: 'high',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'LLM API call without rate limiting or retry logic',
                entity_ids: [fn.id],
                confidence: 0.8,
                data: { has_rate_limiting: false },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add rate limiting with exponential backoff (e.g., p-retry, bottleneck). Implement request queuing and respect provider rate limit headers.',
            confidence: 0.8,
            tags: ['missing-rate-limiting', 'ai', 'resilience', 'runtime'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: Missing Guardrails ─────────────────────────────────────

  /**
   * Detect AI outputs used directly without validation or guardrails
   * (no Zod/JSON schema parse after LLM call).
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing guardrails.
   */
  private async checkMissingGuardrails(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const usesModel = outRels.some((r) => r.type === 'uses_model');
      if (!usesModel) continue;

      const content =
        (fn.properties['content'] as string | undefined) ??
        (fn.properties['body'] as string | undefined) ??
        '';

      const hasGuardrails =
        fn.properties['validates_output'] === true ||
        fn.properties['has_guardrails'] === true ||
        fn.tags.includes('output-validated') ||
        fn.tags.includes('schema-validated') ||
        fn.tags.includes('guardrailed') ||
        fn.tags.includes('zod') ||
        fn.tags.includes('structured-output') ||
        GUARDRAIL_INDICATORS.some((indicator) => content.includes(indicator));

      if (!hasGuardrails) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing guardrails: ${fn.name}`,
            description: `Function '${fn.name}' consumes LLM output without guardrails or validation. AI outputs are non-deterministic and may contain hallucinations, injection attacks, or malformed data that can cause downstream failures.`,
            severity: 'critical',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'LLM output consumed without validation or guardrails',
                entity_ids: [fn.id],
                confidence: 0.85,
                data: { has_guardrails: false },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Validate LLM outputs with Zod schemas or JSON Schema. Use structured output modes (e.g., function calling, tool_choice). Add content filtering and toxicity checks for user-facing outputs.',
            confidence: 0.85,
            tags: ['missing-guardrails', 'ai', 'safety', 'runtime'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 4: Single Model Dependency ────────────────────────────────

  /**
   * Detect when all LLM calls use the same model, lacking diversity
   * for resilience and cost optimization.
   *
   * @param ctx - Analysis context.
   * @returns Findings for single model dependency.
   */
  private async checkSingleModelDependency(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const models = await ctx.graph.getEntities('model');

    if (models.length < 2) return findings;

    // Collect unique model names (normalized)
    const modelNames = new Set<string>();
    for (const model of models) {
      const modelName =
        (model.properties['model_name'] as string | undefined) ??
        model.name;
      modelNames.add(modelName.toLowerCase().trim());
    }

    if (modelNames.size === 1) {
      const modelName = [...modelNames][0]!;
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: `Single model dependency: ${modelName}`,
          description: `All ${models.length} LLM model references use the same model (${modelName}). Using a single model creates a single point of failure and prevents cost optimization by routing simpler tasks to cheaper models.`,
          severity: 'medium',
          category: 'ai_quality',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `All ${models.length} model references use: ${modelName}`,
              entity_ids: models.map((m) => m.id),
              confidence: 0.8,
              data: {
                model_name: modelName,
                model_count: models.length,
                unique_models: 1,
              },
            }),
          ],
          locations: [],
          suggested_fix:
            'Use different models for different tasks: cheaper models (e.g., GPT-3.5) for simple tasks, more capable models for complex reasoning. Add fallback models for resilience.',
          confidence: 0.75,
          tags: ['single-model-dependency', 'ai', 'resilience', 'cost'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 5: Missing Streaming ──────────────────────────────────────

  /**
   * Detect large response handling without streaming, which causes
   * poor user experience and memory issues.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing streaming.
   */
  private async checkMissingStreaming(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const usesModel = outRels.some((r) => r.type === 'uses_model');
      if (!usesModel) continue;

      // Only flag functions that appear to generate large/user-facing responses
      const isLargeResponse =
        fn.properties['generates_long_response'] === true ||
        fn.properties['user_facing'] === true ||
        fn.tags.includes('user-facing') ||
        fn.tags.includes('chat') ||
        fn.tags.includes('completion') ||
        fn.tags.includes('generation');

      if (!isLargeResponse) continue;

      const content =
        (fn.properties['content'] as string | undefined) ??
        (fn.properties['body'] as string | undefined) ??
        '';

      const hasStreaming =
        fn.properties['uses_streaming'] === true ||
        fn.tags.includes('streaming') ||
        fn.tags.includes('stream') ||
        STREAMING_INDICATORS.some((indicator) => content.includes(indicator));

      if (!hasStreaming) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing streaming: ${fn.name}`,
            description: `Function '${fn.name}' handles LLM responses for user-facing or large content without streaming. Non-streaming responses block until the full response is generated, causing poor perceived performance and potential timeouts.`,
            severity: 'medium',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'User-facing LLM response without streaming',
                entity_ids: [fn.id],
                confidence: 0.75,
                data: { has_streaming: false, is_user_facing: true },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Use streaming APIs (e.g., stream: true in OpenAI, streamText in Vercel AI SDK) for user-facing responses. Stream tokens to the client via SSE or WebSockets for real-time feedback.',
            confidence: 0.7,
            tags: ['missing-streaming', 'ai', 'performance', 'ux'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 6: Context Window Overflow ────────────────────────────────

  /**
   * Detect prompts that could exceed model context window limits based
   * on estimated token counts and known model limits.
   *
   * @param ctx - Analysis context.
   * @returns Findings for context window overflow risk.
   */
  private async checkContextWindowOverflow(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const prompts = await ctx.graph.getEntities('prompt');

    for (const prompt of prompts) {
      const content =
        (prompt.properties['template'] as string | undefined) ??
        (prompt.properties['content'] as string | undefined) ??
        '';

      const estimatedTokens = Math.ceil(content.length / CHARS_PER_TOKEN);

      // Determine the context limit for the associated model
      const modelName =
        (prompt.properties['model'] as string | undefined) ??
        (prompt.properties['model_name'] as string | undefined) ??
        '';
      const contextLimit =
        (prompt.properties['context_window'] as number | undefined) ??
        MODEL_CONTEXT_LIMITS[modelName.toLowerCase()] ??
        DEFAULT_CONTEXT_LIMIT;

      // Flag if the static prompt alone uses more than 80% of the context window
      const usageRatio = estimatedTokens / contextLimit;

      if (usageRatio > 0.8) {
        const loc = locationFromEntity(prompt);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Context window overflow risk: ${prompt.name}`,
            description: `Prompt '${prompt.name}' uses ~${estimatedTokens} estimated tokens, which is ${Math.round(usageRatio * 100)}% of the ${contextLimit}-token context window${modelName ? ` for ${modelName}` : ''}. This leaves insufficient room for user input and model responses, risking truncation or errors.`,
            severity: 'high',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `Prompt uses ${Math.round(usageRatio * 100)}% of context window`,
                entity_ids: [prompt.id],
                confidence: 0.8,
                data: {
                  estimated_tokens: estimatedTokens,
                  context_limit: contextLimit,
                  usage_ratio: usageRatio,
                  model: modelName || 'unknown',
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Reduce prompt size by summarizing static context, using retrieval-augmented generation (RAG), or splitting into multiple calls. Consider upgrading to a model with a larger context window.',
            confidence: 0.8,
            tags: ['context-window-overflow', 'ai', 'runtime', 'limits'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 7: Missing Cost Tracking ──────────────────────────────────

  /**
   * Detect LLM calls without any form of cost, usage tracking, or
   * logging.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing cost tracking.
   */
  private async checkMissingCostTracking(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const usesModel = outRels.some(
        (r) => r.type === 'uses_model' || r.type === 'invokes_agent',
      );
      if (!usesModel) continue;

      const content =
        (fn.properties['content'] as string | undefined) ??
        (fn.properties['body'] as string | undefined) ??
        '';

      const hasCostTracking =
        fn.properties['tracks_cost'] === true ||
        fn.properties['tracks_usage'] === true ||
        fn.tags.includes('cost-tracked') ||
        fn.tags.includes('usage-tracked') ||
        fn.tags.includes('metered') ||
        fn.tags.includes('observed') ||
        COST_TRACKING_INDICATORS.some((indicator) => content.includes(indicator));

      if (!hasCostTracking) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing cost tracking: ${fn.name}`,
            description: `Function '${fn.name}' makes LLM calls without cost or usage tracking. Without metering, unexpected usage spikes or runaway costs go undetected until the invoice arrives.`,
            severity: 'medium',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'LLM call without cost or usage tracking',
                entity_ids: [fn.id],
                confidence: 0.75,
                data: { has_cost_tracking: false },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Log token usage (prompt_tokens, completion_tokens) for every LLM call. Use observability tools like Langfuse, Helicone, or custom telemetry. Set up cost alerts and budgets.',
            confidence: 0.7,
            tags: ['missing-cost-tracking', 'ai', 'cost', 'observability'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 8: Stale Embeddings ───────────────────────────────────────

  /**
   * Detect embedding generation without refresh or staleness checks,
   * which can cause retrieval quality degradation over time.
   *
   * @param ctx - Analysis context.
   * @returns Findings for stale embeddings.
   */
  private async checkStaleEmbeddings(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const [functions, modules, configs] = await Promise.all([
      ctx.graph.getEntities('function'),
      ctx.graph.getEntities('module'),
      ctx.graph.getEntities('config'),
    ]);

    const entities = [...functions, ...modules, ...configs];

    for (const entity of entities) {
      const content =
        (entity.properties['content'] as string | undefined) ??
        (entity.properties['body'] as string | undefined) ??
        '';

      const isEmbeddingRelated =
        entity.tags.includes('embedding') ||
        entity.tags.includes('embeddings') ||
        entity.tags.includes('vector') ||
        entity.properties['generates_embeddings'] === true ||
        /embedding/i.test(content) ||
        /text-embedding/i.test(entity.name);

      if (!isEmbeddingRelated) continue;

      const hasRefreshLogic =
        entity.properties['has_refresh'] === true ||
        entity.properties['has_staleness_check'] === true ||
        entity.tags.includes('refresh') ||
        entity.tags.includes('staleness-check') ||
        entity.tags.includes('ttl') ||
        /stale|refresh|ttl|expir|invalidat|re-?index/i.test(content);

      if (!hasRefreshLogic) {
        const loc = locationFromEntity(entity);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Stale embeddings risk: ${entity.name}`,
            description: `${entity.type} '${entity.name}' generates or manages embeddings without staleness checks or refresh logic. Embeddings become stale as source data changes, leading to degraded retrieval quality in RAG pipelines.`,
            severity: 'low',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Embedding generation without refresh/staleness logic',
                entity_ids: [entity.id],
                confidence: 0.7,
                data: { has_refresh_logic: false },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Implement embedding staleness detection using timestamps or content hashes. Set up periodic re-indexing jobs and invalidate embeddings when source documents change.',
            confidence: 0.65,
            tags: ['stale-embeddings', 'ai', 'data-quality', 'runtime'],
          }),
        );
      }
    }

    return findings;
  }
}

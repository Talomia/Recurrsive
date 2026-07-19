/**
 * @module @recurrsive/analyzers/ai-runtime
 *
 * AI runtime analyzer that inspects the knowledge graph for runtime
 * characteristics of AI/LLM integrations: excessive token usage,
 * missing rate limiting, single model dependency, missing streaming,
 * context window overflow, missing cost tracking (systemic), and
 * stale embeddings.
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

/**
 * Analyzes AI/LLM runtime characteristics for operational and
 * resilience issues.
 *
 * ### Rules
 * 1. Excessive token usage — prompt templates exceeding 10k tokens
 * 2. Missing rate limiting — systemic check that LLM usage has any
 *    detectable rate limiting/retry signal (single honest finding; whether
 *    a specific function throttles its calls is not observable, since
 *    function entities carry no body text)
 * 3. Single model dependency — all LLM calls use the same model
 * 5. Context window overflow — prompts that could exceed model limits
 * 6. Missing cost tracking — systemic check that any LLM usage has
 *    detectable cost/usage tracking (single honest finding, never
 *    per-function assertions from unobservable data)
 * 7. Stale embeddings — embeddings without refresh/staleness checks
 *
 * ### Removed rules (producer/consumer contract mismatch)
 * - Missing guardrails — the rule's escape valves were `content`/`body`
 *   checks that function entities never carry, so every function with a
 *   `uses_model` edge was flagged CRITICAL unconditionally, and the finding
 *   duplicated the ai.quality "Missing LLM output validation" rule (which
 *   now gates on the parser-computed `has_validation_call` body feature).
 * - Missing streaming (old rule 4) — it gated on `user_facing`/
 *   `generates_long_response` properties and `chat`/`generation` tags that
 *   NO producer emits, so the rule was permanently dead code; whether a
 *   response is user-facing is not observable to this pipeline.
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
      singleModel,
      contextOverflow,
      missingCostTracking,
      staleEmbeddings,
    ] = await Promise.all([
      this.checkExcessiveTokenUsage(ctx),
      this.checkMissingRateLimiting(ctx),
      this.checkSingleModelDependency(ctx),
      this.checkContextWindowOverflow(ctx),
      this.checkMissingCostTracking(ctx),
      this.checkStaleEmbeddings(ctx),
    ]);

    findings.push(
      ...excessiveTokens,
      ...missingRateLimiting,
      ...singleModel,
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
        // The Langfuse collector stores prompt text under `prompt`.
        (entity.properties['prompt'] as string | undefined) ??
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

  // ── Rule 2: Missing Rate Limiting (systemic) ───────────────────────

  /**
   * Systemic check: LLM usage exists but no rate limiting/retry signal is
   * detectable anywhere in the graph.
   *
   * Whether a specific function throttles its calls is NOT observable to this
   * pipeline: function entities carry no body text, no parser emits a
   * `has_rate_limit` property, and no producer applies `rate-limited`/
   * `throttled`/`retry` tags — so the old per-function rule fired HIGH on
   * 100% of LLM call sites regardless of the actual code. Instead this emits
   * AT MOST ONE low-severity finding, honestly worded as "not detectable",
   * and stays silent when any rate-limiting signal exists.
   *
   * @param ctx - Analysis context.
   * @returns At most one systemic finding for missing rate limiting.
   */
  private async checkMissingRateLimiting(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    // Collect the LLM call sites. Only real model/agent invocations count — a
    // plain `calls` edge is any same-file function call (the TS parser emits
    // one per call), so including it would count virtually every function.
    const llmFunctions: typeof functions = [];
    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const callsModel = outRels.some(
        (r) => r.type === 'uses_model' || r.type === 'invokes_agent',
      );
      if (callsModel) llmFunctions.push(fn);
    }
    if (llmFunctions.length === 0) return findings;

    // Any real rate-limiting signal anywhere suppresses the finding: explicit
    // markers or tags on functions, or rate-limit indicators in whatever
    // content a producer did attach.
    const hasRateLimitSignal = llmFunctions.some((fn) => {
      const content =
        (fn.properties['content'] as string | undefined) ??
        (fn.properties['body'] as string | undefined) ??
        '';
      return (
        fn.properties['has_rate_limit'] === true ||
        fn.tags.includes('rate-limited') ||
        fn.tags.includes('throttled') ||
        fn.tags.includes('retry') ||
        RATE_LIMIT_INDICATORS.some((indicator) => content.includes(indicator))
      );
    });

    if (!hasRateLimitSignal) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Rate limiting not detectable for LLM usage',
          description: `${llmFunctions.length} function(s) make LLM calls but no rate limiting, throttling, or retry logic is detectable in the project (no rate-limit markers, tags, or indicators). Throttling may exist in infrastructure this analysis cannot observe — verify concurrent requests are bounded, since unthrottled bursts can trip provider rate limits and cascade into failures.`,
          severity: 'low',
          category: 'ai_quality',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${llmFunctions.length} LLM call sites, 0 detectable rate-limiting signals`,
              entity_ids: llmFunctions.slice(0, 10).map((fn) => fn.id),
              confidence: 0.6,
              data: { llm_call_sites: llmFunctions.length, has_rate_limiting: false },
            }),
          ],
          locations: [],
          suggested_fix:
            'Add rate limiting with exponential backoff (e.g., p-retry, bottleneck). Implement request queuing and respect provider rate limit headers.',
          confidence: 0.6,
          tags: ['missing-rate-limiting', 'ai', 'resilience', 'runtime', 'systemic'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 3: Single Model Dependency ────────────────────────────────

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

  // ── Rule 4 (removed): Missing Streaming ────────────────────────────
  // The former "Missing streaming" rule gated on generates_long_response /
  // user_facing / streaming markers that NO producer (parser or collector)
  // emits, so it was permanently dead. Detecting streaming reliably needs
  // request-body inspection the pipeline does not perform, so the rule was
  // removed rather than left as dead code that implies coverage.

  // ── Rule 5: Context Window Overflow ────────────────────────────────

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
        // The Langfuse collector stores prompt text under `prompt`.
        (prompt.properties['prompt'] as string | undefined) ??
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

  // ── Rule 6: Missing Cost Tracking (systemic) ───────────────────────

  /**
   * Systemic check: LLM usage exists but no cost/usage tracking is
   * detectable anywhere in the graph.
   *
   * Whether a specific function meters its calls is NOT observable to this
   * pipeline (function entities carry no body text), so the old per-function
   * "Missing cost tracking" assertions fired on 100% of LLM call sites.
   * Instead this emits AT MOST ONE low-severity finding, honestly worded as
   * "not detectable", and stays silent when any tracking signal exists
   * (cost metrics, observability collectors like Langfuse, or explicit
   * tracking markers on functions).
   *
   * @param ctx - Analysis context.
   * @returns At most one systemic finding for missing cost tracking.
   */
  private async checkMissingCostTracking(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const [functions, costMetrics, prompts] = await Promise.all([
      ctx.graph.getEntities('function'),
      ctx.graph.getEntities('cost_metric'),
      ctx.graph.getEntities('prompt'),
    ]);

    // Collect the LLM call sites.
    const llmFunctions: typeof functions = [];
    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const usesModel = outRels.some(
        (r) => r.type === 'uses_model' || r.type === 'invokes_agent',
      );
      if (usesModel) llmFunctions.push(fn);
    }
    if (llmFunctions.length === 0) return findings;

    // Any real tracking signal anywhere suppresses the finding: produced
    // cost metrics, observability-platform entities (e.g. the Langfuse
    // collector tags prompts with 'prompt-template' and sets platform
    // properties), or explicit per-function markers.
    const hasTrackingSignal =
      costMetrics.length > 0 ||
      prompts.some((p) => p.properties['platform'] === 'langfuse' || (p.properties['environment'] != null && p.properties['prompt'] != null)) ||
      llmFunctions.some(
        (fn) =>
          fn.properties['tracks_cost'] === true ||
          fn.properties['tracks_usage'] === true ||
          fn.tags.includes('cost-tracked') ||
          fn.tags.includes('usage-tracked') ||
          fn.tags.includes('metered') ||
          fn.tags.includes('observed'),
      );

    if (!hasTrackingSignal) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Cost tracking not detectable for LLM usage',
          description: `${llmFunctions.length} function(s) make LLM calls but no cost or usage tracking is detectable in the project (no cost metrics, no observability platform data, no tracking markers). Tracking may exist in infrastructure this analysis cannot observe — verify token usage and spend are being metered, since unmetered usage spikes go undetected until the invoice arrives.`,
          severity: 'low',
          category: 'ai_quality',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${llmFunctions.length} LLM call sites, 0 detectable tracking signals`,
              entity_ids: llmFunctions.slice(0, 10).map((fn) => fn.id),
              confidence: 0.6,
              data: { llm_call_sites: llmFunctions.length, has_cost_tracking: false },
            }),
          ],
          locations: [],
          suggested_fix:
            'Log token usage (prompt_tokens, completion_tokens) for every LLM call. Use observability tools like Langfuse, Helicone, or custom telemetry. Set up cost alerts and budgets.',
          confidence: 0.6,
          tags: ['missing-cost-tracking', 'ai', 'cost', 'observability', 'systemic'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 7: Stale Embeddings ───────────────────────────────────────

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

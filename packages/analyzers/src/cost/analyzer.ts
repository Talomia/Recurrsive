/**
 * @module @recurrsive/analyzers/cost
 *
 * Cost analyzer that detects cost-related issues in AI integrations
 * such as missing token tracking, missing semantic caching, and
 * opportunities for batch processing.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
  Entity,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

/**
 * Analyzes the knowledge graph for cost optimization opportunities
 * in AI/LLM usage.
 *
 * ### Rules
 * 1. No token tracking / usage logging
 * 2. Missing semantic caching
 * 3. Missing batch processing
 * 4. No cost alerts
 */
export class CostAnalyzer implements Analyzer {
  readonly id = 'cost.optimization';
  readonly name = 'Cost Analyzer';
  readonly description =
    'Detects cost optimization opportunities such as missing token tracking, missing semantic caching, and batch processing.';
  readonly version = '0.1.0';
  readonly categories = ['cost' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      noTokenTracking,
      missingSemanticCache,
      missingBatch,
      noCostAlerts,
    ] = await Promise.all([
      this.detectNoTokenTracking(ctx),
      this.detectMissingSemanticCaching(ctx),
      this.detectMissingBatchProcessing(ctx),
      this.detectNoCostAlerts(ctx),
    ]);

    findings.push(
      ...noTokenTracking,
      ...missingSemanticCache,
      ...missingBatch,
      ...noCostAlerts,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // ── Cross-cutting: multiple models without cost tracking ─────
    const [models, costMetrics] = await Promise.all([
      ctx.graph.getEntities('model'),
      ctx.graph.getEntities('cost_metric'),
    ]);

    if (models.length > 2 && costMetrics.length === 0) {
      const modelNames = models.map((m) => m.name).join(', ');
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Multiple AI models without cost tracking',
          description: `Project uses ${models.length} AI models (${modelNames}) but has no cost_metric entities. Different model tiers can vary substantially in price, so without cost tracking, budget overruns from model selection mistakes or traffic spikes will go undetected.`,
          severity: 'high',
          category: 'cost',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${models.length} models configured, 0 cost metrics defined`,
              entity_ids: models.map((m) => m.id),
              confidence: 0.85,
              data: {
                model_count: models.length,
                model_names: models.map((m) => m.name),
                cost_metric_count: 0,
              },
            }),
          ],
          locations: [],
          suggested_fix:
            'Implement cost tracking per model: log token usage (input/output) per request, calculate cost using provider pricing, aggregate by model and function. Set up cost_metric entities with daily/weekly rollups and budget alerts.',
          confidence: 0.8,
          tags: ['cost-tracking', 'cost', 'cross-cutting', 'multi-model'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 1: No Token Tracking ──────────────────────────────────────

  /**
   * Detect missing token usage logging in AI-consuming functions.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing token tracking.
   */
  private async detectNoTokenTracking(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    const aiCallers: Entity[] = [];
    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      if (outRels.some((r) => r.type === 'uses_model')) {
        aiCallers.push(fn);
      }
    }

    if (aiCallers.length === 0) return findings;

    // Check for any token tracking infrastructure
    const costMetrics = await ctx.graph.getEntities('cost_metric');
    const hasGlobalTracking = costMetrics.some(
      (m) =>
        m.tags.includes('token-usage') ||
        m.name.toLowerCase().includes('token'),
    );

    if (!hasGlobalTracking && aiCallers.length > 0) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No token usage tracking',
          description: `Found ${aiCallers.length} functions making LLM calls but no token usage tracking infrastructure. Without tracking, you cannot monitor costs, detect anomalies, or optimize token usage.`,
          severity: 'high',
          category: 'cost',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `${aiCallers.length} LLM-calling functions, no token tracking`,
              entity_ids: aiCallers.map((f) => f.id),
              confidence: 0.85,
              data: { ai_caller_count: aiCallers.length },
            }),
          ],
          locations: [],
          suggested_fix:
            'Implement token usage logging using provider callbacks or middleware. Track input/output tokens per call, aggregate by function and model, and set up dashboards for cost visibility.',
          confidence: 0.8,
          tags: ['token-tracking', 'cost', 'observability'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 2: Missing Semantic Caching ───────────────────────────────

  /**
   * Detect repeated similar queries to LLM without semantic caching.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing semantic caching.
   */
  private async detectMissingSemanticCaching(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const prompts = await ctx.graph.getEntities('prompt');

    if (prompts.length < 2) return findings;

    // Check if any caching infrastructure exists
    const hasCachingInfra = prompts.some(
      (p) =>
        p.tags.includes('cached') ||
        p.tags.includes('semantic-cache') ||
        p.properties['cached'] === true,
    );

    if (hasCachingInfra) return findings;

    // Look for prompts that are likely called with similar inputs
    const repeatablePrompts = prompts.filter(
      (p) =>
        p.properties['is_template'] === true ||
        p.tags.includes('template') ||
        p.tags.includes('reusable'),
    );

    if (repeatablePrompts.length > 0) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Missing semantic caching for prompt templates',
          description: `Found ${repeatablePrompts.length} reusable prompt templates without semantic caching. Semantic caching can reduce cost by serving cached responses for semantically similar queries — the actual savings depend on how often similar queries recur in your workload.`,
          severity: 'medium',
          category: 'cost',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `${repeatablePrompts.length} reusable prompts without caching`,
              entity_ids: repeatablePrompts.map((p) => p.id),
              confidence: 0.7,
              data: { reusable_prompt_count: repeatablePrompts.length },
            }),
          ],
          locations: [],
          suggested_fix:
            'Implement semantic caching using embedding-based similarity matching (e.g., GPTCache). Cache responses for queries that are semantically similar to previously seen queries.',
          confidence: 0.65,
          tags: ['semantic-cache', 'cost', 'optimization'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 3: Missing Batch Processing ───────────────────────────────

  /**
   * Detect individual API calls that could be batched together.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing batch processing.
   */
  private async detectMissingBatchProcessing(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const hasLoop = fn.properties['has_loop'] === true || fn.tags.includes('loop');
      if (!hasLoop) continue;

      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      // Only real external-call edge types count. A bare `calls` edge is any
      // same-file function call (the parser emits one per call site), so
      // including it made `has_loop && calls` fire on nearly every function
      // that iterates — asserting batchable API/DB work that isn't there.
      const hasApiCall = outRels.some(
        (r) =>
          r.type === 'uses_model' ||
          r.type === 'queries_table' ||
          r.type === 'writes_to',
      );

      if (!hasApiCall) continue;

      const hasBatching =
        fn.properties['uses_batch'] === true ||
        fn.tags.includes('batch') ||
        fn.tags.includes('bulk');

      if (!hasBatching) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing batch processing: ${fn.name}`,
            description: `Function '${fn.name}' makes API or database calls inside a loop without batching. Batch processing can reduce per-call overhead and often qualifies for volume discounts.`,
            severity: 'medium',
            category: 'cost',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Loop with individual API/DB calls instead of batching',
                entity_ids: [fn.id],
                confidence: 0.7,
                data: { has_loop: hasLoop, has_batching: hasBatching },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Collect items and process in batches. Use bulk insert for databases, batch APIs for LLM providers, and Promise.all() for concurrent execution.',
            confidence: 0.7,
            tags: ['missing-batch', 'cost', 'optimization'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 5: No Cost Alerts ─────────────────────────────────────────

  /**
   * Detect missing cost monitoring and alerting configuration.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing cost alerts.
   */
  private async detectNoCostAlerts(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const alerts = await ctx.graph.getEntities('alert');
    const costMetrics = await ctx.graph.getEntities('cost_metric');
    const models = await ctx.graph.getEntities('model');

    // Only flag if there are AI models in use
    if (models.length === 0) return findings;

    const hasCostAlerts = alerts.some(
      (a) =>
        a.tags.includes('cost') ||
        a.name.toLowerCase().includes('cost') ||
        a.name.toLowerCase().includes('budget') ||
        a.name.toLowerCase().includes('spend'),
    );

    const hasCostMetrics = costMetrics.length > 0;

    if (!hasCostAlerts) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No cost alerting configured',
          description: `${models.length} AI models are in use but no cost-related alerts are configured. Without cost alerting, runaway usage (from bugs, agent loops, or traffic spikes) can cause unexpected bills.`,
          severity: 'high',
          category: 'cost',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `${models.length} models, no cost alerts`,
              entity_ids: models.map((m) => m.id),
              confidence: 0.85,
              data: {
                model_count: models.length,
                has_cost_alerts: hasCostAlerts,
                has_cost_metrics: hasCostMetrics,
              },
            }),
          ],
          locations: [],
          suggested_fix:
            'Set up cost alerting with daily/weekly budget thresholds. Configure alerts at 50%, 80%, and 100% of budget. Add per-request cost caps for agent loops.',
          confidence: 0.8,
          tags: ['cost-alerts', 'cost', 'monitoring'],
        }),
      );
    }

    return findings;
  }
}

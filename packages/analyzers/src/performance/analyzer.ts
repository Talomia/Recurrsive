/**
 * @module @recurrsive/analyzers/performance
 *
 * Performance analyzer that detects common performance anti-patterns
 * such as sequential LLM calls, N+1 queries, missing caching,
 * synchronous blocking, and unbounded loops.
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
 * Analyzes the knowledge graph for performance issues.
 *
 * ### Rules
 * 1. Sequential LLM calls that could be parallelized
 * 2. N+1 query patterns
 * 3. Missing caching for repeated operations
 * 4. Large context windows
 * 5. Synchronous blocking on async operations
 * 6. Unbounded loops on collections
 *
 * Missing pagination is intentionally NOT checked here — the api-contract
 * analyzer owns that rule (its detection is a superset), and both firing
 * double-reported every unpaginated list endpoint.
 */
export class PerformanceAnalyzer implements Analyzer {
  readonly id = 'performance.general';
  readonly name = 'Performance Analyzer';
  readonly description =
    'Detects performance anti-patterns such as N+1 queries, missing caching, and sequential LLM calls.';
  readonly version = '0.1.0';
  readonly categories = ['performance' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      sequentialLLM,
      nPlusOne,
      missingCache,
      largeContext,
      syncBlocking,
      unboundedLoops,
    ] = await Promise.all([
      this.detectSequentialLLMCalls(ctx),
      this.detectNPlusOneQueries(ctx),
      this.detectMissingCaching(ctx),
      this.detectLargeContextWindows(ctx),
      this.detectSynchronousBlocking(ctx),
      this.detectUnboundedLoops(ctx),
    ]);

    findings.push(
      ...sequentialLLM,
      ...nPlusOne,
      ...missingCache,
      ...largeContext,
      ...syncBlocking,
      ...unboundedLoops,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // ── Cross-cutting: endpoint-to-function ratio ────────────────
    const [endpoints, functions, modules] = await Promise.all([
      ctx.graph.getEntities('endpoint'),
      ctx.graph.getEntities('function'),
      ctx.graph.getEntities('module'),
    ]);

    if (endpoints.length > 3 && modules.length > 0) {
      const avgFunctionsPerModule = functions.length / modules.length;

      if (avgFunctionsPerModule < 3) {
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: 'Low function extraction across endpoint modules',
            description: `Project defines ${endpoints.length} endpoints across ${modules.length} modules but averages only ${avgFunctionsPerModule.toFixed(1)} functions per module. This suggests endpoint handlers contain inline logic that should be extracted into separate functions for better performance profiling, caching granularity, and optimization targeting.`,
            severity: 'medium',
            category: 'performance',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `${endpoints.length} endpoints, ${functions.length} functions across ${modules.length} modules (avg ${avgFunctionsPerModule.toFixed(1)}/module)`,
                entity_ids: [
                  ...endpoints.slice(0, 5).map((e) => e.id),
                  ...modules.slice(0, 5).map((m) => m.id),
                ],
                confidence: 0.75,
                data: {
                  endpoint_count: endpoints.length,
                  function_count: functions.length,
                  module_count: modules.length,
                  avg_functions_per_module: avgFunctionsPerModule,
                },
              }),
            ],
            locations: [],
            suggested_fix:
              'Extract inline handler logic into named functions. This enables targeted performance profiling, memoization of hot paths, and independent optimization of bottleneck functions.',
            confidence: 0.7,
            tags: ['function-extraction', 'performance', 'cross-cutting', 'modularity'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 1: Sequential LLM Calls ──────────────────────────────────

  /**
   * Detect functions making multiple LLM calls that are not marked
   * as parallelized — they could potentially be run concurrently.
   *
   * @param ctx - Analysis context.
   * @returns Findings for sequential LLM calls.
   */
  private async detectSequentialLLMCalls(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const modelCalls = outRels.filter((r) => r.type === 'uses_model');

      if (modelCalls.length < 2) continue;

      const isParallel =
        fn.properties['uses_promise_all'] === true ||
        fn.properties['parallel_calls'] === true ||
        fn.tags.includes('parallel') ||
        fn.tags.includes('concurrent');

      if (!isParallel) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Sequential LLM calls in ${fn.name}`,
            description: `Function '${fn.name}' makes ${modelCalls.length} LLM calls that appear to be sequential. If these calls are independent, parallelizing them with Promise.all() could reduce latency by up to ${Math.round((1 - 1 / modelCalls.length) * 100)}%.`,
            severity: 'medium',
            category: 'performance',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `${modelCalls.length} sequential LLM calls detected`,
                entity_ids: [fn.id, ...modelCalls.map((r) => r.target_id)],
                confidence: 0.75,
                data: { call_count: modelCalls.length },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'If the LLM calls are independent, use Promise.all() to execute them concurrently. If they depend on each other, document the dependency chain.',
            confidence: 0.7,
            tags: ['sequential-llm', 'performance', 'parallelization'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 2: N+1 Queries ────────────────────────────────────────────

  /**
   * Detect patterns suggesting N+1 database query problems — a
   * function that queries a list, then for each item queries
   * again.
   *
   * @param ctx - Analysis context.
   * @returns Findings for N+1 query patterns.
   */
  private async detectNPlusOneQueries(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const queryRels = outRels.filter(
        (r) => r.type === 'queries_table' || r.type === 'reads_from',
      );

      if (queryRels.length < 2) continue;

      // Heuristic: if the function queries the same table/collection multiple times
      // or has loop + query markers
      const tableIds = queryRels.map((r) => r.target_id);
      const duplicateQueries = tableIds.filter(
        (id, i) => tableIds.indexOf(id) !== i,
      );

      const hasLoop =
        fn.properties['has_loop'] === true ||
        fn.tags.includes('loop') ||
        fn.tags.includes('iteration');

      if (duplicateQueries.length > 0 || (hasLoop && queryRels.length >= 2)) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Potential N+1 query: ${fn.name}`,
            description: `Function '${fn.name}' appears to query a data source inside a loop or makes ${queryRels.length} queries to the same table(s). This is a common cause of poor performance that can be solved with batch queries or eager loading.`,
            severity: 'high',
            category: 'performance',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `${queryRels.length} queries detected${hasLoop ? ' with loop pattern' : ''}`,
                entity_ids: [fn.id, ...tableIds],
                confidence: 0.8,
                data: {
                  query_count: queryRels.length,
                  has_loop: hasLoop,
                  duplicate_targets: duplicateQueries.length,
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Replace N+1 queries with batch queries (IN clause), JOINs, or eager loading. Use dataloader patterns for GraphQL resolvers.',
            confidence: 0.75,
            tags: ['n-plus-one', 'performance', 'database'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: Missing Caching ────────────────────────────────────────

  /**
   * Detect repeated identical operations without caching.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing caching.
   */
  private async detectMissingCaching(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    // Build a map of function → callees to find repeated identical calls
    const callGraph = new Map<string, Entity[]>();
    const fnMap = new Map(functions.map((f) => [f.id, f]));

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const callees = outRels
        .filter((r) => r.type === 'calls')
        .map((r) => fnMap.get(r.target_id))
        .filter((e): e is Entity => e != null);
      callGraph.set(fn.id, callees);
    }

    // Find functions called by multiple callers that are expensive
    // (e.g., they query tables or call models)
    const callCounts = new Map<string, number>();
    for (const callees of callGraph.values()) {
      for (const callee of callees) {
        callCounts.set(callee.id, (callCounts.get(callee.id) ?? 0) + 1);
      }
    }

    for (const [fnId, count] of callCounts) {
      if (count < 3) continue;
      const fn = fnMap.get(fnId);
      if (!fn) continue;

      const outRels = await ctx.graph.getRelationships(fnId, 'out');
      const isExpensive = outRels.some(
        (r) =>
          r.type === 'queries_table' ||
          r.type === 'reads_from' ||
          r.type === 'uses_model',
      );

      if (!isExpensive) continue;

      const hasCaching =
        fn.tags.includes('cached') ||
        fn.tags.includes('memoized') ||
        fn.properties['cached'] === true;

      if (!hasCaching) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing caching: ${fn.name}`,
            description: `Function '${fn.name}' is called ${count} times and performs expensive operations (database queries or LLM calls) without caching. Adding caching could significantly reduce latency and cost.`,
            severity: 'medium',
            category: 'performance',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `Called ${count} times with expensive operations`,
                entity_ids: [fnId],
                confidence: 0.7,
                data: { call_count: count, has_caching: hasCaching },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add caching using memoization, Redis, or an in-memory cache. Consider TTL-based invalidation for data that changes infrequently.',
            confidence: 0.7,
            tags: ['missing-cache', 'performance', 'optimization'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 4: Large Context Windows ──────────────────────────────────

  /**
   * Detect prompts using near-maximum context window sizes.
   *
   * @param ctx - Analysis context.
   * @returns Findings for large context usage.
   */
  private async detectLargeContextWindows(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const prompts = await ctx.graph.getEntities('prompt');

    const MAX_CONTEXT_THRESHOLD = 100000; // ~100k tokens

    for (const prompt of prompts) {
      const contextSize = prompt.properties['context_token_count'] as number | undefined;
      const maxContext = prompt.properties['max_context_tokens'] as number | undefined;
      const content =
        (prompt.properties['template'] as string | undefined) ??
        (prompt.properties['content'] as string | undefined) ??
        // The Langfuse collector stores prompt text under `prompt`.
        (prompt.properties['prompt'] as string | undefined) ??
        '';
      const estimatedTokens = Math.ceil(content.length / 4);

      const effectiveSize = contextSize ?? estimatedTokens;
      const effectiveMax = maxContext ?? MAX_CONTEXT_THRESHOLD;

      if (effectiveSize > effectiveMax * 0.8) {
        const loc = locationFromEntity(prompt);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Near-maximum context usage: ${prompt.name}`,
            description: `Prompt '${prompt.name}' uses ~${effectiveSize} tokens, which is >${Math.round((effectiveSize / effectiveMax) * 100)}% of the model's context window. This increases latency, cost, and risk of truncation.`,
            severity: 'medium',
            category: 'performance',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `${effectiveSize} tokens used of ${effectiveMax} max`,
                entity_ids: [prompt.id],
                confidence: 0.7,
                data: { estimated_tokens: effectiveSize, max_tokens: effectiveMax },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Reduce context size by summarizing documents, using RAG for selective retrieval, or splitting into multiple smaller prompts.',
            confidence: 0.7,
            tags: ['large-context', 'performance', 'tokens'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 5: Synchronous Blocking ───────────────────────────────────

  /**
   * Detect async operations called synchronously (blocking the event
   * loop).
   *
   * @param ctx - Analysis context.
   * @returns Findings for synchronous blocking patterns.
   */
  private async detectSynchronousBlocking(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const isSyncBlocker =
        fn.properties['sync_file_io'] === true ||
        fn.properties['sync_network'] === true ||
        fn.tags.includes('sync-blocking') ||
        fn.tags.includes('blocking-io');

      // Check for known synchronous Node API patterns in the name. The generic
      // "ends in Sync" test must NOT match "...Async" (which also ends in
      // "sync" case-insensitively) — that flagged every async function as a
      // synchronous blocker, the exact opposite of the truth. Match a real
      // `Sync` suffix not preceded by `a`/`A`, and anchor the known-API list.
      const knownSyncApi =
        /(?:readFile|writeFile|readdir|exec|spawn|execFile|appendFile|mkdir|rmdir|readlink|realpath|stat|lstat|copyFile|unlink|rename|access|truncate|link|symlink|mkdtemp|rm|chmod|chown)Sync$/.test(fn.name);
      // A generic `...Sync` suffix is only a NAMING HINT, not proof of
      // blocking I/O: `initSync` (wasm-bindgen), `dataSync` (tfjs), or
      // app-level "sync data to server" helpers all end in Sync without
      // blocking file/network I/O. Report those at reduced severity and
      // confidence instead of a definite HIGH/0.95 claim.
      const genericSyncSuffix = !knownSyncApi && /(?<![aA])Sync$/.test(fn.name);

      if (isSyncBlocker || knownSyncApi || genericSyncSuffix) {
        const definite = isSyncBlocker || knownSyncApi;
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: definite
              ? `Synchronous blocking: ${fn.name}`
              : `Possible synchronous blocking: ${fn.name}`,
            description: definite
              ? `Function '${fn.name}' performs synchronous I/O operations that block the event loop. This can cause the entire application to freeze during the operation.`
              : `Function '${fn.name}' has a 'Sync' name suffix, which often denotes a synchronous (blocking) API — but may also be an unrelated naming convention (e.g. WASM initSync, data-sync helpers). Verify whether it performs blocking I/O.`,
            severity: definite ? 'high' : 'medium',
            category: 'performance',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: definite
                  ? 'Synchronous blocking operation detected'
                  : `Function name ends in 'Sync' (naming hint only; not a confirmed blocking API)`,
                entity_ids: [fn.id],
                confidence: definite ? 0.9 : 0.5,
                data: { name_match: knownSyncApi || genericSyncSuffix, known_sync_api: knownSyncApi },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: definite
              ? 'Replace synchronous operations with their async equivalents (e.g., fs.readFile instead of fs.readFileSync). Use worker threads for CPU-intensive tasks.'
              : `Check whether '${fn.name}' performs blocking I/O. If it does, replace it with an async equivalent; if the name just means "synchronize", consider renaming to avoid confusion.`,
            confidence: definite ? (knownSyncApi ? 0.95 : 0.8) : 0.5,
            tags: ['sync-blocking', 'performance', 'event-loop'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 6: Unbounded Loops ────────────────────────────────────────

  /**
   * Detect loops without size limits operating on collections.
   *
   * @param ctx - Analysis context.
   * @returns Findings for unbounded loops.
   */
  private async detectUnboundedLoops(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const hasUnboundedLoop =
        fn.properties['has_unbounded_loop'] === true ||
        fn.tags.includes('unbounded-loop');

      const hasWhileTrue =
        fn.properties['has_while_true'] === true ||
        fn.tags.includes('while-true');

      // Check if the function iterates over unbounded collections
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const readsData = outRels.some(
        (r) => r.type === 'reads_from' || r.type === 'queries_table',
      );
      const hasLoop = fn.properties['has_loop'] === true || fn.tags.includes('loop');
      const hasSizeLimit =
        fn.properties['has_size_limit'] === true ||
        fn.tags.includes('bounded') ||
        fn.tags.includes('size-limited');

      if ((hasUnboundedLoop || hasWhileTrue || (hasLoop && readsData && !hasSizeLimit))) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Unbounded loop: ${fn.name}`,
            description: `Function '${fn.name}' contains a loop${readsData ? ' over data from a data source' : ''} without a size limit. As data volume grows, this could cause performance degradation, memory exhaustion, or timeouts.`,
            severity: hasWhileTrue ? 'high' : 'medium',
            category: 'performance',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `Unbounded loop${hasWhileTrue ? ' (while true)' : ''} detected`,
                entity_ids: [fn.id],
                confidence: 0.75,
                data: {
                  has_while_true: hasWhileTrue,
                  reads_data: readsData,
                  has_size_limit: hasSizeLimit,
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add a maximum iteration limit, process data in batches, or use streaming/pagination to handle large datasets safely.',
            confidence: 0.7,
            tags: ['unbounded-loop', 'performance', 'scalability'],
          }),
        );
      }
    }

    return findings;
  }
}

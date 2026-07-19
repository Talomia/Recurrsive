/**
 * @module @recurrsive/analyzers/base/runner
 *
 * High-level analyzer execution engine that adds timeout support,
 * parallel execution, progress tracking, and error isolation on top
 * of the {@link AnalyzerRegistry}.
 *
 * @packageDocumentation
 */

import type { Analyzer, AnalysisContext, Finding } from '@recurrsive/core';
import { AnalyzerError } from '@recurrsive/core';
import type { AnalyzerRegistry } from './registry.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Aggregated result of running one or more analyzers.
 */
export interface AnalysisResult {
  /** All findings collected across analyzers. */
  findings: Finding[];
  /** Errors keyed by analyzer ID. */
  errors: Array<{ analyzer_id: string; error: Error }>;
  /** Total wall-clock time in milliseconds. */
  duration_ms: number;
  /** IDs of analyzers that completed successfully. */
  analyzers_run: string[];
  /** IDs of analyzers that failed. */
  analyzers_failed: string[];
}

/**
 * Options for {@link AnalyzerRunner.run}.
 */
export interface RunOptions {
  /** Per-analyzer timeout in milliseconds (default: 30 000). */
  timeout_ms?: number;
  /** Whether to run analyzers in parallel (default: false). */
  parallel?: boolean;
  /** Progress callback invoked per analyzer. */
  on_progress?: (analyzerId: string, status: string) => void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

/**
 * Run a single analyzer lifecycle (initialize → analyze → finalize) with
 * an optional timeout.
 *
 * CAVEAT — the timeout rejects the returned promise but does NOT cancel
 * the analyzer itself: the underlying async work (graph queries etc.)
 * keeps running in the background until it settles on its own. Its late
 * resolve/reject is a harmless no-op on the already-settled promise, but
 * the analyzer may keep consuming graph-client resources after the run
 * has "timed out". True cancellation would require an AbortSignal in the
 * Analyzer contract.
 *
 * @param analyzer - The analyzer to run.
 * @param ctx - Analysis context.
 * @param timeout_ms - Maximum wall-clock time allowed.
 * @returns Array of findings.
 * @throws {AnalyzerError} On timeout or unexpected failure.
 */
async function runSingle(
  analyzer: Analyzer,
  ctx: AnalysisContext,
  timeout_ms: number,
): Promise<Finding[]> {
  return new Promise<Finding[]>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new AnalyzerError(
          `Analyzer '${analyzer.id}' timed out after ${timeout_ms}ms`,
          'ANALYZER_TIMEOUT',
          analyzer.id,
        ),
      );
    }, timeout_ms);

    (async () => {
      try {
        await analyzer.initialize(ctx);
        const findings = await analyzer.analyze(ctx);
        const finalFindings = await analyzer.finalize(ctx);
        clearTimeout(timer);
        resolve([...findings, ...finalFindings]);
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    })();
  });
}

/**
 * Execution engine that orchestrates analyzer runs with error
 * isolation, timeout, and optional parallelism.
 *
 * @example
 * ```ts
 * const runner = new AnalyzerRunner(registry);
 * const result = await runner.run('*', ctx, { parallel: true, timeout_ms: 10_000 });
 * console.log(`Found ${result.findings.length} findings`);
 * ```
 */
export class AnalyzerRunner {
  /**
   * @param registry - The analyzer registry to draw analyzers from.
   */
  constructor(private registry: AnalyzerRegistry) {}

  /**
   * Run analyzers with error isolation, timeout, and progress tracking.
   *
   * @param analyzerIds - Array of analyzer IDs to run, or `'*'` for all.
   * @param ctx - Analysis context.
   * @param options - Execution options.
   * @returns Aggregated analysis result.
   */
  async run(
    analyzerIds: string[] | '*',
    ctx: AnalysisContext,
    options?: RunOptions,
  ): Promise<AnalysisResult> {
    const timeout_ms = options?.timeout_ms ?? 30_000;
    const parallel = options?.parallel ?? false;
    const onProgress = options?.on_progress;

    const analyzers = this.resolveAnalyzers(analyzerIds);
    const findings: Finding[] = [];
    const errors: Array<{ analyzer_id: string; error: Error }> = [];
    const analyzersRun: string[] = [];
    const analyzersFailed: string[] = [];

    const start = Date.now();

    if (parallel) {
      const settled = await Promise.allSettled(
        analyzers.map(async (analyzer) => {
          onProgress?.(analyzer.id, 'running');
          const result = await runSingle(analyzer, ctx, timeout_ms);
          onProgress?.(analyzer.id, 'completed');
          return { id: analyzer.id, findings: result };
        }),
      );

      for (let i = 0; i < settled.length; i++) {
        const outcome = settled[i]!;
        const analyzer = analyzers[i]!;
        if (outcome.status === 'fulfilled') {
          findings.push(...outcome.value.findings);
          analyzersRun.push(analyzer.id);
        } else {
          const err =
            outcome.reason instanceof Error
              ? outcome.reason
              : new Error(String(outcome.reason));
          errors.push({ analyzer_id: analyzer.id, error: err });
          analyzersFailed.push(analyzer.id);
          onProgress?.(analyzer.id, 'failed');
        }
      }
    } else {
      for (const analyzer of analyzers) {
        onProgress?.(analyzer.id, 'running');
        try {
          const result = await runSingle(analyzer, ctx, timeout_ms);
          findings.push(...result);
          analyzersRun.push(analyzer.id);
          onProgress?.(analyzer.id, 'completed');
        } catch (err) {
          const wrapped = err instanceof Error ? err : new Error(String(err));
          errors.push({ analyzer_id: analyzer.id, error: wrapped });
          analyzersFailed.push(analyzer.id);
          onProgress?.(analyzer.id, 'failed');
        }
      }
    }

    return {
      findings,
      errors,
      duration_ms: Date.now() - start,
      analyzers_run: analyzersRun,
      analyzers_failed: analyzersFailed,
    };
  }

  /**
   * Resolve analyzer IDs to concrete instances.
   *
   * @param analyzerIds - IDs or wildcard.
   * @returns Array of analyzer instances.
   * @throws {AnalyzerError} If a requested ID is not found.
   */
  private resolveAnalyzers(analyzerIds: string[] | '*'): Analyzer[] {
    if (analyzerIds === '*') {
      return this.registry.getAll();
    }
    return analyzerIds.map((id) => {
      const analyzer = this.registry.get(id);
      if (!analyzer) {
        throw new AnalyzerError(
          `Analyzer '${id}' not found in registry`,
          'ANALYZER_NOT_FOUND',
          id,
        );
      }
      return analyzer;
    });
  }
}

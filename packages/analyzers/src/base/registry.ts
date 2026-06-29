/**
 * @module @recurrsive/analyzers/base/registry
 *
 * Central registry for analyzer plugins. Manages registration,
 * lookup, and orchestrated execution of {@link Analyzer} instances.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
  OpportunityCategory,
} from '@recurrsive/core';
import { AnalyzerError } from '@recurrsive/core';

/**
 * A registry that holds {@link Analyzer} instances and provides
 * lookup / execution helpers.
 *
 * @example
 * ```ts
 * const registry = new AnalyzerRegistry();
 * registry.register(new SecurityAnalyzer());
 * const findings = await registry.runAll(ctx);
 * ```
 */
export class AnalyzerRegistry {
  /** Internal store keyed by analyzer ID. */
  private analyzers: Map<string, Analyzer> = new Map();

  /**
   * Register an analyzer.
   *
   * @param analyzer - The analyzer to register.
   * @throws {AnalyzerError} If an analyzer with the same ID is already registered.
   */
  register(analyzer: Analyzer): void {
    if (this.analyzers.has(analyzer.id)) {
      throw new AnalyzerError(
        `Analyzer '${analyzer.id}' is already registered`,
        'DUPLICATE_ANALYZER',
        analyzer.id,
      );
    }
    this.analyzers.set(analyzer.id, analyzer);
  }

  /**
   * Remove an analyzer from the registry.
   *
   * @param id - The analyzer ID to remove.
   * @throws {AnalyzerError} If no analyzer with the given ID is registered.
   */
  unregister(id: string): void {
    if (!this.analyzers.has(id)) {
      throw new AnalyzerError(
        `Analyzer '${id}' is not registered`,
        'ANALYZER_NOT_FOUND',
        id,
      );
    }
    this.analyzers.delete(id);
  }

  /**
   * Retrieve a registered analyzer by ID.
   *
   * @param id - The analyzer ID.
   * @returns The analyzer, or `undefined` if not found.
   */
  get(id: string): Analyzer | undefined {
    return this.analyzers.get(id);
  }

  /**
   * Retrieve all registered analyzers.
   *
   * @returns An array of all registered analyzers.
   */
  getAll(): Analyzer[] {
    return [...this.analyzers.values()];
  }

  /**
   * Retrieve analyzers that cover a given category.
   *
   * @param category - The opportunity category to filter by.
   * @returns Analyzers whose `categories` array includes the given category.
   */
  getByCategory(category: OpportunityCategory): Analyzer[] {
    return this.getAll().filter((a) => a.categories.includes(category));
  }

  /**
   * Run all registered analyzers against the given context.
   *
   * Each analyzer is initialized, executed, and finalized in sequence.
   * Errors in one analyzer do not prevent others from running.
   *
   * @param ctx - The analysis context.
   * @returns Combined findings from all analyzers.
   */
  async runAll(ctx: AnalysisContext): Promise<Finding[]> {
    const allFindings: Finding[] = [];
    for (const analyzer of this.analyzers.values()) {
      if (!ctx.config.enabled) continue;
      try {
        await analyzer.initialize(ctx);
        const findings = await analyzer.analyze(ctx);
        allFindings.push(...findings);
        const finalFindings = await analyzer.finalize(ctx);
        allFindings.push(...finalFindings);
      } catch (error) {
        // Wrap and continue – isolation per analyzer
        const wrapped = error instanceof Error ? error : new Error(String(error));
        throw new AnalyzerError(
          `Analyzer '${analyzer.id}' failed: ${wrapped.message}`,
          'ANALYZER_EXECUTION_ERROR',
          analyzer.id,
          wrapped,
        );
      }
    }
    return allFindings;
  }

  /**
   * Run a specific analyzer by ID.
   *
   * @param id - The analyzer ID.
   * @param ctx - The analysis context.
   * @returns Findings produced by the analyzer.
   * @throws {AnalyzerError} If the analyzer is not found.
   */
  async run(id: string, ctx: AnalysisContext): Promise<Finding[]> {
    const analyzer = this.analyzers.get(id);
    if (!analyzer) {
      throw new AnalyzerError(
        `Analyzer '${id}' is not registered`,
        'ANALYZER_NOT_FOUND',
        id,
      );
    }
    await analyzer.initialize(ctx);
    const findings = await analyzer.analyze(ctx);
    const finalFindings = await analyzer.finalize(ctx);
    return [...findings, ...finalFindings];
  }
}

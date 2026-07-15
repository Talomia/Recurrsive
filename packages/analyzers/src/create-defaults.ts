/**
 * @module @recurrsive/analyzers/create-defaults
 *
 * Factory function that creates all built-in analyzers with their
 * default configuration.
 *
 * @packageDocumentation
 */

import type { Analyzer } from '@recurrsive/core';
import { ArchitectureAnalyzer } from './architecture/index.js';
import { AIAnalyzer } from './ai/index.js';
import { PerformanceAnalyzer } from './performance/index.js';
import { CostAnalyzer } from './cost/index.js';
import { ReliabilityAnalyzer } from './reliability/index.js';
import { SecurityAnalyzer } from './security/index.js';
import { DataAnalyzer } from './data/index.js';
import { DocsAnalyzer } from './docs/index.js';
import { ProductAnalyzer } from './product/index.js';
import { DependencyAnalyzer } from './dependency/index.js';
import { APIContractAnalyzer } from './api-contract/index.js';
import { AIRuntimeAnalyzer } from './ai-runtime/index.js';

/**
 * Create an array containing one instance of every built-in analyzer.
 *
 * This is the recommended way to initialise the analysis engine for
 * a full-spectrum analysis pass.
 *
 * @returns Array of all default {@link Analyzer} instances.
 *
 * @example
 * ```ts
 * import { createDefaultAnalyzers } from '@recurrsive/analyzers';
 * import { AnalyzerRegistry } from '@recurrsive/analyzers';
 *
 * const registry = new AnalyzerRegistry();
 * for (const analyzer of createDefaultAnalyzers()) {
 *   registry.register(analyzer);
 * }
 * ```
 */
export function createDefaultAnalyzers(): Analyzer[] {
  return [
    new ArchitectureAnalyzer(),
    new AIAnalyzer(),
    new PerformanceAnalyzer(),
    new CostAnalyzer(),
    new ReliabilityAnalyzer(),
    new SecurityAnalyzer(),
    new DataAnalyzer(),
    new DocsAnalyzer(),
    new ProductAnalyzer(),
    new DependencyAnalyzer(),
    new APIContractAnalyzer(),
    new AIRuntimeAnalyzer(),
  ];
}

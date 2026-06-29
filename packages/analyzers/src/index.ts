/**
 * @module @recurrsive/analyzers
 *
 * Analysis plugins for the Recurrsive evolution engine.
 *
 * This package provides a suite of analyzers that inspect the
 * knowledge graph to detect architecture, AI, performance, cost,
 * reliability, security, data, documentation, UX, and product
 * issues. Each analyzer implements the core {@link Analyzer}
 * interface and produces raw {@link Finding} objects.
 *
 * @packageDocumentation
 */

// ─── Base Infrastructure ──────────────────────────────────────────────────────

export { AnalyzerRegistry } from './base/index.js';
export { AnalyzerRunner, type AnalysisResult, type RunOptions } from './base/index.js';
export {
  createFinding,
  createEvidence,
  locationFromEntity,
  type CreateFindingOptions,
  type CreateEvidenceOptions,
} from './base/index.js';

// ─── Built-in Analyzers ───────────────────────────────────────────────────────

export { ArchitectureAnalyzer } from './architecture/index.js';
export { AIAnalyzer } from './ai/index.js';
export { PerformanceAnalyzer } from './performance/index.js';
export { CostAnalyzer } from './cost/index.js';
export { ReliabilityAnalyzer } from './reliability/index.js';
export { SecurityAnalyzer } from './security/index.js';
export { DataAnalyzer } from './data/index.js';
export { DocsAnalyzer } from './docs/index.js';
export { UXAnalyzer } from './ux/index.js';
export { ProductAnalyzer } from './product/index.js';

// ─── Factory ──────────────────────────────────────────────────────────────────

export { createDefaultAnalyzers } from './create-defaults.js';

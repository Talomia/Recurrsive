/**
 * @module @recurrsive/analyzers/base
 *
 * Barrel export for the analyzer infrastructure: registry, runner,
 * and shared helper utilities.
 *
 * @packageDocumentation
 */

export { AnalyzerRegistry } from './registry.js';
export { AnalyzerRunner, type AnalysisResult, type RunOptions } from './runner.js';
export {
  createFinding,
  createEvidence,
  locationFromEntity,
  type CreateFindingOptions,
  type CreateEvidenceOptions,
} from './helpers.js';

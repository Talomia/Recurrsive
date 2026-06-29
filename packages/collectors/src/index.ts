/**
 * @module @recurrsive/collectors
 *
 * Data collectors for the Recurrsive knowledge graph.
 *
 * This package provides:
 * - **Base infrastructure**: {@link CollectorRegistry}, {@link CollectorScheduler},
 *   {@link GovernanceFilter}
 * - **Git collector**: {@link GitCollector} — walks file trees, parses git history,
 *   detects project types / frameworks / AI providers
 * - **Documentation collector**: {@link DocumentationCollector} — discovers READMEs,
 *   ADRs, RFCs, API contracts
 *
 * @packageDocumentation
 */

// ─── Base Infrastructure ─────────────────────────────────────────────────────

export {
  CollectorRegistry,
  CollectorScheduler,
  GovernanceFilter,
  type ScheduleConfig,
  type PIIDetection,
  type PIIType,
  type AuditEntry,
} from './base/index.js';

// ─── Git Collector ───────────────────────────────────────────────────────────

export {
  GitCollector,
  detectLanguage,
  isSourceFile,
  isBinaryFile,
  parsePackageJson,
  parsePyprojectToml,
  parseGoMod,
  detectFrameworks,
  detectAIProviders,
  type GitCommitInfo,
  type ProjectTypeInfo,
  type DependencyInfo,
  type FileInfo,
} from './git/index.js';

// ─── Documentation Collector ─────────────────────────────────────────────────

export { DocumentationCollector } from './docs/index.js';

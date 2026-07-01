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
 * - **GitHub collector**: {@link GitHubCollector} — PRs, issues, reviews, workflows,
 *   deployments
 * - **Documentation collector**: {@link DocumentationCollector} — discovers READMEs,
 *   ADRs, RFCs, API contracts
 * - **Environment collector**: {@link EnvironmentCollector} — Docker, Compose, K8s
 * - **CI/CD collector**: {@link CICDCollector} — GitHub Actions, GitLab CI
 * - **Database collector**: {@link DatabaseCollector} — SQL, Prisma, Drizzle schemas
 * - **OpenTelemetry collector**: {@link OpenTelemetryCollector} — traces, metrics,
 *   infrastructure resources
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

// ─── Environment Collector ───────────────────────────────────────────────────

export { EnvironmentCollector } from './environment/index.js';

// ─── CI/CD Collector ─────────────────────────────────────────────────────────

export { CICDCollector } from './cicd/index.js';

// ─── Database Collector ──────────────────────────────────────────────────────

export { DatabaseCollector } from './database/index.js';

// ─── GitHub Collector ────────────────────────────────────────────────────────

export { GitHubCollector } from './github/index.js';

// ─── OpenTelemetry Collector ─────────────────────────────────────────────────

export { OpenTelemetryCollector } from './telemetry/index.js';

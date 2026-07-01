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
 * - **GitLab collector**: {@link GitLabCollector} — MRs, issues, pipelines, jobs,
 *   environments, deployments
 * - **Documentation collector**: {@link DocumentationCollector} — discovers READMEs,
 *   ADRs, RFCs, API contracts
 * - **Environment collector**: {@link EnvironmentCollector} — Docker, Compose, K8s
 * - **CI/CD collector**: {@link CICDCollector} — GitHub Actions, GitLab CI
 * - **Database collector**: {@link DatabaseCollector} — SQL, Prisma, Drizzle schemas
 * - **OpenTelemetry collector**: {@link OpenTelemetryCollector} — traces, metrics,
 *   infrastructure resources
 * - **Cloud cost collector**: {@link CloudCostCollector} — AWS/GCP/Azure cost reports,
 *   budgets, resource allocations
 * - **Error tracking collector**: {@link ErrorTrackingCollector} — Sentry/Bugsnag/Rollbar
 *   error events, error groups, alert rules
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

// ─── GitLab Collector ────────────────────────────────────────────────────────

export { GitLabCollector } from './gitlab/index.js';

// ─── Cloud Cost Collector ───────────────────────────────────────────────────

export { CloudCostCollector } from './cloud-cost/index.js';

// ─── Error Tracking Collector ───────────────────────────────────────────────

export { ErrorTrackingCollector } from './error-tracking/index.js';

// ─── APM Collector ──────────────────────────────────────────────────────────

export { APMCollector } from './apm/index.js';

// ─── Langfuse Collector ─────────────────────────────────────────────────────

export { LangfuseCollector } from './langfuse/index.js';

// ─── Arize Collector ────────────────────────────────────────────────────────

export { ArizeCollector } from './arize/index.js';

// ─── Helicone Collector ─────────────────────────────────────────────────────

export { HeliconeCollector } from './helicone/index.js';

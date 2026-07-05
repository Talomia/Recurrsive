/**
 * @module @recurrsive/server/routes
 *
 * Route registration aggregator. Registers all route groups on the
 * Fastify app instance, organized into three tiers:
 *
 * - **Tier 1 (OSS Core)** — Always registered.
 * - **Tier 2 (Enterprise)** — Gated by `ENABLE_ENTERPRISE` env var.
 * - **Tier 3 (Ecosystem)** — Gated by `ENABLE_ECOSYSTEM` env var.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Tier 1 — OSS Core
// ---------------------------------------------------------------------------
import { registerHealthRoutes } from './health.js';
import { registerAuthRoutes } from './auth.js';
import { registerAnalysisRoutes } from './analysis.js';
import { registerGraphRoutes } from './graph.js';
import { registerTimelineRoutes } from './timeline.js';
import { registerFindingsRoutes } from './findings.js';
import { registerReportRoutes } from './reports.js';
import { registerSnapshotRoutes } from './snapshots.js';
import { registerPolicyRoutes } from './policies.js';
import { registerWebhookRoutes } from './webhooks.js';
import { registerConfigRoutes } from './config.js';
import { registerNotificationRoutes } from './notifications.js';
import { registerBatchRoutes } from './batch.js';
import { registerAuditRoutes } from './audit.js';
import { registerAnalyticsRoutes } from './analytics.js';
import { registerExperimentRoutes } from './experiments.js';
import { registerSearchRoutes } from './search.js';
import { registerExportRoutes } from './export.js';
import { registerProjectRoutes } from './projects.js';
import { registerForecastingRoutes } from './forecasting.js';
import { registerSchedulingRoutes } from './scheduling.js';
import { registerPluginRoutes } from './plugins.js';
import { registerConfidenceRoutes } from './confidence.js';
import { registerSimulationRoutes } from './simulation.js';
import { registerGraphQLRoutes } from './graphql.js';
import { registerOpenAPIRoutes } from './openapi.js';
import { registerIntelligencePackRoutes } from './intelligence-packs.js';
import { registerOpportunityRoutes } from './opportunities.js';

// ---------------------------------------------------------------------------
// Tier 2 — Enterprise
// ---------------------------------------------------------------------------
import { registerSSORoutes } from './sso.js';
import { registerMultiTenantRoutes } from './multi-tenant.js';
import { registerSecretRoutes } from './secrets.js';
import { registerDataMaskingRoutes } from '../middleware/data-masking.js';

// ---------------------------------------------------------------------------
// Tier 3 — Ecosystem
// ---------------------------------------------------------------------------
import { registerCloudRoutes } from './cloud.js';
import { registerMarketplaceRoutes } from './marketplace.js';
import { registerPartnerRoutes } from './partners.js';

/**
 * Register all REST API routes on the Fastify application.
 *
 * Route groups are organized into three tiers:
 *
 * **Tier 1 (OSS Core)** — always registered:
 * - `/health` — Liveness probe
 * - `/api/v1/auth/*` — Authentication, API keys, and sessions
 * - `/api/v1/opportunities` — Opportunity CRUD and export
 * - `/api/v1/analyze`, `/api/v1/analysis/*` — Analysis management
 * - `/api/v1/graph/*` — Knowledge graph queries
 * - `/api/v1/timeline/*` — Intelligence timeline and trends
 * - `/api/v1/findings/*` — Findings query and detail
 * - `/api/v1/reports/*` — Report generation (markdown, HTML, SARIF, JSON)
 * - `/api/v1/snapshots/*` — Snapshot export/import
 * - `/api/v1/policies/*` — Policy enforcement and compliance
 * - `/api/v1/webhooks/*` — Webhook management and events
 * - `/api/v1/config` — Configuration management and features
 * - `/api/v1/notifications/*` — Notification channels and history
 * - `/api/v1/batch/*` — Batch analysis management
 * - `/api/v1/audit` — Audit trail events
 * - `/api/v1/analytics/*` — Analytics summary and categories
 * - `/api/v1/experiments/*` — A/B experiment management
 * - `/api/v1/search` — Cross-entity keyword search
 * - `/api/v1/export/*` — Data export in JSON, CSV, Markdown
 * - `/api/v1/projects/*` — Project management
 * - `/api/v1/forecasting/*` — Trend forecasting and projections
 * - `/api/v1/scheduling/*` — Scheduled analysis and cron jobs
 * - `/api/v1/plugins/*` — Plugin management and lifecycle
 * - `/api/v1/confidence/*` — Confidence scoring and calibration
 * - `/api/v1/simulations/*` — What-if simulation and scenario analysis
 * - `/api/v1/graphql` — GraphQL query endpoint
 * - `/api/v1/openapi` — OpenAPI specification and docs
 * - `/api/v1/intelligence-packs/*` — Domain intelligence packs
 *
 * **Tier 2 (Enterprise)** — gated by `ENABLE_ENTERPRISE`:
 * - `/api/v1/sso/*` — Single sign-on integration
 * - `/api/v1/tenants/*` — Multi-tenant workspace management
 * - `/api/v1/secrets/*` — Secret and credential management
 * - `/api/v1/data-masking/*` — Data masking and PII redaction
 *
 * **Tier 3 (Ecosystem)** — gated by `ENABLE_ECOSYSTEM`:
 * - `/api/v1/cloud/*` — Cloud provider integration
 * - `/api/v1/marketplace/*` — Plugin marketplace and distribution
 * - `/api/v1/partners/*` — Partner integration and management
 *
 * @param app - The Fastify application instance.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  const enableEnterprise = process.env['ENABLE_ENTERPRISE'] !== 'false';
  const enableEcosystem = process.env['ENABLE_ECOSYSTEM'] !== 'false';

  app.log.info(`Route tiers: Tier 1 (OSS Core) = enabled, Tier 2 (Enterprise) = ${enableEnterprise ? 'enabled' : 'disabled'}, Tier 3 (Ecosystem) = ${enableEcosystem ? 'enabled' : 'disabled'}`);

  // ── Tier 1 — OSS Core ───────────────────────────────────────────────────
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerOpportunityRoutes(app);
  await registerAnalysisRoutes(app);
  await registerGraphRoutes(app);
  await registerTimelineRoutes(app);
  await registerFindingsRoutes(app);
  await registerReportRoutes(app);
  await registerSnapshotRoutes(app);
  await registerPolicyRoutes(app);
  await registerWebhookRoutes(app);
  await registerConfigRoutes(app);
  await registerNotificationRoutes(app);
  await registerBatchRoutes(app);
  await registerAuditRoutes(app);
  await registerAnalyticsRoutes(app);
  await registerExperimentRoutes(app);
  await registerSearchRoutes(app);
  await registerExportRoutes(app);
  await registerProjectRoutes(app);
  await registerForecastingRoutes(app);
  await registerSchedulingRoutes(app);
  await registerPluginRoutes(app);
  await registerConfidenceRoutes(app);
  await registerSimulationRoutes(app);
  await registerGraphQLRoutes(app);
  await registerOpenAPIRoutes(app);
  await registerIntelligencePackRoutes(app);

  // ── Tier 2 — Enterprise ─────────────────────────────────────────────────
  if (enableEnterprise) {
    await registerSSORoutes(app);
    await registerMultiTenantRoutes(app);
    await registerSecretRoutes(app);
    await registerDataMaskingRoutes(app);
  }

  // ── Tier 3 — Ecosystem ──────────────────────────────────────────────────
  if (enableEcosystem) {
    await registerCloudRoutes(app);
    await registerMarketplaceRoutes(app);
    await registerPartnerRoutes(app);
  }
}

/**
 * @module @recurrsive/server/routes
 *
 * Route registration aggregator. Registers all route groups on the
 * Fastify app instance.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { registerHealthRoutes } from './health.js';
import { registerOpportunityRoutes } from './opportunities.js';
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

/**
 * Register all REST API routes on the Fastify application.
 *
 * Route groups:
 * - `/health` — Liveness probe
 * - `/api/v1/health-score` — Project health + maturity
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
 *
 * @param app - The Fastify application instance.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerHealthRoutes(app);
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
}

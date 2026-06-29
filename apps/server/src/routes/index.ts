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

/**
 * Register all REST API routes on the Fastify application.
 *
 * Route groups:
 * - `/health` — Liveness probe
 * - `/api/v1/health-score` — Project health + maturity
 * - `/api/v1/opportunities` — Opportunity CRUD and export
 * - `/api/v1/analyze`, `/api/v1/analysis/*` — Analysis management
 * - `/api/v1/graph/*` — Knowledge graph queries
 * - `/api/v1/timeline/*` — Evolution timeline and trends
 *
 * @param app - The Fastify application instance.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerHealthRoutes(app);
  await registerOpportunityRoutes(app);
  await registerAnalysisRoutes(app);
  await registerGraphRoutes(app);
  await registerTimelineRoutes(app);
}

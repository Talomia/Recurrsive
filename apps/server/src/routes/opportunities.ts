/**
 * @module @recurrsive/server/routes/opportunities
 *
 * CRUD and export routes for opportunities.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import type { OpportunityCategory, OpportunityStatus, Severity } from '@recurrsive/core';
import type { ExportFormat } from '@recurrsive/opportunities';
import { createLogger } from '@recurrsive/core';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

const logger = createLogger({ context: { component: 'server:routes:opportunities' } });

// ---------------------------------------------------------------------------
// Query / Param schemas (type-safe request typing)
// ---------------------------------------------------------------------------

interface ListOpportunitiesQuery {
  category?: OpportunityCategory;
  status?: OpportunityStatus;
  severity?: Severity;
  limit?: string;
  offset?: string;
  projectId?: string;
}

interface OpportunityParams {
  id: string;
}

interface UpdateStatusBody {
  status: OpportunityStatus;
  reason?: string;
}

interface ExportParams {
  format: string;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register opportunity management routes.
 *
 * @param app - Fastify instance.
 */
export async function registerOpportunityRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/opportunities
   *
   * List opportunities with optional filtering by category, status, and
   * severity. Supports pagination via limit/offset query parameters.
   */
  app.get<{ Querystring: ListOpportunitiesQuery }>(
    '/api/v1/opportunities',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { category, status, severity, limit: limitStr, offset: offsetStr, projectId } = request.query;

      const manager = await state.loadOpportunitiesForProject(projectId);
      let results = manager.list({
        category,
        status,
        severity,
      });

      const offset = offsetStr ? parseInt(offsetStr, 10) : 0;
      const limit = limitStr ? parseInt(limitStr, 10) : 50;

      const total = results.length;
      results = results.slice(offset, offset + limit);

      return reply.status(200).send({
        data: results,
        total,
        limit,
        offset,
        has_more: offset + limit < total,
      });
    },
  );

  /**
   * GET /api/v1/opportunities/:id
   *
   * Retrieve a single opportunity by its UUID.
   */
  app.get<{ Params: OpportunityParams; Querystring: { projectId?: string } }>(
    '/api/v1/opportunities/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params;
      const manager = await state.loadOpportunitiesForProject(request.query.projectId);
      const opportunity = manager.get(id);

      if (!opportunity) {
        return reply.status(404).send({
          error: 'Not found',
          message: `Opportunity ${id} not found`,
        });
      }

      const score = manager.getScore(id);

      return reply.status(200).send({
        data: opportunity,
        score: score ?? null,
      });
    },
  );

  /**
   * PATCH /api/v1/opportunities/:id
   *
   * Update the lifecycle status of an opportunity (accept, reject, etc.).
   */
  app.patch<{ Params: OpportunityParams; Body: UpdateStatusBody; Querystring: { projectId?: string } }>(
    '/api/v1/opportunities/:id',
    { preHandler: [authMiddleware, requireRole('analyst')] },
    async (request, reply) => {
      const { id } = request.params;
      const { status, reason } = request.body;

      if (!status) {
        return reply.status(400).send({
          error: 'Bad request',
          message: 'Request body must include "status" field',
        });
      }

      const validStatuses = [
        'proposed', 'accepted', 'rejected', 'in_progress',
        'implemented', 'validated', 'archived',
      ];
      if (!validStatuses.includes(status)) {
        return reply.status(400).send({
          error: 'Bad request',
          message: `Invalid status "${status}". Valid values: ${validStatuses.join(', ')}`,
        });
      }


      try {
        const updated = await state.setOpportunityStatus(request.query.projectId, id, status, reason);
        return reply.status(200).send({ data: updated });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to update opportunity status', { error: message, id });
        // Distinguish a missing opportunity (404) from a rejected state
        // transition (400) — collapsing both to 404 mislabeled a valid client
        // error and hid the real reason from the caller.
        if (message.startsWith('Invalid status transition')) {
          return reply.status(400).send({
            error: 'Bad request',
            message,
          });
        }
        return reply.status(404).send({
          error: 'Not found',
          message,
        });
      }
    },
  );

  /**
   * GET /api/v1/opportunities/export/:format
   *
   * Export all opportunities in the specified format (json, markdown, sarif).
   */
  app.get<{ Params: ExportParams; Querystring: { projectId?: string } }>(
    '/api/v1/opportunities/export/:format',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { format } = request.params;

      const validFormats = ['json', 'markdown', 'sarif'];
      if (!validFormats.includes(format)) {
        return reply.status(400).send({
          error: 'Bad request',
          message: `Invalid format "${format}". Valid values: ${validFormats.join(', ')}`,
        });
      }


      const manager = await state.loadOpportunitiesForProject(request.query.projectId);

      try {
        const exported = manager.export(format as ExportFormat);

        const contentTypes: Record<string, string> = {
          json: 'application/json',
          markdown: 'text/markdown',
          sarif: 'application/json',
        };

        const fileExtensions: Record<string, string> = {
          json: 'json',
          markdown: 'md',
          sarif: 'sarif.json',
        };

        const contentType = contentTypes[format] ?? 'text/plain';
        const ext = fileExtensions[format] ?? 'txt';

        return reply
          .status(200)
          .header('Content-Type', contentType)
          .header(
            'Content-Disposition',
            `attachment; filename="opportunities.${ext}"`,
          )
          .send(exported);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to export opportunities', { error: message, format });
        return reply.status(500).send({
          error: 'Export failed',
          message,
        });
      }
    },
  );

  /**
   * GET /api/v1/opportunities/categories
   *
   * Return opportunity categories with counts.
   */
  app.get<{ Querystring: { projectId?: string } }>('/api/v1/opportunities/categories', { preHandler: [authMiddleware] }, async (request, reply) => {

    const manager = await state.loadOpportunitiesForProject(request.query.projectId);
    const all = manager.list({});

    // Group by category
    const categoryMap = new Map<string, number>();
    for (const opp of all) {
      categoryMap.set(opp.category, (categoryMap.get(opp.category) ?? 0) + 1);
    }

    const categories = Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return reply.status(200).send({ data: categories, total: categories.length });
  });
}

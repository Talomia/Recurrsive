/**
 * @module @recurrsive/server/routes/graph
 *
 * Knowledge graph query routes — entity listing, detail, and
 * neighborhood traversal.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import type { Entity, EntityType } from '@recurrsive/core';
import { createLogger } from '@recurrsive/core';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';

const logger = createLogger({ context: { component: 'server:routes:graph' } });

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

interface GraphEntitiesQuery {
  type?: EntityType;
  search?: string;
  limit?: string;
}

interface EntityParams {
  id: string;
}

interface NeighborsQuery {
  depth?: string;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register knowledge graph query routes.
 *
 * @param app - Fastify instance.
 */
export async function registerGraphRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/graph/stats
   *
   * Return aggregate statistics about the knowledge graph: entity and
   * relationship counts, grouped by type.
   */
  app.get('/api/v1/graph/stats', { preHandler: [authMiddleware] }, async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze first.',
      });
    }

    try {
      const graph = state.getGraph();
      const stats = await graph.getStats();

      return reply.status(200).send({
        data: {
          total_entities: stats.totalEntities,
          total_relationships: stats.totalRelationships,
          entities_by_type: stats.entityCountsByType,
          relationships_by_type: stats.relationshipCountsByType,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to fetch graph stats', { error: message });
      return reply.status(500).send({
        error: 'Graph query failed',
        message,
      });
    }
  });

  /**
   * GET /api/v1/graph/entities
   *
   * List entities in the knowledge graph, optionally filtered by type
   * and search string. Returns up to `limit` entities (default 50).
   */
  app.get<{ Querystring: GraphEntitiesQuery }>(
    '/api/v1/graph/entities',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (!state.isInitialized()) {
        return reply.status(503).send({
          error: 'Server not initialized',
          message: 'Run POST /api/v1/analyze first.',
        });
      }

      const { type, search, limit: limitStr } = request.query;
      const parsedLimit = limitStr ? parseInt(limitStr, 10) : 50;
      const limit = Number.isNaN(parsedLimit) ? 50 : Math.max(1, Math.min(parsedLimit, 500));

      try {
        const graph = state.getGraph();

        if (type) {
          // Query by type
          let entities = await graph.getEntities(type);

          // Apply search filter if provided
          if (search) {
            const searchLower = search.toLowerCase();
            entities = entities.filter(
              (e) =>
                e.name.toLowerCase().includes(searchLower) ||
                e.qualified_name.toLowerCase().includes(searchLower) ||
                (e.description?.toLowerCase().includes(searchLower) ?? false),
            );
          }

          const total = entities.length;
          entities = entities.slice(0, limit);

          return reply.status(200).send({
            data: entities,
            total,
            limit,
          });
        }

        // No type filter — iterate through known entity types
        const stats = await graph.getStats();
        const allEntities: Entity[] = [];
        for (const entityType of Object.keys(stats.entityCountsByType)) {
          try {
            const batch = await graph.getEntities(entityType as EntityType);
            allEntities.push(...batch);
          } catch (err: unknown) {
            // Some entity types may not be queryable; log and continue
            request.log.warn({ entityType, err: err instanceof Error ? err.message : String(err) }, 'Skipping entity type');
          }
        }

        // Apply search filter if provided
        let filtered = allEntities;
        if (search) {
          const searchLower = search.toLowerCase();
          filtered = allEntities.filter(
            (e) =>
              e.name.toLowerCase().includes(searchLower) ||
              e.qualified_name.toLowerCase().includes(searchLower) ||
              (e.description?.toLowerCase().includes(searchLower) ?? false),
          );
        }

        const total = filtered.length;
        const paged = filtered.slice(0, limit);

        return reply.status(200).send({
          data: paged,
          total,
          limit,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to list graph entities', { error: message });
        return reply.status(500).send({
          error: 'Graph query failed',
          message,
        });
      }
    },
  );

  /**
   * GET /api/v1/graph/entities/:id
   *
   * Retrieve a single entity by UUID, including its relationships.
   */
  app.get<{ Params: EntityParams }>(
    '/api/v1/graph/entities/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (!state.isInitialized()) {
        return reply.status(503).send({
          error: 'Server not initialized',
          message: 'Run POST /api/v1/analyze first.',
        });
      }

      const { id } = request.params;

      try {
        const graph = state.getGraph();
        const entity = await graph.getEntity(id);

        if (!entity) {
          return reply.status(404).send({
            error: 'Not found',
            message: `Entity ${id} not found`,
          });
        }

        const relationships = await graph.getRelationships(id);

        return reply.status(200).send({
          data: {
            entity,
            relationships,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to fetch entity by ID', { error: message });
        return reply.status(500).send({
          error: 'Graph query failed',
          message,
        });
      }
    },
  );

  /**
   * GET /api/v1/graph/entities/:id/neighbors
   *
   * Traverse the knowledge graph outward from an entity to find its
   * neighborhood up to `depth` hops (default 1).
   */
  app.get<{ Params: EntityParams; Querystring: NeighborsQuery }>(
    '/api/v1/graph/entities/:id/neighbors',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (!state.isInitialized()) {
        return reply.status(503).send({
          error: 'Server not initialized',
          message: 'Run POST /api/v1/analyze first.',
        });
      }

      const { id } = request.params;
      const depth = request.query.depth ? parseInt(request.query.depth, 10) : 1;

      if (depth < 1 || depth > 5) {
        return reply.status(400).send({
          error: 'Bad request',
          message: 'Depth must be between 1 and 5',
        });
      }

      try {
        const graph = state.getGraph();

        // Verify the entity exists
        const entity = await graph.getEntity(id);
        if (!entity) {
          return reply.status(404).send({
            error: 'Not found',
            message: `Entity ${id} not found`,
          });
        }

        const neighborhood = await graph.getNeighbors(id, depth);

        return reply.status(200).send({
          data: {
            center: entity,
            entities: neighborhood.entities,
            relationships: neighborhood.relationships,
            depth,
            entity_count: neighborhood.entities.length,
            relationship_count: neighborhood.relationships.length,
          },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to fetch entity neighbors', { error: message });
        return reply.status(500).send({
          error: 'Graph query failed',
          message,
        });
      }
    },
  );

  /**
   * GET /api/v1/graph/search
   *
   * Full-text search for entities using FTS5. Returns BM25-ranked
   * results matching the query across entity name, qualified_name,
   * and description.
   *
   * Query parameters:
   * - `q` (required) — Search query string.
   * - `type` (optional) — Filter by entity type.
   * - `limit` (optional) — Maximum results (default 50, max 200).
   */
  app.get<{ Querystring: { q?: string; type?: string; limit?: string } }>(
    '/api/v1/graph/search',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (!state.isInitialized()) {
        return reply.status(503).send({
          error: 'Server not initialized',
          message: 'Run POST /api/v1/analyze first.',
        });
      }

      const { q, type, limit: limitStr } = request.query;

      if (!q || q.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad request',
          message: 'Query parameter "q" is required.',
        });
      }

      const parsedLimit = limitStr ? parseInt(limitStr, 10) : 50;
      const limit = Number.isNaN(parsedLimit) ? 50 : Math.max(1, Math.min(parsedLimit, 200));

      try {
        const graph = state.getGraph();

        // Try FTS5 search if the client supports it
        if ('searchEntities' in graph && typeof (graph as any).searchEntities === 'function') {
          const results = await (graph as any).searchEntities(q.trim(), {
            type: type || undefined,
            limit,
          });

          return reply.status(200).send({
            data: results,
            total: results.length,
            limit,
            query: q.trim(),
          });
        }

        // Fallback for non-SQLite providers: LIKE-based search
        if (type) {
          let entities = await graph.getEntities(type as EntityType);
          const searchLower = q.toLowerCase();
          entities = entities.filter(
            (e) =>
              e.name.toLowerCase().includes(searchLower) ||
              e.qualified_name.toLowerCase().includes(searchLower) ||
              (e.description?.toLowerCase().includes(searchLower) ?? false),
          );

          return reply.status(200).send({
            data: entities.slice(0, limit),
            total: entities.length,
            limit,
            query: q.trim(),
          });
        }

        // No type specified — search across the most common entity types
        // to avoid raw SQL string interpolation (prevents injection).
        const stats = await graph.getStats();
        const searchLower = q.trim().toLowerCase();
        const entityTypes = Object.keys(stats.entityCountsByType ?? {});
        const allResults: unknown[] = [];

        for (const et of entityTypes) {
          try {
            const entities = await graph.getEntities(et as EntityType);
            const matches = entities.filter(
              (e) =>
                e.name.toLowerCase().includes(searchLower) ||
                e.qualified_name.toLowerCase().includes(searchLower),
            );
            allResults.push(...matches);
            if (allResults.length >= limit) break;
          } catch (err) {
            logger.warn('Skipping entity type query during search', { error: err instanceof Error ? err.message : String(err), entityType: et });
          }
        }

        return reply.status(200).send({
          data: allResults.slice(0, limit),
          total: allResults.length,
          limit,
          query: q.trim(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to search graph entities', { error: message });
        return reply.status(500).send({
          error: 'Graph search failed',
          message,
        });
      }
    },
  );
}

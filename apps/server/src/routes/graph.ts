/**
 * @module @recurrsive/server/routes/graph
 *
 * Knowledge graph query routes — entity listing, detail, and
 * neighborhood traversal.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import type { EntityType } from '@recurrsive/core';
import { state } from '../state.js';

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
  app.get('/api/v1/graph/stats', async (_request, reply) => {
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

        // No type filter — use a raw query to get all entities
        // We query through the graph's Cypher interface
        const allEntities = await graph.query(
          `MATCH (n) RETURN n LIMIT ${limit}`,
        );

        return reply.status(200).send({
          data: allEntities,
          limit,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
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
        return reply.status(500).send({
          error: 'Graph query failed',
          message,
        });
      }
    },
  );
}

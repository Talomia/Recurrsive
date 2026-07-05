/**
 * @module @recurrsive/server/routes/search
 *
 * Cross-entity keyword search route.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger } from '@recurrsive/core';
import { state } from '../state.js';

const logger = createLogger({ context: { component: 'server:routes:search' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchQuery {
  q?: string;
  scope?: string;
}

interface SearchItem {
  type: 'finding' | 'opportunity' | 'entity';
  id: string;
  name: string;
  description: string;
}

interface SearchResult {
  type: string;
  id: string;
  name: string;
  match: string;
  score: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSearchableItems(): Promise<SearchItem[]> {
  const cache = state.isInitialized() ? state.getAnalysisCache() : null;
  const items: SearchItem[] = [];

  // Add live findings from analysis cache
  if (cache?.findings?.length) {
    for (const f of cache.findings) {
      items.push({
        type: 'finding',
        id: f.id,
        name: f.title,
        description: f.description,
      });
    }
  }

  // Add live opportunities from analysis cache
  if (cache?.opportunities?.length) {
    for (const o of cache.opportunities) {
      items.push({
        type: 'opportunity',
        id: o.id,
        name: o.title,
        description: o.problem,
      });
    }
  }

  // Query entities from the knowledge graph
  if (state.isInitialized()) {
    try {
      const graph = state.getGraph();
      const stats = await graph.getStats();
      for (const entityType of Object.keys(stats.entityCountsByType)) {
        try {
          const entities = await graph.getEntities(entityType as import('@recurrsive/core').EntityType);
          for (const entity of entities.slice(0, 50)) {
            items.push({
              type: 'entity',
              id: entity.id,
              name: entity.name,
              description: entity.description ?? entityType,
            });
          }
        } catch {
          // Some entity types may not be queryable — skip
        }
      }
    } catch {
      // Graph query failed — skip entities
    }
  }

  return items;
}

async function searchItems(query: string, scope: string): Promise<SearchResult[]> {
  const q = query.toLowerCase();

  let items = await getSearchableItems();
  if (scope !== 'all') {
    // Map plural scope names to singular type names
    const scopeMap: Record<string, string> = {
      findings: 'finding',
      opportunities: 'opportunity',
      entities: 'entity',
    };
    const filterType = scopeMap[scope] ?? scope;
    items = items.filter((item) => item.type === filterType);
  }

  const results: SearchResult[] = [];
  for (const item of items) {
    const nameMatch = item.name.toLowerCase().includes(q);
    const descMatch = item.description.toLowerCase().includes(q);

    if (nameMatch || descMatch) {
      // Score: name matches are weighted higher
      const score = nameMatch ? 0.9 : 0.6;
      results.push({
        type: item.type,
        id: item.id,
        name: item.name,
        match: nameMatch ? item.name : item.description,
        score,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register search routes.
 *
 * @param app - Fastify instance.
 */
export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/search
   *
   * Search across findings, opportunities, and entities by keyword.
   * Query parameters:
   * - q (required) — search query string
   * - scope (optional) — 'findings' | 'opportunities' | 'entities' | 'all' (default: 'all')
   */
  app.get<{ Querystring: SearchQuery }>(
    '/api/v1/search',
    async (request, reply) => {
      const { q, scope = 'all' } = request.query;

      if (!q || typeof q !== 'string' || q.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad request',
          message: 'Query parameter "q" is required',
        });
      }

      const validScopes = ['findings', 'opportunities', 'entities', 'all'];
      if (!validScopes.includes(scope)) {
        return reply.status(400).send({
          error: 'Bad request',
          message: `Invalid scope "${scope}". Valid scopes: ${validScopes.join(', ')}`,
        });
      }

      const results = await searchItems(q.trim(), scope);

      logger.debug(`Search for "${q}" (scope=${scope}) returned ${results.length} results`);

      return reply.send({
        data: results,
        total: results.length,
        query: q.trim(),
      });
    },
  );
}

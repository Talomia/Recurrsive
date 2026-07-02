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
// Mock data (20 searchable items)
// ---------------------------------------------------------------------------

const SEARCH_ITEMS: SearchItem[] = [
  // Findings (7)
  { type: 'finding', id: 'f-001', name: 'SQL Injection Risk', description: 'Unsanitized user input in database queries' },
  { type: 'finding', id: 'f-002', name: 'Memory Leak Detected', description: 'Event listeners not cleaned up in component lifecycle' },
  { type: 'finding', id: 'f-003', name: 'Unused Dependencies', description: 'Several npm packages are installed but never imported' },
  { type: 'finding', id: 'f-004', name: 'Hardcoded Credentials', description: 'API keys found in source code configuration files' },
  { type: 'finding', id: 'f-005', name: 'Missing Error Boundaries', description: 'React components lack error boundary wrappers' },
  { type: 'finding', id: 'f-006', name: 'Circular Dependency', description: 'Module A imports B which imports A creating a circular loop' },
  { type: 'finding', id: 'f-007', name: 'Deprecated API Usage', description: 'Legacy API calls that will be removed in next major version' },

  // Opportunities (7)
  { type: 'opportunity', id: 'o-001', name: 'Cache Layer Optimization', description: 'Add Redis caching to reduce database query load by 60%' },
  { type: 'opportunity', id: 'o-002', name: 'Bundle Size Reduction', description: 'Tree-shaking and code splitting could reduce bundle by 40%' },
  { type: 'opportunity', id: 'o-003', name: 'Authentication Refactor', description: 'Migrate from session-based to JWT token authentication' },
  { type: 'opportunity', id: 'o-004', name: 'Database Index Tuning', description: 'Missing indexes on frequently queried columns' },
  { type: 'opportunity', id: 'o-005', name: 'API Rate Limiting', description: 'Implement rate limiting to prevent abuse and improve stability' },
  { type: 'opportunity', id: 'o-006', name: 'Monitoring Dashboard', description: 'Set up Grafana dashboards for real-time performance monitoring' },
  { type: 'opportunity', id: 'o-007', name: 'Test Coverage Improvement', description: 'Increase unit test coverage from 45% to 80%' },

  // Entities (6)
  { type: 'entity', id: 'e-001', name: 'AuthService', description: 'Core authentication and authorization service module' },
  { type: 'entity', id: 'e-002', name: 'UserRepository', description: 'Data access layer for user management operations' },
  { type: 'entity', id: 'e-003', name: 'PaymentGateway', description: 'Integration with payment processing providers' },
  { type: 'entity', id: 'e-004', name: 'NotificationEngine', description: 'Email and push notification delivery system' },
  { type: 'entity', id: 'e-005', name: 'CacheManager', description: 'Multi-level cache orchestration and invalidation' },
  { type: 'entity', id: 'e-006', name: 'ConfigLoader', description: 'Configuration loading and environment variable resolution' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getSearchableItems(): SearchItem[] {
  const cache = state.isInitialized() ? state.getAnalysisCache() : null;
  const items: SearchItem[] = [];

  // Add live findings if available, otherwise use demo items
  if (cache?.findings?.length) {
    for (const f of cache.findings) {
      items.push({
        type: 'finding',
        id: f.id,
        name: f.title,
        description: f.description,
      });
    }
  } else {
    items.push(...SEARCH_ITEMS.filter((i) => i.type === 'finding'));
  }

  // Add live opportunities if available
  if (cache?.opportunities?.length) {
    for (const o of cache.opportunities) {
      items.push({
        type: 'opportunity',
        id: o.id,
        name: o.title,
        description: o.problem,
      });
    }
  } else {
    items.push(...SEARCH_ITEMS.filter((i) => i.type === 'opportunity'));
  }

  // Always include entity demo items (entities come from graph, not analysis cache)
  items.push(...SEARCH_ITEMS.filter((i) => i.type === 'entity'));

  return items;
}

function searchItems(query: string, scope: string): SearchResult[] {
  const q = query.toLowerCase();

  let items = getSearchableItems();
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
        return reply.code(400).send({
          error: 'Bad request',
          message: 'Query parameter "q" is required',
        });
      }

      const validScopes = ['findings', 'opportunities', 'entities', 'all'];
      if (!validScopes.includes(scope)) {
        return reply.code(400).send({
          error: 'Bad request',
          message: `Invalid scope "${scope}". Valid scopes: ${validScopes.join(', ')}`,
        });
      }

      const results = searchItems(q.trim(), scope);

      logger.debug(`Search for "${q}" (scope=${scope}) returned ${results.length} results`);

      return reply.send({
        results,
        total: results.length,
        query: q.trim(),
      });
    },
  );
}

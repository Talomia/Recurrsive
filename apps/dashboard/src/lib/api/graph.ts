/**
 * @module Graph API
 *
 * Knowledge graph queries and entity operations.
 */

import { apiFetch, ApiError } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GraphStats {
  total_entities: number;
  total_relationships: number;
  entities_by_type: Record<string, number>;
  relationships_by_type: Record<string, number>;
}

export interface GraphEntity {
  id: string;
  name: string;
  type: string;
  qualified_name?: string;
  description?: string;
  properties?: Record<string, unknown>;
}

export interface SystemNode {
  id: string;
  name: string;
  type: string;
  health: number;
  connections: string[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get graph statistics from `GET /api/v1/graph/stats`.
 *
 * Throws on failure — zeroed stats would render a fabricated "empty graph".
 */
export async function getGraphStats(): Promise<GraphStats> {
  return await apiFetch<GraphStats>("/api/v1/graph/stats");
}

/**
 * Get entities by type from `GET /api/v1/graph/entities`.
 */
export async function getGraphEntities(type?: string, search?: string, limit = 50): Promise<GraphEntity[]> {
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  if (search) query.set("search", search);
  query.set("limit", String(limit));

  return await apiFetch<GraphEntity[]>(
    `/api/v1/graph/entities?${query.toString()}`,
  );
}

/**
 * Full-text search for entities via `GET /api/v1/graph/search`.
 *
 * Uses FTS5 with BM25 ranking for fast, relevant results.
 */
export async function searchGraphEntities(
  q: string,
  type?: string,
  limit = 50,
): Promise<GraphEntity[]> {
  const query = new URLSearchParams();
  query.set("q", q);
  if (type) query.set("type", type);
  query.set("limit", String(limit));

  return await apiFetch<GraphEntity[]>(
    `/api/v1/graph/search?${query.toString()}`,
  );
}

/**
 * Get entity with relationships from `GET /api/v1/graph/entities/:id`.
 *
 * Returns null only for a genuine 404; other failures throw.
 */
export async function getEntityWithRelationships(id: string): Promise<{
  entity: GraphEntity;
  relationships: Array<{ type: string; source_id: string; target_id: string }>;
} | null> {
  try {
    return await apiFetch<{
      entity: GraphEntity;
      relationships: Array<{ type: string; source_id: string; target_id: string }>;
    }>(`/api/v1/graph/entities/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

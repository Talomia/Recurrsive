/**
 * @module Graph API
 *
 * Knowledge graph queries and entity operations.
 */

import { apiFetch } from './client';

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

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_GRAPH_STATS: GraphStats = {
  total_entities: 234,
  total_relationships: 567,
  entities_by_type: {
    module: 42, function: 89, class: 28, interface: 31, api_endpoint: 16,
    configuration: 8, ai_model: 4, ai_prompt: 6, database_table: 10,
  },
  relationships_by_type: {
    imports: 156, depends_on: 98, exports: 87, calls: 72, implements: 34,
    contains: 45, references: 38, uses_model: 12, queries: 25,
  },
};

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get graph statistics from `GET /api/v1/graph/stats`.
 */
export async function getGraphStats(): Promise<GraphStats> {
  try {
    const raw = await apiFetch<{ data: GraphStats } | null>("/api/v1/graph/stats", null);
    return raw?.data ?? MOCK_GRAPH_STATS;
  } catch {
    return MOCK_GRAPH_STATS;
  }
}

/**
 * Get entities by type from `GET /api/v1/graph/entities`.
 */
export async function getGraphEntities(type?: string, search?: string, limit = 50): Promise<GraphEntity[]> {
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  if (search) query.set("search", search);
  query.set("limit", String(limit));

  try {
    const raw = await apiFetch<{ data: GraphEntity[] } | null>(
      `/api/v1/graph/entities?${query.toString()}`,
      null,
    );
    return raw?.data ?? [];
  } catch {
    return [];
  }
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

  try {
    const raw = await apiFetch<{ data: GraphEntity[] } | null>(
      `/api/v1/graph/search?${query.toString()}`,
      null,
    );
    return raw?.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Get entity with relationships from `GET /api/v1/graph/entities/:id`.
 */
export async function getEntityWithRelationships(id: string): Promise<{
  entity: GraphEntity;
  relationships: Array<{ type: string; source_id: string; target_id: string }>;
} | null> {
  try {
    const raw = await apiFetch<{
      data: {
        entity: GraphEntity;
        relationships: Array<{ type: string; source_id: string; target_id: string }>;
      };
    } | null>(`/api/v1/graph/entities/${encodeURIComponent(id)}`, null);
    return raw?.data ?? null;
  } catch {
    return null;
  }
}

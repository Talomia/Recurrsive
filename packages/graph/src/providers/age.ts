/**
 * @module providers/age
 *
 * PostgreSQL + Apache AGE implementation of the graph client.
 *
 * Uses the `pg` package for connection pooling and wraps all Cypher
 * queries in AGE's `cypher()` SQL function. Results in `agtype` format
 * are parsed back into Recurrsive Entity / Relationship objects.
 *
 * @packageDocumentation
 */

import pg from 'pg';
import type { Entity, EntityType, Relationship } from '@recurrsive/core';
import { GraphError } from '@recurrsive/core';
import type { GraphClient } from '@recurrsive/core';
import { migrate } from '../migrations/001_initial_schema.js';

const { Pool } = pg;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for the AGE graph provider. */
export interface AgeConfig {
  /** PostgreSQL connection string. */
  connectionString: string;
  /** Maximum pool size (default `10`). */
  poolSize?: number;
  /** Connection timeout in milliseconds (default `10_000`). */
  connectionTimeoutMs?: number;
  /** Idle timeout in milliseconds (default `30_000`). */
  idleTimeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Cypher Sanitisation
// ---------------------------------------------------------------------------

/**
 * Escape a string for safe embedding in a Cypher literal wrapped in single
 * quotes.  Handles backslashes, single quotes, and null bytes.
 *
 * @example escapeCypher("it's a \"test\"") → "it\\'s a \"test\""
 */
function escapeCypher(value: string): string {
  return value
    .replace(/\\/g, '\\\\')        // escape backslashes first
    .replace(/'/g, "\\'")          // escape single quotes
    .replace(/\0/g, '');           // strip null bytes
}

// ---------------------------------------------------------------------------
// Graph Statistics
// ---------------------------------------------------------------------------

/** Summary statistics for the knowledge graph. */
export interface GraphStats {
  /** Number of entities grouped by type. */
  entityCountsByType: Record<string, number>;
  /** Total entity count. */
  totalEntities: number;
  /** Number of relationships grouped by type. */
  relationshipCountsByType: Record<string, number>;
  /** Total relationship count. */
  totalRelationships: number;
}

// ---------------------------------------------------------------------------
// Extended Graph Client Interface
// ---------------------------------------------------------------------------

/**
 * Extended graph client that adds mutation and lifecycle methods on top
 * of the read-only {@link GraphClient} from `@recurrsive/core`.
 */
export interface ExtendedGraphClient extends GraphClient {
  /**
   * Create or update an entity (upsert by ID).
   * @param entity - The entity to upsert.
   * @returns The upserted entity.
   */
  upsertEntity(entity: Entity): Promise<Entity>;

  /**
   * Create or update a relationship (upsert by ID).
   * @param relationship - The relationship to upsert.
   * @returns The upserted relationship.
   */
  upsertRelationship(relationship: Relationship): Promise<Relationship>;

  /**
   * Delete an entity and all of its relationships.
   * @param id - UUID of the entity to remove.
   * @returns `true` if the entity was found and deleted.
   */
  deleteEntity(id: string): Promise<boolean>;

  /**
   * Delete a single relationship.
   * @param id - UUID of the relationship to remove.
   * @returns `true` if the relationship was found and deleted.
   */
  deleteRelationship(id: string): Promise<boolean>;

  /**
   * Return aggregate statistics about the graph.
   * @returns Graph statistics.
   */
  getStats(): Promise<GraphStats>;

  /**
   * Close all connections and release resources.
   */
  dispose(): Promise<void>;
}

// ---------------------------------------------------------------------------
// agtype Parsing Helpers
// ---------------------------------------------------------------------------

/**
 * Parse an AGE `agtype` value into a plain JS object.
 *
 * AGE returns results as JSON-ish strings with a trailing `::vertex`
 * or `::edge` type annotation that must be stripped before JSON.parse.
 *
 * @param raw - Raw agtype string from a query result.
 * @returns Parsed JavaScript value.
 */
function parseAgtype(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw;

  // Strip trailing AGE type annotations like ::vertex, ::edge, ::path
  const cleaned = raw.replace(/::(vertex|edge|path|agtype)\b/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch { // ignore AGE parse errors
    // If it's not valid JSON, return the raw string
    return cleaned;
  }
}

/**
 * Convert a parsed AGE vertex object into a Recurrsive Entity.
 *
 * @param vertex - Parsed vertex from AGE.
 * @returns Entity object.
 */
function vertexToEntity(vertex: Record<string, unknown>): Entity {
  const props = (vertex['properties'] ?? vertex) as Record<string, unknown>;
  return {
    id: String(props['id'] ?? ''),
    type: String(props['type'] ?? 'function') as EntityType,
    name: String(props['name'] ?? ''),
    qualified_name: String(props['qualified_name'] ?? ''),
    description: props['description'] !== null ? String(props['description']) : undefined,
    source: String(props['source'] ?? ''),
    source_location: props['source_location'] !== null
      ? (typeof props['source_location'] === 'string'
        ? JSON.parse(props['source_location'])
        : props['source_location']) as Entity['source_location']
      : undefined,
    properties: (typeof props['properties'] === 'object' && props['properties'] !== null
      ? props['properties'] as Record<string, unknown>
      : {}),
    tags: Array.isArray(props['tags'])
      ? (props['tags'] as unknown[]).map(String)
      : [],
    created_at: String(props['created_at'] ?? new Date().toISOString()),
    updated_at: String(props['updated_at'] ?? new Date().toISOString()),
    last_seen_at: String(props['last_seen_at'] ?? new Date().toISOString()),
  };
}

/**
 * Convert a parsed AGE edge object into a Recurrsive Relationship.
 *
 * @param edge - Parsed edge from AGE.
 * @returns Relationship object.
 */
function edgeToRelationship(edge: Record<string, unknown>): Relationship {
  const props = (edge['properties'] ?? edge) as Record<string, unknown>;
  return {
    id: String(props['id'] ?? ''),
    type: String(props['type'] ?? 'references') as Relationship['type'],
    source_id: String(props['source_id'] ?? edge['start_id'] ?? ''),
    target_id: String(props['target_id'] ?? edge['end_id'] ?? ''),
    properties: (typeof props['properties'] === 'object' && props['properties'] !== null
      ? props['properties'] as Record<string, unknown>
      : {}),
    confidence: typeof props['confidence'] === 'number' ? props['confidence'] : 1,
    source: String(props['source'] ?? ''),
    created_at: String(props['created_at'] ?? new Date().toISOString()),
    updated_at: String(props['updated_at'] ?? new Date().toISOString()),
  };
}

/**
 * Serialize an Entity's properties for storage in an AGE vertex.
 *
 * @param entity - The entity to serialize.
 * @returns JSON-safe property map.
 */
function entityToAgeProps(entity: Entity): string {
  const props: Record<string, unknown> = {
    id: entity.id,
    type: entity.type,
    name: entity.name,
    qualified_name: entity.qualified_name,
    source: entity.source,
    properties: JSON.stringify(entity.properties),
    tags: JSON.stringify(entity.tags),
    created_at: entity.created_at,
    updated_at: entity.updated_at,
    last_seen_at: entity.last_seen_at,
  };
  if (entity.description != null) {
    props['description'] = entity.description;
  }
  if (entity.source_location != null) {
    props['source_location'] = JSON.stringify(entity.source_location);
  }

  // Build a Cypher map literal
  const parts = Object.entries(props).map(([k, v]) => {
    if (typeof v === 'string') {
      return `${k}: '${escapeCypher(v)}'`;
    }
    return `${k}: ${JSON.stringify(v)}`;
  });
  return `{${parts.join(', ')}}`;
}

/**
 * Serialize a Relationship's properties for storage as an AGE edge.
 *
 * @param rel - The relationship to serialize.
 * @returns JSON-safe property map.
 */
function relationshipToAgeProps(rel: Relationship): string {
  const props: Record<string, unknown> = {
    id: rel.id,
    type: rel.type,
    source_id: rel.source_id,
    target_id: rel.target_id,
    properties: JSON.stringify(rel.properties),
    confidence: rel.confidence,
    source: rel.source,
    created_at: rel.created_at,
    updated_at: rel.updated_at,
  };

  const parts = Object.entries(props).map(([k, v]) => {
    if (typeof v === 'string') {
      return `${k}: '${escapeCypher(v)}'`;
    }
    return `${k}: ${JSON.stringify(v)}`;
  });
  return `{${parts.join(', ')}}`;
}

// ---------------------------------------------------------------------------
// AGE Provider Implementation
// ---------------------------------------------------------------------------

/**
 * PostgreSQL + Apache AGE implementation of {@link ExtendedGraphClient}.
 *
 * All Cypher queries are wrapped in AGE's `cypher()` SQL function and
 * executed through a connection pool.
 */
export class AgeGraphClient implements ExtendedGraphClient {
  private readonly pool: pg.Pool;
  private initialized = false;

  /**
   * @param config - AGE connection configuration.
   */
  constructor(config: AgeConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.poolSize ?? 10,
      connectionTimeoutMillis: config.connectionTimeoutMs ?? 10_000,
      idleTimeoutMillis: config.idleTimeoutMs ?? 30_000,
    });
  }

  // ── Internal Helpers ────────────────────────────────────────────────

  /**
   * Ensure the AGE extension is loaded and the search path is set on
   * the given client connection.
   */
  private async prepareConnection(client: pg.PoolClient): Promise<void> {
    await client.query(`SET search_path = ag_catalog, "$user", public;`);
    await client.query(`LOAD 'age';`);
  }

  /**
   * Execute a raw Cypher query via AGE and return parsed rows.
   *
   * @param cypher - Cypher query body (without the `cypher()` wrapper).
   * @param returnColumns - Column definition for the `AS (...)` clause.
   * @returns Parsed result rows.
   */
  private async executeCypher(
    cypher: string,
    returnColumns: string = 'result agtype',
  ): Promise<unknown[]> {
    const client = await this.pool.connect();
    try {
      await this.prepareConnection(client);
      const sql = `SELECT * FROM cypher('recurrsive', $$ ${cypher} $$) AS (${returnColumns});`;
      const result = await client.query(sql);
      return result.rows.map((row: Record<string, unknown>) => {
        const parsed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          parsed[key] = parseAgtype(value);
        }
        return parsed;
      });
    } finally {
      client.release();
    }
  }



  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Initialize the database schema if not already done.
   *
   * @throws {GraphError} If migration fails.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      const client = await this.pool.connect();
      try {
        await migrate(
          async (sql) => { await client.query(sql); },
          'postgresql_age',
        );
      } finally {
        client.release();
      }
      this.initialized = true;
    } catch (error) {
      throw new GraphError(
        'Failed to initialize AGE graph schema',
        'INIT_FAILED',
        error,
      );
    }
  }

  // ── GraphClient (read) Interface ────────────────────────────────────

  /**
   * Retrieve a single entity by ID.
   *
   * @param id - UUID of the entity.
   * @returns The entity, or `null` if not found.
   * @throws {GraphError} If the query fails.
   */
  async getEntity(id: string): Promise<Entity | null> {
    try {
      const rows = await this.executeCypher(
        `MATCH (n {id: '${escapeCypher(id)}'}) RETURN n`,
        'n agtype',
      );
      if (rows.length === 0) return null;
      const row = rows[0] as Record<string, unknown>;
      return vertexToEntity(row['n'] as Record<string, unknown>);
    } catch (error) {
      throw new GraphError(
        `Failed to get entity "${id}"`,
        'QUERY_FAILED',
        error,
      );
    }
  }

  /**
   * List entities of a given type, optionally filtered by properties.
   *
   * @param type - The entity type to query.
   * @param filter - Optional key-value filter applied to `properties`.
   * @returns Matching entities.
   * @throws {GraphError} If the query fails.
   */
  async getEntities(type: EntityType, filter?: Record<string, unknown>): Promise<Entity[]> {
    try {
      let whereClause = '';
      if (filter && Object.keys(filter).length > 0) {
        const conditions = Object.entries(filter).map(([k, v]) => {
          // Validate filter key to prevent Cypher injection
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) {
            throw new GraphError(
              `Invalid filter key "${k}" — must be a valid identifier`,
              'INVALID_FILTER',
            );
          }
          const val = typeof v === 'string' ? `'${escapeCypher(v)}'` : JSON.stringify(v);
          return `n.${k} = ${val}`;
        });
        whereClause = `WHERE ${conditions.join(' AND ')}`;
      }

      const rows = await this.executeCypher(
        `MATCH (n:${type}) ${whereClause} RETURN n`,
        'n agtype',
      );
      return rows.map((row) => {
        const r = row as Record<string, unknown>;
        return vertexToEntity(r['n'] as Record<string, unknown>);
      });
    } catch (error) {
      throw new GraphError(
        `Failed to get entities of type "${type}"`,
        'QUERY_FAILED',
        error,
      );
    }
  }

  /**
   * Get all relationships connected to an entity.
   *
   * @param entityId - UUID of the entity.
   * @param direction - Edge direction filter (default: `'both'`).
   * @returns Matching relationships.
   * @throws {GraphError} If the query fails.
   */
  async getRelationships(
    entityId: string,
    direction: 'in' | 'out' | 'both' = 'both',
  ): Promise<Relationship[]> {
    try {
      const safeId = escapeCypher(entityId);
      let cypher: string;

      switch (direction) {
        case 'out':
          cypher = `MATCH (n {id: '${safeId}'})-[r]->(m) RETURN r`;
          break;
        case 'in':
          cypher = `MATCH (n {id: '${safeId}'})<-[r]-(m) RETURN r`;
          break;
        case 'both':
        default:
          cypher = `MATCH (n {id: '${safeId}'})-[r]-(m) RETURN r`;
          break;
      }

      const rows = await this.executeCypher(cypher, 'r agtype');
      return rows.map((row) => {
        const r = row as Record<string, unknown>;
        return edgeToRelationship(r['r'] as Record<string, unknown>);
      });
    } catch (error) {
      throw new GraphError(
        `Failed to get relationships for entity "${entityId}"`,
        'QUERY_FAILED',
        error,
      );
    }
  }

  /**
   * Execute a raw Cypher query.
   *
   * @param cypher - Query string.
   * @param _params - Optional bind parameters (currently embedded inline).
   * @returns Array of result rows.
   * @throws {GraphError} If the query fails.
   */
  async query(cypher: string, _params?: Record<string, unknown>): Promise<unknown[]> {
    try {
      return await this.executeCypher(cypher);
    } catch (error) {
      throw new GraphError(
        'Cypher query failed',
        'QUERY_FAILED',
        error,
      );
    }
  }

  /**
   * Walk the graph outward from an entity up to `depth` hops.
   *
   * @param entityId - Starting entity UUID.
   * @param depth - Maximum traversal depth (default: `1`).
   * @returns Subgraph of entities and relationships.
   * @throws {GraphError} If the query fails.
   */
  async getNeighbors(
    entityId: string,
    depth: number = 1,
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    try {
      const safeId = escapeCypher(entityId);
      const rows = await this.executeCypher(
        `MATCH (start {id: '${safeId}'})-[r*1..${depth}]-(neighbor) RETURN DISTINCT neighbor, r`,
        'neighbor agtype, r agtype',
      );

      const entityMap = new Map<string, Entity>();
      const relMap = new Map<string, Relationship>();

      // Add the starting entity
      const startEntity = await this.getEntity(entityId);
      if (startEntity) {
        entityMap.set(startEntity.id, startEntity);
      }

      for (const row of rows) {
        const r = row as Record<string, unknown>;
        if (r['neighbor']) {
          const entity = vertexToEntity(r['neighbor'] as Record<string, unknown>);
          entityMap.set(entity.id, entity);
        }
        if (r['r']) {
          const relData = r['r'];
          if (Array.isArray(relData)) {
            for (const edge of relData) {
              const rel = edgeToRelationship(edge as Record<string, unknown>);
              relMap.set(rel.id, rel);
            }
          } else {
            const rel = edgeToRelationship(relData as Record<string, unknown>);
            relMap.set(rel.id, rel);
          }
        }
      }

      return {
        entities: Array.from(entityMap.values()),
        relationships: Array.from(relMap.values()),
      };
    } catch (error) {
      throw new GraphError(
        `Failed to get neighbors for entity "${entityId}"`,
        'QUERY_FAILED',
        error,
      );
    }
  }

  // ── Extended (Mutation) Methods ─────────────────────────────────────

  /**
   * Create or update an entity (idempotent upsert by ID).
   *
   * @param entity - The entity to upsert.
   * @returns The upserted entity.
   * @throws {GraphError} If the upsert fails.
   */
  async upsertEntity(entity: Entity): Promise<Entity> {
    try {
      const props = entityToAgeProps(entity);
      await this.executeCypher(
        `MERGE (n:${entity.type} {id: '${escapeCypher(entity.id)}'}) SET n += ${props} RETURN n`,
        'n agtype',
      );
      return entity;
    } catch (error) {
      throw new GraphError(
        `Failed to upsert entity "${entity.id}"`,
        'MUTATION_FAILED',
        error,
      );
    }
  }

  /**
   * Create or update a relationship (idempotent upsert by ID).
   *
   * @param relationship - The relationship to upsert.
   * @returns The upserted relationship.
   * @throws {GraphError} If the upsert fails.
   */
  async upsertRelationship(relationship: Relationship): Promise<Relationship> {
    try {
      const props = relationshipToAgeProps(relationship);
      const safeSrcId = escapeCypher(relationship.source_id);
      const safeTgtId = escapeCypher(relationship.target_id);
      await this.executeCypher(
        `MATCH (a {id: '${safeSrcId}'}), (b {id: '${safeTgtId}'}) MERGE (a)-[r:${relationship.type} {id: '${escapeCypher(relationship.id)}'}]->(b) SET r += ${props} RETURN r`,
        'r agtype',
      );
      return relationship;
    } catch (error) {
      throw new GraphError(
        `Failed to upsert relationship "${relationship.id}"`,
        'MUTATION_FAILED',
        error,
      );
    }
  }

  /**
   * Delete an entity and all of its relationships.
   *
   * @param id - UUID of the entity to remove.
   * @returns `true` if the entity was found and deleted.
   * @throws {GraphError} If the deletion fails.
   */
  async deleteEntity(id: string): Promise<boolean> {
    try {
      const safeId = escapeCypher(id);
      const rows = await this.executeCypher(
        `MATCH (n {id: '${safeId}'}) DETACH DELETE n RETURN count(n) AS deleted`,
        'deleted agtype',
      );
      if (rows.length === 0) return false;
      const row = rows[0] as Record<string, unknown>;
      return Number(row['deleted']) > 0;
    } catch (error) {
      throw new GraphError(
        `Failed to delete entity "${id}"`,
        'MUTATION_FAILED',
        error,
      );
    }
  }

  /**
   * Delete a single relationship.
   *
   * @param id - UUID of the relationship to remove.
   * @returns `true` if the relationship was found and deleted.
   * @throws {GraphError} If the deletion fails.
   */
  async deleteRelationship(id: string): Promise<boolean> {
    try {
      const safeId = escapeCypher(id);
      const rows = await this.executeCypher(
        `MATCH ()-[r {id: '${safeId}'}]-() DELETE r RETURN count(r) AS deleted`,
        'deleted agtype',
      );
      if (rows.length === 0) return false;
      const row = rows[0] as Record<string, unknown>;
      return Number(row['deleted']) > 0;
    } catch (error) {
      throw new GraphError(
        `Failed to delete relationship "${id}"`,
        'MUTATION_FAILED',
        error,
      );
    }
  }

  /**
   * Return aggregate statistics about the graph.
   *
   * @returns Graph statistics with entity and relationship counts by type.
   * @throws {GraphError} If the stats query fails.
   */
  async getStats(): Promise<GraphStats> {
    try {
      // Get entity counts by type
      const entityRows = await this.executeCypher(
        `MATCH (n) RETURN n.type AS type, count(n) AS cnt`,
        'type agtype, cnt agtype',
      );

      const entityCountsByType: Record<string, number> = {};
      let totalEntities = 0;
      for (const row of entityRows) {
        const r = row as Record<string, unknown>;
        const type = String(r['type'] ?? 'unknown').replace(/"/g, '');
        const count = Number(r['cnt'] ?? 0);
        entityCountsByType[type] = count;
        totalEntities += count;
      }

      // Get relationship counts by type
      const relRows = await this.executeCypher(
        `MATCH ()-[r]-() RETURN r.type AS type, count(r) AS cnt`,
        'type agtype, cnt agtype',
      );

      const relationshipCountsByType: Record<string, number> = {};
      let totalRelationships = 0;
      for (const row of relRows) {
        const r = row as Record<string, unknown>;
        const type = String(r['type'] ?? 'unknown').replace(/"/g, '');
        const count = Number(r['cnt'] ?? 0);
        relationshipCountsByType[type] = count;
        totalRelationships += count;
      }

      return {
        entityCountsByType,
        totalEntities,
        relationshipCountsByType,
        totalRelationships,
      };
    } catch (error) {
      throw new GraphError(
        'Failed to gather graph statistics',
        'QUERY_FAILED',
        error,
      );
    }
  }

  /**
   * Close all connections and release resources.
   */
  async dispose(): Promise<void> {
    await this.pool.end();
    this.initialized = false;
  }
}

/**
 * Create and optionally initialize a new AGE graph client.
 *
 * @param config - AGE connection configuration.
 * @param autoMigrate - If `true`, run schema migrations on creation (default `true`).
 * @returns Initialized {@link AgeGraphClient}.
 * @throws {GraphError} If connection or migration fails.
 */
export async function createAgeClient(
  config: AgeConfig,
  autoMigrate: boolean = true,
): Promise<AgeGraphClient> {
  const client = new AgeGraphClient(config);
  if (autoMigrate) {
    await client.initialize();
  }
  return client;
}

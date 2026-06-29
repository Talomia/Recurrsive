/**
 * @module providers/sqlite
 *
 * SQLite implementation of the graph client for local / CLI usage.
 *
 * Uses `better-sqlite3` for synchronous, embedded operation. Graph
 * traversal is implemented via recursive CTEs. All async methods are
 * thin wrappers over synchronous calls to conform to the
 * {@link GraphClient} interface.
 *
 * @packageDocumentation
 */

import Database from 'better-sqlite3';
import type { Entity, EntityType, Relationship } from '@recurrsive/core';
import { GraphError } from '@recurrsive/core';
import type { GraphClient } from '@recurrsive/core';
import type { ExtendedGraphClient, GraphStats } from './age.js';
import { migrate } from '../migrations/001_initial_schema.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for the SQLite graph provider. */
export interface SqliteConfig {
  /** File path for the SQLite database (use `:memory:` for in-memory). */
  path: string;
  /** Enable WAL mode for concurrent reads (default `true`). */
  walMode?: boolean;
}

// ---------------------------------------------------------------------------
// Row → Domain Mapping Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a raw SQLite row into a Recurrsive Entity.
 *
 * @param row - Raw row from the entities table.
 * @returns Entity object.
 */
function rowToEntity(row: Record<string, unknown>): Entity {
  return {
    id: String(row['id']),
    type: String(row['type']) as EntityType,
    name: String(row['name']),
    qualified_name: String(row['qualified_name']),
    description: row['description'] != null ? String(row['description']) : undefined,
    source: String(row['source']),
    source_location: row['source_location'] != null
      ? JSON.parse(String(row['source_location']))
      : undefined,
    properties: row['properties'] != null
      ? JSON.parse(String(row['properties']))
      : {},
    tags: row['tags'] != null
      ? JSON.parse(String(row['tags']))
      : [],
    created_at: String(row['created_at']),
    updated_at: String(row['updated_at']),
    last_seen_at: String(row['last_seen_at']),
  };
}

/**
 * Convert a raw SQLite row into a Recurrsive Relationship.
 *
 * @param row - Raw row from the relationships table.
 * @returns Relationship object.
 */
function rowToRelationship(row: Record<string, unknown>): Relationship {
  return {
    id: String(row['id']),
    type: String(row['type']) as Relationship['type'],
    source_id: String(row['source_id']),
    target_id: String(row['target_id']),
    properties: row['properties'] != null
      ? JSON.parse(String(row['properties']))
      : {},
    confidence: typeof row['confidence'] === 'number' ? row['confidence'] : 1,
    source: String(row['source']),
    created_at: String(row['created_at']),
    updated_at: String(row['updated_at']),
  };
}

// ---------------------------------------------------------------------------
// SQLite Provider Implementation
// ---------------------------------------------------------------------------

/**
 * SQLite implementation of {@link ExtendedGraphClient}.
 *
 * All methods are synchronous under the hood via `better-sqlite3` but
 * wrapped in `async` to satisfy the {@link GraphClient} contract.
 */
export class SqliteGraphClient implements ExtendedGraphClient {
  private db: Database.Database | null = null;
  private readonly dbPath: string;
  private readonly walMode: boolean;

  /**
   * @param config - SQLite configuration.
   */
  constructor(config: SqliteConfig) {
    this.dbPath = config.path;
    this.walMode = config.walMode ?? true;
  }

  // ── Internal Helpers ────────────────────────────────────────────────

  /**
   * Get the underlying database handle, opening the connection if
   * needed.
   *
   * @returns better-sqlite3 Database instance.
   * @throws {GraphError} If the database cannot be opened.
   */
  private getDb(): Database.Database {
    if (this.db) return this.db;
    try {
      this.db = new Database(this.dbPath);
      if (this.walMode) {
        this.db.pragma('journal_mode = WAL');
      }
      this.db.pragma('foreign_keys = ON');
      return this.db;
    } catch (error) {
      throw new GraphError(
        `Failed to open SQLite database at "${this.dbPath}"`,
        'CONNECTION_FAILED',
        error,
      );
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  /**
   * Initialize the database schema via migration.
   *
   * @throws {GraphError} If migration fails.
   */
  async initialize(): Promise<void> {
    try {
      const db = this.getDb();
      await migrate(
        (sql) => { db.exec(sql); },
        'sqlite',
      );
    } catch (error) {
      if (error instanceof GraphError) throw error;
      throw new GraphError(
        'Failed to initialize SQLite graph schema',
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
      const db = this.getDb();
      const row = db.prepare('SELECT * FROM entities WHERE id = ?').get(id) as
        | Record<string, unknown>
        | undefined;
      if (!row) return null;
      return rowToEntity(row);
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
   * @param filter - Optional key-value filter applied to properties JSON.
   * @returns Matching entities.
   * @throws {GraphError} If the query fails.
   */
  async getEntities(type: EntityType, filter?: Record<string, unknown>): Promise<Entity[]> {
    try {
      const db = this.getDb();
      const params: unknown[] = [type];
      let sql = 'SELECT * FROM entities WHERE type = ?';

      if (filter && Object.keys(filter).length > 0) {
        for (const [key, value] of Object.entries(filter)) {
          sql += ` AND json_extract(properties, '$.${key}') = ?`;
          params.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map(rowToEntity);
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
      const db = this.getDb();
      let sql: string;
      let params: unknown[];

      switch (direction) {
        case 'out':
          sql = 'SELECT * FROM relationships WHERE source_id = ?';
          params = [entityId];
          break;
        case 'in':
          sql = 'SELECT * FROM relationships WHERE target_id = ?';
          params = [entityId];
          break;
        case 'both':
        default:
          sql = 'SELECT * FROM relationships WHERE source_id = ? OR target_id = ?';
          params = [entityId, entityId];
          break;
      }

      const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
      return rows.map(rowToRelationship);
    } catch (error) {
      throw new GraphError(
        `Failed to get relationships for entity "${entityId}"`,
        'QUERY_FAILED',
        error,
      );
    }
  }

  /**
   * Execute a raw SQL query.
   *
   * Because SQLite does not support Cypher natively, this method
   * accepts SQL strings. Pass the query exactly as you would pass
   * it to `better-sqlite3`.
   *
   * @param sqlQuery - SQL query string.
   * @param _params - Ignored in this implementation (use `?` placeholders in the SQL).
   * @returns Array of result rows.
   * @throws {GraphError} If the query fails.
   */
  async query(sqlQuery: string, _params?: Record<string, unknown>): Promise<unknown[]> {
    try {
      const db = this.getDb();

      // Detect if it's a read (SELECT) or write statement
      const trimmed = sqlQuery.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('WITH')) {
        return db.prepare(sqlQuery).all() as unknown[];
      }

      // For mutations, run and return info
      const result = db.prepare(sqlQuery).run();
      return [{ changes: result.changes, lastInsertRowid: result.lastInsertRowid }];
    } catch (error) {
      throw new GraphError(
        'SQL query failed',
        'QUERY_FAILED',
        error,
      );
    }
  }

  /**
   * Walk the graph outward from an entity up to `depth` hops using
   * a recursive CTE.
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
      const db = this.getDb();

      // Recursive CTE to walk both directions
      const neighborSql = `
        WITH RECURSIVE neighbors(entity_id, current_depth, path) AS (
          SELECT ?, 0, ?
          UNION ALL
          SELECT
            CASE
              WHEN r.source_id = n.entity_id THEN r.target_id
              ELSE r.source_id
            END,
            n.current_depth + 1,
            n.path || ',' || CASE
              WHEN r.source_id = n.entity_id THEN r.target_id
              ELSE r.source_id
            END
          FROM neighbors n
          JOIN relationships r ON r.source_id = n.entity_id OR r.target_id = n.entity_id
          WHERE n.current_depth < ?
            AND INSTR(n.path, CASE
              WHEN r.source_id = n.entity_id THEN r.target_id
              ELSE r.source_id
            END) = 0
        )
        SELECT DISTINCT entity_id FROM neighbors;
      `;

      const entityIdRows = db.prepare(neighborSql).all(entityId, entityId, depth) as Record<string, unknown>[];
      const entityIds = entityIdRows.map((r) => String(r['entity_id']));

      if (entityIds.length === 0) {
        return { entities: [], relationships: [] };
      }

      // Fetch all entities
      const placeholders = entityIds.map(() => '?').join(', ');
      const entityRows = db
        .prepare(`SELECT * FROM entities WHERE id IN (${placeholders})`)
        .all(...entityIds) as Record<string, unknown>[];
      const entities = entityRows.map(rowToEntity);

      // Fetch all relationships between these entities
      const relSql = `
        SELECT * FROM relationships
        WHERE source_id IN (${placeholders})
          AND target_id IN (${placeholders})
      `;
      const relRows = db.prepare(relSql).all(...entityIds, ...entityIds) as Record<string, unknown>[];
      const relationships = relRows.map(rowToRelationship);

      return { entities, relationships };
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
      const db = this.getDb();
      const sql = `
        INSERT INTO entities (id, type, name, qualified_name, description, source, source_location, properties, tags, created_at, updated_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          name = excluded.name,
          qualified_name = excluded.qualified_name,
          description = excluded.description,
          source = excluded.source,
          source_location = excluded.source_location,
          properties = excluded.properties,
          tags = excluded.tags,
          updated_at = excluded.updated_at,
          last_seen_at = excluded.last_seen_at
      `;

      db.prepare(sql).run(
        entity.id,
        entity.type,
        entity.name,
        entity.qualified_name,
        entity.description ?? null,
        entity.source,
        entity.source_location != null ? JSON.stringify(entity.source_location) : null,
        JSON.stringify(entity.properties),
        JSON.stringify(entity.tags),
        entity.created_at,
        entity.updated_at,
        entity.last_seen_at,
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
      const db = this.getDb();
      const sql = `
        INSERT INTO relationships (id, type, source_id, target_id, properties, confidence, source, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          source_id = excluded.source_id,
          target_id = excluded.target_id,
          properties = excluded.properties,
          confidence = excluded.confidence,
          source = excluded.source,
          updated_at = excluded.updated_at
      `;

      db.prepare(sql).run(
        relationship.id,
        relationship.type,
        relationship.source_id,
        relationship.target_id,
        JSON.stringify(relationship.properties),
        relationship.confidence,
        relationship.source,
        relationship.created_at,
        relationship.updated_at,
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
   * Delete an entity and all of its relationships (cascading via
   * foreign keys).
   *
   * @param id - UUID of the entity to remove.
   * @returns `true` if the entity was found and deleted.
   * @throws {GraphError} If the deletion fails.
   */
  async deleteEntity(id: string): Promise<boolean> {
    try {
      const db = this.getDb();

      // Delete relationships explicitly to be safe in case foreign keys are off
      db.prepare('DELETE FROM relationships WHERE source_id = ? OR target_id = ?').run(id, id);

      const result = db.prepare('DELETE FROM entities WHERE id = ?').run(id);
      return result.changes > 0;
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
      const db = this.getDb();
      const result = db.prepare('DELETE FROM relationships WHERE id = ?').run(id);
      return result.changes > 0;
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
      const db = this.getDb();

      // Entity counts by type
      const entityRows = db.prepare(
        'SELECT type, COUNT(*) AS cnt FROM entities GROUP BY type',
      ).all() as Record<string, unknown>[];

      const entityCountsByType: Record<string, number> = {};
      let totalEntities = 0;
      for (const row of entityRows) {
        const type = String(row['type']);
        const count = Number(row['cnt']);
        entityCountsByType[type] = count;
        totalEntities += count;
      }

      // Relationship counts by type
      const relRows = db.prepare(
        'SELECT type, COUNT(*) AS cnt FROM relationships GROUP BY type',
      ).all() as Record<string, unknown>[];

      const relationshipCountsByType: Record<string, number> = {};
      let totalRelationships = 0;
      for (const row of relRows) {
        const type = String(row['type']);
        const count = Number(row['cnt']);
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
   * Close the database connection and release resources.
   */
  async dispose(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

/**
 * Create and optionally initialize a new SQLite graph client.
 *
 * @param config - SQLite configuration.
 * @param autoMigrate - If `true`, run schema migrations on creation (default `true`).
 * @returns Initialized {@link SqliteGraphClient}.
 * @throws {GraphError} If opening or migration fails.
 */
export async function createSqliteClient(
  config: SqliteConfig,
  autoMigrate: boolean = true,
): Promise<SqliteGraphClient> {
  const client = new SqliteGraphClient(config);
  if (autoMigrate) {
    await client.initialize();
  }
  return client;
}

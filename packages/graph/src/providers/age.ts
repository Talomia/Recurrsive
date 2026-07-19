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
import { GraphError, EntityTypeSchema, RelationTypeSchema } from '@recurrsive/core';
import type { GraphClient } from '@recurrsive/core';
import { migrate, DEFAULT_AGE_GRAPH, assertSafeGraphName } from '../migrations/001_initial_schema.js';
import { assertValidFilterKeys, matchesPropertyFilter } from './property-filter.js';

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
  /**
   * AGE graph (and schema) name this client operates on. Enables per-project
   * isolation: each project uses its own graph. Validated as a safe SQL
   * identifier. Defaults to {@link DEFAULT_AGE_GRAPH} (`recurrsive`).
   */
  graphName?: string;
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

/**
 * Wrap a Cypher body in a PostgreSQL dollar-quoted string using a tag
 * that is guaranteed not to occur in the body.
 *
 * A plain `$$ ... $$` wrapper is exploitable: entity content sourced
 * from arbitrary cloned repositories can contain the `$$` delimiter and
 * break out of the dollar-quoted string, turning the remainder of the
 * payload into attacker-controlled SQL. Instead of `Math.random` (not
 * available in every runtime), the tag is derived deterministically by
 * a counter loop over the payload — the loop terminates because each
 * candidate tag is distinct and the body is finite.
 *
 * @param body - Raw Cypher query body.
 * @returns Dollar-quoted string safe to embed in SQL.
 */
function dollarQuote(body: string): string {
  let tag = 'cypher';
  for (let i = 0; body.includes(`$${tag}$`); i++) {
    tag = `cypher_${i}`;
  }
  return `$${tag}$ ${body} $${tag}$`;
}

/**
 * Validate that a label is safe for Cypher interpolation.
 * Checks against Zod schemas first, then falls back to identifier regex.
 * Prevents Cypher injection via entity/relationship type labels.
 */
function validateCypherLabel(label: string, kind: 'entity' | 'relationship'): void {
  // First check: validate against known schema values
  const schema = kind === 'entity' ? EntityTypeSchema : RelationTypeSchema;
  const result = schema.safeParse(label);
  if (result.success) return;

  // Fallback: strict identifier regex (allows only alphanumeric + underscore)
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(label)) return;

  throw new GraphError(
    `Invalid ${kind} type "${label}" — must be a valid identifier`,
    'INVALID_FILTER',
  );
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

  /**
   * Delete all entities and relationships from the graph.
   * Used to reset the graph before a fresh analysis run.
   */
  clearAll(): Promise<void>;

  /**
   * Full-text search across entities by name, description, and type.
   * Returns entities ordered by relevance.
   *
   * @param query - Search query string (space-separated terms).
   * @param options - Optional type filter and result limit.
   * @returns Matching entities.
   */
  searchEntities?(
    query: string,
    options?: { type?: string; limit?: number },
  ): Promise<Entity[]>;
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
/**
 * Remove AGE type annotations (`::vertex`, `::edge`, `::path`, `::agtype`)
 * that appear OUTSIDE JSON string literals. Annotations can occur mid-value
 * (a `::path` result embeds `::vertex`/`::edge` after each element), so a
 * simple trailing strip is not enough — instead scan the payload tracking
 * JSON string boundaries (including escapes) and drop annotations only in
 * structural positions.
 */
function stripAgtypeAnnotations(raw: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw.charAt(i);
    if (inString) {
      out += ch;
      if (ch === '\\' && i + 1 < raw.length) {
        // Escaped character (e.g. \" or \\) — copy it verbatim so an
        // escaped quote does not terminate the string.
        out += raw.charAt(i + 1);
        i++;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
      continue;
    }
    if (ch === ':' && raw.charAt(i + 1) === ':') {
      // Longest annotation is 8 chars; slice one extra char for the \b check.
      const m = /^::(vertex|edge|path|agtype)\b/.exec(raw.slice(i, i + 9));
      if (m) {
        i += m[0].length - 1;
        continue;
      }
    }
    out += ch;
  }
  return out;
}

function parseAgtype(raw: unknown): unknown {
  if (raw === null || raw === undefined) return null;
  if (typeof raw !== 'string') return raw;

  // Strip AGE type annotations like ::vertex, ::edge, ::path — but ONLY
  // outside JSON string literals. A naive global replace corrupts string
  // contents (e.g. a qualified_name of `boost::filesystem::path` would
  // round-trip as `boost::filesystem`).
  const cleaned = stripAgtypeAnnotations(raw).trim();

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
/**
 * Parse a value that AGE may return either as an already-decoded object or as
 * a JSON string (entityToAgeProps stores nested maps as JSON strings). Returns
 * an empty object on anything unparseable.
 */
function parseJsonObject(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // fall through to empty
    }
  }
  return {};
}

/**
 * Parse a value that AGE may return as an array or as a JSON-string array into
 * a string[]. Returns an empty array on anything unparseable.
 */
function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through to empty
    }
  }
  return [];
}

function vertexToEntity(vertex: Record<string, unknown>): Entity {
  const props = (vertex['properties'] ?? vertex) as Record<string, unknown>;
  return {
    id: String(props['id'] ?? ''),
    type: String(props['type'] ?? 'function') as EntityType,
    name: String(props['name'] ?? ''),
    qualified_name: String(props['qualified_name'] ?? ''),
    // `!= null` (not `!== null`) — a missing key is `undefined`, and `!== null`
    // would let it through String() as the literal string "undefined".
    description: props['description'] != null ? String(props['description']) : undefined,
    source: String(props['source'] ?? ''),
    source_location: props['source_location'] != null
      ? (typeof props['source_location'] === 'string'
        ? JSON.parse(props['source_location'])
        : props['source_location']) as Entity['source_location']
      : undefined,
    // properties/tags are stored as JSON strings (entityToAgeProps), so they
    // must be JSON-parsed back — the old object-only check silently dropped
    // every property and tag on the AGE backend, blinding the analyzers.
    properties: parseJsonObject(props['properties']),
    tags: parseJsonStringArray(props['tags']),
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
    properties: parseJsonObject(props['properties']),
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
  private readonly graphName: string;
  private initialized = false;

  /**
   * @param config - AGE connection configuration.
   */
  constructor(config: AgeConfig) {
    this.graphName = config.graphName ?? DEFAULT_AGE_GRAPH;
    assertSafeGraphName(this.graphName);
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
      // Set a per-query timeout to prevent slow Cypher scans from hanging
      await client.query(`SET statement_timeout = '30s';`);
      return await this.executeCypherOn(client, cypher, returnColumns);
    } finally {
      client.release();
    }
  }

  /**
   * Execute a Cypher query on an ALREADY-PREPARED client connection.
   * Used directly for multi-statement transactions where all statements
   * must share one connection; {@link executeCypher} wraps this with
   * pool checkout + connection preparation.
   */
  private async executeCypherOn(
    client: pg.PoolClient,
    cypher: string,
    returnColumns: string = 'result agtype',
  ): Promise<unknown[]> {
    try {
      const sql = `SELECT * FROM cypher('${this.graphName}', ${dollarQuote(cypher)}) AS (${returnColumns});`;
      const result = await client.query(sql);
      return result.rows.map((row: Record<string, unknown>) => {
        const parsed: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(row)) {
          parsed[key] = parseAgtype(value);
        }
        return parsed;
      });
    } catch (error) {
      // Surface a clear error for statement timeouts instead of a cryptic
      // Postgres "canceling statement" message
      if (error instanceof Error && error.message.includes('statement timeout')) {
        throw new GraphError(
          `Cypher query timed out (30s limit): ${cypher.slice(0, 120)}…`,
          'QUERY_TIMEOUT',
          error,
        );
      }
      throw error;
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
          this.graphName,
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
   * List entities of a given type, optionally filtered by nested
   * `properties` values.
   *
   * The filter is applied against the entity's `properties` map (the
   * same contract as the SQLite provider): scalars are compared by
   * value and objects/arrays structurally. Because AGE stores the
   * `properties` map as a JSON string on the vertex, the filter is
   * evaluated in JS after JSON round-trip via the shared predicate,
   * guaranteeing backend-equivalent results.
   *
   * @param type - The entity type to query.
   * @param filter - Optional key-value filter applied to `properties`.
   * @returns Matching entities.
   * @throws {GraphError} If the query fails.
   */
  async getEntities(type: EntityType, filter?: Record<string, unknown>): Promise<Entity[]> {
    validateCypherLabel(type, 'entity');
    if (filter) assertValidFilterKeys(filter);

    try {
      const rows = await this.executeCypher(
        `MATCH (n:${type}) RETURN n`,
        'n agtype',
      );
      const entities = rows.map((row) => {
        const r = row as Record<string, unknown>;
        return vertexToEntity(r['n'] as Record<string, unknown>);
      });
      if (filter && Object.keys(filter).length > 0) {
        return entities.filter((e) => matchesPropertyFilter(e.properties, filter));
      }
      return entities;
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
          cypher = `MATCH (n {id: '${safeId}'})-[r]-(m) RETURN DISTINCT r`;
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
   * Walk the graph outward from an entity up to `depth` hops and return
   * the induced subgraph: all collected entities plus ALL relationships
   * whose endpoints are both within the collected set (not just the
   * edges on traversal paths). This matches the SQLite provider's
   * semantics so both backends return the same subgraph.
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
      const safeDepth = Math.max(1, Math.floor(depth));
      const rows = await this.executeCypher(
        `MATCH (start {id: '${safeId}'})-[*1..${safeDepth}]-(neighbor) RETURN DISTINCT neighbor`,
        'neighbor agtype',
      );

      const entityMap = new Map<string, Entity>();

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
      }

      if (entityMap.size === 0) {
        return { entities: [], relationships: [] };
      }

      // Fetch ALL relationships among the collected nodes (induced subgraph)
      const idList = Array.from(entityMap.keys())
        .map((id) => `'${escapeCypher(id)}'`)
        .join(', ');
      const relRows = await this.executeCypher(
        `MATCH (a)-[r]->(b) WHERE a.id IN [${idList}] AND b.id IN [${idList}] RETURN r`,
        'r agtype',
      );

      const relMap = new Map<string, Relationship>();
      for (const row of relRows) {
        const r = row as Record<string, unknown>;
        if (r['r']) {
          const rel = edgeToRelationship(r['r'] as Record<string, unknown>);
          relMap.set(rel.id, rel);
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
      validateCypherLabel(entity.type, 'entity');
      const safeId = escapeCypher(entity.id);

      // Look up any existing vertex with this id REGARDLESS of label.
      // A bare `MERGE (n:type {id})` would create a duplicate vertex when
      // the entity's type (= AGE label) changes, because MERGE only
      // matches within the given label.
      const existingRows = await this.executeCypher(
        `MATCH (n {id: '${safeId}'}) RETURN n`,
        'n agtype',
      );

      if (existingRows.length > 0) {
        const vertex = (existingRows[0] as Record<string, unknown>)['n'] as
          | Record<string, unknown>
          | undefined;
        const existingLabel = String(vertex?.['label'] ?? '');

        if (existingLabel !== entity.type) {
          // AGE cannot relabel a vertex in place. Recreate it under the
          // new label, preserving its relationships — parity with the
          // SQLite provider where `type` is a plain column update.
          //
          // This MUST be atomic: a crash between the DETACH DELETE and the
          // edge re-inserts would silently drop every relationship on the
          // vertex (SQLite does a single atomic UPDATE). Run the whole
          // read-delete-recreate-relink sequence on ONE client inside an
          // explicit transaction.
          const client = await this.pool.connect();
          try {
            await this.prepareConnection(client);
            await client.query(`SET statement_timeout = '30s';`);
            await client.query('BEGIN');
            try {
              const relRows = await this.executeCypherOn(
                client,
                `MATCH (n {id: '${safeId}'})-[r]-(m) RETURN DISTINCT r`,
                'r agtype',
              );
              const existingRels = relRows.map((row) =>
                edgeToRelationship(
                  (row as Record<string, unknown>)['r'] as Record<string, unknown>,
                ),
              );
              await this.executeCypherOn(
                client,
                `MATCH (n {id: '${safeId}'}) DETACH DELETE n RETURN count(n) AS deleted`,
                'deleted agtype',
              );
              await this.executeCypherOn(
                client,
                `CREATE (n:${entity.type} ${props}) RETURN n`,
                'n agtype',
              );
              for (const rel of existingRels) {
                validateCypherLabel(rel.type, 'relationship');
                const relProps = relationshipToAgeProps(rel);
                await this.executeCypherOn(
                  client,
                  `MATCH (a {id: '${escapeCypher(rel.source_id)}'}), (b {id: '${escapeCypher(rel.target_id)}'}) MERGE (a)-[r:${rel.type} {id: '${escapeCypher(rel.id)}'}]->(b) SET r += ${relProps} RETURN r`,
                  'r agtype',
                );
              }
              await client.query('COMMIT');
            } catch (txError) {
              await client.query('ROLLBACK').catch(() => {
                // Connection may already be unusable — release below.
              });
              throw txError;
            }
          } finally {
            client.release();
          }
          return entity;
        }
      }

      await this.executeCypher(
        `MERGE (n:${entity.type} {id: '${safeId}'}) SET n += ${props} RETURN n`,
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
      validateCypherLabel(relationship.type, 'relationship');
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
    const client = await this.pool.connect();
    try {
      // Use direct SQL on AGE's label tables — no Cypher overhead.
      // AGE stores each label as a regular PostgreSQL table in the graph's
      // namespace schema (e.g. recurrsive.file, recurrsive.function, etc.).
      // A single UNION ALL query counts all labels at once.

      // Build entity counts query
      const entityParts = EntityTypeSchema.options.map(
        (t) => `SELECT '${t}' AS label, COUNT(*) AS cnt FROM ${this.graphName}."${t}"`,
      );
      const entitySql = entityParts.join(' UNION ALL ');

      const entityCountsByType: Record<string, number> = {};
      let totalEntities = 0;

      try {
        const result = await client.query(entitySql);
        for (const row of result.rows) {
          const count = Number(row['cnt'] ?? 0);
          if (count > 0) {
            entityCountsByType[row['label']] = count;
            totalEntities += count;
          }
        }
      } catch {
        // If any table doesn't exist, fall back to individual queries
        for (const entityType of EntityTypeSchema.options) {
          try {
            const result = await client.query(
              `SELECT COUNT(*) AS cnt FROM ${this.graphName}."${entityType}";`,
            );
            const count = Number(result.rows[0]?.['cnt'] ?? 0);
            if (count > 0) {
              entityCountsByType[entityType] = count;
              totalEntities += count;
            }
          } catch {
            // Table doesn't exist; skip
          }
        }
      }

      // Build relationship counts query
      const relParts = RelationTypeSchema.options.map(
        (t) => `SELECT '${t}' AS label, COUNT(*) AS cnt FROM ${this.graphName}."${t}"`,
      );
      const relSql = relParts.join(' UNION ALL ');

      const relationshipCountsByType: Record<string, number> = {};
      let totalRelationships = 0;

      try {
        const result = await client.query(relSql);
        for (const row of result.rows) {
          const count = Number(row['cnt'] ?? 0);
          if (count > 0) {
            relationshipCountsByType[row['label']] = count;
            totalRelationships += count;
          }
        }
      } catch {
        // If any edge table doesn't exist, fall back to individual queries
        for (const relType of RelationTypeSchema.options) {
          try {
            const result = await client.query(
              `SELECT COUNT(*) AS cnt FROM ${this.graphName}."${relType}";`,
            );
            const count = Number(result.rows[0]?.['cnt'] ?? 0);
            if (count > 0) {
              relationshipCountsByType[relType] = count;
              totalRelationships += count;
            }
          } catch {
            // Table doesn't exist; skip
          }
        }
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
    } finally {
      client.release();
    }
  }

  /**
   * List relationships directly from edge tables using SQL.
   * Avoids O(N) entity iteration by querying the underlying AGE edge
   * tables directly with optional type filter and pagination.
   *
   * @param options - Filter and pagination options.
   * @returns Array of relationships with total count.
   */
  async listRelationships(options?: {
    type?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: Relationship[]; total: number }> {
    try {
      const limit = Math.max(1, Math.min(options?.limit ?? 50, 50000));
      const offset = Math.max(0, options?.offset ?? 0);

      // Use Cypher to list relationships — consistent with getRelationships()
      // For type filtering, validate and apply label filter.
      let typeFilter = '';
      if (options?.type) {
        validateCypherLabel(options.type, 'relationship');
        typeFilter = `:${options.type}`;
      }

      // Get total count first
      const countCypher = `MATCH ()-[r${typeFilter}]->() RETURN count(r) AS cnt`;
      const countRows = await this.executeCypher(countCypher, 'cnt agtype');
      const total = Number((countRows[0] as Record<string, unknown>)?.['cnt'] ?? 0);

      if (total === 0) {
        return { data: [], total: 0 };
      }

      // Get paginated results. ORDER BY a stable key before SKIP/LIMIT —
      // without it Postgres gives no ordering guarantee, so rows could be
      // duplicated or missed across pages.
      const dataCypher = `MATCH ()-[r${typeFilter}]->() RETURN r ORDER BY r.id SKIP ${offset} LIMIT ${limit}`;
      const rows = await this.executeCypher(dataCypher, 'r agtype');

      const relationships: Relationship[] = rows.map((row) => {
        const r = row as Record<string, unknown>;
        return edgeToRelationship(r['r'] as Record<string, unknown>);
      });

      return { data: relationships, total };
    } catch (error) {
      throw new GraphError(
        'Failed to list relationships',
        'QUERY_FAILED',
        error,
      );
    }
  }

  /**
   * Delete all entities and relationships from the graph.
   */
  async clearAll(): Promise<void> {
    try {
      await this.executeCypher(
        'MATCH (n) DETACH DELETE n RETURN count(n) AS deleted',
        'deleted agtype',
      );
    } catch (error) {
      throw new GraphError(
        'Failed to clear all graph data',
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

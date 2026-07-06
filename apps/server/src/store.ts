/**
 * @module @recurrsive/server/store
 *
 * Persistent key-value store for server-side state.
 *
 * Supports two backends:
 * - **SQLite** (`better-sqlite3`) — used in tests and local dev
 * - **PostgreSQL** — used in production when `DATABASE_URL` is set
 *
 * Both implementations share the same {@link IServerStore} interface,
 * allowing all consumer code to work identically regardless of backend.
 *
 * @packageDocumentation
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType, Statement } from 'better-sqlite3';
import pg from 'pg';
import { createLogger, nowISO } from '@recurrsive/core';

import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

const { Pool } = pg;

const logger = createLogger({ context: { component: 'server:store' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options for listing records from a table. */
export interface ListOptions {
  /** Maximum number of records to return. */
  limit?: number;
  /** Number of records to skip (for pagination). */
  offset?: number;
  /** Sort by 'created_at' or 'updated_at' (default: 'created_at'). */
  orderBy?: 'created_at' | 'updated_at';
  /** Sort direction (default: 'desc'). */
  order?: 'asc' | 'desc';
}

/** Result of a list query with pagination metadata. */
export interface ListResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// IServerStore Interface
// ---------------------------------------------------------------------------

/**
 * Abstract interface for the server key-value store.
 *
 * All methods are async to support both synchronous (SQLite) and
 * asynchronous (PostgreSQL) backends.
 */
export interface IServerStore {
  /** Async initialization (e.g. create tables). No-op for SQLite. */
  initialize(): Promise<void>;

  /** Get a record by table and ID. */
  get<T>(table: string, id: string): Promise<T | null>;

  /** Store or replace a record (upsert). */
  set<T>(table: string, id: string, value: T): Promise<void>;

  /** Delete a record. Returns true if deleted. */
  delete(table: string, id: string): Promise<boolean>;

  /** Check if a record exists. */
  has(table: string, id: string): Promise<boolean>;

  /** List records with pagination and ordering. */
  list<T>(table: string, options?: ListOptions): Promise<ListResult<T>>;

  /** Get all records in a table. */
  all<T>(table: string): Promise<T[]>;

  /** Count records in a table. */
  count(table: string): Promise<number>;

  /** Clear all records from a table. */
  clear(table: string): Promise<void>;

  /** Get all records as [id, value] tuples. */
  entries<T>(table: string): Promise<Array<[string, T]>>;

  /** Append a record with auto-generated ID. Returns the ID. */
  append<T>(table: string, value: T): Promise<string>;

  /** Get the most recent N records (newest first). */
  recent<T>(table: string, limit?: number): Promise<T[]>;

  /** Trim a table to keep only the most recent N records. */
  trim(table: string, keepCount: number): Promise<number>;

  /** Execute operations atomically. */
  transaction(fn: () => void | Promise<void>): Promise<void>;

  /** Close the connection. */
  close(): Promise<void>;

  /** Get a description of the store location. */
  getPath(): string;
}

// ---------------------------------------------------------------------------
// SQLite Implementation
// ---------------------------------------------------------------------------

/**
 * SQLite-backed implementation using `better-sqlite3`.
 *
 * Used for tests (`NODE_ENV=test`) and local development without PostgreSQL.
 */
export class SqliteServerStore implements IServerStore {
  private db: DatabaseType;
  private readonly dbPath: string;

  // Prepared statements (lazy-initialized)
  private _stmtGet: Statement | null = null;
  private _stmtSet: Statement | null = null;
  private _stmtUpdate: Statement | null = null;
  private _stmtDelete: Statement | null = null;
  private _stmtHas: Statement | null = null;
  private _stmtCount: Statement | null = null;
  private _stmtClear: Statement | null = null;

  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath;

    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);

    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS kv_store (
        table_name TEXT NOT NULL,
        id         TEXT NOT NULL,
        data       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (table_name, id)
      );

      CREATE INDEX IF NOT EXISTS idx_kv_table_created
        ON kv_store (table_name, created_at);

      CREATE INDEX IF NOT EXISTS idx_kv_table_updated
        ON kv_store (table_name, updated_at);
    `);

    logger.info(`SqliteServerStore initialized at ${dbPath}`);
  }

  // ── Prepared Statements (lazy) ──────────────────────────────────────────

  private get stmtGet() {
    this._stmtGet ??= this.db.prepare(
      'SELECT data, created_at, updated_at FROM kv_store WHERE table_name = ? AND id = ?',
    );
    return this._stmtGet;
  }

  private get stmtSet() {
    this._stmtSet ??= this.db.prepare(
      'INSERT INTO kv_store (table_name, id, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    );
    return this._stmtSet;
  }

  private get stmtUpdate() {
    this._stmtUpdate ??= this.db.prepare(
      'UPDATE kv_store SET data = ?, updated_at = ? WHERE table_name = ? AND id = ?',
    );
    return this._stmtUpdate;
  }

  private get stmtDelete() {
    this._stmtDelete ??= this.db.prepare(
      'DELETE FROM kv_store WHERE table_name = ? AND id = ?',
    );
    return this._stmtDelete;
  }

  private get stmtHas() {
    this._stmtHas ??= this.db.prepare(
      'SELECT 1 FROM kv_store WHERE table_name = ? AND id = ?',
    );
    return this._stmtHas;
  }

  private get stmtCount() {
    this._stmtCount ??= this.db.prepare(
      'SELECT COUNT(*) as count FROM kv_store WHERE table_name = ?',
    );
    return this._stmtCount;
  }

  private get stmtClear() {
    this._stmtClear ??= this.db.prepare(
      'DELETE FROM kv_store WHERE table_name = ?',
    );
    return this._stmtClear;
  }

  // ── IServerStore Implementation ─────────────────────────────────────────

  async initialize(): Promise<void> {
    // No-op: SQLite schema created in constructor
  }

  async get<T>(table: string, id: string): Promise<T | null> {
    const row = this.stmtGet.get(table, id) as
      | { data: string; created_at: string; updated_at: string }
      | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as T;
  }

  async set<T>(table: string, id: string, value: T): Promise<void> {
    const json = JSON.stringify(value);
    const now = nowISO();

    if (await this.has(table, id)) {
      this.stmtUpdate.run(json, now, table, id);
    } else {
      this.stmtSet.run(table, id, json, now, now);
    }
  }

  async delete(table: string, id: string): Promise<boolean> {
    const result = this.stmtDelete.run(table, id);
    return result.changes > 0;
  }

  async has(table: string, id: string): Promise<boolean> {
    return this.stmtHas.get(table, id) !== undefined;
  }

  async list<T>(table: string, options?: ListOptions): Promise<ListResult<T>> {
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'created_at';
    const order = options?.order ?? 'desc';

    const SAFE_ORDER_BY = new Set(['created_at', 'updated_at']);
    const SAFE_ORDER = new Set(['asc', 'desc']);
    const safeOrderBy = SAFE_ORDER_BY.has(orderBy) ? orderBy : 'created_at';
    const safeOrder = SAFE_ORDER.has(order) ? order : 'desc';

    const total = (this.stmtCount.get(table) as { count: number }).count;

    const rows = this.db
      .prepare(
        `SELECT data FROM kv_store WHERE table_name = ? ORDER BY ${safeOrderBy} ${safeOrder} LIMIT ? OFFSET ?`,
      )
      .all(table, limit, offset) as Array<{ data: string }>;

    const data = rows.map((row) => JSON.parse(row.data) as T);

    return { data, total, limit, offset };
  }

  async all<T>(table: string): Promise<T[]> {
    const rows = this.db
      .prepare('SELECT data FROM kv_store WHERE table_name = ? ORDER BY created_at ASC')
      .all(table) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  async count(table: string): Promise<number> {
    return (this.stmtCount.get(table) as { count: number }).count;
  }

  async clear(table: string): Promise<void> {
    this.stmtClear.run(table);
  }

  async entries<T>(table: string): Promise<Array<[string, T]>> {
    const rows = this.db
      .prepare('SELECT id, data FROM kv_store WHERE table_name = ? ORDER BY created_at ASC')
      .all(table) as Array<{ id: string; data: string }>;
    return rows.map((row) => [row.id, JSON.parse(row.data) as T]);
  }

  async append<T>(table: string, value: T): Promise<string> {
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await this.set(table, id, value);
    return id;
  }

  async recent<T>(table: string, limit: number = 100): Promise<T[]> {
    const rows = this.db
      .prepare(
        'SELECT data FROM kv_store WHERE table_name = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(table, limit) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  async trim(table: string, keepCount: number): Promise<number> {
    const result = this.db
      .prepare(
        `DELETE FROM kv_store WHERE table_name = ? AND rowid NOT IN (
          SELECT rowid FROM kv_store WHERE table_name = ? ORDER BY created_at DESC LIMIT ?
        )`,
      )
      .run(table, table, keepCount);
    return result.changes;
  }

  async transaction(fn: () => void | Promise<void>): Promise<void> {
    this.db.transaction(fn as () => void)();
  }

  async close(): Promise<void> {
    this.db.close();
    logger.info('SqliteServerStore closed');
  }

  getPath(): string {
    return this.dbPath;
  }
}

// ---------------------------------------------------------------------------
// PostgreSQL Implementation
// ---------------------------------------------------------------------------

/**
 * PostgreSQL-backed implementation using `pg.Pool`.
 *
 * Used in production when `DATABASE_URL` is set. Stores data in a `kv_store`
 * table using JSONB for efficient querying.
 */
export class PostgresServerStore implements IServerStore {
  private readonly pool: pg.Pool;
  private readonly connectionString: string;
  private _initialized = false;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
    this.pool = new Pool({
      connectionString,
      max: 5,
      connectionTimeoutMillis: 10_000,
      idleTimeoutMillis: 30_000,
    });
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    const client = await this.pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS kv_store (
          table_name TEXT NOT NULL,
          id         TEXT NOT NULL,
          data       JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (table_name, id)
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_kv_table_created
          ON kv_store (table_name, created_at);
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_kv_table_updated
          ON kv_store (table_name, updated_at);
      `);
      this._initialized = true;
      logger.info('PostgresServerStore initialized');
    } finally {
      client.release();
    }
  }

  async get<T>(table: string, id: string): Promise<T | null> {
    const result = await this.pool.query(
      'SELECT data FROM kv_store WHERE table_name = $1 AND id = $2',
      [table, id],
    );
    if (result.rows.length === 0) return null;
    return result.rows[0].data as T;
  }

  async set<T>(table: string, id: string, value: T): Promise<void> {
    const json = JSON.stringify(value);
    await this.pool.query(
      `INSERT INTO kv_store (table_name, id, data, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, NOW(), NOW())
       ON CONFLICT (table_name, id)
       DO UPDATE SET data = $3::jsonb, updated_at = NOW()`,
      [table, id, json],
    );
  }

  async delete(table: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM kv_store WHERE table_name = $1 AND id = $2',
      [table, id],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async has(table: string, id: string): Promise<boolean> {
    const result = await this.pool.query(
      'SELECT 1 FROM kv_store WHERE table_name = $1 AND id = $2',
      [table, id],
    );
    return result.rows.length > 0;
  }

  async list<T>(table: string, options?: ListOptions): Promise<ListResult<T>> {
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'created_at';
    const order = options?.order ?? 'desc';

    const SAFE_ORDER_BY = new Set(['created_at', 'updated_at']);
    const SAFE_ORDER = new Set(['asc', 'desc']);
    const safeOrderBy = SAFE_ORDER_BY.has(orderBy) ? orderBy : 'created_at';
    const safeOrder = SAFE_ORDER.has(order) ? order : 'desc';

    const countResult = await this.pool.query(
      'SELECT COUNT(*) as count FROM kv_store WHERE table_name = $1',
      [table],
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await this.pool.query(
      `SELECT data FROM kv_store WHERE table_name = $1 ORDER BY ${safeOrderBy} ${safeOrder} LIMIT $2 OFFSET $3`,
      [table, limit, offset],
    );

    const data = result.rows.map((row: { data: unknown }) => row.data as T);

    return { data, total, limit, offset };
  }

  async all<T>(table: string): Promise<T[]> {
    const result = await this.pool.query(
      'SELECT data FROM kv_store WHERE table_name = $1 ORDER BY created_at ASC',
      [table],
    );
    return result.rows.map((row: { data: unknown }) => row.data as T);
  }

  async count(table: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM kv_store WHERE table_name = $1',
      [table],
    );
    return parseInt(result.rows[0].count, 10);
  }

  async clear(table: string): Promise<void> {
    await this.pool.query(
      'DELETE FROM kv_store WHERE table_name = $1',
      [table],
    );
  }

  async entries<T>(table: string): Promise<Array<[string, T]>> {
    const result = await this.pool.query(
      'SELECT id, data FROM kv_store WHERE table_name = $1 ORDER BY created_at ASC',
      [table],
    );
    return result.rows.map((row: { id: string; data: unknown }) => [row.id, row.data as T]);
  }

  async append<T>(table: string, value: T): Promise<string> {
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await this.set(table, id, value);
    return id;
  }

  async recent<T>(table: string, limit: number = 100): Promise<T[]> {
    const result = await this.pool.query(
      'SELECT data FROM kv_store WHERE table_name = $1 ORDER BY created_at DESC LIMIT $2',
      [table, limit],
    );
    return result.rows.map((row: { data: unknown }) => row.data as T);
  }

  async trim(table: string, keepCount: number): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM kv_store WHERE table_name = $1
       AND (table_name, id) NOT IN (
         SELECT table_name, id FROM kv_store
         WHERE table_name = $1
         ORDER BY created_at DESC
         LIMIT $2
       )`,
      [table, keepCount],
    );
    return result.rowCount ?? 0;
  }

  async transaction(fn: () => void | Promise<void>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await fn();
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('PostgresServerStore closed');
  }

  getPath(): string {
    return this.connectionString;
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible ServerStore alias
// ---------------------------------------------------------------------------

/**
 * @deprecated Use {@link IServerStore} interface instead.
 * Kept for backward compatibility with existing imports.
 */
export type ServerStore = IServerStore;

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Default SQLite path. Configurable via `DATABASE_PATH` env var.
 * Defaults to `./data/recurrsive.db` for file-based persistence,
 * or `:memory:` when `NODE_ENV=test`.
 */
function getDefaultPath(): string {
  if (process.env['NODE_ENV'] === 'test') {
    return ':memory:';
  }
  return process.env['DATABASE_PATH'] ?? './data/recurrsive.db';
}

/**
 * Create the appropriate store backend.
 *
 * - If `DATABASE_URL` is set and `NODE_ENV` is not `test`, uses PostgreSQL.
 * - Otherwise, uses SQLite.
 */
function createStore(): IServerStore {
  const databaseUrl = process.env['DATABASE_URL'];
  const isTest = process.env['NODE_ENV'] === 'test';

  if (databaseUrl && !isTest) {
    logger.info('Using PostgreSQL-backed ServerStore');
    return new PostgresServerStore(databaseUrl);
  }

  logger.info('Using SQLite-backed ServerStore');
  return new SqliteServerStore(getDefaultPath());
}

/** Global server store singleton. */
export const store: IServerStore = createStore();

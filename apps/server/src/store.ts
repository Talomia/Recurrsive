/**
 * @module @recurrsive/server/store
 *
 * SQLite-backed key-value store for server-side persistent state.
 *
 * Replaces the per-route `new Map()` patterns with durable storage
 * that survives server restarts. Each "table" is a logical namespace
 * storing JSON-serialized records keyed by a string ID.
 *
 * Uses `better-sqlite3` for synchronous, embedded operation (the same
 * library already used by `@recurrsive/graph`'s SQLite provider).
 *
 * @packageDocumentation
 */

import Database from 'better-sqlite3';
import type { Database as DatabaseType, Statement } from 'better-sqlite3';
import { createLogger, nowISO } from '@recurrsive/core';

import { mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

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
// ServerStore
// ---------------------------------------------------------------------------

/**
 * SQLite-backed persistent store for server entities.
 *
 * Each "table" is stored in a single SQLite table called `kv_store`
 * with columns: `table_name`, `id`, `data` (JSON), `created_at`,
 * `updated_at`. This keeps the schema simple and allows any entity
 * type to be stored without migrations.
 *
 * @example
 * ```ts
 * import { store } from './store.js';
 *
 * // Store a webhook
 * store.set('webhooks', 'wh_123', { url: 'https://example.com', events: ['*'] });
 *
 * // Retrieve it
 * const webhook = store.get<Webhook>('webhooks', 'wh_123');
 *
 * // List all webhooks
 * const { data, total } = store.list<Webhook>('webhooks');
 * ```
 */
export class ServerStore {
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

  /**
   * Create a new ServerStore instance.
   *
   * @param dbPath - Path to the SQLite file, or ':memory:' for testing.
   */
  constructor(dbPath: string = ':memory:') {
    this.dbPath = dbPath;

    // Ensure the parent directory exists for file-based databases
    if (dbPath !== ':memory:') {
      const dir = dirname(dbPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }

    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrent read performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');

    // Create the unified key-value table
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

    logger.info(`ServerStore initialized at ${dbPath}`);
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

  // ── CRUD Operations ─────────────────────────────────────────────────────

  /**
   * Get a record by table and ID.
   *
   * @param table - Logical table name (e.g. 'webhooks', 'projects').
   * @param id - Record ID.
   * @returns The deserialized record, or null if not found.
   */
  get<T>(table: string, id: string): T | null {
    const row = this.stmtGet.get(table, id) as
      | { data: string; created_at: string; updated_at: string }
      | undefined;
    if (!row) return null;
    return JSON.parse(row.data) as T;
  }

  /**
   * Store or replace a record.
   *
   * If the record already exists, it is updated (data + updated_at).
   * If it doesn't exist, it is inserted.
   *
   * @param table - Logical table name.
   * @param id - Record ID.
   * @param value - The value to store (will be JSON-serialized).
   */
  set<T>(table: string, id: string, value: T): void {
    const json = JSON.stringify(value);
    const now = nowISO();

    if (this.has(table, id)) {
      this.stmtUpdate.run(json, now, table, id);
    } else {
      this.stmtSet.run(table, id, json, now, now);
    }
  }

  /**
   * Delete a record.
   *
   * @param table - Logical table name.
   * @param id - Record ID.
   * @returns `true` if a record was deleted, `false` if it didn't exist.
   */
  delete(table: string, id: string): boolean {
    const result = this.stmtDelete.run(table, id);
    return result.changes > 0;
  }

  /**
   * Check if a record exists.
   *
   * @param table - Logical table name.
   * @param id - Record ID.
   * @returns `true` if the record exists.
   */
  has(table: string, id: string): boolean {
    return this.stmtHas.get(table, id) !== undefined;
  }

  /**
   * List records in a table with optional pagination and ordering.
   *
   * @param table - Logical table name.
   * @param options - Pagination and sorting options.
   * @returns Paginated result with data array and total count.
   */
  list<T>(table: string, options?: ListOptions): ListResult<T> {
    const limit = options?.limit ?? 1000;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'created_at';
    const order = options?.order ?? 'desc';

    // Defence-in-depth: validate interpolated values even though TypeScript
    // constrains them at compile time — prevents SQL injection if type safety
    // is ever bypassed (e.g. via `as any` or unvalidated user input).
    const SAFE_ORDER_BY = new Set(['created_at', 'updated_at']);
    const SAFE_ORDER = new Set(['asc', 'desc']);
    const safeOrderBy = SAFE_ORDER_BY.has(orderBy) ? orderBy : 'created_at';
    const safeOrder = SAFE_ORDER.has(order) ? order : 'desc';

    const total = (this.stmtCount.get(table) as { count: number }).count;

    // Dynamic ORDER BY requires string interpolation, but values are
    // constrained to safe enum values above.
    const rows = this.db
      .prepare(
        `SELECT data FROM kv_store WHERE table_name = ? ORDER BY ${safeOrderBy} ${safeOrder} LIMIT ? OFFSET ?`,
      )
      .all(table, limit, offset) as Array<{ data: string }>;

    const data = rows.map((row) => JSON.parse(row.data) as T);

    return { data, total, limit, offset };
  }

  /**
   * Get all records in a table as an array (no pagination).
   *
   * Convenience method for small collections.
   *
   * @param table - Logical table name.
   * @returns Array of all records.
   */
  all<T>(table: string): T[] {
    const rows = this.db
      .prepare('SELECT data FROM kv_store WHERE table_name = ? ORDER BY created_at ASC')
      .all(table) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  /**
   * Count records in a table.
   *
   * @param table - Logical table name.
   * @returns Number of records.
   */
  count(table: string): number {
    return (this.stmtCount.get(table) as { count: number }).count;
  }

  /**
   * Clear all records from a table.
   *
   * @param table - Logical table name.
   */
  clear(table: string): void {
    this.stmtClear.run(table);
  }

  /**
   * Get all records in a table as key-value pairs.
   *
   * Returns an array of `[id, value]` tuples, useful when you need
   * to know the store key (e.g. for API key hash lookups).
   *
   * @param table - Logical table name.
   * @returns Array of [id, value] tuples.
   */
  entries<T>(table: string): Array<[string, T]> {
    const rows = this.db
      .prepare('SELECT id, data FROM kv_store WHERE table_name = ? ORDER BY created_at ASC')
      .all(table) as Array<{ id: string; data: string }>;
    return rows.map((row) => [row.id, JSON.parse(row.data) as T]);
  }

  /**
   * Append a record with an auto-generated timestamp-based key.
   *
   * Useful for log-style tables (audit events, notifications).
   * Returns the generated ID.
   *
   * @param table - Logical table name.
   * @param value - The value to store.
   * @returns The generated record ID.
   */
  append<T>(table: string, value: T): string {
    const id = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    this.set(table, id, value);
    return id;
  }

  /**
   * Get the most recent N records from a table (newest first).
   *
   * Useful for capped/log-style tables.
   *
   * @param table - Logical table name.
   * @param limit - Maximum records to return (default: 100).
   * @returns Array of records, newest first.
   */
  recent<T>(table: string, limit: number = 100): T[] {
    const rows = this.db
      .prepare(
        'SELECT data FROM kv_store WHERE table_name = ? ORDER BY created_at DESC LIMIT ?',
      )
      .all(table, limit) as Array<{ data: string }>;
    return rows.map((row) => JSON.parse(row.data) as T);
  }

  /**
   * Trim a log-style table to keep only the most recent N records.
   *
   * @param table - Logical table name.
   * @param keepCount - Number of most recent records to keep.
   * @returns Number of records deleted.
   */
  trim(table: string, keepCount: number): number {
    const result = this.db
      .prepare(
        `DELETE FROM kv_store WHERE table_name = ? AND rowid NOT IN (
          SELECT rowid FROM kv_store WHERE table_name = ? ORDER BY created_at DESC LIMIT ?
        )`,
      )
      .run(table, table, keepCount);
    return result.changes;
  }

  /**
   * Execute a batch of operations atomically in a transaction.
   *
   * @param fn - Function containing store operations.
   */
  transaction(fn: () => void): void {
    this.db.transaction(fn)();
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
    logger.info('ServerStore closed');
  }

  /**
   * Get the database file path.
   */
  getPath(): string {
    return this.dbPath;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/**
 * Default database path. Configurable via `DATABASE_PATH` env var.
 * Defaults to `./data/recurrsive.db` for file-based persistence,
 * or `:memory:` when `NODE_ENV=test`.
 */
function getDefaultPath(): string {
  if (process.env['NODE_ENV'] === 'test') {
    return ':memory:';
  }
  return process.env['DATABASE_PATH'] ?? './data/recurrsive.db';
}

/** Global server store singleton. */
export const store = new ServerStore(getDefaultPath());

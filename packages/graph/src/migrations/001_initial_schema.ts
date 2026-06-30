/**
 * @module migrations/001_initial_schema
 *
 * Initial schema migration for both PostgreSQL + Apache AGE and SQLite
 * graph backends. Creates all required tables, labels, indexes, and
 * constraints.
 *
 * @packageDocumentation
 */

import { EntityTypeSchema, RelationTypeSchema } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported migration provider targets. */
export type MigrationProvider = 'postgresql_age' | 'sqlite';

/** Result of a migration run. */
export interface MigrationResult {
  /** Whether the migration was applied (false if already up-to-date). */
  applied: boolean;
  /** Human-readable summary of what was done. */
  summary: string;
}

// ---------------------------------------------------------------------------
// AGE SQL Generators
// ---------------------------------------------------------------------------

/**
 * Build the full set of SQL statements needed to initialize a
 * PostgreSQL + Apache AGE graph schema.
 *
 * @returns Array of SQL statements to execute sequentially.
 */
function buildAgeStatements(): string[] {
  const stmts: string[] = [];

  // Ensure the AGE extension is available
  stmts.push(`CREATE EXTENSION IF NOT EXISTS age;`);
  stmts.push(`LOAD 'age';`);
  stmts.push(`SET search_path = ag_catalog, "$user", public;`);

  // Create the graph (idempotent — AGE raises if it already exists,
  // so we guard with a DO block)
  stmts.push(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_graph WHERE name = 'recurrsive'
  ) THEN
    PERFORM create_graph('recurrsive');
  END IF;
END
$$;
  `.trim());

  // Create vertex labels for every entity type
  for (const entityType of EntityTypeSchema.options) {
    stmts.push(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label
    WHERE graph = (SELECT graphid FROM ag_catalog.ag_graph WHERE name = 'recurrsive')
      AND name = '${entityType}'
      AND kind = 'v'
  ) THEN
    PERFORM create_vlabel('recurrsive', '${entityType}');
  END IF;
END
$$;
    `.trim());
  }

  // Create edge labels for every relation type
  for (const relationType of RelationTypeSchema.options) {
    stmts.push(`
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM ag_catalog.ag_label
    WHERE graph = (SELECT graphid FROM ag_catalog.ag_graph WHERE name = 'recurrsive')
      AND name = '${relationType}'
      AND kind = 'e'
  ) THEN
    PERFORM create_elabel('recurrsive', '${relationType}');
  END IF;
END
$$;
    `.trim());
  }

  // Create an auxiliary metadata table for tracking migrations
  stmts.push(`
CREATE TABLE IF NOT EXISTS recurrsive_migrations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
  `.trim());

  return stmts;
}

// ---------------------------------------------------------------------------
// SQLite SQL Generators
// ---------------------------------------------------------------------------

/**
 * Build the full set of SQL statements needed to initialize the
 * SQLite schema that mirrors the graph.
 *
 * @returns Array of SQL statements to execute sequentially.
 */
function buildSqliteStatements(): string[] {
  const stmts: string[] = [];

  // Enable WAL mode for better concurrent read performance
  stmts.push(`PRAGMA journal_mode = WAL;`);
  stmts.push(`PRAGMA foreign_keys = ON;`);

  // Entities table
  stmts.push(`
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  qualified_name TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  source_location TEXT,
  properties TEXT NOT NULL DEFAULT '{}',
  tags TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
  `.trim());

  // Relationships table with foreign keys
  stmts.push(`
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY NOT NULL,
  type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  properties TEXT NOT NULL DEFAULT '{}',
  confidence REAL NOT NULL DEFAULT 1.0,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (source_id) REFERENCES entities(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES entities(id) ON DELETE CASCADE
);
  `.trim());

  // Indexes for fast lookups
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);`);
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(name);`);
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_entities_qualified_name ON entities(qualified_name);`);
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_entities_source ON entities(source);`);
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_entities_last_seen ON entities(last_seen_at);`);
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(type);`);
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_relationships_source_id ON relationships(source_id);`);
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_relationships_target_id ON relationships(target_id);`);
  stmts.push(`CREATE INDEX IF NOT EXISTS idx_relationships_source_target ON relationships(source_id, target_id);`);

  // Migration tracking table
  stmts.push(`
CREATE TABLE IF NOT EXISTS recurrsive_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
  `.trim());

  // FTS5 virtual table for full-text search of entities
  stmts.push(`
CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts USING fts5(
  id UNINDEXED,
  name,
  qualified_name,
  description,
  type UNINDEXED,
  content='entities',
  content_rowid='rowid',
  tokenize='porter unicode61'
);
  `.trim());

  // Triggers to keep FTS index in sync with entities table
  stmts.push(`
CREATE TRIGGER IF NOT EXISTS entities_fts_insert AFTER INSERT ON entities BEGIN
  INSERT INTO entities_fts(rowid, id, name, qualified_name, description, type)
  VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, COALESCE(NEW.description, ''), NEW.type);
END;
  `.trim());

  stmts.push(`
CREATE TRIGGER IF NOT EXISTS entities_fts_update AFTER UPDATE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, id, name, qualified_name, description, type)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, COALESCE(OLD.description, ''), OLD.type);
  INSERT INTO entities_fts(rowid, id, name, qualified_name, description, type)
  VALUES (NEW.rowid, NEW.id, NEW.name, NEW.qualified_name, COALESCE(NEW.description, ''), NEW.type);
END;
  `.trim());

  stmts.push(`
CREATE TRIGGER IF NOT EXISTS entities_fts_delete AFTER DELETE ON entities BEGIN
  INSERT INTO entities_fts(entities_fts, rowid, id, name, qualified_name, description, type)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.qualified_name, COALESCE(OLD.description, ''), OLD.type);
END;
  `.trim());

  return stmts;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** The migration name constant for idempotency tracking. */
export const MIGRATION_NAME = '001_initial_schema';

/**
 * Return raw SQL statements for the initial schema migration.
 *
 * This is useful when the caller wants to run the statements through
 * their own connection management rather than through {@link migrate}.
 *
 * @param provider - Target backend (`'postgresql_age'` or `'sqlite'`).
 * @returns Array of SQL strings.
 */
export function getMigrationStatements(provider: MigrationProvider): string[] {
  switch (provider) {
    case 'postgresql_age':
      return buildAgeStatements();
    case 'sqlite':
      return buildSqliteStatements();
  }
}

/**
 * Execute the initial schema migration using a raw SQL execution
 * callback.
 *
 * The caller provides an `exec` function that runs a single SQL
 * statement. This keeps the migration decoupled from any specific
 * database driver.
 *
 * @param exec - Callback to execute a single SQL statement.
 * @param provider - Target backend.
 * @returns Migration result indicating whether it was applied.
 * @throws {Error} If any SQL statement fails.
 *
 * @example
 * ```ts
 * import { migrate } from '@recurrsive/graph';
 *
 * await migrate(
 *   async (sql) => { await pool.query(sql); },
 *   'postgresql_age',
 * );
 * ```
 */
export async function migrate(
  exec: (sql: string) => Promise<void> | void,
  provider: MigrationProvider,
): Promise<MigrationResult> {
  const statements = getMigrationStatements(provider);

  for (const stmt of statements) {
    await exec(stmt);
  }

  // Record that the migration was applied
  if (provider === 'postgresql_age') {
    await exec(
      `INSERT INTO recurrsive_migrations (name) VALUES ('${MIGRATION_NAME}') ON CONFLICT (name) DO NOTHING;`,
    );
  } else {
    await exec(
      `INSERT OR IGNORE INTO recurrsive_migrations (name) VALUES ('${MIGRATION_NAME}');`,
    );
  }

  return {
    applied: true,
    summary: `Applied migration "${MIGRATION_NAME}" for ${provider}`,
  };
}

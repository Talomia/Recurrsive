/**
 * @module client
 *
 * Factory function for creating a configured graph client instance.
 *
 * This is the primary entry point for consumers who want a graph
 * backend without caring about the concrete implementation.
 *
 * @packageDocumentation
 */

import type { GraphClient } from '@recurrsive/core';
import { GraphError } from '@recurrsive/core';
import type { ExtendedGraphClient } from './providers/age.js';
import { createAgeClient } from './providers/age.js';
import { createSqliteClient } from './providers/sqlite.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for creating a graph client. */
export interface GraphConfig {
  /**
   * Backend provider to use.
   *
   * - `'postgresql_age'` — PostgreSQL with Apache AGE extension
   *   (production).
   * - `'sqlite'` — Embedded SQLite via `better-sqlite3` (local / CLI).
   */
  provider: 'postgresql_age' | 'sqlite';

  /**
   * PostgreSQL connection string.
   * Required when `provider` is `'postgresql_age'`.
   *
   * @example `'postgresql://user:pass@localhost:5432/recurrsive'`
   */
  connectionString?: string;

  /**
   * File path for the SQLite database.
   * Required when `provider` is `'sqlite'`.
   * Use `':memory:'` for an ephemeral in-memory database.
   *
   * @example `'./data/recurrsive.db'`
   */
  sqlitePath?: string;

  /**
   * Maximum connection pool size (AGE only, default `10`).
   */
  poolSize?: number;

  /**
   * Whether to automatically run schema migrations on creation
   * (default `true`).
   */
  autoMigrate?: boolean;

  /**
   * Logical graph namespace (AGE only). Each project should use a distinct
   * namespace so clearing or querying one project cannot affect another.
   * Defaults to `recurrsive` for standalone/CLI consumers.
   */
  graphName?: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a graph client for the specified backend provider.
 *
 * This factory is the recommended way to obtain a graph client —
 * callers only need to supply a {@link GraphConfig} and receive a
 * fully-initialized {@link ExtendedGraphClient} ready for use.
 *
 * @param config - Graph client configuration.
 * @returns A connected and (optionally) migrated graph client.
 * @throws {GraphError} If required configuration is missing or
 *   connection / migration fails.
 *
 * @example
 * ```ts
 * import { createGraphClient } from '@recurrsive/graph';
 *
 * // SQLite for local development
 * const client = await createGraphClient({
 *   provider: 'sqlite',
 *   sqlitePath: './data/recurrsive.db',
 * });
 *
 * // PostgreSQL + AGE for production
 * const prodClient = await createGraphClient({
 *   provider: 'postgresql_age',
 *   connectionString: process.env.DATABASE_URL,
 * });
 * ```
 */
export async function createGraphClient(config: GraphConfig): Promise<ExtendedGraphClient> {
  const autoMigrate = config.autoMigrate ?? true;

  switch (config.provider) {
    case 'postgresql_age': {
      if (!config.connectionString) {
        throw new GraphError(
          'connectionString is required for the postgresql_age provider',
          'CONFIG_MISSING',
        );
      }
      return createAgeClient(
        {
          connectionString: config.connectionString,
          poolSize: config.poolSize,
          graphName: config.graphName,
        },
        autoMigrate,
      );
    }

    case 'sqlite': {
      if (!config.sqlitePath) {
        throw new GraphError(
          'sqlitePath is required for the sqlite provider',
          'CONFIG_MISSING',
        );
      }
      return createSqliteClient(
        { path: config.sqlitePath },
        autoMigrate,
      );
    }

    default: {
      const _exhaustive: never = config.provider;
      throw new GraphError(
        `Unknown graph provider: "${String(_exhaustive)}"`,
        'UNKNOWN_PROVIDER',
      );
    }
  }
}

/**
 * Create a read-only graph client (typed as {@link GraphClient}).
 *
 * This is a convenience wrapper that returns only the read interface,
 * useful for analyzers that should not mutate the graph.
 *
 * @param config - Graph client configuration.
 * @returns A connected, read-only graph client.
 * @throws {GraphError} If configuration or connection fails.
 */
export async function createReadOnlyGraphClient(config: GraphConfig): Promise<GraphClient> {
  return createGraphClient(config);
}

/**
 * @module @recurrsive/graph
 *
 * Knowledge Graph engine for Recurrsive — the digital twin storage
 * layer.
 *
 * Supports two backends:
 * - **PostgreSQL + Apache AGE** for production graph storage with
 *   native Cypher support.
 * - **SQLite** for local / CLI usage with recursive CTE-based graph
 *   traversal.
 *
 * ## Quick Start
 *
 * ```ts
 * import { createGraphClient } from '@recurrsive/graph';
 *
 * const client = await createGraphClient({
 *   provider: 'sqlite',
 *   sqlitePath: ':memory:',
 * });
 *
 * await client.upsertEntity(myEntity);
 * const entity = await client.getEntity(myEntity.id);
 * await client.dispose();
 * ```
 *
 * @packageDocumentation
 */

// ─── Client Factory ──────────────────────────────────────────────────────────

export {
  createGraphClient,
  createReadOnlyGraphClient,
  type GraphConfig,
} from './client.js';

// ─── Providers ───────────────────────────────────────────────────────────────

export {
  AgeGraphClient,
  createAgeClient,
  type AgeConfig,
  type ExtendedGraphClient,
  type GraphStats,
  SqliteGraphClient,
  createSqliteClient,
  type SqliteConfig,
} from './providers/index.js';

// ─── Migrations ──────────────────────────────────────────────────────────────

export {
  migrate,
  getMigrationStatements,
  MIGRATION_NAME,
  DEFAULT_AGE_GRAPH,
  assertSafeGraphName,
  type MigrationProvider,
  type MigrationResult,
} from './migrations/index.js';

// ─── Query Builders ──────────────────────────────────────────────────────────

export {
  findCallChain,
  findDependencyTree,
  findAIWorkflow,
  findDeadCode,
  findCircularDeps,
  findAllPromptsForAgent,
  findModelUsage,
  findEntitiesByPattern,
  type QueryDialect,
} from './queries/index.js';

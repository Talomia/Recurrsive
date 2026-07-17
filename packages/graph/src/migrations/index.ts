/**
 * @module migrations
 *
 * Barrel export for graph schema migrations.
 *
 * @packageDocumentation
 */

export {
  migrate,
  getMigrationStatements,
  MIGRATION_NAME,
  DEFAULT_AGE_GRAPH,
  assertSafeGraphName,
  type MigrationProvider,
  type MigrationResult,
} from './001_initial_schema.js';

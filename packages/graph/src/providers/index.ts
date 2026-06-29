/**
 * @module providers
 *
 * Barrel export for graph backend providers.
 *
 * @packageDocumentation
 */

export {
  AgeGraphClient,
  createAgeClient,
  type AgeConfig,
  type ExtendedGraphClient,
  type GraphStats,
} from './age.js';

export {
  SqliteGraphClient,
  createSqliteClient,
  type SqliteConfig,
} from './sqlite.js';

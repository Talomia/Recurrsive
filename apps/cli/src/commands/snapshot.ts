/**
 * @module @recurrsive/cli/commands/snapshot
 *
 * `recurrsive snapshot export` — Export the knowledge graph to a JSON file.
 * `recurrsive snapshot import <file>` — Import a snapshot JSON file into the graph.
 *
 * Snapshot files contain all entities and relationships from the SQLite
 * graph database, along with metadata (version, project name, timestamps,
 * and aggregate statistics).
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { Command } from 'commander';
import type { Entity, Relationship } from '@recurrsive/core';
import {
  createGraphClient,
  type ExtendedGraphClient,
} from '@recurrsive/graph';
import { loadConfig } from '../config/loader.js';
import {
  banner,
  header,
  success,
  error,
  info,
  bold,
  cyan,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Current snapshot format version. */
const SNAPSHOT_VERSION = '0.2.0';

// ---------------------------------------------------------------------------
// Snapshot Shape
// ---------------------------------------------------------------------------

/**
 * The JSON structure of a Recurrsive snapshot file.
 */
export interface Snapshot {
  /** Format version for forward-compatibility checks. */
  version: string;
  /** ISO-8601 timestamp of when the snapshot was exported. */
  exported_at: string;
  /** Name of the source project. */
  project: string;
  /** All entities in the graph at export time. */
  entities: Entity[];
  /** All relationships in the graph at export time. */
  relationships: Relationship[];
  /** Aggregate statistics. */
  stats: {
    entity_count: number;
    relationship_count: number;
    entity_types: Record<string, number>;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create and return a graph client from the current config.
 *
 * @returns The graph client, project root, and config.
 */
async function getGraphClient(): Promise<{
  client: ExtendedGraphClient;
  projectRoot: string;
  projectName: string;
}> {
  const { config, projectRoot } = await loadConfig();
  const dbPath =
    config.graph.connection_string ??
    resolve(projectRoot, '.recurrsive', 'graph.db');

  const client = await createGraphClient({
    provider: config.graph.provider,
    sqlitePath: config.graph.provider === 'sqlite' ? dbPath : undefined,
    connectionString:
      config.graph.provider === 'postgresql_age'
        ? config.graph.connection_string
        : undefined,
    autoMigrate: false,
  });

  const projectName = basename(projectRoot);

  return { client, projectRoot, projectName };
}

/**
 * Read all entities from the graph via raw SQL query.
 *
 * @param client - The graph client.
 * @returns Array of all entities.
 */
async function getAllEntities(client: ExtendedGraphClient): Promise<Entity[]> {
  const rows = (await client.query('SELECT * FROM entities')) as Entity[];
  return rows;
}

/**
 * Read all relationships from the graph via raw SQL query.
 *
 * @param client - The graph client.
 * @returns Array of all relationships.
 */
async function getAllRelationships(
  client: ExtendedGraphClient,
): Promise<Relationship[]> {
  const rows = (await client.query(
    'SELECT * FROM relationships',
  )) as Relationship[];
  return rows;
}

/**
 * Generate a default snapshot file name with a date stamp.
 *
 * @returns File name like `recurrsive-snapshot-2026-06-30.json`.
 */
function defaultSnapshotFilename(): string {
  const date = new Date().toISOString().slice(0, 10);
  return `recurrsive-snapshot-${date}.json`;
}

/**
 * Build entity-type counts from an array of entities.
 *
 * @param entities - The entities to count.
 * @returns Map of entity type → count.
 */
function entityTypeCounts(entities: Entity[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entities) {
    counts[e.type] = (counts[e.type] ?? 0) + 1;
  }
  return counts;
}

/**
 * Validate that a parsed object looks like a valid Recurrsive snapshot.
 *
 * @param data - The parsed JSON object to validate.
 * @returns `true` if the structure is valid.
 */
function isValidSnapshot(data: unknown): data is Snapshot {
  if (data === null || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj['version'] === 'string' &&
    Array.isArray(obj['entities']) &&
    Array.isArray(obj['relationships'])
  );
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `snapshot` command group on the Commander program.
 *
 * Sub-commands:
 * - `snapshot export [--output <path>]`
 * - `snapshot import <file>`
 *
 * @param program - The Commander program instance.
 */
export function registerSnapshotCommand(program: Command): void {
  const snapshotCmd = program
    .command('snapshot')
    .description('Export or import knowledge graph snapshots');

  // ── snapshot export ─────────────────────────────────────────────────────

  snapshotCmd
    .command('export')
    .description('Export the knowledge graph to a JSON snapshot file')
    .option('--output <path>', 'Output file path')
    .action(async (opts: { output?: string }) => {
      let client: ExtendedGraphClient | null = null;

      try {
        const result = await getGraphClient();
        client = result.client;

        banner();
        header('Snapshot Export');

        // Fetch all data
        info('Reading entities from knowledge graph...');
        const entities = await getAllEntities(client);

        info('Reading relationships from knowledge graph...');
        const relationships = await getAllRelationships(client);

        if (entities.length === 0 && relationships.length === 0) {
          error(
            'No data found in the knowledge graph. ' +
              `Run ${bold(cyan('recurrsive analyze'))} first.`,
          );
          return;
        }

        // Build snapshot
        const typeCounts = entityTypeCounts(entities);
        const snapshot: Snapshot = {
          version: SNAPSHOT_VERSION,
          exported_at: new Date().toISOString(),
          project: result.projectName,
          entities,
          relationships,
          stats: {
            entity_count: entities.length,
            relationship_count: relationships.length,
            entity_types: typeCounts,
          },
        };

        // Determine output path
        const outputPath = resolve(opts.output ?? defaultSnapshotFilename());
        const dir = resolve(outputPath, '..');
        await mkdir(dir, { recursive: true });

        // Write file
        await writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf-8');

        // Display stats
        console.log('');
        console.log(
          `  ${bold('Entities:')}        ${cyan(String(entities.length))}`,
        );
        console.log(
          `  ${bold('Relationships:')}   ${cyan(String(relationships.length))}`,
        );
        console.log('');

        // Entity type breakdown
        const typeRows = Object.entries(typeCounts)
          .sort(([, a], [, b]) => b - a)
          .map(([type, count]) => [type, String(count)]);

        if (typeRows.length > 0) {
          console.log(table(['Entity Type', 'Count'], typeRows));
          console.log('');
        }

        success(`Snapshot saved to ${dim(outputPath)}`);
        console.log('');
      } catch (err: unknown) {
        error(
          `Export failed: ${err instanceof Error ? err.message : String(err)}`,
        );
        info(
          `Ensure you have run ${bold(cyan('recurrsive analyze'))} first.`,
        );
      } finally {
        if (client) {
          await client.dispose();
        }
      }
    });

  // ── snapshot import ─────────────────────────────────────────────────────

  snapshotCmd
    .command('import <file>')
    .description('Import a JSON snapshot file into the knowledge graph')
    .action(async (file: string) => {
      let client: ExtendedGraphClient | null = null;

      try {
        const filePath = resolve(file);

        banner();
        header('Snapshot Import');

        // Validate file exists
        if (!existsSync(filePath)) {
          error(`Snapshot file not found: ${dim(filePath)}`);
          return;
        }

        // Read and parse
        info(`Reading snapshot from ${dim(filePath)}...`);
        const raw = await readFile(filePath, 'utf-8');

        let data: unknown;
        try {
          data = JSON.parse(raw);
        } catch {
          error('Invalid JSON: the snapshot file could not be parsed.');
          return;
        }

        // Validate structure
        if (!isValidSnapshot(data)) {
          error(
            'Invalid snapshot format: file must contain "version", "entities", and "relationships" fields.',
          );
          return;
        }

        const snapshot = data;

        info(`Snapshot version: ${bold(snapshot.version)}`);
        info(
          `Contains ${bold(cyan(String(snapshot.entities.length)))} entities and ` +
            `${bold(cyan(String(snapshot.relationships.length)))} relationships`,
        );
        console.log('');

        // Connect to graph
        const result = await getGraphClient();
        client = result.client;

        // Upsert entities
        info('Importing entities...');
        let entityCount = 0;
        for (const entity of snapshot.entities) {
          await client.upsertEntity(entity);
          entityCount++;
        }

        // Upsert relationships
        info('Importing relationships...');
        let relCount = 0;
        for (const rel of snapshot.relationships) {
          await client.upsertRelationship(rel);
          relCount++;
        }

        console.log('');
        console.log(
          `  ${bold('Entities imported:')}        ${cyan(String(entityCount))}`,
        );
        console.log(
          `  ${bold('Relationships imported:')}   ${cyan(String(relCount))}`,
        );
        console.log('');

        success('Snapshot imported successfully.');
        console.log('');
      } catch (err: unknown) {
        error(
          `Import failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      } finally {
        if (client) {
          await client.dispose();
        }
      }
    });
}

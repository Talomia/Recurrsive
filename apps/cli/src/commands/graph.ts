/**
 * @module @recurrsive/cli/commands/graph
 *
 * `recurrsive graph` — Explore the knowledge graph.
 *
 * Provides graph statistics, entity listing by type, search by
 * pattern, and neighbor exploration.
 *
 * @packageDocumentation
 */

import { resolve } from 'node:path';
import type { Command } from 'commander';
import type { EntityType } from '@recurrsive/core';
import {
  createGraphClient,
  type ExtendedGraphClient,
  type GraphStats,
} from '@recurrsive/graph';
import { loadConfig } from '../config/loader.js';
import {
  header,
  error,
  info,
  bold,
  cyan,
  dim,
  magenta,
  table,
  progressBar,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create and return a graph client from the current config.
 *
 * @returns The graph client and project root.
 */
async function getGraphClient(): Promise<{
  client: ExtendedGraphClient;
  projectRoot: string;
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

  return { client, projectRoot };
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `graph` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerGraphCommand(program: Command): void {
  program
    .command('graph')
    .description('Explore the knowledge graph')
    .option('--stats', 'Show entity/relationship counts by type')
    .option('--type <entityType>', 'List entities of a specific type')
    .option('--search <pattern>', 'Search entities by name')
    .option('--neighbors <id>', 'Show neighbors of an entity')
    .option('--depth <n>', 'Neighbor traversal depth', parseInt)
    .action(
      async (opts: {
        stats?: boolean;
        type?: string;
        search?: string;
        neighbors?: string;
        depth?: number;
      }) => {
        let client: ExtendedGraphClient | null = null;

        try {
          const result = await getGraphClient();
          client = result.client;

          // Default to --stats if no options given
          if (!opts.type && !opts.search && !opts.neighbors) {
            opts.stats = true;
          }

          // ── Stats ──────────────────────────────────────────────
          if (opts.stats) {
            const stats: GraphStats = await client.getStats();

            header('Knowledge Graph Statistics');

            console.log(
              `  ${bold('Total entities:')}       ${cyan(bold(String(stats.totalEntities)))}`,
            );
            console.log(
              `  ${bold('Total relationships:')}  ${cyan(bold(String(stats.totalRelationships)))}`,
            );
            console.log('');

            // Entity counts by type
            if (Object.keys(stats.entityCountsByType).length > 0) {
              console.log(bold('  Entities by type:'));
              console.log('');

              const entityRows = Object.entries(stats.entityCountsByType)
                .sort((a, b) => b[1] - a[1])
                .map(([type, count]) => [
                  type,
                  String(count),
                  progressBar(count, stats.totalEntities, 15),
                ]);

              console.log(table(['Type', 'Count', 'Distribution'], entityRows));
              console.log('');
            }

            // Relationship counts by type
            if (Object.keys(stats.relationshipCountsByType).length > 0) {
              console.log(bold('  Relationships by type:'));
              console.log('');

              const relRows = Object.entries(stats.relationshipCountsByType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 15)
                .map(([type, count]) => [type, String(count)]);

              console.log(table(['Type', 'Count'], relRows));

              const shown = relRows.length;
              const total = Object.keys(stats.relationshipCountsByType).length;
              if (shown < total) {
                console.log(
                  dim(`  ... and ${total - shown} more relationship types`),
                );
              }
              console.log('');
            }
          }

          // ── List by type ───────────────────────────────────────
          if (opts.type) {
            const entityType = opts.type as EntityType;

            header(`Entities: ${entityType}`);

            const entities = await client.getEntities(entityType);

            if (entities.length === 0) {
              info(`No entities of type "${entityType}" found.`);
            } else {
              const rows = entities.slice(0, 50).map((e) => [
                e.name,
                e.qualified_name.slice(0, 60) +
                  (e.qualified_name.length > 60 ? '…' : ''),
                e.source,
                e.id.slice(0, 8),
              ]);

              console.log(
                table(['Name', 'Qualified Name', 'Source', 'ID'], rows),
              );

              if (entities.length > 50) {
                console.log(
                  dim(`\n  Showing 50 of ${entities.length} entities.`),
                );
              }
              console.log('');
            }
          }

          // ── Search ─────────────────────────────────────────────
          if (opts.search) {
            const pattern = opts.search;

            header(`Search: "${pattern}"`);

            // Search across all entity types by iterating known types
            const entityTypes: EntityType[] = [
              'repository', 'file', 'function', 'class', 'module',
              'endpoint', 'prompt', 'agent', 'tool', 'model',
              'document', 'adr', 'rfc', 'api_contract',
              'dependency', 'config',
            ];

            const matches: Array<{
              name: string;
              type: string;
              qualifiedName: string;
              id: string;
            }> = [];

            for (const type of entityTypes) {
              const entities = await client.getEntities(type);
              for (const entity of entities) {
                if (
                  entity.name
                    .toLowerCase()
                    .includes(pattern.toLowerCase()) ||
                  entity.qualified_name
                    .toLowerCase()
                    .includes(pattern.toLowerCase())
                ) {
                  matches.push({
                    name: entity.name,
                    type: entity.type,
                    qualifiedName: entity.qualified_name,
                    id: entity.id,
                  });
                }
              }
            }

            if (matches.length === 0) {
              info(`No entities matching "${pattern}" found.`);
            } else {
              const rows = matches.slice(0, 50).map((m) => [
                m.name,
                m.type,
                m.qualifiedName.slice(0, 50) +
                  (m.qualifiedName.length > 50 ? '…' : ''),
                m.id.slice(0, 8),
              ]);

              console.log(
                `  Found ${bold(String(matches.length))} matches:\n`,
              );
              console.log(table(['Name', 'Type', 'Qualified Name', 'ID'], rows));

              if (matches.length > 50) {
                console.log(
                  dim(`\n  Showing 50 of ${matches.length} matches.`),
                );
              }
              console.log('');
            }
          }

          // ── Neighbors ──────────────────────────────────────────
          if (opts.neighbors) {
            const entityId = opts.neighbors;
            const depth = opts.depth ?? 1;

            const entity = await client.getEntity(entityId);
            if (!entity) {
              // Try prefix match
              error(`Entity not found: ${entityId}`);
              info(
                'Use a full UUID or search for the entity first with --search.',
              );
            } else {
              header(`Neighbors of: ${entity.name} (depth ${depth})`);

              console.log(
                `  ${bold('Entity:')}  ${cyan(entity.name)} (${entity.type})`,
              );
              console.log(`  ${bold('ID:')}      ${dim(entity.id)}`);
              console.log('');

              const subgraph = await client.getNeighbors(entityId, depth);

              if (subgraph.entities.length === 0) {
                info('No neighbors found.');
              } else {
                // Show connected entities
                const entityRows = subgraph.entities
                  .filter((e) => e.id !== entityId)
                  .map((e) => [
                    e.name,
                    e.type,
                    e.id.slice(0, 8),
                  ]);

                if (entityRows.length > 0) {
                  console.log(
                    bold('  Connected entities:\n'),
                  );
                  console.log(table(['Name', 'Type', 'ID'], entityRows));
                  console.log('');
                }

                // Show relationships
                if (subgraph.relationships.length > 0) {
                  console.log(bold('  Relationships:\n'));

                  const relRows = subgraph.relationships.map((r) => {
                    const sourceEntity = subgraph.entities.find(
                      (e) => e.id === r.source_id,
                    );
                    const targetEntity = subgraph.entities.find(
                      (e) => e.id === r.target_id,
                    );
                    return [
                      sourceEntity?.name ?? r.source_id.slice(0, 8),
                      magenta(r.type),
                      targetEntity?.name ?? r.target_id.slice(0, 8),
                    ];
                  });

                  console.log(table(['From', 'Relationship', 'To'], relRows));
                  console.log('');
                }
              }
            }
          }
        } catch (err: unknown) {
          error(
            `Graph error: ${err instanceof Error ? err.message : String(err)}`,
          );
          info(
            `Ensure you have run ${bold(cyan('recurrsive analyze'))} first.`,
          );
        } finally {
          if (client) {
            await client.dispose();
          }
        }
      },
    );
}

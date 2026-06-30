/**
 * @module @recurrsive/cli/commands/search
 *
 * `recurrsive search <query>` — Full-text search across the knowledge graph.
 *
 * Uses the SQLite FTS5 index to search entity names, qualified names,
 * and descriptions. Results are ranked by BM25 relevance.
 *
 * @packageDocumentation
 */

import { resolve } from 'node:path';
import type { Command } from 'commander';
import {
  createGraphClient,
  type ExtendedGraphClient,
  SqliteGraphClient,
} from '@recurrsive/graph';
import { loadConfig } from '../config/loader.js';
import {
  banner,
  header,
  error,
  info,
  bold,
  cyan,
  table,
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

/**
 * Truncate a string to a maximum length, appending an ellipsis if needed.
 *
 * @param str - The string to truncate.
 * @param maxLen - Maximum allowed length (default 60).
 * @returns The possibly-truncated string.
 */
function truncate(str: string, maxLen = 60): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen) + '…';
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `search` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('Full-text search across the knowledge graph (FTS5)')
    .option('--type <entityType>', 'Filter results by entity type')
    .option('--limit <number>', 'Maximum number of results', parseInt)
    .option('--json', 'Output results as JSON')
    .action(
      async (
        query: string,
        opts: {
          type?: string;
          limit?: number;
          json?: boolean;
        },
      ) => {
        let client: ExtendedGraphClient | null = null;

        try {
          const result = await getGraphClient();
          client = result.client;

          // searchEntities is available on SqliteGraphClient
          if (typeof (client as SqliteGraphClient).searchEntities !== 'function') {
            error('Full-text search is only supported with the SQLite graph provider.');
            return;
          }

          const limit = opts.limit ?? 20;
          const entities = await (client as SqliteGraphClient).searchEntities(
            query,
            {
              type: opts.type,
              limit,
            },
          );

          // ── JSON output ──────────────────────────────────────
          if (opts.json) {
            console.log(JSON.stringify(entities, null, 2));
            return;
          }

          // ── Table output ─────────────────────────────────────
          banner();
          header(`Search: "${query}"`);

          if (opts.type) {
            info(`Filtered by type: ${bold(opts.type)}`);
          }

          if (entities.length === 0) {
            info(`No results found for "${query}".`);
            console.log('');
            return;
          }

          console.log(
            `  Found ${bold(cyan(String(entities.length)))} result${entities.length !== 1 ? 's' : ''}:\n`,
          );

          const rows = entities.map((e) => [
            e.name,
            e.type,
            truncate(e.qualified_name, 50),
            truncate(e.description ?? '', 40),
          ]);

          console.log(
            table(
              ['Name', 'Type', 'Qualified Name', 'Description'],
              rows,
            ),
          );
          console.log('');
        } catch (err: unknown) {
          error(
            `Search error: ${err instanceof Error ? err.message : String(err)}`,
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

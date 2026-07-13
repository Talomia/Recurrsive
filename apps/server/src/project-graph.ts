import { createHash } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createGraphClient, type ExtendedGraphClient } from '@recurrsive/graph';
import { createLogger } from '@recurrsive/core';

const logger = createLogger({ context: { component: 'server:project-graph' } });
const clients = new Map<string, Promise<ExtendedGraphClient>>();

function projectKey(projectId: string): string {
  if (!projectId.trim()) throw new Error('A project ID is required for graph access.');
  return createHash('sha256').update(projectId).digest('hex').slice(0, 24);
}

export function projectGraphName(projectId: string): string {
  return `recurrsive_${projectKey(projectId)}`;
}

export function projectGraphPath(projectId: string): string {
  const configured = process.env['GRAPH_DATABASE_PATH'] ?? path.resolve('./data/recurrsive-graph.db');
  return path.join(path.dirname(configured), 'project-graphs', `${projectKey(projectId)}.db`);
}

async function createProjectGraph(projectId: string): Promise<ExtendedGraphClient> {
  const provider = (process.env['GRAPH_PROVIDER'] ?? 'sqlite') as 'sqlite' | 'postgresql_age';
  const connectionString = process.env['DATABASE_URL'];

  if (provider === 'postgresql_age' && connectionString) {
    return createGraphClient({
      provider: 'postgresql_age',
      connectionString,
      graphName: projectGraphName(projectId),
      autoMigrate: true,
    });
  }

  if (provider === 'postgresql_age') {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('DATABASE_URL is required for the postgresql_age graph provider in production.');
    }
    logger.warn('DATABASE_URL is unavailable; using the project-scoped SQLite graph provider.');
  }

  const sqlitePath = process.env['NODE_ENV'] === 'test' ? ':memory:' : projectGraphPath(projectId);
  if (sqlitePath !== ':memory:') await mkdir(path.dirname(sqlitePath), { recursive: true });
  return createGraphClient({ provider: 'sqlite', sqlitePath, autoMigrate: true });
}

/** Return the durable graph namespace owned by exactly one registered project. */
export async function getProjectGraph(projectId: string): Promise<ExtendedGraphClient> {
  const key = projectId.trim();
  let client = clients.get(key);
  if (!client) {
    client = createProjectGraph(key).catch((error) => {
      clients.delete(key);
      throw error;
    });
    clients.set(key, client);
  }
  return client;
}

/** Remove every graph entity owned by a project and release its client. */
export async function deleteProjectGraph(projectId: string): Promise<void> {
  const key = projectId.trim();
  const graph = await (clients.get(key) ?? createProjectGraph(key));
  await graph.clearAll();
  await graph.dispose();
  clients.delete(key);

  if ((process.env['GRAPH_PROVIDER'] ?? 'sqlite') !== 'postgresql_age' || !process.env['DATABASE_URL']) {
    const dbPath = projectGraphPath(key);
    await Promise.all([
      rm(dbPath, { force: true }),
      rm(`${dbPath}-wal`, { force: true }),
      rm(`${dbPath}-shm`, { force: true }),
    ]);
  }
}

export async function disposeProjectGraphs(): Promise<void> {
  const pending = [...clients.values()];
  clients.clear();
  await Promise.allSettled(pending.map(async (client) => (await client).dispose()));
}

/**
 * @module @recurrsive/server/routes/snapshots
 *
 * Snapshot export/import routes for persisting and restoring
 * knowledge graph state. Also provides comparison endpoints
 * for diffing analysis runs.
 *
 * @packageDocumentation
 */

import { readFileSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import type { Entity, Relationship, EntityType } from '@recurrsive/core';
import { nowISO, createLogger } from '@recurrsive/core';
import { state } from '../state.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveAnalysisHistory } from '../project-analysis.js';

const PKG_VERSION = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf-8')).version as string;

const logger = createLogger({ context: { component: 'server:routes:snapshots' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Snapshot file format. */
interface Snapshot {
  version: string;
  exported_at: string;
  project: string;
  entities: Entity[];
  relationships: Relationship[];
  stats: {
    entity_count: number;
    relationship_count: number;
    entity_types: Record<string, number>;
    relationship_types: Record<string, number>;
  };
}

/** Comparison result between two analysis runs. */
// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register snapshot management routes.
 *
 * @param app - Fastify instance.
 */
export async function registerSnapshotRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/snapshots/export
   *
   * Export the current knowledge graph state as a portable JSON snapshot.
   * Returns a full dump of all entities and relationships with metadata.
   */
  app.get('/api/v1/snapshots/export', { preHandler: [authMiddleware] }, async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze first.',
      });
    }

    try {
      const graph = state.getGraph();
      const graphStats = await graph.getStats();

      // Fetch all entities by type
      const allEntities: Entity[] = [];
      for (const type of Object.keys(graphStats.entityCountsByType)) {
        const typed = await graph.getEntities(type as EntityType);
        allEntities.push(...typed);
      }

      // Fetch all relationships
      const allRelationships: Relationship[] = [];
      for (const entity of allEntities) {
        const rels = await graph.getRelationships(entity.id);
        for (const rel of rels) {
          // Avoid duplicates (relationships are returned for both source and target)
          if (!allRelationships.some((r) => r.id === rel.id)) {
            allRelationships.push(rel);
          }
        }
      }

      const snapshot: Snapshot = {
        version: PKG_VERSION,
        exported_at: nowISO(),
        project: state.getProjectPath() ?? 'unknown',
        entities: allEntities,
        relationships: allRelationships,
        stats: {
          entity_count: allEntities.length,
          relationship_count: allRelationships.length,
          entity_types: graphStats.entityCountsByType,
          relationship_types: graphStats.relationshipCountsByType,
        },
      };

      return reply
        .status(200)
        .header('Content-Type', 'application/json')
        .header(
          'Content-Disposition',
          `attachment; filename="recurrsive-snapshot-${new Date().toISOString().slice(0, 10)}.json"`,
        )
        .send(snapshot);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to export snapshot', { error: message });
      return reply.status(500).send({
        error: 'Export failed',
        message,
      });
    }
  });

  /**
   * POST /api/v1/snapshots/import
   *
   * Import a previously exported snapshot into the knowledge graph.
   * Upserts all entities and relationships from the snapshot file.
   */
  app.post<{ Body: Snapshot }>('/api/v1/snapshots/import', { preHandler: [authMiddleware] }, async (request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze first to initialize the graph.',
      });
    }

    const body = request.body;

    // Validate snapshot structure
    if (!body || !Array.isArray(body.entities) || !Array.isArray(body.relationships)) {
      return reply.status(400).send({
        error: 'Bad request',
        message: 'Invalid snapshot format. Must contain "entities" and "relationships" arrays.',
      });
    }

    try {
      const graph = state.getGraph();
      let entitiesImported = 0;
      let relationshipsImported = 0;

      // Upsert entities
      for (const entity of body.entities) {
        await graph.upsertEntity(entity);
        entitiesImported++;
      }

      // Upsert relationships
      for (const rel of body.relationships) {
        await graph.upsertRelationship(rel);
        relationshipsImported++;
      }

      return reply.status(200).send({
        message: 'Snapshot imported successfully',
        data: {
          entities_imported: entitiesImported,
          relationships_imported: relationshipsImported,
          source_version: body.version ?? 'unknown',
          source_project: body.project ?? 'unknown',
          exported_at: body.exported_at ?? 'unknown',
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to import snapshot', { error: message });
      return reply.status(500).send({
        error: 'Import failed',
        message,
      });
    }
  });

  /** Compare two recorded analysis history entries by ID. */
  app.get<{ Querystring: { run_a?: string; run_b?: string } }>(
    '/api/v1/analysis/compare',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      if (!request.query.run_a || !request.query.run_b) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'run_a and run_b history IDs are required.',
        });
      }
      const history = await resolveAnalysisHistory(request);
      const runA = history.find((entry) => entry.id === request.query.run_a);
      const runB = history.find((entry) => entry.id === request.query.run_b);
      if (!runA || !runB) {
        return reply.status(404).send({ error: 'Not Found', message: 'One or both analysis runs were not found.' });
      }
      const present = (entry: typeof runA) => ({
        id: entry.id,
        label: `Run ${new Date(entry.startedAt).toISOString()}`,
        date: entry.startedAt,
        health_score: entry.healthScore,
        findings: entry.findingCount,
        opportunities: entry.opportunityCount,
        duration_ms: entry.durationMs,
        status: entry.status,
        categories: [],
      });
      const healthDelta = runA.healthScore === null || runB.healthScore === null
        ? null
        : Math.round((runB.healthScore - runA.healthScore) * 10) / 10;

      return reply.status(200).send({
        data: {
          runA: present(runA),
          runB: present(runB),
          health_delta: healthDelta,
          findings_delta: runB.findingCount - runA.findingCount,
          opportunities_delta: runB.opportunityCount - runA.opportunityCount,
          duration_delta_ms: runB.durationMs - runA.durationMs,
        },
      });
    },
  );
}

/**
 * @module @recurrsive/server/routes/snapshots
 *
 * Snapshot export/import routes for persisting and restoring
 * knowledge graph state. Also provides comparison endpoints
 * for diffing analysis runs.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import type { Entity, Relationship } from '@recurrsive/core';
import { nowISO, createLogger } from '@recurrsive/core';
import { state } from '../state.js';

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
interface ComparisonResult {
  added_findings: number;
  removed_findings: number;
  changed_findings: number;
  added_opportunities: number;
  removed_opportunities: number;
  severity_changes: Array<{
    id: string;
    title: string;
    from: string;
    to: string;
  }>;
  summary: string;
}

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
  app.get('/api/v1/snapshots/export', async (_request, reply) => {
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
        const typed = await graph.getEntities(type as any);
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
        version: '0.5.5',
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
  app.post<{ Body: Snapshot }>('/api/v1/snapshots/import', async (request, reply) => {
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

  /**
   * GET /api/v1/analysis/compare
   *
   * Compare the current analysis results against a baseline.
   * Returns a diff of findings and opportunities. Uses analysis
   * history entries if available.
   *
   * Query params:
   * - baseline (optional) — Index in history to compare against (default: previous run)
   */
  app.get<{ Querystring: { baseline?: string } }>(
    '/api/v1/analysis/compare',
    async (request, reply) => {
      if (!state.isInitialized()) {
        return reply.status(503).send({
          error: 'Server not initialized',
          message: 'Run POST /api/v1/analyze first.',
        });
      }

      const cache = state.getAnalysisCache();
      if (!cache) {
        return reply.status(404).send({
          error: 'No analysis results',
          message: 'No cached analysis results available for comparison.',
        });
      }

      const history = state.getAnalysisHistory();
      if (history.length < 2) {
        // No previous run to compare against — return current as "all new"
        const currentFindings = cache.findings;
        const currentOpportunities = cache.opportunities;

        return reply.status(200).send({
          data: {
            comparison: {
              added_findings: currentFindings.length,
              removed_findings: 0,
              changed_findings: 0,
              added_opportunities: currentOpportunities.length,
              removed_opportunities: 0,
              severity_changes: [],
              summary: `First analysis run: ${currentFindings.length} findings, ${currentOpportunities.length} opportunities.`,
            } satisfies ComparisonResult,
            is_first_run: true,
            current: {
              finding_count: currentFindings.length,
              opportunity_count: currentOpportunities.length,
              analyzed_at: cache.analyzedAt,
            },
          },
        });
      }

      // Compare current vs previous run from history
      const baselineIdx = request.query.baseline
        ? parseInt(request.query.baseline, 10)
        : history.length - 2;

      const previous = history[baselineIdx];
      const current = history[history.length - 1];

      if (!previous || !current) {
        return reply.status(400).send({
          error: 'Bad request',
          message: 'Invalid baseline index.',
        });
      }

      const findingDelta = cache.findings.length - (previous?.findingCount ?? 0);
      const opportunityDelta = cache.opportunities.length - (previous?.opportunityCount ?? 0);

      const comparison: ComparisonResult = {
        added_findings: Math.max(0, findingDelta),
        removed_findings: Math.max(0, -findingDelta),
        changed_findings: 0,
        added_opportunities: Math.max(0, opportunityDelta),
        removed_opportunities: Math.max(0, -opportunityDelta),
        severity_changes: [],
        summary: [
          `Compared run #${history.length} against run #${baselineIdx + 1}.`,
          findingDelta > 0 ? `${findingDelta} new finding(s).` : '',
          findingDelta < 0 ? `${-findingDelta} finding(s) resolved.` : '',
          opportunityDelta > 0 ? `${opportunityDelta} new opportunity(ies).` : '',
          opportunityDelta < 0 ? `${-opportunityDelta} opportunity(ies) resolved.` : '',
          findingDelta === 0 && opportunityDelta === 0 ? 'No changes detected.' : '',
        ].filter(Boolean).join(' '),
      };

      return reply.status(200).send({
        data: {
          comparison,
          is_first_run: false,
          current: {
            run: history.length,
            finding_count: cache.findings.length,
            opportunity_count: cache.opportunities.length,
            analyzed_at: cache.analyzedAt,
          },
          baseline: {
            run: baselineIdx + 1,
            finding_count: previous.findingCount,
            opportunity_count: previous.opportunityCount,
            analyzed_at: previous.startedAt,
          },
        },
      });
    },
  );
}

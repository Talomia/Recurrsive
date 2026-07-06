/**
 * @module @recurrsive/server/routes/export
 *
 * Data export routes for generating downloadable analysis data
 * in JSON, CSV, and Markdown formats.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger, generateId, nowISO } from '@recurrsive/core';
import { state } from '../state.js';
import { store } from '../store.js';
import { authMiddleware } from '../middleware/auth.js';

const logger = createLogger({ context: { component: 'server:routes:export' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = 'json' | 'csv' | 'markdown' | 'sarif';
type ExportScope = 'findings' | 'opportunities' | 'health' | 'all';

interface ExportRequest {
  format: ExportFormat;
  scope: ExportScope;
  filters?: {
    severity?: string;
    category?: string;
    status?: string;
  };
}

interface ExportRecord {
  export_id: string;
  format: ExportFormat;
  scope: ExportScope;
  status: string;
  download_url: string;
  record_count: number;
  generated_at: string;
  filters?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_FORMATS: ExportFormat[] = ['json', 'csv', 'markdown', 'sarif'];
const VALID_SCOPES: ExportScope[] = ['findings', 'opportunities', 'health', 'all'];

// ---------------------------------------------------------------------------
// Content generators — uses real state data when available
// ---------------------------------------------------------------------------

function generateContent(format: ExportFormat, scope: ExportScope): string {
  const cache = state.isInitialized() ? state.getAnalysisCache() : null;

  // Build data from real analysis cache when available
  const findings = cache?.findings.map((f) => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
    category: f.category,
  })) ?? [];

  const opportunities = cache?.opportunities.map((o) => ({
    id: o.id,
    title: o.title,
    severity: o.severity,
    status: o.status,
  })) ?? [];

  let healthData = { overall_score: 0, dimensions: {} as Record<string, number> };
  if (state.isInitialized() && cache) {
    try {
      const hs = state.getHealthScore();
      healthData = {
        overall_score: hs.overall,
        dimensions: Object.fromEntries(
          hs.dimensions.map((d) => [d.dimension, d.score]),
        ),
      };
    } catch (err: unknown) {
      // Health score unavailable; continue with defaults
      logger.warn(`Could not fetch health score for export: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const data = { findings, opportunities, health: healthData };
  const scopeData =
    scope === 'all' ? data : { [scope]: data[scope as keyof typeof data] };

  switch (format) {
    case 'json':
      return JSON.stringify(scopeData, null, 2);

    case 'csv': {
      const rows = findings.map(
        f => `${f.id},${f.title},${f.severity},${f.category}`,
      );
      return ['id,title,severity,category', ...rows].join('\n');
    }

    case 'markdown': {
      const lines = [
        `# Export — ${scope}`,
        '',
        `Generated at: ${nowISO()}`,
        '',
        '| ID | Title | Severity |',
        '|---|---|---|',
        ...findings.map(f => `| ${f.id} | ${f.title} | ${f.severity} |`),
      ];
      return lines.join('\n');
    }

    case 'sarif': {
      const sarifReport = {
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [
          {
            tool: {
              driver: {
                name: 'Recurrsive',
                informationUri: 'https://recurrsive.dev',
                version: '1.0.0',
                rules: findings.map(f => ({
                  id: f.id,
                  shortDescription: { text: f.title },
                  defaultConfiguration: {
                    level: f.severity === 'critical' || f.severity === 'high'
                      ? 'error'
                      : f.severity === 'medium'
                        ? 'warning'
                        : 'note',
                  },
                  properties: { category: f.category },
                })),
              },
            },
            results: findings.map(f => ({
              ruleId: f.id,
              level: f.severity === 'critical' || f.severity === 'high'
                ? 'error'
                : f.severity === 'medium'
                  ? 'warning'
                  : 'note',
              message: { text: f.title },
              properties: {
                severity: f.severity,
                category: f.category,
              },
            })),
          },
        ],
      };
      return JSON.stringify(sarifReport, null, 2);
    }

    default:
      return JSON.stringify(scopeData, null, 2);
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register export routes.
 *
 * @param app - Fastify instance.
 */
export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
  /**
   * POST /api/v1/export
   *
   * Create a new data export.
   */
  app.post<{ Body: ExportRequest }>(
    '/api/v1/export',
    async (request, reply) => {
      const { format, scope, filters } = request.body ?? ({} as ExportRequest);

      if (!format || !VALID_FORMATS.includes(format)) {
        return reply.status(400).send({
          error: 'Invalid format',
          message: `Format must be one of: ${VALID_FORMATS.join(', ')}`,
          valid_formats: VALID_FORMATS,
        });
      }

      if (!scope || !VALID_SCOPES.includes(scope)) {
        return reply.status(400).send({
          error: 'Invalid scope',
          message: `Scope must be one of: ${VALID_SCOPES.join(', ')}`,
          valid_scopes: VALID_SCOPES,
        });
      }

      // Compute actual record count from analysis state
      const cache = state.isInitialized() ? state.getAnalysisCache() : null;
      const findingsCount = cache?.findings.length ?? 0;
      const opportunitiesCount = cache?.opportunities.length ?? 0;
      const recordCount = scope === 'all'
        ? findingsCount + opportunitiesCount + 1 /* health */
        : scope === 'health'
          ? 1
          : scope === 'findings'
            ? findingsCount
            : opportunitiesCount;

      const exportId = `exp_${generateId().slice(0, 8)}`;
      const record: ExportRecord = {
        export_id: exportId,
        format,
        scope,
        status: 'completed',
        download_url: `/api/v1/export/${exportId}/download`,
        record_count: recordCount,
        generated_at: nowISO(),
        filters: filters as Record<string, string> | undefined,
      };

      store.set<ExportRecord>('exports', exportId, record);
      logger.info(`Export created: ${exportId} (${format}/${scope})`);

      return reply.status(201).send({ data: record });
    },
  );

  /**
   * GET /api/v1/export/:id/download
   *
   * Download a previously generated export.
   */
  app.get<{ Params: { id: string } }>(
    '/api/v1/export/:id/download',
    async (request, reply) => {
      const { id } = request.params;
      const record = store.get<ExportRecord>('exports', id);

      if (!record) {
        return reply.status(404).send({
          error: 'Export not found',
          message: `No export with ID "${id}" found`,
        });
      }

      const content = generateContent(record.format, record.scope);

      const contentTypes: Record<ExportFormat, string> = {
        json: 'application/json; charset=utf-8',
        csv: 'text/csv; charset=utf-8',
        markdown: 'text/markdown; charset=utf-8',
        sarif: 'application/sarif+json; charset=utf-8',
      };

      return reply
        .header('Content-Type', contentTypes[record.format])
        .header(
          'Content-Disposition',
          `attachment; filename="recurrsive-export-${id}.${record.format === 'markdown' ? 'md' : record.format}"`,
        )
        .send(content);
    },
  );

  /**
   * GET /api/v1/export/history
   *
   * List all past exports.
   */
  app.get('/api/v1/export/history', async (_request, reply) => {
    const all = store.all<ExportRecord>('exports');
    return reply.send({
      data: all,
      total: all.length,
    });
  });

  /**
   * GET /api/v1/export/findings/:format
   *
   * Direct download of findings in the specified format. Supported
   * formats: `json`, `csv`, `markdown`. The dashboard's report page
   * uses these for one-click download buttons.
   */
  app.get<{ Params: { format: string } }>(
    '/api/v1/export/findings/:format',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { format } = request.params;

      if (!VALID_FORMATS.includes(format as ExportFormat)) {
        return reply.status(400).send({
          error: 'Invalid format',
          message: `Format must be one of: ${VALID_FORMATS.join(', ')}`,
          valid_formats: VALID_FORMATS,
        });
      }

      const content = generateContent(format as ExportFormat, 'findings');
      const ext = format === 'markdown' ? 'md' : format;

      const contentTypes: Record<string, string> = {
        json: 'application/json; charset=utf-8',
        csv: 'text/csv; charset=utf-8',
        markdown: 'text/markdown; charset=utf-8',
        sarif: 'application/sarif+json; charset=utf-8',
      };

      return reply
        .header('Content-Type', contentTypes[format] ?? 'application/octet-stream')
        .header(
          'Content-Disposition',
          `attachment; filename="recurrsive-findings.${ext}"`,
        )
        .send(content);
    },
  );

  /**
   * GET /api/v1/export/graph/:format
   *
   * Direct download of graph data in the specified format. Supported
   * formats: `json`, `csv`, `graphml`. The dashboard's report page
   * uses these for one-click download buttons.
   */
  app.get<{ Params: { format: string } }>(
    '/api/v1/export/graph/:format',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { format } = request.params;
      const validGraphFormats = ['json', 'csv', 'graphml'];

      if (!validGraphFormats.includes(format)) {
        return reply.status(400).send({
          error: 'Invalid format',
          message: `Format must be one of: ${validGraphFormats.join(', ')}`,
          valid_formats: validGraphFormats,
        });
      }

      if (!state.isInitialized()) {
        return reply.status(503).send({
          error: 'Server not initialized',
          message: 'Run POST /api/v1/analyze first.',
        });
      }

      try {
        const graph = state.getGraph();
        const stats = await graph.getStats();

        // Gather all entities
        const allEntities: Array<{ id: string; name: string; type: string; qualified_name: string }> = [];
        for (const entityType of Object.keys(stats.entityCountsByType)) {
          try {
            const entities = await graph.getEntities(entityType as any);
            allEntities.push(...entities.map((e) => ({
              id: e.id,
              name: e.name,
              type: e.type,
              qualified_name: e.qualified_name,
            })));
          } catch {
            // Skip inaccessible entity types
          }
        }

        // Gather all relationships using direct SQL listing if available
        let allRels: Array<{ id: string; source_id: string; target_id: string; type: string }> = [];
        if ('listRelationships' in graph && typeof graph.listRelationships === 'function') {
          const result = await graph.listRelationships({ limit: 10000 });
          allRels = result.data.map((rel: { id: string; source_id: string; target_id: string; type: string }) => ({
            id: rel.id,
            source_id: rel.source_id,
            target_id: rel.target_id,
            type: rel.type,
          }));
        } else {
          // Fallback for non-AGE providers
          const seenIds = new Set<string>();
          for (const entity of allEntities) {
            try {
              const rels = await graph.getRelationships(entity.id);
              for (const rel of rels) {
                if (!seenIds.has(rel.id)) {
                  seenIds.add(rel.id);
                  allRels.push({
                    id: rel.id,
                    source_id: rel.source_id,
                    target_id: rel.target_id,
                    type: rel.type,
                  });
                }
              }
            } catch {
              // Skip errors
            }
          }
        }

        let content: string;
        let contentType: string;
        let ext: string;

        switch (format) {
          case 'json':
            content = JSON.stringify({ entities: allEntities, relationships: allRels }, null, 2);
            contentType = 'application/json; charset=utf-8';
            ext = 'json';
            break;

          case 'csv': {
            const entityRows = allEntities.map((e) => `entity,${e.id},${e.name},${e.type},${e.qualified_name}`);
            const relRows = allRels.map((r) => `relationship,${r.id},${r.source_id},${r.target_id},${r.type}`);
            content = ['kind,id,col1,col2,col3', ...entityRows, ...relRows].join('\n');
            contentType = 'text/csv; charset=utf-8';
            ext = 'csv';
            break;
          }

          case 'graphml': {
            const xmlEntities = allEntities.map(
              (e) =>
                `    <node id="${e.id}">\n      <data key="name">${escapeXml(e.name)}</data>\n      <data key="type">${escapeXml(e.type)}</data>\n    </node>`,
            );
            const xmlEdges = allRels.map(
              (r) =>
                `    <edge id="${r.id}" source="${r.source_id}" target="${r.target_id}">\n      <data key="type">${escapeXml(r.type)}</data>\n    </edge>`,
            );
            content = [
              '<?xml version="1.0" encoding="UTF-8"?>',
              '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">',
              '  <key id="name" for="node" attr.name="name" attr.type="string"/>',
              '  <key id="type" for="all" attr.name="type" attr.type="string"/>',
              '  <graph id="G" edgedefault="directed">',
              ...xmlEntities,
              ...xmlEdges,
              '  </graph>',
              '</graphml>',
            ].join('\n');
            contentType = 'application/xml; charset=utf-8';
            ext = 'graphml';
            break;
          }

          default:
            content = '{}';
            contentType = 'application/octet-stream';
            ext = 'bin';
        }

        return reply
          .header('Content-Type', contentType)
          .header(
            'Content-Disposition',
            `attachment; filename="recurrsive-graph.${ext}"`,
          )
          .send(content);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to export graph data', { error: message });
        return reply.status(500).send({
          error: 'Graph export failed',
          message,
        });
      }
    },
  );

  /**
   * GET /api/v1/export/report
   *
   * Generate a comprehensive report and return metadata with download URL.
   * Accepts optional `format` query param (json, csv, markdown; default: markdown).
   */
  app.get<{ Querystring: { format?: string } }>(
    '/api/v1/export/report',
    async (request, reply) => {
      const format = (request.query.format ?? 'markdown') as ExportFormat;

      if (!VALID_FORMATS.includes(format)) {
        return reply.status(400).send({
          error: 'Invalid format',
          message: `Format must be one of: ${VALID_FORMATS.join(', ')}`,
          valid_formats: VALID_FORMATS,
        });
      }

      const exportId = `rpt_${generateId().slice(0, 8)}`;
      const generatedAt = nowISO();

      // Compute record count from analysis state
      const cache = state.isInitialized() ? state.getAnalysisCache() : null;
      const recordCount = (cache?.findings.length ?? 0) + (cache?.opportunities.length ?? 0) + 1;

      const record: ExportRecord = {
        export_id: exportId,
        format,
        scope: 'all',
        status: 'completed',
        download_url: `/api/v1/export/${exportId}/download`,
        record_count: recordCount,
        generated_at: generatedAt,
      };

      store.set<ExportRecord>('exports', exportId, record);
      logger.info(`Report generated: ${exportId} (${format})`);

      return reply.status(200).send({
        data: {
          report_url: record.download_url,
          format,
          generated_at: generatedAt,
        },
      });
    },
  );
}

/** Escape special XML characters in a string. */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

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
import type { EntityType } from '@recurrsive/core';
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
  /** Project the export was generated for; download regenerates from this project. */
  project_id?: string;
  filters?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_FORMATS: ExportFormat[] = ['json', 'csv', 'markdown', 'sarif'];
const VALID_SCOPES: ExportScope[] = ['findings', 'opportunities', 'health', 'all'];

// ---------------------------------------------------------------------------
// Escaping helpers
// ---------------------------------------------------------------------------

/** Quote a CSV field per RFC 4180 (only when quoting is required). */
function csvField(value: unknown): string {
  const s = String(value ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Join values into an RFC-4180 CSV row. */
function csvRow(values: unknown[]): string {
  return values.map(csvField).join(',');
}

/** Escape a value for use inside a Markdown table cell. */
function mdCell(value: unknown): string {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ');
}

// ---------------------------------------------------------------------------
// Content generators — uses real state data when available
// ---------------------------------------------------------------------------

async function generateContent(format: ExportFormat, scope: ExportScope, projectId?: string): Promise<string> {
  const cache = await state.loadCacheForProject(projectId);

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

  let healthData = { overall_score: null as number | null, dimensions: {} as Record<string, number> };
  if (cache) {
    try {
      const hs = await state.getHealthScoreForProject(projectId);
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

  const includeFindings = scope === 'findings' || scope === 'all';
  const includeOpportunities = scope === 'opportunities' || scope === 'all';
  const includeHealth = scope === 'health' || scope === 'all';

  switch (format) {
    case 'json':
      return JSON.stringify(scopeData, null, 2);

    case 'csv': {
      // Every format honors `scope` — the delivered artifact must match
      // the stored record_count for its scope.
      if (scope === 'findings') {
        return [
          'id,title,severity,category',
          ...findings.map((f) => csvRow([f.id, f.title, f.severity, f.category])),
        ].join('\n');
      }
      if (scope === 'opportunities') {
        return [
          'id,title,severity,status',
          ...opportunities.map((o) => csvRow([o.id, o.title, o.severity, o.status])),
        ].join('\n');
      }
      if (scope === 'health') {
        return [
          'metric,score',
          csvRow(['overall', healthData.overall_score ?? '']),
          ...Object.entries(healthData.dimensions).map(([dim, score]) => csvRow([dim, score])),
        ].join('\n');
      }
      // scope === 'all': one unified table covering all three record kinds
      return [
        'record_type,id,title,severity,category,status,score',
        ...findings.map((f) => csvRow(['finding', f.id, f.title, f.severity, f.category, '', ''])),
        ...opportunities.map((o) => csvRow(['opportunity', o.id, o.title, o.severity, '', o.status, ''])),
        csvRow(['health', 'overall', '', '', '', '', healthData.overall_score ?? '']),
        ...Object.entries(healthData.dimensions).map(([dim, score]) =>
          csvRow(['health', dim, '', '', '', '', score]),
        ),
      ].join('\n');
    }

    case 'markdown': {
      const lines = [
        `# Export — ${scope}`,
        '',
        `Generated at: ${nowISO()}`,
        '',
      ];
      if (includeFindings) {
        lines.push('## Findings', '');
        lines.push('| ID | Title | Severity | Category |');
        lines.push('|---|---|---|---|');
        lines.push(
          ...findings.map(
            (f) => `| ${mdCell(f.id)} | ${mdCell(f.title)} | ${mdCell(f.severity)} | ${mdCell(f.category)} |`,
          ),
        );
        lines.push('');
      }
      if (includeOpportunities) {
        lines.push('## Opportunities', '');
        lines.push('| ID | Title | Severity | Status |');
        lines.push('|---|---|---|---|');
        lines.push(
          ...opportunities.map(
            (o) => `| ${mdCell(o.id)} | ${mdCell(o.title)} | ${mdCell(o.severity)} | ${mdCell(o.status)} |`,
          ),
        );
        lines.push('');
      }
      if (includeHealth) {
        lines.push('## Health', '');
        lines.push('| Metric | Score |');
        lines.push('|---|---|');
        lines.push(`| overall | ${mdCell(healthData.overall_score ?? 'n/a')} |`);
        lines.push(
          ...Object.entries(healthData.dimensions).map(
            ([dim, score]) => `| ${mdCell(dim)} | ${mdCell(score)} |`,
          ),
        );
        lines.push('');
      }
      return lines.join('\n');
    }

    case 'sarif': {
      const toLevel = (severity: string): string =>
        severity === 'critical' || severity === 'high'
          ? 'error'
          : severity === 'medium'
            ? 'warning'
            : 'note';

      // SARIF also honors scope: findings and/or opportunities become
      // results; a health-only export carries the health data as run
      // properties with zero results.
      const items = [
        ...(includeFindings
          ? findings.map((f) => ({
              id: f.id,
              title: f.title,
              severity: f.severity,
              properties: { severity: f.severity, category: f.category, kind: 'finding' },
            }))
          : []),
        ...(includeOpportunities
          ? opportunities.map((o) => ({
              id: o.id,
              title: o.title,
              severity: o.severity,
              properties: { severity: o.severity, status: o.status, kind: 'opportunity' },
            }))
          : []),
      ];

      const sarifReport = {
        $schema: 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json',
        version: '2.1.0',
        runs: [
          {
            tool: {
              driver: {
                name: 'Recurrsive',
                informationUri: 'https://recurrsive.dev',
                version: '1.0.0',
                rules: items.map((item) => ({
                  id: item.id,
                  shortDescription: { text: item.title },
                  defaultConfiguration: { level: toLevel(item.severity) },
                  properties: item.properties,
                })),
              },
            },
            results: items.map((item) => ({
              ruleId: item.id,
              level: toLevel(item.severity),
              message: { text: item.title },
              properties: item.properties,
            })),
            ...(includeHealth ? { properties: { health: healthData } } : {}),
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
  app.post<{ Body: ExportRequest; Querystring: { projectId?: string } }>(
    '/api/v1/export',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { format, scope, filters } = request.body ?? ({} as ExportRequest);
      const projectId = request.query.projectId;

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

      // Compute actual record count from the requested project's analysis state
      const cache = await state.loadCacheForProject(projectId);
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
        ...(projectId ? { project_id: projectId } : {}),
        filters: filters as Record<string, string> | undefined,
      };

      await store.set<ExportRecord>('exports', exportId, record);
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
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params;
      const record = await store.get<ExportRecord>('exports', id);

      if (!record) {
        return reply.status(404).send({
          error: 'Export not found',
          message: `No export with ID "${id}" found`,
        });
      }

      const content = await generateContent(record.format, record.scope, record.project_id);

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
  app.get('/api/v1/export/history', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const all = await store.all<ExportRecord>('exports');
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
  app.get<{ Params: { format: string }; Querystring: { projectId?: string } }>(
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

      const content = await generateContent(format as ExportFormat, 'findings', request.query.projectId);
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

      try {
        const graph = await state.getGraph((request.query as { projectId?: string } | undefined)?.projectId);
        const stats = await graph.getStats();

        // Gather all entities
        const allEntities: Array<{ id: string; name: string; type: string; qualified_name: string }> = [];
        for (const entityType of Object.keys(stats.entityCountsByType)) {
          try {
            const entities = await graph.getEntities(entityType as EntityType);
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
            const entityRows = allEntities.map((e) => csvRow(['entity', e.id, e.name, e.type, e.qualified_name]));
            const relRows = allRels.map((r) => csvRow(['relationship', r.id, r.source_id, r.target_id, r.type]));
            content = ['kind,id,col1,col2,col3', ...entityRows, ...relRows].join('\n');
            contentType = 'text/csv; charset=utf-8';
            ext = 'csv';
            break;
          }

          case 'graphml': {
            const xmlEntities = allEntities.map(
              (e) =>
                `    <node id="${escapeXml(e.id)}">\n      <data key="name">${escapeXml(e.name)}</data>\n      <data key="type">${escapeXml(e.type)}</data>\n    </node>`,
            );
            const xmlEdges = allRels.map(
              (r) =>
                `    <edge id="${escapeXml(r.id)}" source="${escapeXml(r.source_id)}" target="${escapeXml(r.target_id)}">\n      <data key="type">${escapeXml(r.type)}</data>\n    </edge>`,
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
  app.get<{ Querystring: { format?: string; projectId?: string } }>(
    '/api/v1/export/report',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const format = (request.query.format ?? 'markdown') as ExportFormat;
      const projectId = request.query.projectId;

      if (!VALID_FORMATS.includes(format)) {
        return reply.status(400).send({
          error: 'Invalid format',
          message: `Format must be one of: ${VALID_FORMATS.join(', ')}`,
          valid_formats: VALID_FORMATS,
        });
      }

      const exportId = `rpt_${generateId().slice(0, 8)}`;
      const generatedAt = nowISO();

      // Compute record count from the requested project's analysis state
      const cache = await state.loadCacheForProject(projectId);
      const recordCount = (cache?.findings.length ?? 0) + (cache?.opportunities.length ?? 0) + 1;

      const record: ExportRecord = {
        export_id: exportId,
        format,
        scope: 'all',
        status: 'completed',
        download_url: `/api/v1/export/${exportId}/download`,
        record_count: recordCount,
        generated_at: generatedAt,
        ...(projectId ? { project_id: projectId } : {}),
      };

      await store.set<ExportRecord>('exports', exportId, record);
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

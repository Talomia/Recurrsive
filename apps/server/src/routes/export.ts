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

const logger = createLogger({ context: { component: 'server:routes:export' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = 'json' | 'csv' | 'markdown';
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
// In-memory store
// ---------------------------------------------------------------------------

const exportHistory: ExportRecord[] = [];

const VALID_FORMATS: ExportFormat[] = ['json', 'csv', 'markdown'];
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
    } catch { /* use default */ }
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
        return reply.code(400).send({
          error: 'Invalid format',
          message: `Format must be one of: ${VALID_FORMATS.join(', ')}`,
          valid_formats: VALID_FORMATS,
        });
      }

      if (!scope || !VALID_SCOPES.includes(scope)) {
        return reply.code(400).send({
          error: 'Invalid scope',
          message: `Scope must be one of: ${VALID_SCOPES.join(', ')}`,
          valid_scopes: VALID_SCOPES,
        });
      }

      const exportId = `exp_${generateId().slice(0, 8)}`;
      const record: ExportRecord = {
        export_id: exportId,
        format,
        scope,
        status: 'completed',
        download_url: `/api/v1/export/${exportId}/download`,
        record_count: scope === 'all' ? 6 : scope === 'health' ? 1 : 3,
        generated_at: nowISO(),
        filters: filters as Record<string, string> | undefined,
      };

      exportHistory.push(record);
      logger.info(`Export created: ${exportId} (${format}/${scope})`);

      return reply.code(201).send(record);
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
      const record = exportHistory.find(r => r.export_id === id);

      if (!record) {
        return reply.code(404).send({
          error: 'Export not found',
          message: `No export with ID "${id}" found`,
        });
      }

      const content = generateContent(record.format, record.scope);

      const contentTypes: Record<ExportFormat, string> = {
        json: 'application/json; charset=utf-8',
        csv: 'text/csv; charset=utf-8',
        markdown: 'text/markdown; charset=utf-8',
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
    return reply.send({
      data: exportHistory,
      total: exportHistory.length,
    });
  });
}

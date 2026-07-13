/**
 * @module @recurrsive/server/routes/reports
 *
 * Report generation routes for markdown, HTML, SARIF, and JSON formats.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createLogger } from '@recurrsive/core';
import { generateReport } from '@recurrsive/presentation';
import { authMiddleware } from '../middleware/auth.js';
import { requireProjectScope, resolveAnalysis } from '../project-analysis.js';

const logger = createLogger({ context: { component: 'server:routes:reports' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportParams {
  format: string;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register report generation routes.
 *
 * @param app - Fastify instance.
 */
export async function registerReportRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/reports/:format
   *
   * Generate and download a report in the specified format.
   * Supported formats: markdown, html, sarif, json.
   */
  app.get<{ Params: ReportParams }>(
    '/api/v1/reports/:format',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const project = await requireProjectScope(request);
      const { cache } = await resolveAnalysis(request);
      if (!cache) {
        return reply.status(404).send({
          error: 'No analysis results available',
          message: 'Run an analysis first via POST /api/v1/analyze',
        });
      }

      const format = request.params.format.toLowerCase();
      const opportunities = cache.opportunities;
      const projectName = project.name;

      logger.info(`Generating ${format} report`);

      try {
        switch (format) {
          case 'markdown':
          case 'md': {
            const report = generateReport(opportunities, 'markdown', {
              title: `Recurrsive Report — ${projectName}`,
            });
            return reply
              .header('Content-Type', 'text/markdown; charset=utf-8')
              .header('Content-Disposition', 'attachment; filename="recurrsive-report.md"')
              .send(report);
          }

          case 'html': {
            const report = generateReport(opportunities, 'html', {
              title: `Recurrsive Report — ${projectName}`,
            });
            return reply
              .header('Content-Type', 'text/html; charset=utf-8')
              .header('Content-Disposition', 'attachment; filename="recurrsive-report.html"')
              .send(report);
          }

          case 'sarif': {
            const sarifReport = generateReport(opportunities, 'sarif', {
              title: `Recurrsive Report — ${projectName}`,
            });
            return reply
              .header('Content-Type', 'application/json; charset=utf-8')
              .header('Content-Disposition', 'attachment; filename="recurrsive-report.sarif.json"')
              .send(sarifReport);
          }

          case 'json': {
            const jsonReport = generateReport(opportunities, 'json', {
              title: `Recurrsive Report — ${projectName}`,
            });
            return reply
              .header('Content-Type', 'application/json; charset=utf-8')
              .header('Content-Disposition', 'attachment; filename="recurrsive-report.json"')
              .send(jsonReport);
          }

          default:
            return reply.status(400).send({
              error: 'Unsupported report format',
              message: `Format "${format}" is not supported. Use: markdown, html, sarif, json`,
              supported_formats: ['markdown', 'html', 'sarif', 'json'],
            });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error('Failed to generate report', { error: message, format });
        return reply.status(500).send({
          error: 'Internal server error',
          message: 'Operation failed.',
        });
      }
    },
  );
}

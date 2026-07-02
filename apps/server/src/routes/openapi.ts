/**
 * @module @recurrsive/server/routes/openapi
 *
 * Auto-generated OpenAPI 3.1 specification for the Recurrsive API.
 * Serves the spec at /api/v1/openapi.json and a simple Swagger UI at /api/docs.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Recurrsive API',
    version: '0.5.2',
    description: 'Engineering Intelligence Platform — REST API for analysis, graph queries, opportunities, reports, and platform management.',
    license: { name: 'Apache-2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
    contact: { name: 'Recurrsive Team', email: 'api@recurrsive.dev', url: 'https://recurrsive.dev' },
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local development' },
    { url: 'https://api.recurrsive.dev', description: 'Production' },
  ],
  tags: [
    { name: 'Health', description: 'Health check and system status' },
    { name: 'Analysis', description: 'Code analysis and findings' },
    { name: 'Opportunities', description: 'Improvement opportunities' },
    { name: 'Graph', description: 'Knowledge graph queries' },
    { name: 'Reports', description: 'Report generation' },
    { name: 'Timeline', description: 'Analysis timeline and history' },
    { name: 'Snapshots', description: 'Graph snapshots' },
    { name: 'Analytics', description: 'Platform analytics and metrics' },
    { name: 'Projects', description: 'Project management' },
    { name: 'Forecasting', description: 'Trend forecasting' },
    { name: 'Simulation', description: 'What-if simulation' },
    { name: 'Experiments', description: 'A/B experiments' },
    { name: 'Cloud', description: 'Cloud instance management' },
    { name: 'Marketplace', description: 'Extension marketplace' },
    { name: 'Partners', description: 'Partner program' },
    { name: 'Auth', description: 'Authentication and SSO' },
    { name: 'Audit', description: 'Audit logging' },
    { name: 'Policies', description: 'Governance policies' },
    { name: 'Secrets', description: 'Secrets management' },
    { name: 'Multi-Tenant', description: 'Multi-tenant management' },
    { name: 'Notifications', description: 'Notifications and webhooks' },
    { name: 'Scheduling', description: 'Report scheduling' },
    { name: 'Batch', description: 'Batch operations' },
    { name: 'Search', description: 'Full-text search' },
    { name: 'Export', description: 'Data export' },
    { name: 'Plugins', description: 'Plugin management' },
    { name: 'GraphQL', description: 'GraphQL endpoint' },
  ],
  paths: {
    '/api/v1/health': {
      get: {
        tags: ['Health'],
        summary: 'Health check',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'System health status',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
          },
        },
      },
    },
    '/api/v1/health/detailed': {
      get: {
        tags: ['Health'],
        summary: 'Detailed health check with component status',
        operationId: 'getHealthDetailed',
        responses: { '200': { description: 'Detailed health status' } },
      },
    },
    '/api/v1/analysis': {
      post: {
        tags: ['Analysis'],
        summary: 'Start a new analysis',
        operationId: 'startAnalysis',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  target: { type: 'string', description: 'Target path or repository URL' },
                  options: { type: 'object', description: 'Analysis options' },
                },
                required: ['target'],
              },
            },
          },
        },
        responses: { '202': { description: 'Analysis started' } },
      },
    },
    '/api/v1/analysis/{id}': {
      get: {
        tags: ['Analysis'],
        summary: 'Get analysis status and results',
        operationId: 'getAnalysis',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Analysis result' } },
      },
    },
    '/api/v1/findings': {
      get: {
        tags: ['Analysis'],
        summary: 'List findings with filtering',
        operationId: 'getFindings',
        parameters: [
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: 'Paginated findings list' } },
      },
    },
    '/api/v1/opportunities': {
      get: {
        tags: ['Opportunities'],
        summary: 'List improvement opportunities',
        operationId: 'getOpportunities',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] } },
        ],
        responses: { '200': { description: 'Opportunities list' } },
      },
    },
    '/api/v1/graph/entities': {
      get: {
        tags: ['Graph'],
        summary: 'Query knowledge graph entities',
        operationId: 'getEntities',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 100 } },
        ],
        responses: { '200': { description: 'Entity list' } },
      },
    },
    '/api/v1/graph/relationships': {
      get: {
        tags: ['Graph'],
        summary: 'Query knowledge graph relationships',
        operationId: 'getRelationships',
        responses: { '200': { description: 'Relationship list' } },
      },
    },
    '/api/v1/graph/stats': {
      get: {
        tags: ['Graph'],
        summary: 'Knowledge graph statistics',
        operationId: 'getGraphStats',
        responses: { '200': { description: 'Graph statistics' } },
      },
    },
    '/api/v1/reports': {
      get: {
        tags: ['Reports'],
        summary: 'List available reports',
        operationId: 'getReports',
        responses: { '200': { description: 'Reports list' } },
      },
      post: {
        tags: ['Reports'],
        summary: 'Generate a new report',
        operationId: 'generateReport',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { format: { type: 'string', enum: ['html', 'json', 'pdf', 'markdown'] } } } } },
        },
        responses: { '202': { description: 'Report generation started' } },
      },
    },
    '/api/v1/marketplace/extensions': {
      get: {
        tags: ['Marketplace'],
        summary: 'List marketplace extensions',
        operationId: 'getMarketplaceExtensions',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['analyzer', 'collector', 'policy', 'intelligence-pack'] } },
          { name: 'source', in: 'query', schema: { type: 'string', enum: ['built-in', 'community'] } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['downloads', 'rating', 'name', 'newest'] } },
        ],
        responses: { '200': { description: 'Extension list with categories and counts' } },
      },
      post: {
        tags: ['Marketplace'],
        summary: 'Submit a new extension',
        operationId: 'submitExtension',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string', enum: ['analyzer', 'collector', 'policy', 'intelligence-pack'] },
                  description: { type: 'string' },
                  repositoryUrl: { type: 'string', format: 'uri' },
                  author: { type: 'string' },
                  version: { type: 'string' },
                },
                required: ['name', 'category', 'description'],
              },
            },
          },
        },
        responses: { '201': { description: 'Extension submitted for review' } },
      },
    },
    '/api/v1/marketplace/stats': {
      get: { tags: ['Marketplace'], summary: 'Marketplace statistics', operationId: 'getMarketplaceStats', responses: { '200': { description: 'Stats' } } },
    },
    '/api/v1/partners': {
      get: {
        tags: ['Partners'],
        summary: 'List partners',
        operationId: 'getPartners',
        parameters: [
          { name: 'tier', in: 'query', schema: { type: 'string', enum: ['platinum', 'gold', 'silver'] } },
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'region', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Partner list with tier counts' } },
      },
    },
    '/api/v1/partners/apply': {
      post: {
        tags: ['Partners'],
        summary: 'Submit partner application',
        operationId: 'applyPartner',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  companyName: { type: 'string' },
                  contactEmail: { type: 'string', format: 'email' },
                  partnerType: { type: 'string', enum: ['system-integrator', 'consulting', 'technology', 'cloud-provider'] },
                },
                required: ['companyName', 'contactEmail', 'partnerType'],
              },
            },
          },
        },
        responses: { '201': { description: 'Application submitted' } },
      },
    },
    '/api/v1/partners/certifications': {
      get: { tags: ['Partners'], summary: 'List certification tracks', operationId: 'getCertifications', responses: { '200': { description: 'Certification list' } } },
    },
    '/api/v1/partners/stats': {
      get: { tags: ['Partners'], summary: 'Partner program statistics', operationId: 'getPartnerStats', responses: { '200': { description: 'Stats' } } },
    },
  },
  components: {
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
          version: { type: 'string' },
          uptime: { type: 'number' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      Finding: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          rule: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
          message: { type: 'string' },
          location: { type: 'object' },
          evidence: { type: 'object' },
        },
      },
      Opportunity: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          category: { type: 'string' },
          priority: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
          impact: { type: 'object' },
          recommendation: { type: 'string' },
        },
      },
      Entity: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          name: { type: 'string' },
          properties: { type: 'object' },
        },
      },
    },
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      apiKey: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
    },
  },
  security: [{ bearerAuth: [] }, { apiKey: [] }],
};

export async function registerOpenAPIRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/openapi.json
   *
   * Serves the OpenAPI 3.1 specification.
   */
  app.get('/api/v1/openapi.json', async (_request, reply) => {
    return reply.header('Content-Type', 'application/json').send(OPENAPI_SPEC);
  });

  /**
   * GET /api/docs
   *
   * Serves a minimal Swagger UI page.
   */
  app.get('/api/docs', async (_request, reply) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Recurrsive API — Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0a0a0f; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui { max-width: 1200px; margin: 0 auto; padding: 20px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/api/v1/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
    return reply.header('Content-Type', 'text/html').send(html);
  });
}

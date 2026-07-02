/**
 * @module @recurrsive/server/routes/openapi
 *
 * Auto-generated OpenAPI 3.1 specification for the Recurrsive API.
 * Serves the spec at /api/v1/openapi.json and a simple Swagger UI at /api/docs.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { VERSION } from '@recurrsive/core';

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'Recurrsive API',
    version: VERSION,
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
    { name: 'Webhooks', description: 'Webhook management' },
    { name: 'Confidence', description: 'Prediction confidence and calibration' },
    { name: 'Config', description: 'Server configuration and feature flags' },
    { name: 'PullRequests', description: 'Pull request generation and management' },
    { name: 'IntelligencePacks', description: 'Pre-built reasoning configurations' },
    { name: 'Findings', description: 'Analysis findings' },
  ],
  paths: {
    // -----------------------------------------------------------------------
    // Health
    // -----------------------------------------------------------------------
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Basic health check',
        operationId: 'getBasicHealth',
        responses: { '200': { description: 'Server is running' } },
      },
    },
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
    '/api/v1/health-score': {
      get: {
        tags: ['Health'],
        summary: 'Overall project health score',
        operationId: 'getHealthScore',
        responses: { '200': { description: 'Health score with component breakdown' } },
      },
    },
    '/api/v1/metrics/performance': {
      get: {
        tags: ['Health'],
        summary: 'Performance metrics',
        operationId: 'getPerformanceMetrics',
        responses: { '200': { description: 'Server performance metrics' } },
      },
    },

    // -----------------------------------------------------------------------
    // Analysis
    // -----------------------------------------------------------------------
    '/api/v1/analyze': {
      post: {
        tags: ['Analysis'],
        summary: 'Trigger a new analysis run',
        operationId: 'triggerAnalysis',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  path: { type: 'string', description: 'Absolute path to the project' },
                  analyzers: { type: 'array', items: { type: 'string' }, description: 'Optional analyzer IDs' },
                  include_reasoning: { type: 'boolean', description: 'Include reasoning in results' },
                },
                required: ['path'],
              },
            },
          },
        },
        responses: { '202': { description: 'Analysis started' } },
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
    '/api/v1/analysis/status': {
      get: {
        tags: ['Analysis'],
        summary: 'Get current analysis status',
        operationId: 'getAnalysisStatus',
        responses: { '200': { description: 'Current analysis status and progress' } },
      },
    },
    '/api/v1/analysis/history': {
      get: {
        tags: ['Analysis'],
        summary: 'List analysis history',
        operationId: 'getAnalysisHistory',
        responses: { '200': { description: 'List of past analysis runs' } },
      },
    },
    '/api/v1/analysis/compare': {
      get: {
        tags: ['Analysis'],
        summary: 'Compare current analysis against a baseline',
        operationId: 'getAnalysisCompare',
        parameters: [
          { name: 'baseline', in: 'query', schema: { type: 'string' }, description: 'Baseline history index to compare against' },
        ],
        responses: { '200': { description: 'Diff of findings and opportunities' } },
      },
    },

    // -----------------------------------------------------------------------
    // Findings
    // -----------------------------------------------------------------------
    '/api/v1/findings': {
      get: {
        tags: ['Findings'],
        summary: 'List findings with filtering',
        operationId: 'getFindings',
        parameters: [
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'analyzer', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: 'Paginated findings list' } },
      },
    },
    '/api/v1/findings/{id}': {
      get: {
        tags: ['Findings'],
        summary: 'Get a specific finding by ID',
        operationId: 'getFinding',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Finding detail' } },
      },
    },
    '/api/v1/findings/summary': {
      get: {
        tags: ['Findings'],
        summary: 'Findings summary with counts by severity',
        operationId: 'getFindingsSummary',
        responses: { '200': { description: 'Findings summary' } },
      },
    },

    // -----------------------------------------------------------------------
    // Opportunities
    // -----------------------------------------------------------------------
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

    // -----------------------------------------------------------------------
    // Graph
    // -----------------------------------------------------------------------
    '/api/v1/graph/entities': {
      get: {
        tags: ['Graph'],
        summary: 'Query knowledge graph entities',
        operationId: 'getEntities',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'Entity list' } },
      },
    },
    '/api/v1/graph/entities/{id}': {
      get: {
        tags: ['Graph'],
        summary: 'Get a single entity by ID with relationships',
        operationId: 'getEntity',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Entity detail with relationships' } },
      },
    },
    '/api/v1/graph/entities/{id}/neighbors': {
      get: {
        tags: ['Graph'],
        summary: 'Traverse entity neighborhood',
        operationId: 'getEntityNeighbors',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'depth', in: 'query', schema: { type: 'integer', default: 1, minimum: 1, maximum: 5 } },
        ],
        responses: { '200': { description: 'Entity neighborhood graph' } },
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
    '/api/v1/graph/search': {
      get: {
        tags: ['Graph'],
        summary: 'Full-text search for graph entities',
        operationId: 'searchGraph',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
          { name: 'type', in: 'query', schema: { type: 'string' }, description: 'Filter by entity type' },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
        ],
        responses: { '200': { description: 'BM25-ranked search results' } },
      },
    },

    // -----------------------------------------------------------------------
    // Reports
    // -----------------------------------------------------------------------
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
    '/api/v1/reports/{format}': {
      get: {
        tags: ['Reports'],
        summary: 'Generate and download a report in the specified format',
        operationId: 'getReportByFormat',
        parameters: [
          { name: 'format', in: 'path', required: true, schema: { type: 'string', enum: ['markdown', 'html', 'sarif', 'json'] } },
        ],
        responses: { '200': { description: 'Report content in the requested format' } },
      },
    },

    // -----------------------------------------------------------------------
    // Timeline
    // -----------------------------------------------------------------------
    '/api/v1/timeline': {
      get: {
        tags: ['Timeline'],
        summary: 'Get analysis timeline',
        operationId: 'getTimeline',
        responses: { '200': { description: 'Analysis timeline entries' } },
      },
    },
    '/api/v1/timeline/snapshots': {
      get: {
        tags: ['Timeline'],
        summary: 'List timeline snapshots',
        operationId: 'getTimelineSnapshots',
        responses: { '200': { description: 'Timeline snapshot list' } },
      },
    },
    '/api/v1/timeline/trends': {
      get: {
        tags: ['Timeline'],
        summary: 'Get timeline trend data',
        operationId: 'getTimelineTrends',
        responses: { '200': { description: 'Trend data over time' } },
      },
    },

    // -----------------------------------------------------------------------
    // Snapshots
    // -----------------------------------------------------------------------
    '/api/v1/snapshots/export': {
      get: {
        tags: ['Snapshots'],
        summary: 'Export current analysis snapshot',
        operationId: 'exportSnapshot',
        responses: { '200': { description: 'Snapshot data for export' } },
      },
    },
    '/api/v1/snapshots/import': {
      post: {
        tags: ['Snapshots'],
        summary: 'Import a snapshot',
        operationId: 'importSnapshot',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', description: 'Snapshot data to import' } } },
        },
        responses: { '200': { description: 'Snapshot imported successfully' } },
      },
    },

    // -----------------------------------------------------------------------
    // Analytics
    // -----------------------------------------------------------------------
    '/api/v1/analytics/summary': {
      get: {
        tags: ['Analytics'],
        summary: 'Get analytics summary with trends',
        operationId: 'getAnalyticsSummary',
        responses: { '200': { description: 'Analytics summary with trend data' } },
      },
    },
    '/api/v1/analytics/top-categories': {
      get: {
        tags: ['Analytics'],
        summary: 'Get top finding categories',
        operationId: 'getTopCategories',
        responses: { '200': { description: 'Category breakdown with counts and percentages' } },
      },
    },

    // -----------------------------------------------------------------------
    // Projects
    // -----------------------------------------------------------------------
    '/api/v1/projects': {
      get: {
        tags: ['Projects'],
        summary: 'List projects',
        operationId: 'getProjects',
        responses: { '200': { description: 'Project list' } },
      },
      post: {
        tags: ['Projects'],
        summary: 'Create a new project',
        operationId: 'createProject',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Project created' } },
      },
    },
    '/api/v1/projects/{id}': {
      get: {
        tags: ['Projects'],
        summary: 'Get project by ID',
        operationId: 'getProject',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Project detail' } },
      },
      put: {
        tags: ['Projects'],
        summary: 'Update a project',
        operationId: 'updateProject',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'Project updated' } },
      },
      delete: {
        tags: ['Projects'],
        summary: 'Delete a project',
        operationId: 'deleteProject',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Project deleted' } },
      },
    },
    '/api/v1/projects/compare/health': {
      get: {
        tags: ['Projects'],
        summary: 'Compare health scores across projects',
        operationId: 'compareProjectHealth',
        responses: { '200': { description: 'Health comparison across projects' } },
      },
    },

    // -----------------------------------------------------------------------
    // Forecasting
    // -----------------------------------------------------------------------
    '/api/v1/forecasting/health': {
      get: {
        tags: ['Forecasting'],
        summary: 'Forecast health score trends',
        operationId: 'forecastHealth',
        parameters: [
          { name: 'horizon', in: 'query', schema: { type: 'integer', default: 30 }, description: 'Forecast horizon in days' },
          { name: 'history', in: 'query', schema: { type: 'integer', default: 90 }, description: 'Historical days to use' },
        ],
        responses: { '200': { description: 'Health forecast with trend data' } },
      },
    },
    '/api/v1/forecasting/what-if': {
      post: {
        tags: ['Forecasting'],
        summary: 'Run a what-if forecast scenario',
        operationId: 'forecastWhatIf',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'What-if scenario results' } },
      },
    },
    '/api/v1/forecasting/evolution': {
      get: {
        tags: ['Forecasting'],
        summary: 'Get codebase evolution trends',
        operationId: 'getEvolution',
        responses: { '200': { description: 'Evolution trend data' } },
      },
    },

    // -----------------------------------------------------------------------
    // Simulation
    // -----------------------------------------------------------------------
    '/api/v1/simulations': {
      get: {
        tags: ['Simulation'],
        summary: 'List simulations',
        operationId: 'getSimulations',
        responses: { '200': { description: 'Simulation list' } },
      },
      post: {
        tags: ['Simulation'],
        summary: 'Create a new simulation',
        operationId: 'createSimulation',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Simulation created' } },
      },
    },
    '/api/v1/simulations/{id}': {
      get: {
        tags: ['Simulation'],
        summary: 'Get simulation by ID',
        operationId: 'getSimulation',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Simulation detail' } },
      },
    },

    // -----------------------------------------------------------------------
    // Pull Requests
    // -----------------------------------------------------------------------
    '/api/v1/pull-requests': {
      get: {
        tags: ['PullRequests'],
        summary: 'List generated pull requests',
        operationId: 'getPullRequests',
        responses: { '200': { description: 'Pull request list' } },
      },
    },
    '/api/v1/pull-requests/{id}': {
      get: {
        tags: ['PullRequests'],
        summary: 'Get pull request by ID',
        operationId: 'getPullRequest',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Pull request detail' } },
      },
    },
    '/api/v1/pull-requests/generate': {
      post: {
        tags: ['PullRequests'],
        summary: 'Generate a new pull request from opportunities',
        operationId: 'generatePullRequest',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Pull request generated' } },
      },
    },
    '/api/v1/pull-requests/{id}/submit': {
      post: {
        tags: ['PullRequests'],
        summary: 'Submit a generated pull request to the repository',
        operationId: 'submitPullRequest',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Pull request submitted' } },
      },
    },

    // -----------------------------------------------------------------------
    // Intelligence Packs
    // -----------------------------------------------------------------------
    '/api/v1/intelligence-packs': {
      get: {
        tags: ['IntelligencePacks'],
        summary: 'List available intelligence packs',
        operationId: 'getIntelligencePacks',
        responses: { '200': { description: 'Intelligence pack list' } },
      },
    },
    '/api/v1/intelligence-packs/{id}': {
      get: {
        tags: ['IntelligencePacks'],
        summary: 'Get intelligence pack by ID',
        operationId: 'getIntelligencePack',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Intelligence pack detail' } },
      },
    },
    '/api/v1/intelligence-packs/{id}/install': {
      post: {
        tags: ['IntelligencePacks'],
        summary: 'Install an intelligence pack',
        operationId: 'installIntelligencePack',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Intelligence pack installed' } },
      },
    },
    '/api/v1/intelligence-packs/{id}/uninstall': {
      delete: {
        tags: ['IntelligencePacks'],
        summary: 'Uninstall an intelligence pack',
        operationId: 'uninstallIntelligencePack',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Intelligence pack uninstalled' } },
      },
    },

    // -----------------------------------------------------------------------
    // Experiments
    // -----------------------------------------------------------------------
    '/api/v1/experiments': {
      get: {
        tags: ['Experiments'],
        summary: 'List experiments',
        operationId: 'getExperiments',
        responses: { '200': { description: 'Experiment list' } },
      },
      post: {
        tags: ['Experiments'],
        summary: 'Create a new experiment',
        operationId: 'createExperiment',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Experiment created' } },
      },
    },
    '/api/v1/experiments/{id}': {
      get: {
        tags: ['Experiments'],
        summary: 'Get experiment by ID',
        operationId: 'getExperiment',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Experiment detail' } },
      },
    },
    '/api/v1/experiments/{id}/status': {
      put: {
        tags: ['Experiments'],
        summary: 'Update experiment status',
        operationId: 'updateExperimentStatus',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object', properties: { status: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Experiment status updated' } },
      },
    },

    // -----------------------------------------------------------------------
    // Cloud
    // -----------------------------------------------------------------------
    '/api/v1/cloud/info': {
      get: {
        tags: ['Cloud'],
        summary: 'Get cloud instance information',
        operationId: 'getCloudInfo',
        responses: { '200': { description: 'Cloud instance info' } },
      },
    },
    '/api/v1/cloud/services': {
      get: {
        tags: ['Cloud'],
        summary: 'List cloud services',
        operationId: 'getCloudServices',
        responses: { '200': { description: 'Cloud services list' } },
      },
    },
    '/api/v1/cloud/benchmarks': {
      post: {
        tags: ['Cloud'],
        summary: 'Run cloud benchmarks',
        operationId: 'runCloudBenchmarks',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'Benchmark results' } },
      },
    },
    '/api/v1/cloud/benchmarks/report': {
      get: {
        tags: ['Cloud'],
        summary: 'Get benchmark report',
        operationId: 'getCloudBenchmarkReport',
        parameters: [
          { name: 'industry', in: 'query', schema: { type: 'string' }, description: 'Filter by industry' },
        ],
        responses: { '200': { description: 'Benchmark report' } },
      },
    },
    '/api/v1/cloud/patterns': {
      get: {
        tags: ['Cloud'],
        summary: 'List cloud architecture patterns',
        operationId: 'getCloudPatterns',
        responses: { '200': { description: 'Cloud patterns list' } },
      },
    },
    '/api/v1/cloud/patterns/{id}': {
      get: {
        tags: ['Cloud'],
        summary: 'Get cloud pattern by ID',
        operationId: 'getCloudPattern',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Cloud pattern detail' } },
      },
    },
    '/api/v1/cloud/partners': {
      get: {
        tags: ['Cloud'],
        summary: 'List cloud partners',
        operationId: 'getCloudPartners',
        responses: { '200': { description: 'Cloud partner list' } },
      },
    },
    '/api/v1/cloud/partners/{id}': {
      get: {
        tags: ['Cloud'],
        summary: 'Get cloud partner by ID',
        operationId: 'getCloudPartner',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Cloud partner detail' } },
      },
    },
    '/api/v1/cloud/partners/apply': {
      post: {
        tags: ['Cloud'],
        summary: 'Apply to become a cloud partner',
        operationId: 'applyCloudPartner',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Cloud partner application submitted' } },
      },
    },

    // -----------------------------------------------------------------------
    // Marketplace
    // -----------------------------------------------------------------------
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
    '/api/v1/marketplace/extensions/{id}': {
      get: {
        tags: ['Marketplace'],
        summary: 'Get extension detail',
        operationId: 'getMarketplaceExtension',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Extension detail' } },
      },
    },
    '/api/v1/marketplace/categories': {
      get: {
        tags: ['Marketplace'],
        summary: 'List marketplace categories with counts',
        operationId: 'getMarketplaceCategories',
        responses: { '200': { description: 'Category list with counts' } },
      },
    },
    '/api/v1/marketplace/stats': {
      get: { tags: ['Marketplace'], summary: 'Marketplace statistics', operationId: 'getMarketplaceStats', responses: { '200': { description: 'Stats' } } },
    },

    // -----------------------------------------------------------------------
    // Partners
    // -----------------------------------------------------------------------
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
    '/api/v1/partners/{id}': {
      get: {
        tags: ['Partners'],
        summary: 'Get partner detail',
        operationId: 'getPartner',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Partner detail' } },
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

    // -----------------------------------------------------------------------
    // Auth
    // -----------------------------------------------------------------------
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login with username and password',
        operationId: 'login',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string' },
                },
                required: ['username', 'password'],
              },
            },
          },
        },
        responses: { '200': { description: 'Authentication token' } },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Refresh authentication token',
        operationId: 'refreshToken',
        responses: { '200': { description: 'Refreshed token' } },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user info',
        operationId: 'getCurrentUser',
        responses: { '200': { description: 'Current user profile' } },
      },
    },
    '/api/v1/api-keys': {
      get: {
        tags: ['Auth'],
        summary: 'List API keys',
        operationId: 'getApiKeys',
        responses: { '200': { description: 'API key list' } },
      },
      post: {
        tags: ['Auth'],
        summary: 'Create a new API key',
        operationId: 'createApiKey',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  scopes: { type: 'array', items: { type: 'string' } },
                },
                required: ['name'],
              },
            },
          },
        },
        responses: { '201': { description: 'API key created' } },
      },
    },
    '/api/v1/api-keys/{id}': {
      delete: {
        tags: ['Auth'],
        summary: 'Revoke an API key',
        operationId: 'revokeApiKey',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'API key revoked' } },
      },
    },

    // -----------------------------------------------------------------------
    // SSO
    // -----------------------------------------------------------------------
    '/api/v1/sso/providers': {
      get: {
        tags: ['Auth'],
        summary: 'List SSO providers',
        operationId: 'getSsoProviders',
        responses: { '200': { description: 'SSO provider list' } },
      },
    },
    '/api/v1/sso/providers/{id}': {
      get: {
        tags: ['Auth'],
        summary: 'Get SSO provider by ID',
        operationId: 'getSsoProvider',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'SSO provider detail' } },
      },
      put: {
        tags: ['Auth'],
        summary: 'Update SSO provider configuration',
        operationId: 'updateSsoProvider',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'SSO provider updated' } },
      },
      delete: {
        tags: ['Auth'],
        summary: 'Delete SSO provider',
        operationId: 'deleteSsoProvider',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'SSO provider deleted' } },
      },
    },
    '/api/v1/sso/login/{provider}': {
      get: {
        tags: ['Auth'],
        summary: 'Initiate SSO login flow',
        operationId: 'ssoLogin',
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '302': { description: 'Redirect to SSO provider' } },
      },
    },
    '/api/v1/sso/callback/{provider}': {
      post: {
        tags: ['Auth'],
        summary: 'SSO callback handler',
        operationId: 'ssoCallback',
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'SSO authentication result' } },
      },
    },
    '/api/v1/sso/sessions': {
      get: {
        tags: ['Auth'],
        summary: 'List active SSO sessions',
        operationId: 'getSsoSessions',
        responses: { '200': { description: 'SSO session list' } },
      },
    },
    '/api/v1/sso/sessions/{id}': {
      delete: {
        tags: ['Auth'],
        summary: 'Revoke an SSO session',
        operationId: 'revokeSsoSession',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Session revoked' } },
      },
    },

    // -----------------------------------------------------------------------
    // Audit
    // -----------------------------------------------------------------------
    '/api/v1/audit': {
      get: {
        tags: ['Audit'],
        summary: 'List audit events with optional filters',
        operationId: 'getAuditEvents',
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string', enum: ['read', 'write', 'delete', 'auth', 'admin'] } },
          { name: 'userId', in: 'query', schema: { type: 'string' } },
          { name: 'method', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['2xx', '4xx', '5xx'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: 'Paginated audit event list' } },
      },
    },
    '/api/v1/audit/stats': {
      get: {
        tags: ['Audit'],
        summary: 'Aggregated audit statistics',
        operationId: 'getAuditStats',
        responses: { '200': { description: 'Audit statistics' } },
      },
    },

    // -----------------------------------------------------------------------
    // Policies
    // -----------------------------------------------------------------------
    '/api/v1/policies': {
      get: {
        tags: ['Policies'],
        summary: 'List governance policies',
        operationId: 'getPolicies',
        responses: { '200': { description: 'Policy list' } },
      },
    },
    '/api/v1/policies/evaluate': {
      post: {
        tags: ['Policies'],
        summary: 'Evaluate policies against current opportunities',
        operationId: 'evaluatePolicies',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  opportunity_ids: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Policy evaluation results' } },
      },
    },
    '/api/v1/policies/compliance': {
      get: {
        tags: ['Policies'],
        summary: 'Get compliance status',
        operationId: 'getCompliance',
        responses: { '200': { description: 'Compliance status report' } },
      },
    },

    // -----------------------------------------------------------------------
    // Secrets
    // -----------------------------------------------------------------------
    '/api/v1/secrets': {
      get: {
        tags: ['Secrets'],
        summary: 'List secrets (metadata only)',
        operationId: 'getSecrets',
        responses: { '200': { description: 'Secret metadata list' } },
      },
      post: {
        tags: ['Secrets'],
        summary: 'Create a new secret',
        operationId: 'createSecret',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Secret created' } },
      },
    },
    '/api/v1/secrets/{id}': {
      get: {
        tags: ['Secrets'],
        summary: 'Get secret metadata by ID',
        operationId: 'getSecret',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Secret metadata' } },
      },
      delete: {
        tags: ['Secrets'],
        summary: 'Delete a secret',
        operationId: 'deleteSecret',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Secret deleted' } },
      },
    },
    '/api/v1/secrets/{id}/rotate': {
      post: {
        tags: ['Secrets'],
        summary: 'Rotate a secret',
        operationId: 'rotateSecret',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Secret rotated' } },
      },
    },
    '/api/v1/secrets/audit/log': {
      get: {
        tags: ['Secrets'],
        summary: 'Get secrets audit log',
        operationId: 'getSecretsAuditLog',
        responses: { '200': { description: 'Secrets audit trail' } },
      },
    },
    '/api/v1/secrets/health/rotation': {
      get: {
        tags: ['Secrets'],
        summary: 'Get secret rotation health status',
        operationId: 'getSecretsRotationHealth',
        responses: { '200': { description: 'Rotation health status' } },
      },
    },

    // -----------------------------------------------------------------------
    // Multi-Tenant
    // -----------------------------------------------------------------------
    '/api/v1/tenants': {
      get: {
        tags: ['Multi-Tenant'],
        summary: 'List tenants',
        operationId: 'getTenants',
        responses: { '200': { description: 'Tenant list' } },
      },
      post: {
        tags: ['Multi-Tenant'],
        summary: 'Create a new tenant',
        operationId: 'createTenant',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Tenant created' } },
      },
    },
    '/api/v1/tenants/{id}': {
      get: {
        tags: ['Multi-Tenant'],
        summary: 'Get tenant by ID',
        operationId: 'getTenant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Tenant detail' } },
      },
      put: {
        tags: ['Multi-Tenant'],
        summary: 'Update a tenant',
        operationId: 'updateTenant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'Tenant updated' } },
      },
      delete: {
        tags: ['Multi-Tenant'],
        summary: 'Delete a tenant',
        operationId: 'deleteTenant',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Tenant deleted' } },
      },
    },
    '/api/v1/tenants/{id}/quotas': {
      get: {
        tags: ['Multi-Tenant'],
        summary: 'Get tenant quotas and usage',
        operationId: 'getTenantQuotas',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Tenant quota details' } },
      },
    },
    '/api/v1/tenants/tiers/info': {
      get: {
        tags: ['Multi-Tenant'],
        summary: 'Get tier information and pricing',
        operationId: 'getTierInfo',
        responses: { '200': { description: 'Tier information' } },
      },
    },

    // -----------------------------------------------------------------------
    // Notifications
    // -----------------------------------------------------------------------
    '/api/v1/notifications/channels': {
      get: {
        tags: ['Notifications'],
        summary: 'List notification channels',
        operationId: 'getNotificationChannels',
        responses: { '200': { description: 'Notification channel list' } },
      },
    },
    '/api/v1/notifications/test': {
      post: {
        tags: ['Notifications'],
        summary: 'Send a test notification',
        operationId: 'testNotification',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  channel: { type: 'string' },
                  config: { type: 'object' },
                },
                required: ['channel'],
              },
            },
          },
        },
        responses: { '200': { description: 'Test notification sent' } },
      },
    },
    '/api/v1/notifications/history': {
      get: {
        tags: ['Notifications'],
        summary: 'Get notification delivery history',
        operationId: 'getNotificationHistory',
        responses: { '200': { description: 'Notification history' } },
      },
    },

    // -----------------------------------------------------------------------
    // Webhooks
    // -----------------------------------------------------------------------
    '/api/v1/webhooks': {
      get: {
        tags: ['Webhooks'],
        summary: 'List registered webhooks',
        operationId: 'getWebhooks',
        responses: { '200': { description: 'Webhook list' } },
      },
      post: {
        tags: ['Webhooks'],
        summary: 'Register a new webhook',
        operationId: 'createWebhook',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  url: { type: 'string', format: 'uri' },
                  events: { type: 'array', items: { type: 'string' } },
                  secret: { type: 'string' },
                },
                required: ['url', 'events'],
              },
            },
          },
        },
        responses: { '201': { description: 'Webhook registered' } },
      },
    },
    '/api/v1/webhooks/{id}': {
      delete: {
        tags: ['Webhooks'],
        summary: 'Remove a registered webhook',
        operationId: 'deleteWebhook',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Webhook deleted' } },
      },
      patch: {
        tags: ['Webhooks'],
        summary: 'Update a webhook (toggle active, change events or URL)',
        operationId: 'updateWebhook',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  active: { type: 'boolean' },
                  events: { type: 'array', items: { type: 'string' } },
                  url: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Webhook updated' } },
      },
    },
    '/api/v1/webhooks/{id}/test': {
      post: {
        tags: ['Webhooks'],
        summary: 'Send a test event to a registered webhook',
        operationId: 'testWebhook',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Test delivery sent' } },
      },
    },
    '/api/v1/webhooks/{id}/deliveries': {
      get: {
        tags: ['Webhooks'],
        summary: 'Get delivery history for a webhook',
        operationId: 'getWebhookDeliveries',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Delivery history' } },
      },
    },
    '/api/v1/webhooks/events': {
      get: {
        tags: ['Webhooks'],
        summary: 'List available webhook event types',
        operationId: 'getWebhookEvents',
        responses: { '200': { description: 'Available event types' } },
      },
    },

    // -----------------------------------------------------------------------
    // Scheduling
    // -----------------------------------------------------------------------
    '/api/v1/schedules': {
      get: {
        tags: ['Scheduling'],
        summary: 'List schedules',
        operationId: 'getSchedules',
        responses: { '200': { description: 'Schedule list' } },
      },
      post: {
        tags: ['Scheduling'],
        summary: 'Create a new schedule',
        operationId: 'createSchedule',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '201': { description: 'Schedule created' } },
      },
    },
    '/api/v1/schedules/{id}': {
      get: {
        tags: ['Scheduling'],
        summary: 'Get schedule by ID',
        operationId: 'getSchedule',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Schedule detail' } },
      },
      put: {
        tags: ['Scheduling'],
        summary: 'Update a schedule',
        operationId: 'updateSchedule',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'Schedule updated' } },
      },
      delete: {
        tags: ['Scheduling'],
        summary: 'Delete a schedule',
        operationId: 'deleteSchedule',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Schedule deleted' } },
      },
    },
    '/api/v1/schedules/{id}/run': {
      post: {
        tags: ['Scheduling'],
        summary: 'Manually trigger a scheduled run',
        operationId: 'triggerScheduleRun',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Run triggered' } },
      },
    },
    '/api/v1/schedules/{id}/runs': {
      get: {
        tags: ['Scheduling'],
        summary: 'Get run history for a schedule',
        operationId: 'getScheduleRuns',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Run history' } },
      },
    },
    '/api/v1/schedules/{id}/toggle': {
      post: {
        tags: ['Scheduling'],
        summary: 'Toggle schedule enabled/disabled',
        operationId: 'toggleSchedule',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Schedule toggled' } },
      },
    },

    // -----------------------------------------------------------------------
    // Batch
    // -----------------------------------------------------------------------
    '/api/v1/batch/analyze': {
      post: {
        tags: ['Batch'],
        summary: 'Submit a batch analysis for multiple projects',
        operationId: 'batchAnalyze',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  projects: { type: 'array', items: { type: 'string' }, description: 'Filesystem paths (max 10)' },
                  options: { type: 'object' },
                },
                required: ['projects'],
              },
            },
          },
        },
        responses: { '202': { description: 'Batch analysis started' } },
      },
    },
    '/api/v1/batch/status/{id}': {
      get: {
        tags: ['Batch'],
        summary: 'Get batch run status',
        operationId: 'getBatchStatus',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Batch run status' } },
      },
    },
    '/api/v1/batch/history': {
      get: {
        tags: ['Batch'],
        summary: 'Get batch analysis history',
        operationId: 'getBatchHistory',
        responses: { '200': { description: 'Batch run history' } },
      },
    },

    // -----------------------------------------------------------------------
    // Search
    // -----------------------------------------------------------------------
    '/api/v1/search': {
      get: {
        tags: ['Search'],
        summary: 'Full-text search across findings, opportunities, and entities',
        operationId: 'search',
        parameters: [
          { name: 'q', in: 'query', required: true, schema: { type: 'string' }, description: 'Search query' },
          { name: 'scope', in: 'query', schema: { type: 'string', enum: ['findings', 'opportunities', 'entities', 'all'], default: 'all' } },
        ],
        responses: { '200': { description: 'Search results' } },
      },
    },

    // -----------------------------------------------------------------------
    // Export
    // -----------------------------------------------------------------------
    '/api/v1/export': {
      post: {
        tags: ['Export'],
        summary: 'Create a new data export',
        operationId: 'createExport',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  format: { type: 'string', enum: ['json', 'csv', 'sarif', 'html'] },
                  scope: { type: 'string', enum: ['all', 'findings', 'opportunities', 'health'] },
                  filters: { type: 'object' },
                },
                required: ['format', 'scope'],
              },
            },
          },
        },
        responses: { '201': { description: 'Export created' } },
      },
    },
    '/api/v1/export/{id}/download': {
      get: {
        tags: ['Export'],
        summary: 'Download a generated export',
        operationId: 'downloadExport',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Export file content' } },
      },
    },
    '/api/v1/export/history': {
      get: {
        tags: ['Export'],
        summary: 'Get export history',
        operationId: 'getExportHistory',
        responses: { '200': { description: 'Export history list' } },
      },
    },

    // -----------------------------------------------------------------------
    // Plugins
    // -----------------------------------------------------------------------
    '/api/v1/plugins/marketplace': {
      get: {
        tags: ['Plugins'],
        summary: 'List plugins from the marketplace',
        operationId: 'getPluginMarketplace',
        parameters: [
          { name: 'type', in: 'query', schema: { type: 'string' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Plugin marketplace listing' } },
      },
    },
    '/api/v1/plugins/marketplace/{id}': {
      get: {
        tags: ['Plugins'],
        summary: 'Get marketplace plugin by ID',
        operationId: 'getMarketplacePlugin',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plugin detail' } },
      },
    },
    '/api/v1/plugins/installed': {
      get: {
        tags: ['Plugins'],
        summary: 'List installed plugins',
        operationId: 'getInstalledPlugins',
        responses: { '200': { description: 'Installed plugin list' } },
      },
    },
    '/api/v1/plugins/installed/{id}': {
      get: {
        tags: ['Plugins'],
        summary: 'Get installed plugin by ID',
        operationId: 'getInstalledPlugin',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Installed plugin detail' } },
      },
      delete: {
        tags: ['Plugins'],
        summary: 'Uninstall a plugin',
        operationId: 'uninstallPlugin',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plugin uninstalled' } },
      },
    },
    '/api/v1/plugins/install/{id}': {
      post: {
        tags: ['Plugins'],
        summary: 'Install a plugin from the marketplace',
        operationId: 'installPlugin',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plugin installed' } },
      },
    },
    '/api/v1/plugins/installed/{id}/toggle': {
      post: {
        tags: ['Plugins'],
        summary: 'Toggle a plugin enabled/disabled',
        operationId: 'togglePlugin',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plugin toggled' } },
      },
    },
    '/api/v1/plugins/installed/{id}/config': {
      put: {
        tags: ['Plugins'],
        summary: 'Update plugin configuration',
        operationId: 'updatePluginConfig',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'Plugin config updated' } },
      },
    },
    '/api/v1/plugins/installed/{id}/health': {
      get: {
        tags: ['Plugins'],
        summary: 'Get plugin health status',
        operationId: 'getPluginHealth',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Plugin health status' } },
      },
    },
    '/api/v1/plugins/sdk': {
      get: {
        tags: ['Plugins'],
        summary: 'Get plugin SDK information',
        operationId: 'getPluginSdk',
        responses: { '200': { description: 'Plugin SDK info and documentation links' } },
      },
    },

    // -----------------------------------------------------------------------
    // GraphQL
    // -----------------------------------------------------------------------
    '/api/v1/graphql': {
      post: {
        tags: ['GraphQL'],
        summary: 'Execute a GraphQL query',
        operationId: 'executeGraphQL',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  query: { type: 'string' },
                  variables: { type: 'object' },
                  operationName: { type: 'string' },
                },
                required: ['query'],
              },
            },
          },
        },
        responses: { '200': { description: 'GraphQL response' } },
      },
    },
    '/api/v1/graphql/schema': {
      get: {
        tags: ['GraphQL'],
        summary: 'Get the GraphQL schema definition',
        operationId: 'getGraphQLSchema',
        responses: { '200': { description: 'GraphQL schema SDL' } },
      },
    },
    '/api/v1/graphql/introspection': {
      get: {
        tags: ['GraphQL'],
        summary: 'GraphQL introspection query results',
        operationId: 'getGraphQLIntrospection',
        responses: { '200': { description: 'Introspection result' } },
      },
    },

    // -----------------------------------------------------------------------
    // Confidence
    // -----------------------------------------------------------------------
    '/api/v1/confidence/overview': {
      get: {
        tags: ['Confidence'],
        summary: 'Get confidence system overview and statistics',
        operationId: 'getConfidenceOverview',
        responses: { '200': { description: 'Confidence overview with analyzer stats' } },
      },
    },
    '/api/v1/confidence/predictions': {
      get: {
        tags: ['Confidence'],
        summary: 'List predictions with optional filtering',
        operationId: 'getConfidencePredictions',
        parameters: [
          { name: 'analyzer', in: 'query', schema: { type: 'string' } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['pending', 'resolved'] } },
          { name: 'severity', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Prediction list' } },
      },
    },
    '/api/v1/confidence/predictions/{id}/outcome': {
      post: {
        tags: ['Confidence'],
        summary: 'Record actual outcome for a prediction',
        operationId: 'recordPredictionOutcome',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'Outcome recorded' } },
      },
    },
    '/api/v1/confidence/calibration/{analyzerId}': {
      get: {
        tags: ['Confidence'],
        summary: 'Get calibration curve for an analyzer',
        operationId: 'getCalibrationCurve',
        parameters: [{ name: 'analyzerId', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { '200': { description: 'Calibration curve data' } },
      },
    },

    // -----------------------------------------------------------------------
    // Config
    // -----------------------------------------------------------------------
    '/api/v1/config': {
      get: {
        tags: ['Config'],
        summary: 'Get server configuration',
        operationId: 'getConfig',
        responses: { '200': { description: 'Current server configuration' } },
      },
      patch: {
        tags: ['Config'],
        summary: 'Update server configuration',
        operationId: 'updateConfig',
        requestBody: {
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: { '200': { description: 'Configuration updated' } },
      },
    },
    '/api/v1/config/features': {
      get: {
        tags: ['Config'],
        summary: 'Get feature flags',
        operationId: 'getFeatureFlags',
        responses: { '200': { description: 'Feature flag list' } },
      },
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

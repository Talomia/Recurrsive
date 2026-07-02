/**
 * @module @recurrsive/server/routes/config
 *
 * Configuration management routes for inspecting and updating
 * server configuration at runtime.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { state } from '../state.js';

/**
 * All 10 analyzer IDs in the platform.
 *
 * Used by the features endpoint to enumerate available analyzers.
 */
const ALL_ANALYZER_IDS = [
  'architecture.structural',
  'ai.quality',
  'performance.general',
  'cost.optimization',
  'reliability.resilience',
  'security.vulnerabilities',
  'data.schema-quality',
  'docs.completeness',
  'ux.quality',
  'product.health',
] as const;

/**
 * All collector names in the platform.
 */
const ALL_COLLECTOR_IDS = [
  'git',
  'documentation',
  'environment',
  'cicd',
  'database',
] as const;

/**
 * All built-in policy set IDs.
 */
const ALL_POLICY_SET_IDS = [
  'builtin:security-baseline',
  'builtin:change-management',
  'builtin:cost-governance',
  'builtin:compliance',
  'builtin:quality-gates',
] as const;

/**
 * In-memory config overrides applied via PATCH /api/v1/config.
 *
 * These are non-persistent — they live only for the lifetime of the
 * current server process.
 */
interface ConfigOverrides {
  /** Override graph provider. */
  graphProvider?: string;
  /** Override severity threshold for analysis. */
  severityThreshold?: string;
  /** Override report output format. */
  reportFormat?: string;
  /** Override report output directory. */
  reportDirectory?: string;
  /** Analyzer IDs to enable (overrides default "all"). */
  enabledAnalyzers?: string[];
  /** Collector IDs to enable (overrides default "all"). */
  enabledCollectors?: string[];
  /** Policy set IDs to activate. */
  activePolicySets?: string[];
}

const overrides: ConfigOverrides = {};

/**
 * Register configuration management routes.
 *
 * @param app - Fastify instance.
 */
export async function registerConfigRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/config
   *
   * Returns the current server configuration derived from server state
   * and any in-memory overrides. Returns 503 if the server is not yet
   * initialized with a project.
   */
  app.get('/api/v1/config', async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze with a project path first.',
      });
    }

    const projectPath = state.getProjectPath();
    const graphProvider = overrides.graphProvider
      ?? (process.env['GRAPH_PROVIDER'] ?? 'sqlite');

    return reply.status(200).send({
      project: {
        root: projectPath,
        info: state.getProjectInfo(),
      },
      graph: {
        provider: graphProvider,
      },
      analysis: {
        severity_threshold: overrides.severityThreshold ?? 'info',
        parallel: true,
        timeout_ms: 60_000,
      },
      report: {
        format: overrides.reportFormat ?? 'markdown',
        directory: overrides.reportDirectory ?? '.recurrsive',
      },
      features: {
        enabled_analyzers: overrides.enabledAnalyzers ?? [...ALL_ANALYZER_IDS],
        enabled_collectors: overrides.enabledCollectors ?? [...ALL_COLLECTOR_IDS],
        active_policy_sets: overrides.activePolicySets ?? [...ALL_POLICY_SET_IDS],
      },
      overrides_applied: Object.keys(overrides).length > 0,
    });
  });

  /**
   * PATCH /api/v1/config
   *
   * Update configuration values at runtime (in-memory only, not persisted).
   * Accepts a JSON body with optional fields to override.
   */
  app.patch('/api/v1/config', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Invalid request body',
        message: 'Request body must be a JSON object with config fields to update.',
      });
    }

    // Apply recognized fields
    if (typeof body['graphProvider'] === 'string') {
      overrides.graphProvider = body['graphProvider'];
    }

    if (typeof body['severityThreshold'] === 'string') {
      const valid = ['info', 'low', 'medium', 'high', 'critical'];
      if (!valid.includes(body['severityThreshold'])) {
        return reply.status(400).send({
          error: 'Invalid severity threshold',
          message: `Must be one of: ${valid.join(', ')}`,
        });
      }
      overrides.severityThreshold = body['severityThreshold'];
    }

    if (typeof body['reportFormat'] === 'string') {
      const valid = ['markdown', 'html', 'json', 'sarif'];
      if (!valid.includes(body['reportFormat'])) {
        return reply.status(400).send({
          error: 'Invalid report format',
          message: `Must be one of: ${valid.join(', ')}`,
        });
      }
      overrides.reportFormat = body['reportFormat'];
    }

    if (typeof body['reportDirectory'] === 'string') {
      overrides.reportDirectory = body['reportDirectory'];
    }

    if (Array.isArray(body['enabledAnalyzers'])) {
      const ids = body['enabledAnalyzers'] as string[];
      const invalid = ids.filter((id) => !(ALL_ANALYZER_IDS as readonly string[]).includes(id));
      if (invalid.length > 0) {
        return reply.status(400).send({
          error: 'Invalid analyzer IDs',
          message: `Unknown analyzers: ${invalid.join(', ')}`,
          valid: [...ALL_ANALYZER_IDS],
        });
      }
      overrides.enabledAnalyzers = ids;
    }

    if (Array.isArray(body['enabledCollectors'])) {
      const ids = body['enabledCollectors'] as string[];
      const invalid = ids.filter((id) => !(ALL_COLLECTOR_IDS as readonly string[]).includes(id));
      if (invalid.length > 0) {
        return reply.status(400).send({
          error: 'Invalid collector IDs',
          message: `Unknown collectors: ${invalid.join(', ')}`,
          valid: [...ALL_COLLECTOR_IDS],
        });
      }
      overrides.enabledCollectors = ids;
    }

    if (Array.isArray(body['activePolicySets'])) {
      const ids = body['activePolicySets'] as string[];
      const invalid = ids.filter((id) => !(ALL_POLICY_SET_IDS as readonly string[]).includes(id));
      if (invalid.length > 0) {
        return reply.status(400).send({
          error: 'Invalid policy set IDs',
          message: `Unknown policy sets: ${invalid.join(', ')}`,
          valid: [...ALL_POLICY_SET_IDS],
        });
      }
      overrides.activePolicySets = ids;
    }

    return reply.status(200).send({
      message: 'Configuration updated (in-memory only)',
      overrides: { ...overrides },
    });
  });

  /**
   * GET /api/v1/config/features
   *
   * Returns a comprehensive feature inventory with enabled status
   * for analyzers, collectors, and policy sets.
   */
  app.get('/api/v1/config/features', async (_request, reply) => {
    const enabledAnalyzers = new Set(overrides.enabledAnalyzers ?? ALL_ANALYZER_IDS);
    const enabledCollectors = new Set(overrides.enabledCollectors ?? ALL_COLLECTOR_IDS);
    const activePolicySets = new Set(overrides.activePolicySets ?? ALL_POLICY_SET_IDS);

    const analyzers = ALL_ANALYZER_IDS.map((id) => ({
      id,
      enabled: enabledAnalyzers.has(id),
    }));

    const collectors = ALL_COLLECTOR_IDS.map((id) => ({
      id,
      enabled: enabledCollectors.has(id),
    }));

    const policySets = ALL_POLICY_SET_IDS.map((id) => ({
      id,
      enabled: activePolicySets.has(id),
    }));

    return reply.status(200).send({
      analyzers,
      collectors,
      policy_sets: policySets,
      summary: {
        total_analyzers: ALL_ANALYZER_IDS.length,
        enabled_analyzers: analyzers.filter((a) => a.enabled).length,
        total_collectors: ALL_COLLECTOR_IDS.length,
        enabled_collectors: collectors.filter((c) => c.enabled).length,
        total_policy_sets: ALL_POLICY_SET_IDS.length,
        active_policy_sets: policySets.filter((p) => p.enabled).length,
      },
    });
  });
}

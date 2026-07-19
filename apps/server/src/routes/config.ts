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
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';

/**
 * All 10 analyzer IDs in the platform.
 *
 * Used by the features endpoint to enumerate available analyzers.
 */
export const ALL_ANALYZER_IDS = [
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
export const ALL_COLLECTOR_IDS = [
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
 * Config overrides applied via PATCH /api/v1/config.
 *
 * Stored persistently in SQLite via ServerStore under the key
 * 'config_overrides' / 'default'.
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

/**
 * Settings overrides applied via PATCH /api/v1/config.
 *
 * Stored in ServerStore under key 'settings_overrides' / 'default'.
 */
interface SettingsOverrides {
  /** Platform display name. */
  platform_name?: string;
  /** Auto-analyze on push. */
  auto_analyze?: boolean;
  /** Require multi-factor authentication. */
  require_mfa?: boolean;
  /** Session timeout in minutes. */
  session_timeout?: number;
  /** Enable email/push notifications. */
  enable_notifications?: boolean;
  /** Data retention period in days. */
  data_retention_days?: number;
  /** Max concurrent analysis jobs. */
  max_concurrent?: number;
  /** API rate limit (requests per minute). */
  rate_limit?: number;
  /** Enable AI reasoning. */
  enable_reasoning?: boolean;
  /** Max findings per report. */
  max_findings?: number;
  /** Email notifications enabled. */
  email_notifications?: boolean;
  /** Slack integration enabled. */
  slack_enabled?: boolean;
  /** Webhook URL for notifications. */
  webhook_url?: string;
}

/** Load persisted config overrides (or empty object on first run). */
async function getOverrides(): Promise<ConfigOverrides> {
  return await store.get<ConfigOverrides>('config_overrides', 'default') ?? {};
}

/** Persist config overrides. */
async function setOverrides(overrides: ConfigOverrides): Promise<void> {
  await store.set('config_overrides', 'default', overrides);
}

/** Load persisted settings overrides (or empty object on first run). */
async function getSettings(): Promise<SettingsOverrides> {
  return await store.get<SettingsOverrides>('settings_overrides', 'default') ?? {};
}

/** Persist settings overrides. */
async function setSettings(settings: SettingsOverrides): Promise<void> {
  await store.set('settings_overrides', 'default', settings);
}

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
  app.get('/api/v1/config', { preHandler: [authMiddleware] }, async (_request, reply) => {
    if (!state.isInitialized()) {
      return reply.status(503).send({
        error: 'Server not initialized',
        message: 'Run POST /api/v1/analyze with a project path first.',
      });
    }

    const projectPath = state.getProjectPath();
    const ov = await getOverrides();
    const graphProvider = ov.graphProvider
      ?? (process.env['GRAPH_PROVIDER'] ?? 'sqlite');

    const settings = await getSettings();

    return reply.status(200).send({
      data: {
        project: {
          root: projectPath,
          info: state.getProjectInfo(),
        },
        graph: {
          provider: graphProvider,
        },
        analysis: {
          severity_threshold: ov.severityThreshold ?? 'info',
          parallel: true,
          timeout_ms: 60_000,
        },
        report: {
          format: ov.reportFormat ?? 'markdown',
          directory: ov.reportDirectory ?? '.recurrsive',
        },
        features: {
          enabled_analyzers: ov.enabledAnalyzers ?? [...ALL_ANALYZER_IDS],
          enabled_collectors: ov.enabledCollectors ?? [...ALL_COLLECTOR_IDS],
          active_policy_sets: ov.activePolicySets ?? [...ALL_POLICY_SET_IDS],
        },
        settings: {
          platform_name: settings.platform_name ?? 'Recurrsive',
          auto_analyze: settings.auto_analyze ?? true,
          require_mfa: settings.require_mfa ?? false,
          session_timeout: settings.session_timeout ?? 60,
          enable_notifications: settings.enable_notifications ?? true,
          data_retention_days: settings.data_retention_days ?? 90,
          max_concurrent: settings.max_concurrent ?? 3,
          rate_limit: settings.rate_limit ?? 100,
          enable_reasoning: settings.enable_reasoning ?? true,
          max_findings: settings.max_findings ?? 500,
          email_notifications: settings.email_notifications ?? true,
          slack_enabled: settings.slack_enabled ?? false,
          webhook_url: settings.webhook_url ?? '',
        },
        overrides_applied: Object.keys(ov).length > 0 || Object.keys(settings).length > 0,
      },
    });
  });

  /**
   * PATCH /api/v1/config
   *
   * Update configuration values at runtime (persisted via ServerStore).
   * Accepts a JSON body with optional fields to override.
   */
  app.patch('/api/v1/config', {
    preHandler: [authMiddleware, requireRole('admin')],
    schema: {
      body: {
        type: 'object',
        properties: {
          graphProvider: { type: 'string' },
          severityThreshold: { type: 'string', enum: ['info', 'low', 'medium', 'high', 'critical'] },
          enableAI: { type: 'boolean' },
          enableEnterprise: { type: 'boolean' },
          enableEcosystem: { type: 'boolean' },
          llmProvider: { type: 'string' },
          llmModel: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Invalid request body',
        message: 'Request body must be a JSON object with config fields to update.',
      });
    }

    const ov = await getOverrides();

    // Apply recognized fields
    if (typeof body['graphProvider'] === 'string') {
      ov.graphProvider = body['graphProvider'];
    }

    if (typeof body['severityThreshold'] === 'string') {
      const valid = ['info', 'low', 'medium', 'high', 'critical'];
      if (!valid.includes(body['severityThreshold'])) {
        return reply.status(400).send({
          error: 'Invalid severity threshold',
          message: `Must be one of: ${valid.join(', ')}`,
        });
      }
      ov.severityThreshold = body['severityThreshold'];
    }

    if (typeof body['reportFormat'] === 'string') {
      const valid = ['markdown', 'html', 'json', 'sarif'];
      if (!valid.includes(body['reportFormat'])) {
        return reply.status(400).send({
          error: 'Invalid report format',
          message: `Must be one of: ${valid.join(', ')}`,
        });
      }
      ov.reportFormat = body['reportFormat'];
    }

    if (typeof body['reportDirectory'] === 'string') {
      ov.reportDirectory = body['reportDirectory'];
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
      ov.enabledAnalyzers = ids;
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
      ov.enabledCollectors = ids;
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
      ov.activePolicySets = ids;
    }

    // ---- Settings fields (dashboard UI) ----
    const settings = await getSettings();
    let settingsChanged = false;

    if (typeof body['platform_name'] === 'string') {
      settings.platform_name = body['platform_name'];
      settingsChanged = true;
    }
    if (typeof body['auto_analyze'] === 'boolean') {
      settings.auto_analyze = body['auto_analyze'];
      settingsChanged = true;
    }
    if (typeof body['require_mfa'] === 'boolean') {
      settings.require_mfa = body['require_mfa'];
      settingsChanged = true;
    }
    if (typeof body['session_timeout'] === 'number') {
      settings.session_timeout = body['session_timeout'];
      settingsChanged = true;
    }
    if (typeof body['enable_notifications'] === 'boolean') {
      settings.enable_notifications = body['enable_notifications'];
      settingsChanged = true;
    }
    if (typeof body['data_retention_days'] === 'number') {
      settings.data_retention_days = body['data_retention_days'];
      settingsChanged = true;
    }
    if (typeof body['max_concurrent'] === 'number') {
      settings.max_concurrent = body['max_concurrent'];
      settingsChanged = true;
    }
    if (typeof body['rate_limit'] === 'number') {
      settings.rate_limit = body['rate_limit'];
      settingsChanged = true;
    }
    if (typeof body['enable_reasoning'] === 'boolean') {
      settings.enable_reasoning = body['enable_reasoning'];
      settingsChanged = true;
    }
    if (typeof body['max_findings'] === 'number') {
      settings.max_findings = body['max_findings'];
      settingsChanged = true;
    }
    if (typeof body['email_notifications'] === 'boolean') {
      settings.email_notifications = body['email_notifications'];
      settingsChanged = true;
    }
    if (typeof body['slack_enabled'] === 'boolean') {
      settings.slack_enabled = body['slack_enabled'];
      settingsChanged = true;
    }
    if (typeof body['webhook_url'] === 'string') {
      settings.webhook_url = body['webhook_url'];
      settingsChanged = true;
    }

    // Persist the updated overrides
    await setOverrides(ov);
    if (settingsChanged) {
      await setSettings(settings);
    }

    return reply.status(200).send({
      data: {
        overrides: { ...ov },
        settings: { ...settings },
      },
      message: 'Configuration updated (persisted)',
    });
  });

  /**
   * GET /api/v1/config/features
   *
   * Returns a comprehensive feature inventory with enabled status
   * for analyzers, collectors, and policy sets.
   */
  app.get('/api/v1/config/features', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const ov = await getOverrides();
    const enabledAnalyzers = new Set(ov.enabledAnalyzers ?? ALL_ANALYZER_IDS);
    const enabledCollectors = new Set(ov.enabledCollectors ?? ALL_COLLECTOR_IDS);
    const activePolicySets = new Set(ov.activePolicySets ?? ALL_POLICY_SET_IDS);

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
      data: {
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
      },
    });
  });

  // Settings sections — dashboard settings UI categories
  app.get('/api/v1/settings/sections', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.send({
      data: [
        {
          icon: '🔧',
          title: 'General',
          description: 'Platform-wide configuration',
          settings: [
            { label: 'Platform Name', key: 'platform_name', type: 'text', defaultValue: 'Recurrsive' },
            { label: 'Auto-Analysis on Push', key: 'auto_analyze', type: 'toggle', defaultValue: true },
            { label: 'Max Concurrent Analysis', key: 'max_concurrent', type: 'number', defaultValue: '3' },
          ],
        },
        {
          icon: '🔐',
          title: 'Security',
          description: 'Authentication and access control',
          settings: [
            { label: 'Require MFA', key: 'require_mfa', type: 'toggle', defaultValue: false },
            { label: 'Session Timeout (minutes)', key: 'session_timeout', type: 'number', defaultValue: '60' },
            { label: 'API Rate Limit (req/min)', key: 'rate_limit', type: 'number', defaultValue: '100' },
          ],
        },
        {
          icon: '📊',
          title: 'Analysis',
          description: 'Analysis engine configuration',
          settings: [
            { label: 'Severity Threshold', key: 'severity_threshold', type: 'text', defaultValue: 'low' },
            { label: 'Enable AI Reasoning', key: 'enable_reasoning', type: 'toggle', defaultValue: true },
            { label: 'Max Findings per Report', key: 'max_findings', type: 'number', defaultValue: '500' },
          ],
        },
        {
          icon: '🔔',
          title: 'Notifications',
          description: 'Alert and notification preferences',
          settings: [
            { label: 'Email Notifications', key: 'email_notifications', type: 'toggle', defaultValue: true },
            { label: 'Slack Integration', key: 'slack_enabled', type: 'toggle', defaultValue: false },
            { label: 'Webhook URL', key: 'webhook_url', type: 'text', defaultValue: '' },
          ],
        },
      ],
    });
  });

  /**
   * GET /api/v1/settings
   *
   * Return all current settings values. Combines defaults with
   * any persisted overrides.
   */
  app.get('/api/v1/settings', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const settings = await getSettings();

    return reply.status(200).send({
      data: {
        platform_name: settings.platform_name ?? 'Recurrsive',
        auto_analyze: settings.auto_analyze ?? true,
        require_mfa: settings.require_mfa ?? false,
        session_timeout: settings.session_timeout ?? 60,
        enable_notifications: settings.enable_notifications ?? true,
        data_retention_days: settings.data_retention_days ?? 90,
        max_concurrent: settings.max_concurrent ?? 3,
        rate_limit: settings.rate_limit ?? 100,
        enable_reasoning: settings.enable_reasoning ?? true,
        max_findings: settings.max_findings ?? 500,
        email_notifications: settings.email_notifications ?? true,
        slack_enabled: settings.slack_enabled ?? false,
        webhook_url: settings.webhook_url ?? '',
      },
    });
  });

  /**
   * GET /api/v1/settings/preferences
   *
   * Return user-facing preferences (notification, display, and
   * workflow settings). A subset of the full settings object.
   */
  app.get('/api/v1/settings/preferences', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const settings = await getSettings();

    return reply.status(200).send({
      data: {
        notifications: {
          enable_notifications: settings.enable_notifications ?? true,
          email_notifications: settings.email_notifications ?? true,
          slack_enabled: settings.slack_enabled ?? false,
          webhook_url: settings.webhook_url ?? '',
        },
        analysis: {
          auto_analyze: settings.auto_analyze ?? true,
          enable_reasoning: settings.enable_reasoning ?? true,
          max_findings: settings.max_findings ?? 500,
          max_concurrent: settings.max_concurrent ?? 3,
        },
        security: {
          require_mfa: settings.require_mfa ?? false,
          session_timeout: settings.session_timeout ?? 60,
          rate_limit: settings.rate_limit ?? 100,
        },
        general: {
          platform_name: settings.platform_name ?? 'Recurrsive',
          data_retention_days: settings.data_retention_days ?? 90,
        },
      },
    });
  });
}

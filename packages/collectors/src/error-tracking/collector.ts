/**
 * @module @recurrsive/collectors/error-tracking/collector
 *
 * Error Tracking Collector — ingests error events, error groups,
 * alert rules, services, environments, and users from an error
 * tracking platform (Sentry, Bugsnag, or Rollbar) and produces
 * entities and relationships for the knowledge graph.
 *
 * Since this collector is not yet connected to real API calls, it
 * generates synthetic data that mirrors the shape of real error
 * tracking platform responses for development and testing purposes.
 *
 * Produces entities:
 * - `incident` — individual error occurrences (error events)
 * - `alert` — grouped/deduplicated error patterns (error groups)
 * - `config` — alerting rules
 * - `infrastructure_resource` — services experiencing errors
 * - `environment` — production/staging/dev environments
 * - `user` — SRE team members who own alert rules
 *
 * @packageDocumentation
 */

import type {
  Collector,
  CollectorConfig,
  CollectorResult,
  CollectorType,
  Entity,
  Relationship,
} from '@recurrsive/core';
import {
  generateId,
  qualifiedName,
  nowISO,
  createLogger,
  CollectorError,
} from '@recurrsive/core';
import { GovernanceFilter } from '../base/governance.js';

const logger = createLogger({ context: { module: 'error-tracking-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Supported error tracking platforms. */
export type ErrorTrackingPlatform = 'sentry' | 'bugsnag' | 'rollbar';

/** Synthetic error event data. */
interface MockErrorEvent {
  title: string;
  errorType: string;
  severity: 'fatal' | 'error' | 'warning';
  service: string;
  environment: string;
  stackTrace: string;
  occurrences: number;
}

/** Synthetic error group data. */
interface MockErrorGroup {
  name: string;
  pattern: string;
  errorTypes: string[];
  count: number;
  firstSeen: string;
  lastSeen: string;
}

/** Synthetic alert rule data. */
interface MockAlertRule {
  name: string;
  condition: string;
  threshold: number;
  owner: string;
  channel: string;
  enabled: boolean;
}

/** Synthetic service data. */
interface MockService {
  name: string;
  language: string;
  framework: string;
  errorRate: number;
}

/** Synthetic environment data. */
interface MockEnvironment {
  name: string;
  tier: 'production' | 'staging' | 'development';
  url: string;
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_USERS = ['sre-alice', 'sre-bob', 'sre-carol', 'sre-dave', 'sre-eve'];

const MOCK_ERROR_EVENTS: MockErrorEvent[] = [
  { title: 'TypeError: Cannot read property of undefined', errorType: 'TypeError', severity: 'error', service: 'frontend', environment: 'prod', stackTrace: 'at render (app.tsx:42)', occurrences: 1523 },
  { title: 'NullReferenceException in UserService', errorType: 'NullRef', severity: 'error', service: 'auth-service', environment: 'prod', stackTrace: 'at UserService.getUser (user.ts:88)', occurrences: 872 },
  { title: 'OutOfMemoryError: heap space exhausted', errorType: 'OOM', severity: 'fatal', service: 'ml-pipeline', environment: 'prod', stackTrace: 'at ModelLoader.load (loader.py:156)', occurrences: 43 },
  { title: 'API Timeout: upstream /v2/payments exceeded 30s', errorType: 'APITimeout', severity: 'error', service: 'api-gateway', environment: 'prod', stackTrace: 'at HttpClient.request (http.ts:201)', occurrences: 2891 },
  { title: 'RateLimitExceeded: 429 Too Many Requests', errorType: 'RateLimit', severity: 'warning', service: 'api-gateway', environment: 'staging', stackTrace: 'at RateLimiter.check (limiter.ts:67)', occurrences: 567 },
  { title: 'AuthenticationFailure: invalid JWT signature', errorType: 'AuthFailure', severity: 'error', service: 'auth-service', environment: 'prod', stackTrace: 'at JwtVerifier.verify (jwt.ts:34)', occurrences: 312 },
  { title: 'DBConnectionError: connection pool exhausted', errorType: 'DBConnection', severity: 'fatal', service: 'payment-processor', environment: 'prod', stackTrace: 'at ConnectionPool.acquire (pool.ts:99)', occurrences: 78 },
  { title: 'ParseError: unexpected token in JSON at position 0', errorType: 'ParseError', severity: 'warning', service: 'api-gateway', environment: 'staging', stackTrace: 'at JSON.parse (native)', occurrences: 234 },
];

const MOCK_ERROR_GROUPS: MockErrorGroup[] = [
  { name: 'Type Errors', pattern: 'TypeError|NullRef', errorTypes: ['TypeError', 'NullRef'], count: 2395, firstSeen: '2025-01-15T08:00:00Z', lastSeen: '2026-07-01T12:00:00Z' },
  { name: 'Resource Exhaustion', pattern: 'OOM|DBConnection', errorTypes: ['OOM', 'DBConnection'], count: 121, firstSeen: '2025-06-01T03:00:00Z', lastSeen: '2026-07-01T11:30:00Z' },
  { name: 'Network Failures', pattern: 'APITimeout|RateLimit', errorTypes: ['APITimeout', 'RateLimit'], count: 3458, firstSeen: '2025-03-20T10:00:00Z', lastSeen: '2026-07-01T12:15:00Z' },
  { name: 'Auth Errors', pattern: 'AuthFailure', errorTypes: ['AuthFailure'], count: 312, firstSeen: '2025-09-10T14:00:00Z', lastSeen: '2026-07-01T09:45:00Z' },
  { name: 'Data Parsing', pattern: 'ParseError', errorTypes: ['ParseError'], count: 234, firstSeen: '2025-11-05T16:00:00Z', lastSeen: '2026-06-30T22:00:00Z' },
];

const MOCK_ALERT_RULES: MockAlertRule[] = [
  { name: 'Critical Error Spike', condition: 'error_count > threshold in 5m', threshold: 100, owner: 'sre-alice', channel: '#incidents', enabled: true },
  { name: 'P0 Bug Alert', condition: 'severity == fatal', threshold: 1, owner: 'sre-bob', channel: '#p0-alerts', enabled: true },
  { name: 'Performance Degradation', condition: 'p99_latency > threshold_ms', threshold: 5000, owner: 'sre-carol', channel: '#performance', enabled: true },
  { name: 'Security Alert', condition: 'error_type in [AuthFailure]', threshold: 50, owner: 'sre-dave', channel: '#security', enabled: true },
];

const MOCK_SERVICES: MockService[] = [
  { name: 'api-gateway', language: 'TypeScript', framework: 'Express', errorRate: 0.023 },
  { name: 'auth-service', language: 'TypeScript', framework: 'NestJS', errorRate: 0.015 },
  { name: 'payment-processor', language: 'Java', framework: 'Spring Boot', errorRate: 0.008 },
  { name: 'ml-pipeline', language: 'Python', framework: 'FastAPI', errorRate: 0.012 },
  { name: 'frontend', language: 'TypeScript', framework: 'React', errorRate: 0.031 },
];

const MOCK_ENVIRONMENTS: MockEnvironment[] = [
  { name: 'prod', tier: 'production', url: 'https://app.example.com' },
  { name: 'staging', tier: 'staging', url: 'https://staging.example.com' },
  { name: 'dev', tier: 'development', url: 'https://dev.example.com' },
];

// ---------------------------------------------------------------------------
// ErrorTrackingCollector
// ---------------------------------------------------------------------------

/**
 * Collects error events, error groups, alert rules, services,
 * environments, and users from an error tracking platform.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and DSN.
 * 2. {@link validate} — verify the DSN is well-formed.
 * 3. {@link collect} — generate entities & relationships from
 *    synthetic error tracking data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new ErrorTrackingCollector('sentry');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: { dsn: 'https://key@sentry.io/123' },
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class ErrorTrackingCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'error-tracking';
  /** @inheritdoc */
  readonly name = 'Error Tracking Collector';
  /** @inheritdoc */
  readonly description = 'Collects error events, error groups, alert rules, and services from error tracking platforms';
  /** @inheritdoc */
  readonly type: CollectorType = 'observability';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** Error tracking platform. */
  private platform: ErrorTrackingPlatform;
  /** Data source name / project URL. */
  private dsn: string;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;

  /**
   * @param platform - Error tracking platform (default: `'sentry'`).
   */
  constructor(platform: ErrorTrackingPlatform = 'sentry') {
    this.platform = platform;
    this.dsn = '';
  }

  // -----------------------------------------------------------------------
  // Collector Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialize the collector with configuration.
   *
   * @param config - Collector configuration including governance rules.
   */
  async initialize(config: CollectorConfig): Promise<void> {
    this.governanceFilter = new GovernanceFilter(config.governance);

    if (typeof config.custom['dsn'] === 'string') {
      this.dsn = config.custom['dsn'];
    }

    if (typeof config.custom['platform'] === 'string') {
      const p = config.custom['platform'];
      if (p === 'sentry' || p === 'bugsnag' || p === 'rollbar') {
        this.platform = p;
      }
    }

    this.initialized = true;
    logger.info('ErrorTrackingCollector initialized', {
      platform: this.platform,
      dsn: this.dsn,
    });
  }

  /**
   * Validate that the configured DSN / platform is well-formed.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    const validPlatforms: ErrorTrackingPlatform[] = ['sentry', 'bugsnag', 'rollbar'];
    if (!validPlatforms.includes(this.platform)) {
      errors.push(`'${this.platform}' is not a supported platform. Supported: ${validPlatforms.join(', ')}`);
    }

    if (this.dsn) {
      try {
        new URL(this.dsn);
      } catch {
        errors.push(`'${this.dsn}' is not a valid DSN URL`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform the full collection run.
   *
   * @returns Entities, relationships, and run metadata.
   * @throws {CollectorError} If the collector has not been initialized.
   */
  async collect(): Promise<CollectorResult> {
    if (!this.initialized) {
      throw new CollectorError(
        'ErrorTrackingCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // Build entities and relationships from synthetic data
    const entities = this.buildEntities();
    const relationships = this.buildRelationships(entities);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    logger.info('ErrorTrackingCollector collection complete', {
      entities: maskedEntities.length,
      relationships: relationships.length,
      durationMs,
    });

    return {
      entities: maskedEntities,
      relationships,
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed:
          MOCK_ERROR_EVENTS.length +
          MOCK_ERROR_GROUPS.length +
          MOCK_ALERT_RULES.length +
          MOCK_SERVICES.length +
          MOCK_ENVIRONMENTS.length,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('ErrorTrackingCollector disposed', { platform: this.platform });
  }

  // -----------------------------------------------------------------------
  // Internal: Entity Helpers
  // -----------------------------------------------------------------------

  /**
   * Create a single entity with common defaults.
   */
  private makeEntity(
    type: Entity['type'],
    name: string,
    props: Record<string, unknown>,
    tags: string[] = [],
  ): Entity {
    const now = nowISO();
    return {
      id: generateId(),
      type,
      name,
      qualified_name: qualifiedName(this.platform, name),
      source: this.id,
      properties: props,
      tags: ['error-tracking', this.platform, ...tags],
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    };
  }

  /**
   * Create a single relationship with common defaults.
   */
  private makeRel(
    type: Relationship['type'],
    sourceId: string,
    targetId: string,
    props: Record<string, unknown> = {},
  ): Relationship {
    const now = nowISO();
    return {
      id: generateId(),
      type,
      source_id: sourceId,
      target_id: targetId,
      properties: props,
      confidence: 1.0,
      source: this.id,
      created_at: now,
      updated_at: now,
    };
  }

  // -----------------------------------------------------------------------
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from synthetic error tracking data.
   *
   * Creates:
   * - `user` entities for each SRE team member
   * - `incident` entities for each error event
   * - `alert` entities for each error group
   * - `config` entities for each alert rule
   * - `infrastructure_resource` entities for each service
   * - `environment` entities for each deployment environment
   *
   * @returns Array of entities.
   */
  private buildEntities(): Entity[] {
    const entities: Entity[] = [];

    // --- User entities (SRE team members) ---
    for (const username of MOCK_USERS) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          role: 'sre',
          platform: this.platform,
        }, ['sre']),
      );
    }

    // --- Error event entities ---
    for (const event of MOCK_ERROR_EVENTS) {
      entities.push(
        this.makeEntity('incident', event.title, {
          error_type: event.errorType,
          severity: event.severity,
          service: event.service,
          environment: event.environment,
          stack_trace: event.stackTrace,
          occurrences: event.occurrences,
          platform: this.platform,
        }, ['error-event', event.severity, event.errorType.toLowerCase()]),
      );
    }

    // --- Error group entities ---
    for (const group of MOCK_ERROR_GROUPS) {
      entities.push(
        this.makeEntity('alert', group.name, {
          pattern: group.pattern,
          error_types: group.errorTypes,
          count: group.count,
          first_seen: group.firstSeen,
          last_seen: group.lastSeen,
          platform: this.platform,
        }, ['error-group']),
      );
    }

    // --- Alert rule entities ---
    for (const rule of MOCK_ALERT_RULES) {
      entities.push(
        this.makeEntity('config', rule.name, {
          condition: rule.condition,
          threshold: rule.threshold,
          owner: rule.owner,
          channel: rule.channel,
          enabled: rule.enabled,
          platform: this.platform,
        }, ['alert-rule', rule.enabled ? 'enabled' : 'disabled']),
      );
    }

    // --- Service entities ---
    for (const svc of MOCK_SERVICES) {
      entities.push(
        this.makeEntity('infrastructure_resource', svc.name, {
          language: svc.language,
          framework: svc.framework,
          error_rate: svc.errorRate,
          platform: this.platform,
        }, ['service']),
      );
    }

    // --- Environment entities ---
    for (const env of MOCK_ENVIRONMENTS) {
      entities.push(
        this.makeEntity('environment', env.name, {
          tier: env.tier,
          url: env.url,
          platform: this.platform,
        }, [env.tier]),
      );
    }

    return entities;
  }

  // -----------------------------------------------------------------------
  // Internal: Relationship Building
  // -----------------------------------------------------------------------

  /**
   * Build relationships between entities.
   *
   * Creates:
   * - `monitors` — alert rule monitors error group
   * - `contains` — service contains error groups
   * - `triggers` — error event triggers alert rule
   * - `deploys_to` — service deploys to environment
   * - `owns` — user owns alert rule
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const incidents = entities.filter((e) => e.type === 'incident');
    const alertGroups = entities.filter((e) => e.type === 'alert');
    const alertRules = entities.filter((e) => e.type === 'config');
    const services = entities.filter((e) => e.type === 'infrastructure_resource');
    const environments = entities.filter((e) => e.type === 'environment');

    // Alert Rule → Error Group (monitors)
    // Each alert rule monitors relevant error groups
    for (const rule of alertRules) {
      const ruleName = rule.name as string;
      // Match alert rules to error groups based on rule semantics
      for (const group of alertGroups) {
        const errorTypes = group.properties['error_types'] as string[];
        const shouldMonitor =
          (ruleName === 'Critical Error Spike') ||
          (ruleName === 'P0 Bug Alert' && errorTypes.some((t) => ['OOM', 'DBConnection'].includes(t))) ||
          (ruleName === 'Performance Degradation' && errorTypes.some((t) => ['APITimeout', 'RateLimit'].includes(t))) ||
          (ruleName === 'Security Alert' && errorTypes.includes('AuthFailure'));

        if (shouldMonitor) {
          relationships.push(this.makeRel('monitors', rule.id, group.id, {
            rule_name: ruleName,
            group_name: group.name,
          }));
        }
      }
    }

    // Service → Error Group (contains)
    // Map services to error groups based on the error events they produce
    for (const svc of services) {
      const svcName = svc.name;
      // Find error types associated with this service
      const svcErrorTypes = new Set(
        MOCK_ERROR_EVENTS
          .filter((e) => e.service === svcName)
          .map((e) => e.errorType),
      );

      for (const group of alertGroups) {
        const groupErrorTypes = group.properties['error_types'] as string[];
        if (groupErrorTypes.some((t) => svcErrorTypes.has(t))) {
          relationships.push(this.makeRel('contains', svc.id, group.id, {
            service: svcName,
            group_name: group.name,
          }));
        }
      }
    }

    // Error Event → Alert Rule (triggers)
    // Fatal/high-severity events trigger relevant alert rules
    for (const event of incidents) {
      const severity = event.properties['severity'] as string;
      const errorType = event.properties['error_type'] as string;

      for (const rule of alertRules) {
        const ruleName = rule.name as string;
        const shouldTrigger =
          (ruleName === 'P0 Bug Alert' && severity === 'fatal') ||
          (ruleName === 'Security Alert' && errorType === 'AuthFailure');

        if (shouldTrigger) {
          relationships.push(this.makeRel('triggers', event.id, rule.id, {
            event_title: event.name,
            rule_name: ruleName,
          }));
        }
      }
    }

    // Service → Environment (deploys_to)
    for (const svc of services) {
      const svcName = svc.name;
      // Find environments this service has errors in
      const svcEnvs = new Set(
        MOCK_ERROR_EVENTS
          .filter((e) => e.service === svcName)
          .map((e) => e.environment),
      );

      for (const env of environments) {
        if (svcEnvs.has(env.name)) {
          relationships.push(this.makeRel('deploys_to', svc.id, env.id, {
            service: svcName,
            environment: env.name,
          }));
        }
      }
    }

    // User → Alert Rule (owns)
    for (const rule of alertRules) {
      const ownerName = rule.properties['owner'] as string;
      const ownerEntity = users.find((u) => u.name === ownerName);
      if (ownerEntity) {
        relationships.push(this.makeRel('owns', ownerEntity.id, rule.id, {
          rule_name: rule.name,
        }));
      }
    }

    return relationships;
  }
}

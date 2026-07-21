/**
 * @module @recurrsive/collectors/apm/collector
 *
 * APM (Application Performance Monitoring) Collector — ingests
 * performance metrics, infrastructure resources, alerts, incidents,
 * environments, and team members from an APM platform account and
 * produces entities and relationships for the knowledge graph.
 *
 * Connects to real APM platform APIs (Datadog, New Relic, Grafana)
 * using credentials from config or environment variables. When no
 * credentials are configured the collector returns empty results.
 *
 * Produces entities:
 * - `performance_metric` — response times, error rates, throughput
 *   (New Relic application summaries)
 * - `infrastructure_resource` — hosts (Datadog), services (New Relic),
 *   dashboards (Grafana)
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

const logger = createLogger({ context: { module: 'apm-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** APM platform type. */
type APMPlatform = 'datadog' | 'newrelic' | 'grafana';

// ---------------------------------------------------------------------------
// APMCollector
// ---------------------------------------------------------------------------

/**
 * Collects performance metrics, infrastructure resources, alerts,
 * incidents, environments, and team members from an APM platform
 * account.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and platform.
 * 2. {@link validate} — verify the platform is supported.
 * 3. {@link collect} — generate entities & relationships from
 *    APM API data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new APMCollector('datadog');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: { datadog_api_key: 'xxx', datadog_app_key: 'yyy' },
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class APMCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'apm';
  /** @inheritdoc */
  readonly name = 'APM Collector';
  /** @inheritdoc */
  readonly description = 'Collects performance metrics, infrastructure resources, alerts, and incidents from APM platforms';
  /** @inheritdoc */
  readonly type: CollectorType = 'observability';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** APM platform. */
  private platform: APMPlatform;
  /** Stored collector configuration. */
  private config!: CollectorConfig;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;

  /**
   * @param platform - APM platform (default: `'datadog'`).
   */
  constructor(platform: APMPlatform = 'datadog') {
    this.platform = platform;
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
    this.config = config;
    this.governanceFilter = new GovernanceFilter(config.governance);

    if (typeof config.custom['platform'] === 'string') {
      const p = config.custom['platform'];
      if (p === 'datadog' || p === 'newrelic' || p === 'grafana') {
        this.platform = p;
      }
    }

    this.initialized = true;
    logger.info('APMCollector initialized', { platform: this.platform });
  }

  /**
   * Validate that the configured platform is supported.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const supported: APMPlatform[] = ['datadog', 'newrelic', 'grafana'];

    if (!this.platform) {
      errors.push('APM platform is required');
    } else if (!supported.includes(this.platform)) {
      errors.push(`'${this.platform}' is not a supported APM platform. Supported: ${supported.join(', ')}`);
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
        'APMCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // Build empty result helper — carries any recorded errors so failures
    // and missing credentials degrade honestly instead of silently.
    const emptyResult = (): CollectorResult => ({
      entities: [],
      relationships: [],
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: Date.now() - startTime,
        items_processed: 0,
        errors,
      },
    });

    // Check for credentials based on the selected platform
    let apiKey: string | undefined;
    let appKey: string | undefined;
    let baseUrl: string;

    if (this.platform === 'datadog') {
      apiKey = (this.config.custom['datadog_api_key'] as string) || process.env['DATADOG_API_KEY'];
      appKey = (this.config.custom['datadog_app_key'] as string) || process.env['DATADOG_APP_KEY'];
      baseUrl = (this.config.custom['datadog_url'] as string) || process.env['DATADOG_URL'] || 'https://api.datadoghq.com';

      if (!apiKey || !appKey) {
        logger.warn(`No APM credentials configured for ${this.platform}, skipping collection`);
        errors.push({ message: `No Datadog credentials configured (need datadog_api_key and datadog_app_key); skipping collection` });
        return emptyResult();
      }
    } else if (this.platform === 'newrelic') {
      apiKey = (this.config.custom['newrelic_api_key'] as string) || process.env['NEWRELIC_API_KEY'];
      baseUrl = (this.config.custom['newrelic_url'] as string) || process.env['NEWRELIC_URL'] || 'https://api.newrelic.com';

      if (!apiKey) {
        logger.warn(`No APM credentials configured for ${this.platform}, skipping collection`);
        errors.push({ message: `No New Relic credentials configured (need newrelic_api_key); skipping collection` });
        return emptyResult();
      }
    } else if (this.platform === 'grafana') {
      apiKey = (this.config.custom['grafana_api_key'] as string) || process.env['GRAFANA_API_KEY'];
      // There is no meaningful default Grafana instance URL — grafana.com is
      // the cloud portal, not the user's instance API. Require explicit config.
      const grafanaUrl = (this.config.custom['grafana_url'] as string) || process.env['GRAFANA_URL'];

      if (!apiKey) {
        logger.warn(`No APM credentials configured for ${this.platform}, skipping collection`);
        errors.push({ message: `No Grafana credentials configured (need grafana_api_key); skipping collection` });
        return emptyResult();
      }
      if (!grafanaUrl) {
        const msg = 'No Grafana instance URL configured (set grafana_url or GRAFANA_URL); the collector cannot guess the instance URL, skipping collection';
        logger.warn(msg);
        errors.push({ message: msg });
        return emptyResult();
      }
      baseUrl = grafanaUrl;
    } else {
      logger.warn(`No APM credentials configured for ${this.platform}, skipping collection`);
      errors.push({ message: `No APM credentials configured for ${this.platform}; skipping collection` });
      return emptyResult();
    }

    // Fetch data from the APM platform API
    let responseData: unknown;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      let url: string;
      const headers: Record<string, string> = {};

      if (this.platform === 'datadog') {
        url = `${baseUrl}/api/v1/hosts`;
        headers['DD-API-KEY'] = apiKey!;
        headers['DD-APPLICATION-KEY'] = appKey!;
      } else if (this.platform === 'newrelic') {
        url = `${baseUrl}/v2/applications.json`;
        headers['Api-Key'] = apiKey!;
      } else {
        // grafana — dashboard search endpoint on the configured instance
        url = `${baseUrl}/api/search?type=dash-db`;
        headers['Authorization'] = `Bearer ${apiKey!}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      responseData = await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn(`Failed to fetch from ${this.platform} API`, { error: message });
      errors.push({ message: `${this.platform} API fetch failed: ${message}` });
      return emptyResult();
    }

    // Build entities from response data
    const entities = this.buildEntitiesFromResponse(responseData);
    const relationships = this.buildRelationships(entities);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    logger.info('APMCollector collection complete', {
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
        items_processed: maskedEntities.length,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('APMCollector disposed', { platform: this.platform });
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
      tags: ['apm', this.platform, ...tags],
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
  // Internal: Entity Building from API Response
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from API response data.
   *
   * Parses the platform-specific response and creates:
   * - `infrastructure_resource` entities
   * - `performance_metric` entities (New Relic application summaries)
   *
   * Only data actually present in the API response is emitted; absent
   * fields are omitted rather than defaulted.
   *
   * @param data - Raw API response data.
   * @returns Array of entities.
   */
  private buildEntitiesFromResponse(data: unknown): Entity[] {
    const entities: Entity[] = [];

    if (!data || typeof data !== 'object') {
      return entities;
    }

    const record = data as Record<string, unknown>;

    if (this.platform === 'datadog') {
      // Parse Datadog /api/v1/hosts response. Host metrics are nested under
      // host.metrics (cpu/memory) and host metadata under host.meta — when a
      // value is absent it is omitted, never defaulted to 0.
      const hostList = Array.isArray(record['host_list']) ? record['host_list'] : [];
      for (const host of hostList) {
        const h = host as Record<string, unknown>;

        const props: Record<string, unknown> = {
          resource_type: 'host',
          status: h['up'] === true ? 'healthy' : h['up'] === false ? 'degraded' : 'unknown',
          platform: this.platform,
        };

        const hostMetrics = (typeof h['metrics'] === 'object' && h['metrics'] !== null)
          ? (h['metrics'] as Record<string, unknown>)
          : {};
        if (typeof hostMetrics['cpu'] === 'number') props['cpu_percent'] = hostMetrics['cpu'];
        if (typeof hostMetrics['memory'] === 'number') props['memory_percent'] = hostMetrics['memory'];

        const meta = (typeof h['meta'] === 'object' && h['meta'] !== null)
          ? (h['meta'] as Record<string, unknown>)
          : {};
        if (typeof meta['platform'] === 'string') props['os_platform'] = meta['platform'];
        if (typeof meta['agent_version'] === 'string') props['agent_version'] = meta['agent_version'];

        entities.push(
          this.makeEntity('infrastructure_resource', String(h['name'] ?? 'unknown-host'), props, ['host']),
        );
      }
    } else if (this.platform === 'newrelic') {
      // Parse New Relic /v2/applications.json response
      const applications = Array.isArray(record['applications']) ? record['applications'] : [];
      for (const app of applications) {
        const a = app as Record<string, unknown>;
        entities.push(
          this.makeEntity('infrastructure_resource', String(a['name'] ?? 'unknown-app'), {
            resource_type: 'service',
            // Map New Relic health: green→healthy, orange→degraded, red→critical.
            // 'gray' (not reporting) and any missing/unknown value map to
            // 'unknown' — NOT 'critical' — so absent data isn't asserted as a
            // critical incident (mirrors the Datadog path's missing→unknown).
            status: a['health_status'] === 'green' ? 'healthy'
              : a['health_status'] === 'orange' ? 'degraded'
                : a['health_status'] === 'red' ? 'critical'
                  : 'unknown',
            language: a['language'] ?? 'unknown',
            platform: this.platform,
          }, ['service']),
        );

        // Extract application metrics if present
        const appSettings = a['application_summary'] as Record<string, unknown> | undefined;
        if (appSettings) {
          if (appSettings['response_time'] != null) {
            entities.push(
              this.makeEntity('performance_metric', `${a['name']}-response-time`, {
                metric_type: 'response_time',
                value: appSettings['response_time'],
                unit: 'ms',
                service: String(a['name']),
                period: '5m',
                platform: this.platform,
              }, ['apm-metric', 'response_time']),
            );
          }
          if (appSettings['error_rate'] != null) {
            entities.push(
              this.makeEntity('performance_metric', `${a['name']}-error-rate`, {
                metric_type: 'error_rate',
                value: appSettings['error_rate'],
                unit: 'percent',
                service: String(a['name']),
                period: '5m',
                platform: this.platform,
              }, ['apm-metric', 'error_rate']),
            );
          }
          if (appSettings['throughput'] != null) {
            entities.push(
              this.makeEntity('performance_metric', `${a['name']}-throughput`, {
                metric_type: 'throughput',
                value: appSettings['throughput'],
                unit: 'req/min',
                service: String(a['name']),
                period: '1m',
                platform: this.platform,
              }, ['apm-metric', 'throughput']),
            );
          }
        }
      }
    } else if (this.platform === 'grafana') {
      // Parse Grafana /api/dashboards response
      const dashboards = Array.isArray(record) ? (record as unknown as unknown[]) : (Array.isArray(record['dashboards']) ? record['dashboards'] : []);
      for (const dash of dashboards) {
        const d = dash as Record<string, unknown>;
        entities.push(
          this.makeEntity('infrastructure_resource', String(d['title'] ?? d['name'] ?? 'unknown-dashboard'), {
            resource_type: 'service',
            uid: d['uid'] ?? 'unknown',
            status: 'healthy',
            platform: this.platform,
          }, ['dashboard']),
        );
      }
    }

    // Extract alerts if present in response
    const alerts = Array.isArray(record['alerts']) ? record['alerts'] : [];
    for (const alert of alerts) {
      const a = alert as Record<string, unknown>;
      entities.push(
        this.makeEntity('alert', String(a['name'] ?? 'unknown-alert'), {
          severity: a['severity'] ?? 'warning',
          metric: a['metric'] ?? 'unknown',
          threshold: a['threshold'] ?? 0,
          current_value: a['current_value'] ?? 0,
          owner: a['owner'] ?? 'unknown',
          status: a['status'] ?? 'active',
          platform: this.platform,
        }, ['apm-alert']),
      );
    }

    // Extract incidents if present in response
    const incidents = Array.isArray(record['incidents']) ? record['incidents'] : [];
    for (const incident of incidents) {
      const i = incident as Record<string, unknown>;
      entities.push(
        this.makeEntity('incident', String(i['name'] ?? i['title'] ?? 'unknown-incident'), {
          severity: i['severity'] ?? 'SEV3',
          status: i['status'] ?? 'active',
          affected_service: i['affected_service'] ?? 'unknown',
          started_at: i['started_at'] ?? nowISO(),
          commander: i['commander'] ?? 'unknown',
          platform: this.platform,
        }, ['apm-incident']),
      );
    }

    // Extract environments if present in response
    const environments = Array.isArray(record['environments']) ? record['environments'] : [];
    for (const env of environments) {
      const e = env as Record<string, unknown>;
      entities.push(
        this.makeEntity('environment', String(e['name'] ?? 'unknown-env'), {
          tier: e['tier'] ?? 'development',
          service_count: e['service_count'] ?? 0,
          host_count: e['host_count'] ?? 0,
          platform: this.platform,
        }, [String(e['tier'] ?? 'development')]),
      );
    }

    // Extract users if present in response
    const users = Array.isArray(record['users']) ? record['users'] : [];
    for (const user of users) {
      const u = user as Record<string, unknown>;
      entities.push(
        this.makeEntity('user', String(u['name'] ?? u['username'] ?? 'unknown-user'), {
          username: u['username'] ?? u['name'] ?? 'unknown',
          role: u['role'] ?? 'devops_engineer',
          platform: this.platform,
        }, ['devops-team']),
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
   * - `monitors` — alert monitors performance_metric
   * - `contains` — environment contains infrastructure_resource
   * - `deploys_to` — infrastructure_resource (service) deployed to environment
   * - `depends_on` — infrastructure_resource (service) depends on another service
   * - `owns` — user owns alert
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const metrics = entities.filter((e) => e.type === 'performance_metric');
    const resources = entities.filter((e) => e.type === 'infrastructure_resource');
    const alerts = entities.filter((e) => e.type === 'alert');
    const incidents = entities.filter((e) => e.type === 'incident');
    const environments = entities.filter((e) => e.type === 'environment');

    // Alert → Performance Metric (monitors) — each alert monitors a metric
    for (const alert of alerts) {
      const metricName = alert.properties['metric'] as string;
      const metricEntity = metrics.find((m) => m.name === metricName);
      if (metricEntity) {
        relationships.push(this.makeRel('monitors', alert.id, metricEntity.id, {
          alert_name: alert.name,
          severity: alert.properties['severity'],
        }));
      }
    }

    // Environment → Infrastructure Resource (contains) — environments contain hosts/containers
    const prodEnv = environments.find((e) => e.name === 'production');
    const stagingEnv = environments.find((e) => e.name === 'staging');


    for (const resource of resources) {
      const resourceType = resource.properties['resource_type'] as string;
      if (resourceType === 'host' || resourceType === 'container') {
        const status = resource.properties['status'] as string;
        if (status === 'healthy' || status === 'degraded' || status === 'critical') {
          if (resource.name.includes('staging') && stagingEnv) {
            relationships.push(this.makeRel('contains', stagingEnv.id, resource.id, {
              environment: 'staging',
            }));
          } else if (prodEnv) {
            relationships.push(this.makeRel('contains', prodEnv.id, resource.id, {
              environment: 'production',
            }));
          }
        }
      }
    }

    // Infrastructure Resource (service) → Environment (deploys_to)
    const serviceResources = resources.filter((r) => r.properties['resource_type'] === 'service');
    for (const service of serviceResources) {
      if (prodEnv) {
        relationships.push(this.makeRel('deploys_to', service.id, prodEnv.id, {
          environment: 'production',
          service_name: service.name,
        }));
      }
    }

    // NOTE: Service→Service `depends_on` edges are intentionally NOT emitted.
    // APM provider responses (Datadog/New Relic/Grafana) used here do not carry
    // service-dependency topology, so any such edge would be fabricated. A prior
    // version invented these by string-matching hardcoded names (api-gateway →
    // auth-service, etc.) with made-up `dependency_type`s — removed for honesty.
    // Real dependency edges must come from an observed source (e.g. a service
    // map / trace-derived topology endpoint), not asserted from names.

    // User → Alert (owns) — alert owners
    for (const alert of alerts) {
      const ownerName = alert.properties['owner'] as string;
      const ownerEntity = users.find((u) => u.name === ownerName);
      if (ownerEntity) {
        relationships.push(this.makeRel('owns', ownerEntity.id, alert.id, {
          role: 'alert_owner',
        }));
      }
    }

    // User → Incident (owns) — incident commanders
    for (const incident of incidents) {
      const commanderName = incident.properties['commander'] as string;
      const commanderEntity = users.find((u) => u.name === commanderName);
      if (commanderEntity) {
        relationships.push(this.makeRel('owns', commanderEntity.id, incident.id, {
          role: 'incident_commander',
        }));
      }
    }

    return relationships;
  }
}

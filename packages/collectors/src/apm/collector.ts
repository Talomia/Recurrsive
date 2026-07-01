/**
 * @module @recurrsive/collectors/apm/collector
 *
 * APM (Application Performance Monitoring) Collector — ingests
 * performance metrics, infrastructure resources, alerts, incidents,
 * environments, and team members from an APM platform account and
 * produces entities and relationships for the knowledge graph.
 *
 * Since this collector is not yet connected to real API calls, it
 * generates synthetic data that mirrors the shape of real APM
 * API responses for development and testing purposes.
 *
 * Produces entities:
 * - `performance_metric` — response times, error rates, throughput
 * - `infrastructure_resource` — hosts, containers, services
 * - `alert` — performance threshold alerts
 * - `incident` — active incidents
 * - `environment` — production, staging, dev environments
 * - `user` — DevOps team members
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

/** Synthetic performance metric data. */
interface MockPerformanceMetric {
  name: string;
  metric_type: 'response_time' | 'error_rate' | 'throughput';
  value: number;
  unit: string;
  service: string;
  period: string;
}

/** Synthetic infrastructure resource data. */
interface MockInfraResource {
  name: string;
  resource_type: 'host' | 'container' | 'service';
  cpu_percent: number;
  memory_percent: number;
  status: 'healthy' | 'degraded' | 'critical';
  region: string;
}

/** Synthetic alert data. */
interface MockAlert {
  name: string;
  severity: 'warning' | 'critical';
  metric: string;
  threshold: number;
  current_value: number;
  owner: string;
  status: 'active' | 'resolved';
}

/** Synthetic incident data. */
interface MockIncident {
  name: string;
  severity: 'SEV1' | 'SEV2' | 'SEV3';
  status: 'active' | 'investigating' | 'resolved';
  affected_service: string;
  started_at: string;
  commander: string;
}

/** Synthetic environment data. */
interface MockEnvironment {
  name: string;
  tier: 'production' | 'staging' | 'development';
  service_count: number;
  host_count: number;
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_USERS = ['devops-lead', 'sre-engineer', 'platform-admin'];

const MOCK_PERFORMANCE_METRICS: MockPerformanceMetric[] = [
  { name: 'api-response-time-p99', metric_type: 'response_time', value: 245.8, unit: 'ms', service: 'api-gateway', period: '5m' },
  { name: 'api-response-time-p50', metric_type: 'response_time', value: 42.3, unit: 'ms', service: 'api-gateway', period: '5m' },
  { name: 'auth-service-error-rate', metric_type: 'error_rate', value: 0.23, unit: 'percent', service: 'auth-service', period: '15m' },
  { name: 'payment-service-error-rate', metric_type: 'error_rate', value: 1.47, unit: 'percent', service: 'payment-service', period: '15m' },
  { name: 'api-gateway-throughput', metric_type: 'throughput', value: 12480, unit: 'req/min', service: 'api-gateway', period: '1m' },
  { name: 'order-service-throughput', metric_type: 'throughput', value: 3200, unit: 'req/min', service: 'order-service', period: '1m' },
];

const MOCK_INFRA_RESOURCES: MockInfraResource[] = [
  { name: 'web-host-01', resource_type: 'host', cpu_percent: 67.2, memory_percent: 74.1, status: 'healthy', region: 'us-east-1' },
  { name: 'web-host-02', resource_type: 'host', cpu_percent: 82.5, memory_percent: 88.3, status: 'degraded', region: 'us-east-1' },
  { name: 'db-host-01', resource_type: 'host', cpu_percent: 45.0, memory_percent: 62.4, status: 'healthy', region: 'us-west-2' },
  { name: 'api-container-01', resource_type: 'container', cpu_percent: 55.3, memory_percent: 60.2, status: 'healthy', region: 'us-east-1' },
  { name: 'api-container-02', resource_type: 'container', cpu_percent: 91.7, memory_percent: 85.6, status: 'critical', region: 'us-east-1' },
  { name: 'worker-container-01', resource_type: 'container', cpu_percent: 30.1, memory_percent: 42.5, status: 'healthy', region: 'us-west-2' },
  { name: 'api-gateway', resource_type: 'service', cpu_percent: 58.0, memory_percent: 65.0, status: 'healthy', region: 'us-east-1' },
  { name: 'auth-service', resource_type: 'service', cpu_percent: 35.2, memory_percent: 48.7, status: 'healthy', region: 'us-east-1' },
  { name: 'payment-service', resource_type: 'service', cpu_percent: 72.8, memory_percent: 70.3, status: 'degraded', region: 'us-east-1' },
  { name: 'order-service', resource_type: 'service', cpu_percent: 48.5, memory_percent: 55.1, status: 'healthy', region: 'us-west-2' },
];

const MOCK_ALERTS: MockAlert[] = [
  { name: 'high-p99-latency', severity: 'warning', metric: 'api-response-time-p99', threshold: 200, current_value: 245.8, owner: 'devops-lead', status: 'active' },
  { name: 'elevated-error-rate', severity: 'critical', metric: 'payment-service-error-rate', threshold: 1.0, current_value: 1.47, owner: 'sre-engineer', status: 'active' },
  { name: 'cpu-saturation', severity: 'critical', metric: 'cpu_percent', threshold: 90, current_value: 91.7, owner: 'platform-admin', status: 'active' },
  { name: 'memory-pressure', severity: 'warning', metric: 'memory_percent', threshold: 85, current_value: 88.3, owner: 'devops-lead', status: 'active' },
];

const MOCK_INCIDENTS: MockIncident[] = [
  { name: 'payment-degradation-2026-06-30', severity: 'SEV2', status: 'investigating', affected_service: 'payment-service', started_at: '2026-06-30T14:22:00Z', commander: 'sre-engineer' },
  { name: 'api-latency-spike-2026-06-29', severity: 'SEV3', status: 'resolved', affected_service: 'api-gateway', started_at: '2026-06-29T09:15:00Z', commander: 'devops-lead' },
];

const MOCK_ENVIRONMENTS: MockEnvironment[] = [
  { name: 'production', tier: 'production', service_count: 8, host_count: 6 },
  { name: 'staging', tier: 'staging', service_count: 4, host_count: 2 },
  { name: 'dev', tier: 'development', service_count: 3, host_count: 1 },
];

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
 *    synthetic APM data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new APMCollector('datadog');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {},
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

    // Build entities and relationships from synthetic data
    const entities = this.buildEntities();
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
        items_processed: MOCK_PERFORMANCE_METRICS.length + MOCK_INFRA_RESOURCES.length + MOCK_ALERTS.length + MOCK_INCIDENTS.length + MOCK_ENVIRONMENTS.length,
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
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from synthetic APM data.
   *
   * Creates:
   * - `user` entities for DevOps team members
   * - `performance_metric` entities for response times, error rates, throughput
   * - `infrastructure_resource` entities for hosts, containers, services
   * - `alert` entities for performance thresholds
   * - `incident` entities for active incidents
   * - `environment` entities for deployment environments
   *
   * @returns Array of entities.
   */
  private buildEntities(): Entity[] {
    const entities: Entity[] = [];

    // --- User entities (DevOps team) ---
    for (const username of MOCK_USERS) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          role: 'devops_engineer',
          platform: this.platform,
        }, ['devops-team']),
      );
    }

    // --- Performance metric entities ---
    for (const metric of MOCK_PERFORMANCE_METRICS) {
      entities.push(
        this.makeEntity('performance_metric', metric.name, {
          metric_type: metric.metric_type,
          value: metric.value,
          unit: metric.unit,
          service: metric.service,
          period: metric.period,
          platform: this.platform,
        }, ['apm-metric', metric.metric_type]),
      );
    }

    // --- Infrastructure resource entities (hosts, containers, services) ---
    for (const resource of MOCK_INFRA_RESOURCES) {
      entities.push(
        this.makeEntity('infrastructure_resource', resource.name, {
          resource_type: resource.resource_type,
          cpu_percent: resource.cpu_percent,
          memory_percent: resource.memory_percent,
          status: resource.status,
          region: resource.region,
          platform: this.platform,
        }, [resource.resource_type, resource.status]),
      );
    }

    // --- Alert entities (performance thresholds) ---
    for (const alert of MOCK_ALERTS) {
      entities.push(
        this.makeEntity('alert', alert.name, {
          severity: alert.severity,
          metric: alert.metric,
          threshold: alert.threshold,
          current_value: alert.current_value,
          owner: alert.owner,
          status: alert.status,
          breach_percent: Math.round((alert.current_value / alert.threshold) * 100),
          platform: this.platform,
        }, ['apm-alert', alert.severity]),
      );
    }

    // --- Incident entities ---
    for (const incident of MOCK_INCIDENTS) {
      entities.push(
        this.makeEntity('incident', incident.name, {
          severity: incident.severity,
          status: incident.status,
          affected_service: incident.affected_service,
          started_at: incident.started_at,
          commander: incident.commander,
          platform: this.platform,
        }, ['apm-incident', incident.severity]),
      );
    }

    // --- Environment entities ---
    for (const env of MOCK_ENVIRONMENTS) {
      entities.push(
        this.makeEntity('environment', env.name, {
          tier: env.tier,
          service_count: env.service_count,
          host_count: env.host_count,
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

    // Service → Service (depends_on) — service dependencies
    const apiGateway = serviceResources.find((s) => s.name === 'api-gateway');
    const authService = serviceResources.find((s) => s.name === 'auth-service');
    const paymentService = serviceResources.find((s) => s.name === 'payment-service');
    const orderService = serviceResources.find((s) => s.name === 'order-service');

    if (apiGateway && authService) {
      relationships.push(this.makeRel('depends_on', apiGateway.id, authService.id, {
        dependency_type: 'authentication',
      }));
    }
    if (apiGateway && orderService) {
      relationships.push(this.makeRel('depends_on', apiGateway.id, orderService.id, {
        dependency_type: 'routing',
      }));
    }
    if (orderService && paymentService) {
      relationships.push(this.makeRel('depends_on', orderService.id, paymentService.id, {
        dependency_type: 'payment_processing',
      }));
    }

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

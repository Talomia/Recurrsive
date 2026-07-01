/**
 * @module @recurrsive/collectors/telemetry/collector
 *
 * OpenTelemetry Collector — ingests OTLP-shaped trace and metric data
 * and produces entities and relationships for the knowledge graph.
 *
 * Since this collector is not yet connected to a real OTLP endpoint,
 * it generates synthetic data that mirrors the shape of real
 * OpenTelemetry trace spans and metric data points.
 *
 * Produces entities:
 * - `performance_metric` — latency, throughput, error-rate metrics
 * - `infrastructure_resource` — hosts, containers, pods
 * - `deployment` — service deployment records
 * - `environment` — staging / production environments
 * - `alert` — firing or resolved alert rules
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

const logger = createLogger({ context: { module: 'telemetry-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Synthetic trace span data. */
interface MockSpan {
  traceId: string;
  spanId: string;
  operationName: string;
  serviceName: string;
  durationMs: number;
  status: 'ok' | 'error';
}

/** Synthetic metric data point. */
interface MockMetric {
  name: string;
  unit: string;
  value: number;
  resource: string;
  metricType: 'gauge' | 'counter' | 'histogram';
}

/** Synthetic infrastructure resource. */
interface MockResource {
  name: string;
  kind: 'host' | 'container' | 'pod';
  region: string;
  cpu: number;
  memoryMb: number;
}

/** Synthetic alert definition. */
interface MockAlert {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  condition: string;
  targetMetric: string;
  status: 'firing' | 'resolved';
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_SPANS: MockSpan[] = [
  { traceId: 'trace-001', spanId: 'span-001', operationName: 'GET /api/users', serviceName: 'api-gateway', durationMs: 45, status: 'ok' },
  { traceId: 'trace-001', spanId: 'span-002', operationName: 'SELECT users', serviceName: 'user-service', durationMs: 12, status: 'ok' },
  { traceId: 'trace-002', spanId: 'span-003', operationName: 'POST /api/orders', serviceName: 'api-gateway', durationMs: 230, status: 'error' },
  { traceId: 'trace-003', spanId: 'span-004', operationName: 'GET /health', serviceName: 'api-gateway', durationMs: 2, status: 'ok' },
];

const MOCK_METRICS: MockMetric[] = [
  { name: 'http_request_duration_ms', unit: 'ms', value: 45.2, resource: 'api-gateway', metricType: 'histogram' },
  { name: 'http_requests_total', unit: 'count', value: 15234, resource: 'api-gateway', metricType: 'counter' },
  { name: 'cpu_utilization', unit: 'percent', value: 67.5, resource: 'worker-node-1', metricType: 'gauge' },
  { name: 'memory_utilization', unit: 'percent', value: 82.1, resource: 'worker-node-1', metricType: 'gauge' },
  { name: 'error_rate', unit: 'percent', value: 0.3, resource: 'api-gateway', metricType: 'gauge' },
];

const MOCK_RESOURCES: MockResource[] = [
  { name: 'worker-node-1', kind: 'host', region: 'us-east-1', cpu: 8, memoryMb: 16384 },
  { name: 'api-gateway-pod-1', kind: 'pod', region: 'us-east-1', cpu: 2, memoryMb: 4096 },
  { name: 'user-service-container', kind: 'container', region: 'us-east-1', cpu: 1, memoryMb: 2048 },
];

const MOCK_ALERTS: MockAlert[] = [
  { name: 'HighErrorRate', severity: 'critical', condition: 'error_rate > 1%', targetMetric: 'error_rate', status: 'resolved' },
  { name: 'HighCPU', severity: 'warning', condition: 'cpu_utilization > 80%', targetMetric: 'cpu_utilization', status: 'firing' },
];

const MOCK_ENVIRONMENTS = ['production', 'staging'];

const MOCK_DEPLOYMENTS = [
  { service: 'api-gateway', environment: 'production', version: 'v2.3.1', status: 'active' },
  { service: 'user-service', environment: 'staging', version: 'v1.8.0-rc.2', status: 'active' },
];

// ---------------------------------------------------------------------------
// OpenTelemetryCollector
// ---------------------------------------------------------------------------

/**
 * Collects telemetry data (traces, metrics, infrastructure resources,
 * alerts, and deployments) from an OTLP-compatible endpoint.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and endpoint.
 * 2. {@link validate} — verify the endpoint URL is well-formed.
 * 3. {@link collect} — generate entities & relationships from
 *    synthetic OTLP data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new OpenTelemetryCollector('http://localhost:4318');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 },
 *   custom: {},
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class OpenTelemetryCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'telemetry';
  /** @inheritdoc */
  readonly name = 'OpenTelemetry Collector';
  /** @inheritdoc */
  readonly description = 'Ingests OTLP-shaped trace/metric data for observability analysis';
  /** @inheritdoc */
  readonly type: CollectorType = 'telemetry';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** OTLP endpoint URL. */
  private otlpEndpoint: string;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;

  /**
   * @param otlpEndpoint - OTLP receiver endpoint URL
   *   (e.g. `http://localhost:4318`).
   */
  constructor(otlpEndpoint: string) {
    this.otlpEndpoint = otlpEndpoint;
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

    if (typeof config.custom['otlpEndpoint'] === 'string') {
      this.otlpEndpoint = config.custom['otlpEndpoint'];
    }

    this.initialized = true;
    logger.info('OpenTelemetryCollector initialized', { otlpEndpoint: this.otlpEndpoint });
  }

  /**
   * Validate that the configured OTLP endpoint URL is well-formed.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!this.otlpEndpoint) {
      errors.push('OTLP endpoint URL is required');
    } else {
      try {
        const url = new URL(this.otlpEndpoint);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push(`Unsupported protocol '${url.protocol}' — expected http: or https:`);
        }
      } catch {
        errors.push(`'${this.otlpEndpoint}' is not a valid URL`);
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
        'OpenTelemetryCollector has not been initialized. Call initialize() first.',
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

    logger.info('OpenTelemetryCollector collection complete', {
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
        items_processed: MOCK_SPANS.length + MOCK_METRICS.length + MOCK_RESOURCES.length,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('OpenTelemetryCollector disposed', { otlpEndpoint: this.otlpEndpoint });
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
      qualified_name: qualifiedName('telemetry', name),
      source: this.id,
      properties: props,
      tags: ['telemetry', ...tags],
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
   * Build knowledge graph entities from synthetic telemetry data.
   *
   * Creates:
   * - `performance_metric` entities for each metric
   * - `infrastructure_resource` entities for each host/pod/container
   * - `deployment` entities for each deployment record
   * - `environment` entities for each environment
   * - `alert` entities for each alert rule
   *
   * @returns Array of entities.
   */
  private buildEntities(): Entity[] {
    const entities: Entity[] = [];

    // --- Performance metric entities ---
    for (const metric of MOCK_METRICS) {
      entities.push(
        this.makeEntity('performance_metric', metric.name, {
          unit: metric.unit,
          value: metric.value,
          resource: metric.resource,
          metric_type: metric.metricType,
          otlp_endpoint: this.otlpEndpoint,
        }, [metric.metricType, metric.resource]),
      );
    }

    // --- Infrastructure resource entities ---
    for (const resource of MOCK_RESOURCES) {
      entities.push(
        this.makeEntity('infrastructure_resource', resource.name, {
          kind: resource.kind,
          region: resource.region,
          cpu_cores: resource.cpu,
          memory_mb: resource.memoryMb,
          otlp_endpoint: this.otlpEndpoint,
        }, [resource.kind, resource.region]),
      );
    }

    // --- Environment entities ---
    for (const env of MOCK_ENVIRONMENTS) {
      entities.push(
        this.makeEntity('environment', env, {
          environment_name: env,
          otlp_endpoint: this.otlpEndpoint,
        }, [env]),
      );
    }

    // --- Deployment entities ---
    for (const deploy of MOCK_DEPLOYMENTS) {
      entities.push(
        this.makeEntity('deployment', `${deploy.service}-${deploy.environment}`, {
          service: deploy.service,
          environment: deploy.environment,
          version: deploy.version,
          status: deploy.status,
          otlp_endpoint: this.otlpEndpoint,
        }, [deploy.environment, deploy.service]),
      );
    }

    // --- Alert entities ---
    for (const alert of MOCK_ALERTS) {
      entities.push(
        this.makeEntity('alert', alert.name, {
          severity: alert.severity,
          condition: alert.condition,
          target_metric: alert.targetMetric,
          status: alert.status,
          otlp_endpoint: this.otlpEndpoint,
        }, [alert.severity, alert.status]),
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
   * - `monitors` — infrastructure_resource → performance_metric
   * - `alerts_on` — alert → performance_metric
   * - `depends_on` — deployment → infrastructure_resource
   * - `routes_to` — environment → deployment
   * - `deploys_to` — deployment → environment
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const metrics = entities.filter((e) => e.type === 'performance_metric');
    const resources = entities.filter((e) => e.type === 'infrastructure_resource');
    const deployments = entities.filter((e) => e.type === 'deployment');
    const environments = entities.filter((e) => e.type === 'environment');
    const alerts = entities.filter((e) => e.type === 'alert');

    // Infrastructure resource → Performance metric (monitors)
    for (const resource of resources) {
      const resourceMetrics = metrics.filter(
        (m) => m.properties['resource'] === resource.name,
      );
      for (const metric of resourceMetrics) {
        relationships.push(this.makeRel('monitors', resource.id, metric.id, {
          resource_name: resource.name,
        }));
      }
    }

    // Alert → Performance metric (alerts_on)
    for (const alert of alerts) {
      const targetMetric = metrics.find(
        (m) => m.name === alert.properties['target_metric'],
      );
      if (targetMetric) {
        relationships.push(this.makeRel('alerts_on', alert.id, targetMetric.id, {
          condition: alert.properties['condition'],
        }));
      }
    }

    // Deployment → Infrastructure resource (depends_on)
    for (const deploy of deployments) {
      // Each deployment depends on the first matching infrastructure resource
      const matchingResource = resources.find(
        (r) => r.properties['kind'] === 'pod' || r.properties['kind'] === 'container',
      );
      if (matchingResource) {
        relationships.push(this.makeRel('depends_on', deploy.id, matchingResource.id, {
          service: deploy.properties['service'],
        }));
      }
    }

    // Environment → Deployment (routes_to)
    for (const env of environments) {
      const envDeployments = deployments.filter(
        (d) => d.properties['environment'] === env.name,
      );
      for (const deploy of envDeployments) {
        relationships.push(this.makeRel('routes_to', env.id, deploy.id));
      }
    }

    // Deployment → Environment (deploys_to)
    for (const deploy of deployments) {
      const targetEnv = environments.find(
        (e) => e.name === deploy.properties['environment'],
      );
      if (targetEnv) {
        relationships.push(this.makeRel('deploys_to', deploy.id, targetEnv.id, {
          version: deploy.properties['version'],
        }));
      }
    }

    return relationships;
  }
}

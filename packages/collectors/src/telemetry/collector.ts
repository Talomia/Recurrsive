/**
 * @module @recurrsive/collectors/telemetry/collector
 *
 * OpenTelemetry Collector — ingests OTLP-shaped trace and metric data
 * and produces entities and relationships for the knowledge graph.
 *
 * Reads OTEL data from local JSON files (.otel-traces.json and
 * .otel-metrics.json) if they exist in the project directory.
 * If no files are found, returns empty results.
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
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const logger = createLogger({ context: { module: 'telemetry-collector' } });

// ---------------------------------------------------------------------------
// OTEL Data Shapes
// ---------------------------------------------------------------------------

/** Shape of a span in the .otel-traces.json file. */
interface OtelSpan {
  traceId: string;
  spanId: string;
  operationName: string;
  serviceName: string;
  durationMs: number;
  status: 'ok' | 'error';
}

/** Shape of a metric data point in the .otel-metrics.json file. */
interface OtelMetric {
  name: string;
  unit: string;
  value: number;
  resource: string;
  metricType: 'gauge' | 'counter' | 'histogram';
}

// ---------------------------------------------------------------------------
// OpenTelemetryCollector
// ---------------------------------------------------------------------------

/**
 * Collects telemetry data (traces, metrics, infrastructure resources,
 * alerts, and deployments) from local OTEL JSON files.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and endpoint.
 * 2. {@link validate} — verify the endpoint URL is well-formed.
 * 3. {@link collect} — read OTEL data files and build entities &
 *    relationships.
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
  /** Stored collector configuration. */
  private config!: CollectorConfig;

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
    this.config = config;
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
   * Reads OTEL data from local JSON files. If no files are found,
   * returns empty results with a warning.
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

    // Determine file paths
    const tracesPath = resolve(
      process.cwd(),
      (this.config.custom['otel_traces_path'] as string) ||
        process.env['OTEL_TRACES_PATH'] ||
        '.otel-traces.json',
    );
    const metricsPath = resolve(
      process.cwd(),
      (this.config.custom['otel_metrics_path'] as string) ||
        process.env['OTEL_METRICS_PATH'] ||
        '.otel-metrics.json',
    );

    // Try to read data files
    let spans: OtelSpan[] | null = null;
    let metrics: OtelMetric[] | null = null;

    try {
      const tracesRaw = await readFile(tracesPath, 'utf-8');
      spans = JSON.parse(tracesRaw) as OtelSpan[];
    } catch {
      // File not found or invalid JSON — continue
    }

    try {
      const metricsRaw = await readFile(metricsPath, 'utf-8');
      metrics = JSON.parse(metricsRaw) as OtelMetric[];
    } catch {
      // File not found or invalid JSON — continue
    }

    // If neither file exists, return empty results
    if (!spans && !metrics) {
      const durationMs = Date.now() - startTime;
      logger.warn('No OTEL data files found, skipping collection', {
        tracesPath,
        metricsPath,
      });
      return {
        entities: [],
        relationships: [],
        metadata: {
          collector_id: this.id,
          collected_at: nowISO(),
          duration_ms: durationMs,
          items_processed: 0,
          errors: [],
        },
      };
    }

    // Build entities and relationships from file data
    const entities = this.buildEntities(spans ?? [], metrics ?? []);
    const relationships = this.buildRelationships(entities);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;
    const itemsProcessed = (spans?.length ?? 0) + (metrics?.length ?? 0);

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
        items_processed: itemsProcessed,
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
   * Build knowledge graph entities from OTEL data files.
   *
   * Creates:
   * - `performance_metric` entities for each metric data point
   * - `infrastructure_resource` entities for unique resources from
   *   metrics and unique services from spans
   * - `deployment` entities from unique service names in spans
   * - `environment` entities (production, staging)
   * - `alert` entities for metrics that may indicate issues
   *
   * @param spans - Parsed span data from .otel-traces.json.
   * @param metrics - Parsed metric data from .otel-metrics.json.
   * @returns Array of entities.
   */
  private buildEntities(spans: OtelSpan[], metrics: OtelMetric[]): Entity[] {
    const entities: Entity[] = [];

    // --- Performance metric entities from metrics file ---
    for (const metric of metrics) {
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

    // --- Infrastructure resource entities from metrics ---
    const resourceNames = new Set(metrics.map((m) => m.resource));
    for (const resourceName of resourceNames) {
      entities.push(
        this.makeEntity('infrastructure_resource', resourceName, {
          kind: 'host',
          region: 'unknown',
          cpu_cores: 0,
          memory_mb: 0,
          otlp_endpoint: this.otlpEndpoint,
        }, ['host', 'unknown']),
      );
    }

    // --- Infrastructure resource entities from unique services in spans ---
    const serviceNames = new Set(spans.map((s) => s.serviceName));
    for (const svcName of serviceNames) {
      if (!resourceNames.has(svcName)) {
        entities.push(
          this.makeEntity('infrastructure_resource', svcName, {
            kind: 'service',
            region: 'unknown',
            cpu_cores: 0,
            memory_mb: 0,
            otlp_endpoint: this.otlpEndpoint,
          }, ['service', 'unknown']),
        );
      }
    }

    // --- Environment entities ---
    const environments = ['production', 'staging'];
    for (const env of environments) {
      entities.push(
        this.makeEntity('environment', env, {
          environment_name: env,
          otlp_endpoint: this.otlpEndpoint,
        }, [env]),
      );
    }

    // --- Deployment entities from unique services in spans ---
    for (const svcName of serviceNames) {
      entities.push(
        this.makeEntity('deployment', `${svcName}-production`, {
          service: svcName,
          environment: 'production',
          version: 'unknown',
          status: 'active',
          otlp_endpoint: this.otlpEndpoint,
        }, ['production', svcName]),
      );
    }

    // --- Alert entities from metrics with concerning values ---
    for (const metric of metrics) {
      if (
        (metric.name.includes('error') && metric.value > 0.5) ||
        (metric.name.includes('cpu') && metric.value > 80)
      ) {
        entities.push(
          this.makeEntity('alert', `High${metric.name}`, {
            severity: metric.value > 90 ? 'critical' : 'warning',
            condition: `${metric.name} > threshold`,
            target_metric: metric.name,
            status: 'firing',
            otlp_endpoint: this.otlpEndpoint,
          }, [metric.value > 90 ? 'critical' : 'warning', 'firing']),
        );
      }
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
        (r) => r.properties['kind'] === 'pod' || r.properties['kind'] === 'container' || r.properties['kind'] === 'service',
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

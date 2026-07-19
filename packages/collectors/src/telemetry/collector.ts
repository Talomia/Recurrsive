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
 * - `performance_metric` — metric data points from the metrics file
 * - `infrastructure_resource` — resources named in metrics and services
 *   named in spans
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
      try {
        spans = JSON.parse(tracesRaw) as OtelSpan[];
      } catch (err) {
        errors.push({ message: `Failed to parse OTEL traces file ${tracesPath}: ${err instanceof Error ? err.message : String(err)}` });
      }
    } catch {
      // Traces file not found — recorded below if metrics are also absent
    }

    try {
      const metricsRaw = await readFile(metricsPath, 'utf-8');
      try {
        metrics = JSON.parse(metricsRaw) as OtelMetric[];
      } catch (err) {
        errors.push({ message: `Failed to parse OTEL metrics file ${metricsPath}: ${err instanceof Error ? err.message : String(err)}` });
      }
    } catch {
      // Metrics file not found — recorded below if spans are also absent
    }

    // If neither file yielded data, return empty results — and say why.
    if (!spans && !metrics) {
      const durationMs = Date.now() - startTime;
      errors.push({
        message: `No OTEL data collected: neither ${tracesPath} nor ${metricsPath} could be read`,
      });
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
          errors,
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
   *
   * Only data actually present in the OTEL files is emitted — no
   * deployments, environments, or alerts are synthesized.
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
    // The OTEL files only carry a resource name, so no kind, region, or
    // capacity figures are asserted — they would be fabrications.
    const resourceNames = new Set(metrics.map((m) => m.resource));
    for (const resourceName of resourceNames) {
      entities.push(
        this.makeEntity('infrastructure_resource', resourceName, {
          source_field: 'metric.resource',
          otlp_endpoint: this.otlpEndpoint,
        }, ['metric-resource']),
      );
    }

    // --- Infrastructure resource entities from unique services in spans ---
    const serviceNames = new Set(spans.map((s) => s.serviceName));
    for (const svcName of serviceNames) {
      if (!resourceNames.has(svcName)) {
        entities.push(
          this.makeEntity('infrastructure_resource', svcName, {
            kind: 'service',
            source_field: 'span.serviceName',
            otlp_endpoint: this.otlpEndpoint,
          }, ['service']),
        );
      }
    }

    // Note: no deployment, environment, or alert entities are created —
    // the OTEL data files carry no such records, and inventing them
    // (e.g. "<service>-production" deployments or "firing" alerts)
    // would misrepresent the source.

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
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const metrics = entities.filter((e) => e.type === 'performance_metric');
    const resources = entities.filter((e) => e.type === 'infrastructure_resource');

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

    return relationships;
  }
}

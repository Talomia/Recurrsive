/**
 * @module @recurrsive/collectors/cloud-cost/collector
 *
 * Cloud Cost Collector — ingests cost metrics, budget alerts,
 * infrastructure resources, cloud service pipelines, and environments
 * from a cloud provider account and produces entities and relationships
 * for the knowledge graph.
 *
 * Supports reading cloud cost data from:
 * - A local CSV export file (via CLOUD_COST_CSV_PATH)
 * - AWS Cost Explorer (credentials checked, but direct API not yet implemented)
 *
 * If no credentials or CSV path are configured, returns empty results.
 *
 * Produces entities:
 * - `cost_metric` — per-service cost aggregations from the CSV
 * - `infrastructure_resource` — cloud resources with costs
 * - `pipeline` — cloud service categories present in the CSV
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

const logger = createLogger({ context: { module: 'cloud-cost-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Cloud provider type. */
type CloudProvider = 'aws' | 'gcp' | 'azure';

/** Parsed CSV row for cloud cost data. */
interface CostCsvRow {
  service: string;
  resource: string;
  monthly_cost: number;
  region: string;
  status: string;
  /** Billing period start, only when the CSV provides it. */
  period_start?: string;
  /** Billing period end, only when the CSV provides it. */
  period_end?: string;
  /** Currency code, only when the CSV provides it. */
  currency?: string;
}

// ---------------------------------------------------------------------------
// CloudCostCollector
// ---------------------------------------------------------------------------

/**
 * Collects cost metrics, budget alerts, infrastructure resources,
 * cloud service pipelines, and environment cost allocations from a
 * cloud provider account.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure governance rules and provider.
 * 2. {@link validate} — verify the provider is supported.
 * 3. {@link collect} — read cost data from CSV or API and build
 *    entities & relationships.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new CloudCostCollector('aws');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: { cloud_cost_csv_path: './costs.csv' },
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class CloudCostCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'cloud-cost';
  /** @inheritdoc */
  readonly name = 'Cloud Cost Collector';
  /** @inheritdoc */
  readonly description = 'Collects cost metrics, budgets, resources, and service costs from cloud provider accounts';
  /** @inheritdoc */
  readonly type: CollectorType = 'cloud';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** Cloud provider. */
  private provider: CloudProvider;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether this collector has been initialized. */
  private initialized = false;
  /** Stored collector configuration. */
  private config!: CollectorConfig;

  /**
   * @param provider - Cloud provider (default: `'aws'`).
   */
  constructor(provider: CloudProvider = 'aws') {
    this.provider = provider;
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

    if (typeof config.custom['provider'] === 'string') {
      const p = config.custom['provider'];
      if (p === 'aws' || p === 'gcp' || p === 'azure') {
        this.provider = p;
      }
    }

    this.initialized = true;
    logger.info('CloudCostCollector initialized', { provider: this.provider });
  }

  /**
   * Validate that the configured provider is supported.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const supported: CloudProvider[] = ['aws', 'gcp', 'azure'];

    if (!this.provider) {
      errors.push('Cloud provider is required');
    } else if (!supported.includes(this.provider)) {
      errors.push(`'${this.provider}' is not a supported cloud provider. Supported: ${supported.join(', ')}`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform the full collection run.
   *
   * Reads cloud cost data from a CSV file or API. If no credentials
   * or CSV path are configured, returns empty results.
   *
   * @returns Entities, relationships, and run metadata.
   * @throws {CollectorError} If the collector has not been initialized.
   */
  async collect(): Promise<CollectorResult> {
    if (!this.initialized) {
      throw new CollectorError(
        'CloudCostCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // Check for CSV path
    const csvPath = (this.config.custom['cloud_cost_csv_path'] as string) ||
      process.env['CLOUD_COST_CSV_PATH'];

    // Check for AWS credentials
    const awsAccessKey = (this.config.custom['aws_access_key_id'] as string) ||
      process.env['AWS_ACCESS_KEY_ID'];

    // --- CSV path available: read and parse ---
    if (csvPath) {
      try {
        const resolvedPath = resolve(process.cwd(), csvPath);
        const csvContent = await readFile(resolvedPath, 'utf-8');
        const rows = this.parseCsv(csvContent);

        const entities = this.buildEntitiesFromCsv(rows);
        const relationships = this.buildRelationships(entities);
        const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));
        const durationMs = Date.now() - startTime;

        logger.info('CloudCostCollector collection complete (CSV)', {
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
            items_processed: rows.length,
            errors,
          },
        };
      } catch (err) {
        const durationMs = Date.now() - startTime;
        logger.warn('Failed to read cloud cost CSV file', { csvPath, error: err });
        return {
          entities: [],
          relationships: [],
          metadata: {
            collector_id: this.id,
            collected_at: nowISO(),
            duration_ms: durationMs,
            items_processed: 0,
            errors: [{ message: `Failed to read CSV: ${err instanceof Error ? err.message : String(err)}` }],
          },
        };
      }
    }

    // --- AWS credentials present but no CSV ---
    if (awsAccessKey) {
      const durationMs = Date.now() - startTime;
      const msg =
        'AWS Cost Explorer direct API integration not implemented. ' +
        'Export costs to CSV and set CLOUD_COST_CSV_PATH.';
      logger.warn(msg);
      errors.push({ message: msg });
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

    // --- No credentials or CSV path ---
    const durationMs = Date.now() - startTime;
    const msg =
      'No cloud cost data source configured: set cloud_cost_csv_path / ' +
      'CLOUD_COST_CSV_PATH (or AWS credentials) to enable collection.';
    logger.warn(msg);
    errors.push({ message: msg });
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

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('CloudCostCollector disposed', { provider: this.provider });
  }

  // -----------------------------------------------------------------------
  // Internal: CSV Parsing
  // -----------------------------------------------------------------------

  /**
   * Parse CSV content into structured rows.
   *
   * The header row is used to locate columns by name. Core columns:
   * `service,resource,monthly_cost,region,status` (positional fallback
   * when the header lacks a name). Optional columns `period_start`,
   * `period_end`, and `currency` are picked up only when the header
   * declares them. Quoted fields (RFC 4180 style, including embedded
   * commas and doubled quotes) are handled.
   */
  private parseCsv(content: string): CostCsvRow[] {
    const lines = content.trim().split(/\r?\n/);
    if (lines.length <= 1) return [];

    const header = this.splitCsvLine(lines[0]!).map((h) => h.trim().toLowerCase());
    const indexOf = (name: string, fallback: number): number => {
      const i = header.indexOf(name);
      return i >= 0 ? i : fallback;
    };
    const serviceIdx = indexOf('service', 0);
    const resourceIdx = indexOf('resource', 1);
    const costIdx = indexOf('monthly_cost', 2);
    const regionIdx = indexOf('region', 3);
    const statusIdx = indexOf('status', 4);
    // Optional columns — no positional fallback: absent means absent.
    const periodStartIdx = header.indexOf('period_start');
    const periodEndIdx = header.indexOf('period_end');
    const currencyIdx = header.indexOf('currency');

    return lines.slice(1).map((line) => {
      const parts = this.splitCsvLine(line).map((p) => p.trim());
      const optional = (idx: number): string | undefined =>
        idx >= 0 && parts[idx] ? parts[idx] : undefined;
      const row: CostCsvRow = {
        service: parts[serviceIdx] ?? '',
        resource: parts[resourceIdx] ?? '',
        monthly_cost: parseFloat(parts[costIdx] ?? '0') || 0,
        region: parts[regionIdx] || 'unknown',
        // Never assume a resource is running when the CSV doesn't say so.
        status: parts[statusIdx] || 'unknown',
      };
      const periodStart = optional(periodStartIdx);
      const periodEnd = optional(periodEndIdx);
      const currency = optional(currencyIdx);
      if (periodStart !== undefined) row.period_start = periodStart;
      if (periodEnd !== undefined) row.period_end = periodEnd;
      if (currency !== undefined) row.currency = currency;
      return row;
    }).filter((row) => row.service && row.resource);
  }

  /**
   * Split a single CSV line into fields, honouring double-quoted
   * fields with embedded commas and doubled ("") escape quotes.
   */
  private splitCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields;
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
      qualified_name: qualifiedName(this.provider, name),
      source: this.id,
      properties: props,
      tags: ['cloud-cost', this.provider, ...tags],
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
   * Build knowledge graph entities from parsed CSV data.
   *
   * Creates:
   * - `cost_metric` entities for aggregate costs by service
   * - `infrastructure_resource` entities for each resource row
   * - `pipeline` entities for unique service categories
   *
   * Only data present in the CSV is emitted — no environment entities
   * are synthesized, and billing periods come from the CSV's own
   * `period_start`/`period_end` columns (omitted when absent), never
   * from the wall clock.
   *
   * @param rows - Parsed CSV rows.
   * @returns Array of entities.
   */
  private buildEntitiesFromCsv(rows: CostCsvRow[]): Entity[] {
    const entities: Entity[] = [];

    // --- Cost metric entities (aggregate by service) ---
    const serviceCosts = new Map<string, number>();
    for (const row of rows) {
      serviceCosts.set(row.service, (serviceCosts.get(row.service) ?? 0) + row.monthly_cost);
    }
    for (const [service, totalCost] of serviceCosts) {
      const serviceRows = rows.filter((r) => r.service === service);

      // Billing period from the CSV data itself (min start / max end);
      // omitted when the CSV carries no period columns.
      const periodStarts = serviceRows
        .map((r) => r.period_start)
        .filter((p): p is string => typeof p === 'string')
        .sort();
      const periodEnds = serviceRows
        .map((r) => r.period_end)
        .filter((p): p is string => typeof p === 'string')
        .sort();
      const currencies = new Set(
        serviceRows.map((r) => r.currency).filter((c): c is string => typeof c === 'string'),
      );

      entities.push(
        this.makeEntity('cost_metric', `${service}-monthly-cost`, {
          granularity: 'monthly',
          total_cost: totalCost,
          // Currency only when the CSV declares one (unambiguously).
          ...(currencies.size === 1 ? { currency: [...currencies][0] } : {}),
          ...(periodStarts.length > 0 ? { period_start: periodStarts[0] } : {}),
          ...(periodEnds.length > 0 ? { period_end: periodEnds[periodEnds.length - 1] } : {}),
          provider: this.provider,
        }, ['cost-report', 'monthly']),
      );
    }

    // --- Infrastructure resource entities ---
    for (const row of rows) {
      entities.push(
        this.makeEntity('infrastructure_resource', row.resource, {
          resource_type: 'cloud_resource',
          monthly_cost: row.monthly_cost,
          region: row.region,
          service: row.service,
          status: row.status,
          provider: this.provider,
        }, ['cloud_resource', row.status]),
      );
    }

    // --- Pipeline entities (unique services) ---
    const uniqueServices = new Set(rows.map((r) => r.service));
    for (const service of uniqueServices) {
      const serviceRows = rows.filter((r) => r.service === service);
      entities.push(
        this.makeEntity('pipeline', service, {
          category: service,
          monthly_cost: serviceCosts.get(service) ?? 0,
          resource_count: serviceRows.length,
          provider: this.provider,
        }, ['cloud-service', service.toLowerCase()]),
      );
    }

    // Note: no environment entities are created — the cost CSV carries
    // no environment data, and inventing production/staging/dev
    // entities would misrepresent the source.

    return entities;
  }

  // -----------------------------------------------------------------------
  // Internal: Relationship Building
  // -----------------------------------------------------------------------

  /**
   * Build relationships between entities.
   *
   * Creates:
   * - `contains` — pipeline (service) contains infrastructure_resource
   *
   * No deploys_to relationships are created: the cost CSV carries no
   * environment data, and a resource's status says nothing about which
   * environment it belongs to.
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const resources = entities.filter((e) => e.type === 'infrastructure_resource');
    const services = entities.filter((e) => e.type === 'pipeline');

    // Pipeline (service) → Infrastructure Resource (contains)
    for (const resource of resources) {
      const serviceName = resource.properties['service'] as string;
      const serviceEntity = services.find((s) => {
        const cat = (s.properties['category'] as string).toLowerCase();
        return s.name === serviceName || cat === serviceName;
      });
      if (serviceEntity) {
        relationships.push(this.makeRel('contains', serviceEntity.id, resource.id, {
          service: serviceName,
        }));
      }
    }

    return relationships;
  }
}

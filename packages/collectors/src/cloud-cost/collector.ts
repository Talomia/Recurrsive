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
 * - `cost_metric` — monthly/daily/weekly cost aggregations
 * - `alert` — budget limits and spend alerts
 * - `infrastructure_resource` — cloud resources with costs
 * - `pipeline` — cloud service pipelines (compute, storage, etc.)
 * - `environment` — production, staging, dev environments with cost allocation
 * - `user` — budget owners and cost centre managers
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
      logger.warn(
        'AWS Cost Explorer direct API integration not yet implemented. ' +
        'Export costs to CSV and set CLOUD_COST_CSV_PATH.',
      );
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

    // --- No credentials or CSV path ---
    const durationMs = Date.now() - startTime;
    logger.warn('No cloud cost credentials configured, skipping collection');
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
   * Expected format: service,resource,monthly_cost,region,status
   * First line is treated as header.
   */
  private parseCsv(content: string): CostCsvRow[] {
    const lines = content.trim().split('\n');
    if (lines.length <= 1) return [];

    // Skip header line
    return lines.slice(1).map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      return {
        service: parts[0] ?? '',
        resource: parts[1] ?? '',
        monthly_cost: parseFloat(parts[2] ?? '0') || 0,
        region: parts[3] ?? 'unknown',
        status: parts[4] ?? 'running',
      };
    }).filter((row) => row.service && row.resource);
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
   * - `environment` entities (production, staging, dev)
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
      entities.push(
        this.makeEntity('cost_metric', `${service}-monthly-cost`, {
          granularity: 'monthly',
          total_cost: totalCost,
          currency: 'USD',
          period_start: new Date().toISOString().slice(0, 7) + '-01',
          period_end: new Date().toISOString().slice(0, 10),
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

    // --- Environment entities ---
    const envs = [
      { name: 'production', tier: 'production' as const },
      { name: 'staging', tier: 'staging' as const },
      { name: 'dev', tier: 'development' as const },
    ];
    for (const env of envs) {
      entities.push(
        this.makeEntity('environment', env.name, {
          tier: env.tier,
          monthly_cost: 0,
          resource_count: 0,
          provider: this.provider,
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
   * - `contains` — pipeline (service) contains infrastructure_resource
   * - `deploys_to` — infrastructure_resource deployed to environment
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const resources = entities.filter((e) => e.type === 'infrastructure_resource');
    const services = entities.filter((e) => e.type === 'pipeline');
    const environments = entities.filter((e) => e.type === 'environment');

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

    // Infrastructure Resource → Environment (deploys_to)
    const prodEnv = environments.find((e) => e.name === 'production');
    const devEnv = environments.find((e) => e.name === 'dev');

    for (const resource of resources) {
      const status = resource.properties['status'] as string;
      if (status === 'running' && prodEnv) {
        relationships.push(this.makeRel('deploys_to', resource.id, prodEnv.id, {
          environment: 'production',
        }));
      } else if (status === 'stopped' && devEnv) {
        relationships.push(this.makeRel('deploys_to', resource.id, devEnv.id, {
          environment: 'dev',
        }));
      }
    }

    return relationships;
  }
}

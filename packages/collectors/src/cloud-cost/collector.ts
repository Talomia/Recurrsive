/**
 * @module @recurrsive/collectors/cloud-cost/collector
 *
 * Cloud Cost Collector — ingests cost metrics, budget alerts,
 * infrastructure resources, cloud service pipelines, and environments
 * from a cloud provider account and produces entities and relationships
 * for the knowledge graph.
 *
 * Since this collector is not yet connected to real API calls, it
 * generates synthetic data that mirrors the shape of real cloud cost
 * API responses for development and testing purposes.
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

const logger = createLogger({ context: { module: 'cloud-cost-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Cloud provider type. */
type CloudProvider = 'aws' | 'gcp' | 'azure';

/** Synthetic cost report data. */
interface MockCostReport {
  name: string;
  granularity: 'daily' | 'weekly' | 'monthly';
  total_cost: number;
  currency: string;
  period_start: string;
  period_end: string;
}

/** Synthetic budget data. */
interface MockBudget {
  name: string;
  limit: number;
  actual_spend: number;
  currency: string;
  owner: string;
  threshold_percent: number;
}

/** Synthetic infrastructure resource data. */
interface MockResource {
  name: string;
  resource_type: string;
  monthly_cost: number;
  region: string;
  service: string;
  status: 'running' | 'stopped' | 'terminated';
}

/** Synthetic cloud service data. */
interface MockService {
  name: string;
  category: string;
  monthly_cost: number;
  resource_count: number;
}

/** Synthetic environment data. */
interface MockEnvironment {
  name: string;
  tier: 'production' | 'staging' | 'development';
  monthly_cost: number;
  resource_count: number;
}

// ---------------------------------------------------------------------------
// Synthetic Data
// ---------------------------------------------------------------------------

const MOCK_USERS = ['budget-admin', 'cloud-ops-lead', 'finance-manager'];

const MOCK_COST_REPORTS: MockCostReport[] = [
  { name: 'daily-cost-report', granularity: 'daily', total_cost: 1247.83, currency: 'USD', period_start: '2026-06-30', period_end: '2026-06-30' },
  { name: 'weekly-cost-report', granularity: 'weekly', total_cost: 8734.21, currency: 'USD', period_start: '2026-06-23', period_end: '2026-06-29' },
  { name: 'monthly-cost-report', granularity: 'monthly', total_cost: 37892.50, currency: 'USD', period_start: '2026-06-01', period_end: '2026-06-30' },
];

const MOCK_BUDGETS: MockBudget[] = [
  { name: 'engineering-budget', limit: 50000, actual_spend: 37892.50, currency: 'USD', owner: 'budget-admin', threshold_percent: 80 },
  { name: 'infrastructure-budget', limit: 30000, actual_spend: 24150.00, currency: 'USD', owner: 'cloud-ops-lead', threshold_percent: 90 },
];

const MOCK_RESOURCES: MockResource[] = [
  { name: 'api-server-01', resource_type: 'vm', monthly_cost: 450.00, region: 'us-east-1', service: 'compute', status: 'running' },
  { name: 'api-server-02', resource_type: 'vm', monthly_cost: 450.00, region: 'us-east-1', service: 'compute', status: 'running' },
  { name: 'primary-db', resource_type: 'database', monthly_cost: 1200.00, region: 'us-east-1', service: 'database', status: 'running' },
  { name: 'replica-db', resource_type: 'database', monthly_cost: 800.00, region: 'us-west-2', service: 'database', status: 'running' },
  { name: 'redis-cache-01', resource_type: 'cache', monthly_cost: 320.00, region: 'us-east-1', service: 'database', status: 'running' },
  { name: 'app-lb', resource_type: 'load_balancer', monthly_cost: 180.00, region: 'us-east-1', service: 'networking', status: 'running' },
  { name: 'ml-training-gpu', resource_type: 'vm', monthly_cost: 2400.00, region: 'us-west-2', service: 'ai_ml', status: 'running' },
  { name: 'staging-server', resource_type: 'vm', monthly_cost: 225.00, region: 'us-east-1', service: 'compute', status: 'stopped' },
];

const MOCK_SERVICES: MockService[] = [
  { name: 'compute', category: 'Compute', monthly_cost: 3525.00, resource_count: 3 },
  { name: 'storage', category: 'Storage', monthly_cost: 890.00, resource_count: 4 },
  { name: 'database', category: 'Database', monthly_cost: 2320.00, resource_count: 3 },
  { name: 'networking', category: 'Networking', monthly_cost: 540.00, resource_count: 2 },
  { name: 'ai-ml', category: 'AI/ML', monthly_cost: 2400.00, resource_count: 1 },
  { name: 'monitoring', category: 'Monitoring', monthly_cost: 350.00, resource_count: 2 },
];

const MOCK_ENVIRONMENTS: MockEnvironment[] = [
  { name: 'production', tier: 'production', monthly_cost: 28500.00, resource_count: 12 },
  { name: 'staging', tier: 'staging', monthly_cost: 6200.00, resource_count: 5 },
  { name: 'dev', tier: 'development', monthly_cost: 3192.50, resource_count: 4 },
];

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
 * 3. {@link collect} — generate entities & relationships from
 *    synthetic cloud cost data.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new CloudCostCollector('aws');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {},
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

    // Build entities and relationships from synthetic data
    const entities = this.buildEntities();
    const relationships = this.buildRelationships(entities);

    // Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    logger.info('CloudCostCollector collection complete', {
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
        items_processed: MOCK_COST_REPORTS.length + MOCK_BUDGETS.length + MOCK_RESOURCES.length + MOCK_SERVICES.length + MOCK_ENVIRONMENTS.length,
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
   * Build knowledge graph entities from synthetic cloud cost data.
   *
   * Creates:
   * - `user` entities for budget owners
   * - `cost_metric` entities for cost reports (daily, weekly, monthly)
   * - `alert` entities for budgets and spend thresholds
   * - `infrastructure_resource` entities for cloud resources
   * - `pipeline` entities for cloud service categories
   * - `environment` entities for cost-allocated environments
   *
   * @returns Array of entities.
   */
  private buildEntities(): Entity[] {
    const entities: Entity[] = [];

    // --- User entities (budget owners) ---
    for (const username of MOCK_USERS) {
      entities.push(
        this.makeEntity('user', username, {
          username,
          role: 'cost_manager',
          platform: this.provider,
        }, ['cost-owner']),
      );
    }

    // --- Cost metric entities (cost reports) ---
    for (const report of MOCK_COST_REPORTS) {
      entities.push(
        this.makeEntity('cost_metric', report.name, {
          granularity: report.granularity,
          total_cost: report.total_cost,
          currency: report.currency,
          period_start: report.period_start,
          period_end: report.period_end,
          provider: this.provider,
        }, ['cost-report', report.granularity]),
      );
    }

    // --- Alert entities (budgets) ---
    for (const budget of MOCK_BUDGETS) {
      entities.push(
        this.makeEntity('alert', budget.name, {
          budget_limit: budget.limit,
          actual_spend: budget.actual_spend,
          currency: budget.currency,
          owner: budget.owner,
          threshold_percent: budget.threshold_percent,
          utilization_percent: Math.round((budget.actual_spend / budget.limit) * 100),
          provider: this.provider,
        }, ['budget', 'cost-alert']),
      );
    }

    // --- Infrastructure resource entities ---
    for (const resource of MOCK_RESOURCES) {
      entities.push(
        this.makeEntity('infrastructure_resource', resource.name, {
          resource_type: resource.resource_type,
          monthly_cost: resource.monthly_cost,
          region: resource.region,
          service: resource.service,
          status: resource.status,
          provider: this.provider,
        }, [resource.resource_type, resource.status]),
      );
    }

    // --- Pipeline entities (cloud services) ---
    for (const service of MOCK_SERVICES) {
      entities.push(
        this.makeEntity('pipeline', service.name, {
          category: service.category,
          monthly_cost: service.monthly_cost,
          resource_count: service.resource_count,
          provider: this.provider,
        }, ['cloud-service', service.category.toLowerCase()]),
      );
    }

    // --- Environment entities ---
    for (const env of MOCK_ENVIRONMENTS) {
      entities.push(
        this.makeEntity('environment', env.name, {
          tier: env.tier,
          monthly_cost: env.monthly_cost,
          resource_count: env.resource_count,
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
   * - `monitors` — alert monitors cost_metric
   * - `contains` — pipeline (service) contains infrastructure_resource
   * - `deploys_to` — infrastructure_resource deployed to environment
   * - `depends_on` — pipeline (service) depends on pipeline (service)
   * - `owns` — user owns alert (budget)
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];

    const users = entities.filter((e) => e.type === 'user');
    const costMetrics = entities.filter((e) => e.type === 'cost_metric');
    const alerts = entities.filter((e) => e.type === 'alert');
    const resources = entities.filter((e) => e.type === 'infrastructure_resource');
    const services = entities.filter((e) => e.type === 'pipeline');
    const environments = entities.filter((e) => e.type === 'environment');

    // Alert → Cost Metric (monitors) — each budget monitors the monthly cost report
    const monthlyReport = costMetrics.find(
      (c) => c.properties['granularity'] === 'monthly',
    );
    if (monthlyReport) {
      for (const alert of alerts) {
        relationships.push(this.makeRel('monitors', alert.id, monthlyReport.id, {
          budget_name: alert.name,
          threshold_percent: alert.properties['threshold_percent'],
        }));
      }
    }

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
    // Map resources to environments based on status
    const prodEnv = environments.find((e) => e.name === 'production');
    const stagingEnv = environments.find((e) => e.name === 'staging');
    const devEnv = environments.find((e) => e.name === 'dev');

    for (const resource of resources) {
      const status = resource.properties['status'] as string;
      if (status === 'running' && prodEnv) {
        // Running resources deploy to production (unless staging-named)
        if (resource.name.includes('staging')) {
          relationships.push(this.makeRel('deploys_to', resource.id, stagingEnv!.id, {
            environment: 'staging',
          }));
        } else {
          relationships.push(this.makeRel('deploys_to', resource.id, prodEnv.id, {
            environment: 'production',
          }));
        }
      } else if (status === 'stopped' && devEnv) {
        relationships.push(this.makeRel('deploys_to', resource.id, devEnv.id, {
          environment: 'dev',
        }));
      }
    }

    // Pipeline → Pipeline (depends_on) — service dependencies
    const computeService = services.find((s) => s.name === 'compute');
    const networkingService = services.find((s) => s.name === 'networking');
    const databaseService = services.find((s) => s.name === 'database');
    const monitoringService = services.find((s) => s.name === 'monitoring');

    if (computeService && networkingService) {
      relationships.push(this.makeRel('depends_on', computeService.id, networkingService.id, {
        dependency_type: 'network_access',
      }));
    }
    if (computeService && databaseService) {
      relationships.push(this.makeRel('depends_on', computeService.id, databaseService.id, {
        dependency_type: 'data_access',
      }));
    }
    if (monitoringService && computeService) {
      relationships.push(this.makeRel('depends_on', monitoringService.id, computeService.id, {
        dependency_type: 'observability',
      }));
    }

    // User → Alert (owns) — budget owners
    for (const alert of alerts) {
      const ownerName = alert.properties['owner'] as string;
      const ownerEntity = users.find((u) => u.name === ownerName);
      if (ownerEntity) {
        relationships.push(this.makeRel('owns', ownerEntity.id, alert.id, {
          role: 'budget_owner',
        }));
      }
    }

    return relationships;
  }
}

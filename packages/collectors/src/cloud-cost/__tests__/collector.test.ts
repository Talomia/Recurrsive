/**
 * Tests for the CloudCostCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Validation success / failure
 * - Collection produces entities with valid shapes
 * - All entity types validate against EntityTypeSchema
 * - All relationship types validate against RelationTypeSchema
 * - Governance filtering works
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 * - Provider override via config.custom
 * - All relationships reference valid entity IDs
 * - Cost metric entities have expected properties
 * - Alert (budget) entities have expected properties
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CloudCostCollector } from '../../cloud-cost/collector.js';
import { EntityTypeSchema, RelationTypeSchema } from '@recurrsive/core';
import type { CollectorConfig } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultConfig: CollectorConfig = {
  governance: {
    masked_fields: [],
    excluded_patterns: [],
    pii_detection: false,
    audit_log: false,
    retention_days: 90,
  },
  custom: {},
};

let collector: CloudCostCollector;

beforeEach(() => {
  collector = new CloudCostCollector('aws');
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('initializes without error', async () => {
    await expect(collector.initialize(defaultConfig)).resolves.not.toThrow();
  });

  it('accepts provider override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { provider: 'gcp' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // All entities should now be tagged with gcp
    const tags = result.entities.flatMap((e) => e.tags);
    expect(tags).toContain('gcp');
  });

  it('ignores invalid provider in custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { provider: 'invalid-provider' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // Should keep original provider
    const tags = result.entities.flatMap((e) => e.tags);
    expect(tags).toContain('aws');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Validation', () => {
  it('validates the default aws provider', async () => {
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates gcp provider', async () => {
    const gcpCollector = new CloudCostCollector('gcp');
    const result = await gcpCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates azure provider', async () => {
    const azureCollector = new CloudCostCollector('azure');
    const result = await azureCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Collection — Entity Production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('produces approximately 25 entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    // 3 users + 3 cost_metrics + 2 alerts + 8 resources + 6 services + 3 envs = 25
    expect(result.entities.length).toBeGreaterThanOrEqual(20);
    expect(result.entities.length).toBeLessThanOrEqual(30);
  });

  it('produces entities with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.id).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.name).toBeDefined();
      expect(entity.qualified_name).toBeDefined();
      expect(entity.source).toBe('cloud-cost');
      expect(entity.properties).toBeDefined();
      expect(entity.tags).toBeDefined();
      expect(entity.created_at).toBeDefined();
      expect(entity.updated_at).toBeDefined();
      expect(entity.last_seen_at).toBeDefined();
    }
  });

  it('produces only valid EntityType values', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      const parsed = EntityTypeSchema.safeParse(entity.type);
      expect(parsed.success).toBe(true);
    }
  });

  it('produces the expected entity types', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const types = new Set(result.entities.map((e) => e.type));
    expect(types.has('cost_metric')).toBe(true);
    expect(types.has('alert')).toBe(true);
    expect(types.has('infrastructure_resource')).toBe(true);
    expect(types.has('pipeline')).toBe(true);
    expect(types.has('environment')).toBe(true);
    expect(types.has('user')).toBe(true);
  });

  it('produces user entities for budget owners', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    expect(users.length).toBe(3);
    for (const user of users) {
      expect(user.properties['role']).toBe('cost_manager');
    }
  });

  it('produces cost_metric entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const costMetrics = result.entities.filter((e) => e.type === 'cost_metric');
    expect(costMetrics.length).toBe(3);

    for (const metric of costMetrics) {
      expect(metric.properties['granularity']).toBeDefined();
      expect(metric.properties['total_cost']).toBeDefined();
      expect(metric.properties['currency']).toBe('USD');
      expect(metric.properties['period_start']).toBeDefined();
      expect(metric.properties['period_end']).toBeDefined();
      expect(metric.properties['provider']).toBe('aws');
    }
  });

  it('produces alert (budget) entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const alerts = result.entities.filter((e) => e.type === 'alert');
    expect(alerts.length).toBe(2);

    for (const alert of alerts) {
      expect(alert.properties['budget_limit']).toBeDefined();
      expect(alert.properties['actual_spend']).toBeDefined();
      expect(alert.properties['currency']).toBe('USD');
      expect(alert.properties['owner']).toBeDefined();
      expect(alert.properties['threshold_percent']).toBeDefined();
      expect(alert.properties['utilization_percent']).toBeDefined();
    }
  });

  it('produces infrastructure_resource entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const resources = result.entities.filter((e) => e.type === 'infrastructure_resource');
    expect(resources.length).toBe(8);

    for (const resource of resources) {
      expect(resource.properties['resource_type']).toBeDefined();
      expect(resource.properties['monthly_cost']).toBeDefined();
      expect(resource.properties['region']).toBeDefined();
      expect(resource.properties['status']).toBeDefined();
    }
  });

  it('produces pipeline (cloud service) entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const services = result.entities.filter((e) => e.type === 'pipeline');
    expect(services.length).toBe(6);

    for (const service of services) {
      expect(service.properties['category']).toBeDefined();
      expect(service.properties['monthly_cost']).toBeDefined();
      expect(service.properties['resource_count']).toBeDefined();
    }
  });

  it('produces environment entities with cost allocations', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const envs = result.entities.filter((e) => e.type === 'environment');
    expect(envs.length).toBe(3);

    const envNames = envs.map((e) => e.name);
    expect(envNames).toContain('production');
    expect(envNames).toContain('staging');
    expect(envNames).toContain('dev');

    for (const env of envs) {
      expect(env.properties['tier']).toBeDefined();
      expect(env.properties['monthly_cost']).toBeDefined();
    }
  });

  it('tags all entities with cloud-cost and provider', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.tags).toContain('cloud-cost');
      expect(entity.tags).toContain('aws');
    }
  });
});

// ---------------------------------------------------------------------------
// Collection — Relationship Production
// ---------------------------------------------------------------------------

describe('Collection — relationship production', () => {
  it('produces at least 15 relationships', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBeGreaterThanOrEqual(15);
  });

  it('produces only valid RelationType values', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const rel of result.relationships) {
      const parsed = RelationTypeSchema.safeParse(rel.type);
      expect(parsed.success).toBe(true);
    }
  });

  it('produces the expected relationship types', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const types = new Set(result.relationships.map((r) => r.type));
    expect(types.has('monitors')).toBe(true);
    expect(types.has('contains')).toBe(true);
    expect(types.has('deploys_to')).toBe(true);
    expect(types.has('depends_on')).toBe(true);
    expect(types.has('owns')).toBe(true);
  });

  it('produces relationships with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const rel of result.relationships) {
      expect(rel.id).toBeDefined();
      expect(rel.type).toBeDefined();
      expect(rel.source_id).toBeDefined();
      expect(rel.target_id).toBeDefined();
      expect(rel.properties).toBeDefined();
      expect(rel.confidence).toBeGreaterThanOrEqual(0);
      expect(rel.confidence).toBeLessThanOrEqual(1);
      expect(rel.source).toBe('cloud-cost');
      expect(rel.created_at).toBeDefined();
      expect(rel.updated_at).toBeDefined();
    }
  });

  it('all relationships reference valid entity IDs', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const entityIds = new Set(result.entities.map((e) => e.id));

    for (const rel of result.relationships) {
      expect(entityIds.has(rel.source_id)).toBe(true);
      expect(entityIds.has(rel.target_id)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('masks configured fields in entity properties', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['owner', 'username'],
        excluded_patterns: [],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: {},
    };

    await collector.initialize(maskedConfig);
    const result = await collector.collect();

    const alerts = result.entities.filter((e) => e.type === 'alert');
    for (const alert of alerts) {
      expect(alert.properties['owner']).toBe('***REDACTED***');
    }

    const users = result.entities.filter((e) => e.type === 'user');
    for (const user of users) {
      expect(user.properties['username']).toBe('***REDACTED***');
    }
  });
});

// ---------------------------------------------------------------------------
// Error Handling
// ---------------------------------------------------------------------------

describe('Error handling', () => {
  it('throws CollectorError when collecting before initialization', async () => {
    await expect(collector.collect()).rejects.toThrow('not been initialized');
  });
});

// ---------------------------------------------------------------------------
// Dispose
// ---------------------------------------------------------------------------

describe('Dispose', () => {
  it('disposes cleanly', async () => {
    await collector.initialize(defaultConfig);
    await expect(collector.dispose()).resolves.not.toThrow();
  });

  it('prevents collection after dispose', async () => {
    await collector.initialize(defaultConfig);
    await collector.dispose();
    await expect(collector.collect()).rejects.toThrow('not been initialized');
  });
});

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

describe('Metadata', () => {
  it('has correct collector id', () => {
    expect(collector.id).toBe('cloud-cost');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('Cloud Cost Collector');
  });

  it('has correct version', () => {
    expect(collector.version).toBe('0.1.0');
  });

  it('has correct type', () => {
    expect(collector.type).toBe('cloud');
  });

  it('returns correct run metadata', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    expect(result.metadata.collector_id).toBe('cloud-cost');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

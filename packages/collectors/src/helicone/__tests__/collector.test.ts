/**
 * Tests for the HeliconeCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Environment override via config.custom
 * - Validation success / failure
 * - Collection produces entities with valid shapes
 * - All entity types validate against EntityTypeSchema
 * - All relationship types validate against RelationTypeSchema
 * - Governance filtering works
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 * - All relationships reference valid entity IDs
 * - Cost metric entities have expected properties
 * - Model entities have expected properties
 * - Performance metric entities have expected properties
 * - User entities have expected properties
 * - Alert entities have expected properties
 * - Config entities have expected properties
 * - Relationship types: uses_model, monitors, owns, contains
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeliconeCollector } from '../../helicone/collector.js';
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

let collector: HeliconeCollector;

beforeEach(() => {
  collector = new HeliconeCollector('production');
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('initializes without error', async () => {
    await expect(collector.initialize(defaultConfig)).resolves.not.toThrow();
  });

  it('accepts environment override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { environment: 'staging' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // All entities should now be tagged with staging
    const tags = result.entities.flatMap((e) => e.tags);
    expect(tags).toContain('staging');
  });

  it('ignores invalid environment in custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { environment: 'invalid-env' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // Should keep original environment
    const tags = result.entities.flatMap((e) => e.tags);
    expect(tags).toContain('production');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Validation', () => {
  it('validates the default production environment', async () => {
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates staging environment', async () => {
    const stagingCollector = new HeliconeCollector('staging');
    const result = await stagingCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates development environment', async () => {
    const devCollector = new HeliconeCollector('development');
    const result = await devCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Collection — Entity Production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('produces approximately 28 entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    // 3 users + 7 cost_metrics + 4 models + 8 perf_metrics + 3 alerts + 3 configs = 28
    expect(result.entities.length).toBeGreaterThanOrEqual(26);
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
      expect(entity.source).toBe('helicone');
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
    expect(types.has('user')).toBe(true);
    expect(types.has('cost_metric')).toBe(true);
    expect(types.has('model')).toBe(true);
    expect(types.has('performance_metric')).toBe(true);
    expect(types.has('alert')).toBe(true);
    expect(types.has('config')).toBe(true);
  });

  it('produces user entities for developers', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    expect(users.length).toBe(3);
    for (const user of users) {
      expect(user.properties['platform']).toBe('helicone');
      expect(user.properties['api_key_count']).toBeDefined();
      expect(user.properties['role']).toBeDefined();
    }
  });

  it('produces cost_metric entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const costs = result.entities.filter((e) => e.type === 'cost_metric');
    expect(costs.length).toBe(7);

    for (const cost of costs) {
      expect(cost.properties['period']).toBeDefined();
      expect(cost.properties['model']).toBeDefined();
      expect(cost.properties['total_cost']).toBeDefined();
      expect(cost.properties['request_count']).toBeDefined();
      expect(cost.properties['currency']).toBe('USD');
      expect(cost.properties['environment']).toBe('production');
    }
  });

  it('produces model entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const models = result.entities.filter((e) => e.type === 'model');
    expect(models.length).toBe(4);

    for (const model of models) {
      expect(model.properties['provider']).toBeDefined();
      expect(model.properties['context_window']).toBeDefined();
      expect(model.properties['cost_per_1k_input']).toBeDefined();
      expect(model.properties['cost_per_1k_output']).toBeDefined();
      expect(model.properties['pricing_tier']).toBeDefined();
    }
  });

  it('produces performance_metric entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const metrics = result.entities.filter((e) => e.type === 'performance_metric');
    expect(metrics.length).toBe(8);

    for (const metric of metrics) {
      expect(metric.properties['metric_type']).toBeDefined();
      expect(metric.properties['value']).toBeDefined();
      expect(metric.properties['unit']).toBeDefined();
      expect(metric.properties['model']).toBeDefined();
      expect(metric.properties['period']).toBeDefined();
    }
  });

  it('produces alert entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const alerts = result.entities.filter((e) => e.type === 'alert');
    expect(alerts.length).toBe(3);

    for (const alert of alerts) {
      expect(alert.properties['severity']).toBeDefined();
      expect(alert.properties['threshold_usd']).toBeDefined();
      expect(alert.properties['current_spend_usd']).toBeDefined();
      expect(alert.properties['model']).toBeDefined();
      expect(alert.properties['triggered']).toBeDefined();
    }
  });

  it('produces config entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const configs = result.entities.filter((e) => e.type === 'config');
    expect(configs.length).toBe(3);

    for (const config of configs) {
      expect(config.properties['config_type']).toBe('rate_limit');
      expect(config.properties['rate_limit_rpm']).toBeDefined();
      expect(config.properties['rate_limit_tpm']).toBeDefined();
      expect(config.properties['model']).toBeDefined();
    }
  });

  it('tags all entities with helicone and environment', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.tags).toContain('helicone');
      expect(entity.tags).toContain('production');
    }
  });

  it('tags alert entities with severity and triggered status', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const alerts = result.entities.filter((e) => e.type === 'alert');
    const triggered = alerts.filter((a) => a.properties['triggered'] === true);
    const idle = alerts.filter((a) => a.properties['triggered'] === false);

    for (const a of triggered) {
      expect(a.tags).toContain('triggered');
    }
    for (const a of idle) {
      expect(a.tags).toContain('idle');
    }
  });
});

// ---------------------------------------------------------------------------
// Collection — Relationship Production
// ---------------------------------------------------------------------------

describe('Collection — relationship production', () => {
  it('produces at least 20 relationships', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBeGreaterThanOrEqual(20);
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
    expect(types.has('uses_model')).toBe(true);
    expect(types.has('monitors')).toBe(true);
    expect(types.has('owns')).toBe(true);
    expect(types.has('contains')).toBe(true);
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
      expect(rel.source).toBe('helicone');
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

  it('creates uses_model relationships from cost metrics to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const usesModel = result.relationships.filter((r) => r.type === 'uses_model');
    // 7 cost metrics, each uses a model
    expect(usesModel.length).toBe(7);
  });

  it('creates monitors relationships from perf metrics and configs to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const monitors = result.relationships.filter((r) => r.type === 'monitors');
    // 8 perf metrics + 3 configs = 11 monitors relationships
    expect(monitors.length).toBe(11);
  });

  it('creates owns relationships from users to alerts and configs', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const owns = result.relationships.filter((r) => r.type === 'owns');
    // 3 alerts + 3 configs = 6 owns relationships
    expect(owns.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('masks configured fields in entity properties', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['username', 'pricing_tier'],
        excluded_patterns: [],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: {},
    };

    await collector.initialize(maskedConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    for (const user of users) {
      expect(user.properties['username']).toBe('***REDACTED***');
    }

    const models = result.entities.filter((e) => e.type === 'model');
    for (const model of models) {
      expect(model.properties['pricing_tier']).toBe('***REDACTED***');
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
    expect(collector.id).toBe('helicone');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('Helicone Collector');
  });

  it('has correct version', () => {
    expect(collector.version).toBe('0.1.0');
  });

  it('has correct type', () => {
    expect(collector.type).toBe('observability');
  });

  it('returns correct run metadata', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    expect(result.metadata.collector_id).toBe('helicone');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

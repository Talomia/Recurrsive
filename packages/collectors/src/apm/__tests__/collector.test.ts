/**
 * Tests for the APMCollector.
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
 * - Platform override via config.custom
 * - All relationships reference valid entity IDs
 * - Performance metric entities have expected properties
 * - Alert entities have expected properties
 * - Incident entities have expected properties
 * - Infrastructure resource entities have expected properties
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { APMCollector } from '../../apm/collector.js';
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

let collector: APMCollector;

beforeEach(() => {
  collector = new APMCollector('datadog');
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('initializes without error', async () => {
    await expect(collector.initialize(defaultConfig)).resolves.not.toThrow();
  });

  it('accepts platform override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { platform: 'newrelic' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // All entities should now be tagged with newrelic
    const tags = result.entities.flatMap((e) => e.tags);
    expect(tags).toContain('newrelic');
  });

  it('ignores invalid platform in custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { platform: 'invalid-platform' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // Should keep original platform
    const tags = result.entities.flatMap((e) => e.tags);
    expect(tags).toContain('datadog');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Validation', () => {
  it('validates the default datadog platform', async () => {
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates newrelic platform', async () => {
    const nrCollector = new APMCollector('newrelic');
    const result = await nrCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates grafana platform', async () => {
    const grafanaCollector = new APMCollector('grafana');
    const result = await grafanaCollector.validate();
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
    // 3 users + 6 metrics + 10 resources + 4 alerts + 2 incidents + 3 envs = 28
    expect(result.entities.length).toBeGreaterThanOrEqual(25);
    expect(result.entities.length).toBeLessThanOrEqual(32);
  });

  it('produces entities with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.id).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.name).toBeDefined();
      expect(entity.qualified_name).toBeDefined();
      expect(entity.source).toBe('apm');
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
    expect(types.has('performance_metric')).toBe(true);
    expect(types.has('infrastructure_resource')).toBe(true);
    expect(types.has('alert')).toBe(true);
    expect(types.has('incident')).toBe(true);
    expect(types.has('environment')).toBe(true);
    expect(types.has('user')).toBe(true);
  });

  it('produces user entities for DevOps team', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    expect(users.length).toBe(3);
    for (const user of users) {
      expect(user.properties['role']).toBe('devops_engineer');
    }
  });

  it('produces performance_metric entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const metrics = result.entities.filter((e) => e.type === 'performance_metric');
    expect(metrics.length).toBe(6);

    for (const metric of metrics) {
      expect(metric.properties['metric_type']).toBeDefined();
      expect(metric.properties['value']).toBeDefined();
      expect(metric.properties['unit']).toBeDefined();
      expect(metric.properties['service']).toBeDefined();
      expect(metric.properties['period']).toBeDefined();
      expect(metric.properties['platform']).toBe('datadog');
    }
  });

  it('produces infrastructure_resource entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const resources = result.entities.filter((e) => e.type === 'infrastructure_resource');
    expect(resources.length).toBe(10);

    for (const resource of resources) {
      expect(resource.properties['resource_type']).toBeDefined();
      expect(resource.properties['cpu_percent']).toBeDefined();
      expect(resource.properties['memory_percent']).toBeDefined();
      expect(resource.properties['status']).toBeDefined();
      expect(resource.properties['region']).toBeDefined();
    }
  });

  it('produces alert entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const alerts = result.entities.filter((e) => e.type === 'alert');
    expect(alerts.length).toBe(4);

    for (const alert of alerts) {
      expect(alert.properties['severity']).toBeDefined();
      expect(alert.properties['metric']).toBeDefined();
      expect(alert.properties['threshold']).toBeDefined();
      expect(alert.properties['current_value']).toBeDefined();
      expect(alert.properties['owner']).toBeDefined();
      expect(alert.properties['status']).toBeDefined();
      expect(alert.properties['breach_percent']).toBeDefined();
    }
  });

  it('produces incident entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const incidents = result.entities.filter((e) => e.type === 'incident');
    expect(incidents.length).toBe(2);

    for (const incident of incidents) {
      expect(incident.properties['severity']).toBeDefined();
      expect(incident.properties['status']).toBeDefined();
      expect(incident.properties['affected_service']).toBeDefined();
      expect(incident.properties['started_at']).toBeDefined();
      expect(incident.properties['commander']).toBeDefined();
    }
  });

  it('produces environment entities', async () => {
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
      expect(env.properties['service_count']).toBeDefined();
      expect(env.properties['host_count']).toBeDefined();
    }
  });

  it('tags all entities with apm and platform', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.tags).toContain('apm');
      expect(entity.tags).toContain('datadog');
    }
  });

  it('includes resource_type-specific tags on infrastructure resources', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const hosts = result.entities.filter(
      (e) => e.type === 'infrastructure_resource' && e.properties['resource_type'] === 'host',
    );
    for (const host of hosts) {
      expect(host.tags).toContain('host');
    }

    const containers = result.entities.filter(
      (e) => e.type === 'infrastructure_resource' && e.properties['resource_type'] === 'container',
    );
    for (const container of containers) {
      expect(container.tags).toContain('container');
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
      expect(rel.source).toBe('apm');
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

  it('alert monitors relationships link to performance metrics', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const monitorRels = result.relationships.filter((r) => r.type === 'monitors');
    expect(monitorRels.length).toBeGreaterThanOrEqual(2);

    const alertIds = new Set(result.entities.filter((e) => e.type === 'alert').map((e) => e.id));
    const metricIds = new Set(result.entities.filter((e) => e.type === 'performance_metric').map((e) => e.id));

    for (const rel of monitorRels) {
      expect(alertIds.has(rel.source_id)).toBe(true);
      expect(metricIds.has(rel.target_id)).toBe(true);
    }
  });

  it('service depends_on relationships are present', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const depRels = result.relationships.filter((r) => r.type === 'depends_on');
    expect(depRels.length).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('masks configured fields in entity properties', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['owner', 'username', 'commander'],
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

    const incidents = result.entities.filter((e) => e.type === 'incident');
    for (const incident of incidents) {
      expect(incident.properties['commander']).toBe('***REDACTED***');
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
    expect(collector.id).toBe('apm');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('APM Collector');
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

    expect(result.metadata.collector_id).toBe('apm');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

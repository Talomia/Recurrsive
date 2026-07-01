/**
 * Tests for the ArizeCollector.
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
 * - Model entities have expected properties
 * - Dataset entities have expected properties
 * - Performance metric entities have expected properties
 * - Alert entities have expected properties
 * - Pipeline entities have expected properties
 * - Relationship types: uses_model, monitors, contains, owns, evaluates_with, alerts_on, depends_on
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArizeCollector } from '../../arize/collector.js';
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

let collector: ArizeCollector;

beforeEach(() => {
  collector = new ArizeCollector('production');
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
    const stagingCollector = new ArizeCollector('staging');
    const result = await stagingCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates development environment', async () => {
    const devCollector = new ArizeCollector('development');
    const result = await devCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Collection — Entity Production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('produces approximately 34 entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    // 4 users + 5 models + 6 datasets + 10 metrics + 4 alerts + 5 pipelines = 34
    expect(result.entities.length).toBeGreaterThanOrEqual(30);
    expect(result.entities.length).toBeLessThanOrEqual(38);
  });

  it('produces entities with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.id).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.name).toBeDefined();
      expect(entity.qualified_name).toBeDefined();
      expect(entity.source).toBe('arize');
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
    expect(types.has('model')).toBe(true);
    expect(types.has('dataset')).toBe(true);
    expect(types.has('performance_metric')).toBe(true);
    expect(types.has('alert')).toBe(true);
    expect(types.has('pipeline')).toBe(true);
  });

  it('produces user entities for ML engineers', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    expect(users.length).toBe(4);
    for (const user of users) {
      expect(user.properties['role']).toBe('ml_engineer');
      expect(user.properties['platform']).toBe('arize');
    }
  });

  it('produces model entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const models = result.entities.filter((e) => e.type === 'model');
    expect(models.length).toBe(5);

    for (const model of models) {
      expect(model.properties['version']).toBeDefined();
      expect(model.properties['framework']).toBeDefined();
      expect(model.properties['model_type']).toBeDefined();
      expect(model.properties['accuracy']).toBeDefined();
      expect(model.properties['latency_ms']).toBeDefined();
      expect(model.properties['platform']).toBe('arize');
      expect(model.properties['environment']).toBe('production');
    }
  });

  it('produces dataset entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const datasets = result.entities.filter((e) => e.type === 'dataset');
    expect(datasets.length).toBe(6);

    for (const dataset of datasets) {
      expect(dataset.properties['dataset_type']).toBeDefined();
      expect(dataset.properties['row_count']).toBeDefined();
      expect(dataset.properties['feature_count']).toBeDefined();
      expect(dataset.properties['model']).toBeDefined();
    }
  });

  it('produces performance_metric entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const metrics = result.entities.filter((e) => e.type === 'performance_metric');
    expect(metrics.length).toBe(10);

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
    expect(alerts.length).toBe(4);

    for (const alert of alerts) {
      expect(alert.properties['severity']).toBeDefined();
      expect(alert.properties['alert_type']).toBeDefined();
      expect(alert.properties['model']).toBeDefined();
      expect(alert.properties['threshold']).toBeDefined();
      expect(alert.properties['current_value']).toBeDefined();
    }
  });

  it('produces pipeline entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const pipelines = result.entities.filter((e) => e.type === 'pipeline');
    expect(pipelines.length).toBe(5);

    for (const pipeline of pipelines) {
      expect(pipeline.properties['description']).toBeDefined();
      expect(pipeline.properties['pipeline_type']).toBeDefined();
      expect(pipeline.properties['step_count']).toBeDefined();
      expect(pipeline.properties['avg_duration_ms']).toBeDefined();
      expect(pipeline.properties['daily_runs']).toBeDefined();
    }
  });

  it('tags all entities with arize and environment', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.tags).toContain('arize');
      expect(entity.tags).toContain('production');
    }
  });

  it('tags alert entities with severity level', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const alerts = result.entities.filter((e) => e.type === 'alert');
    for (const alert of alerts) {
      const severity = alert.properties['severity'] as string;
      expect(alert.tags).toContain(severity);
    }
  });

  it('tags model entities with framework', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const models = result.entities.filter((e) => e.type === 'model');
    for (const model of models) {
      const framework = model.properties['framework'] as string;
      expect(model.tags).toContain(framework);
    }
  });

  it('tags dataset entities with dataset type', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const datasets = result.entities.filter((e) => e.type === 'dataset');
    for (const dataset of datasets) {
      const dsType = dataset.properties['dataset_type'] as string;
      expect(dataset.tags).toContain(dsType);
    }
  });
});

// ---------------------------------------------------------------------------
// Collection — Relationship Production
// ---------------------------------------------------------------------------

describe('Collection — relationship production', () => {
  it('produces at least 25 relationships', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBeGreaterThanOrEqual(25);
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
    expect(types.has('contains')).toBe(true);
    expect(types.has('owns')).toBe(true);
    expect(types.has('evaluates_with')).toBe(true);
    expect(types.has('alerts_on')).toBe(true);
    expect(types.has('depends_on')).toBe(true);
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
      expect(rel.source).toBe('arize');
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

  it('creates uses_model relationships from pipelines to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const usesModel = result.relationships.filter((r) => r.type === 'uses_model');
    // 5 pipelines, each uses one model
    expect(usesModel.length).toBe(5);
  });

  it('creates monitors relationships from metrics to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const monitors = result.relationships.filter((r) => r.type === 'monitors');
    // 10 metrics, each monitors a model
    expect(monitors.length).toBe(10);
  });

  it('creates owns relationships from users to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const owns = result.relationships.filter((r) => r.type === 'owns');
    // alice owns 2, bob owns 2, carol owns 1 = 5
    expect(owns.length).toBe(5);
  });

  it('creates evaluates_with relationships from datasets to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const evaluatesWith = result.relationships.filter((r) => r.type === 'evaluates_with');
    // 2 eval/reference datasets: fraud-eval-q2, churn-reference
    expect(evaluatesWith.length).toBe(2);
  });

  it('creates alerts_on relationships from alerts to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const alertsOn = result.relationships.filter((r) => r.type === 'alerts_on');
    // 4 alerts, each targets a model
    expect(alertsOn.length).toBe(4);
  });

  it('creates depends_on relationships from models to training datasets', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const dependsOn = result.relationships.filter((r) => r.type === 'depends_on');
    // 3 training datasets: fraud-training-2026, churn-training, demand-training
    expect(dependsOn.length).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('masks configured fields in entity properties', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['username', 'framework'],
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
      expect(model.properties['framework']).toBe('***REDACTED***');
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
    expect(collector.id).toBe('arize');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('Arize Collector');
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

    expect(result.metadata.collector_id).toBe('arize');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

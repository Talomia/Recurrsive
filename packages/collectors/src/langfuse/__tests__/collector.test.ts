/**
 * Tests for the LangfuseCollector.
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
 * - Prompt entities have expected properties
 * - Model entities have expected properties
 * - Performance metric entities have expected properties
 * - Pipeline entities have expected properties
 * - Evaluation entities have expected properties
 * - Relationship types: uses_model, contains, monitors, owns, calls, evaluates_with
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LangfuseCollector } from '../../langfuse/collector.js';
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

let collector: LangfuseCollector;

beforeEach(() => {
  collector = new LangfuseCollector('production');
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
    const stagingCollector = new LangfuseCollector('staging');
    const result = await stagingCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates development environment', async () => {
    const devCollector = new LangfuseCollector('development');
    const result = await devCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Collection — Entity Production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('produces approximately 27 entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    // 3 users + 5 prompts + 4 models + 8 metrics + 4 pipelines + 3 evals = 27
    expect(result.entities.length).toBeGreaterThanOrEqual(25);
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
      expect(entity.source).toBe('langfuse');
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
    expect(types.has('prompt')).toBe(true);
    expect(types.has('model')).toBe(true);
    expect(types.has('performance_metric')).toBe(true);
    expect(types.has('pipeline')).toBe(true);
    expect(types.has('evaluation')).toBe(true);
  });

  it('produces user entities for AI engineers', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    expect(users.length).toBe(3);
    for (const user of users) {
      expect(user.properties['role']).toBe('ai_engineer');
      expect(user.properties['platform']).toBe('langfuse');
    }
  });

  it('produces prompt entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const prompts = result.entities.filter((e) => e.type === 'prompt');
    expect(prompts.length).toBe(5);

    for (const prompt of prompts) {
      expect(prompt.properties['version']).toBeDefined();
      expect(prompt.properties['template']).toBeDefined();
      expect(prompt.properties['model']).toBeDefined();
      expect(prompt.properties['author']).toBeDefined();
      expect(prompt.properties['is_active']).toBeDefined();
      expect(prompt.properties['environment']).toBe('production');
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

  it('produces pipeline entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const pipelines = result.entities.filter((e) => e.type === 'pipeline');
    expect(pipelines.length).toBe(4);

    for (const pipeline of pipelines) {
      expect(pipeline.properties['description']).toBeDefined();
      expect(pipeline.properties['step_count']).toBeDefined();
      expect(pipeline.properties['avg_latency_ms']).toBeDefined();
      expect(pipeline.properties['daily_invocations']).toBeDefined();
    }
  });

  it('produces evaluation entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const evals = result.entities.filter((e) => e.type === 'evaluation');
    expect(evals.length).toBe(3);

    for (const evalEntity of evals) {
      expect(evalEntity.properties['dataset_size']).toBeDefined();
      expect(evalEntity.properties['avg_score']).toBeDefined();
      expect(evalEntity.properties['scoring_method']).toBeDefined();
      expect(evalEntity.properties['model']).toBeDefined();
    }
  });

  it('tags all entities with langfuse and environment', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.tags).toContain('langfuse');
      expect(entity.tags).toContain('production');
    }
  });

  it('tags prompt entities with active/inactive status', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const prompts = result.entities.filter((e) => e.type === 'prompt');
    const activePrompts = prompts.filter((p) => p.properties['is_active'] === true);
    const inactivePrompts = prompts.filter((p) => p.properties['is_active'] === false);

    for (const p of activePrompts) {
      expect(p.tags).toContain('active');
    }
    for (const p of inactivePrompts) {
      expect(p.tags).toContain('inactive');
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
    expect(types.has('contains')).toBe(true);
    expect(types.has('monitors')).toBe(true);
    expect(types.has('owns')).toBe(true);
    expect(types.has('calls')).toBe(true);
    expect(types.has('evaluates_with')).toBe(true);
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
      expect(rel.source).toBe('langfuse');
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

  it('creates uses_model relationships from prompts to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const usesModel = result.relationships.filter((r) => r.type === 'uses_model');
    // 5 prompts, each uses a model
    expect(usesModel.length).toBe(5);
  });

  it('creates owns relationships from users to prompts', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const owns = result.relationships.filter((r) => r.type === 'owns');
    // 5 prompts, each has an author
    expect(owns.length).toBe(5);
  });

  it('creates monitors relationships from metrics to models', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const monitors = result.relationships.filter((r) => r.type === 'monitors');
    // 8 metrics, each monitors a model
    expect(monitors.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('masks configured fields in entity properties', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['author', 'username'],
        excluded_patterns: [],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: {},
    };

    await collector.initialize(maskedConfig);
    const result = await collector.collect();

    const prompts = result.entities.filter((e) => e.type === 'prompt');
    for (const prompt of prompts) {
      expect(prompt.properties['author']).toBe('***REDACTED***');
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
    expect(collector.id).toBe('langfuse');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('Langfuse Collector');
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

    expect(result.metadata.collector_id).toBe('langfuse');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

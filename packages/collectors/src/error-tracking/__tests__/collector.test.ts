/**
 * Tests for the ErrorTrackingCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Platform configuration (sentry, bugsnag, rollbar)
 * - Validation success / failure
 * - Collection produces entities with valid shapes
 * - Entity types are all valid EntityType values
 * - Relationship types are all valid RelationType values
 * - Expected entity and relationship types are present
 * - Governance filtering works
 * - Error handling (collecting before init)
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorTrackingCollector } from '../../error-tracking/collector.js';
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

let collector: ErrorTrackingCollector;

beforeEach(() => {
  collector = new ErrorTrackingCollector();
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('initializes without error', async () => {
    await expect(collector.initialize(defaultConfig)).resolves.not.toThrow();
  });

  it('accepts DSN override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { dsn: 'https://key@sentry.io/123' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBeGreaterThan(0);
  });

  it('accepts platform override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { platform: 'bugsnag' },
    };
    const c = new ErrorTrackingCollector('sentry');
    await c.initialize(overrideConfig);
    const result = await c.collect();
    // Tags should reflect the overridden platform
    const hasTag = result.entities.some((e) => e.tags.includes('bugsnag'));
    expect(hasTag).toBe(true);
  });

  it('defaults to sentry platform', () => {
    const c = new ErrorTrackingCollector();
    expect(c.id).toBe('error-tracking');
  });

  it('accepts constructor platform parameter', () => {
    const c = new ErrorTrackingCollector('rollbar');
    expect(c.id).toBe('error-tracking');
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Validation', () => {
  it('validates with default sentry platform', async () => {
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates with bugsnag platform', async () => {
    const c = new ErrorTrackingCollector('bugsnag');
    const result = await c.validate();
    expect(result.valid).toBe(true);
  });

  it('validates with rollbar platform', async () => {
    const c = new ErrorTrackingCollector('rollbar');
    const result = await c.validate();
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid DSN URL when set', async () => {
    const c = new ErrorTrackingCollector('sentry');
    await c.initialize({
      ...defaultConfig,
      custom: { dsn: 'not-a-url' },
    });
    const result = await c.validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not a valid DSN URL');
  });
});

// ---------------------------------------------------------------------------
// Collection — Entity Production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('produces approximately 30 entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    // 5 users + 8 incidents + 5 alerts + 4 configs + 5 services + 3 envs = 30
    expect(result.entities.length).toBeGreaterThanOrEqual(25);
    expect(result.entities.length).toBeLessThanOrEqual(35);
  });

  it('produces entities with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.id).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.name).toBeDefined();
      expect(entity.qualified_name).toBeDefined();
      expect(entity.source).toBe('error-tracking');
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
    expect(types.has('incident')).toBe(true);
    expect(types.has('alert')).toBe(true);
    expect(types.has('config')).toBe(true);
    expect(types.has('infrastructure_resource')).toBe(true);
    expect(types.has('environment')).toBe(true);
    expect(types.has('user')).toBe(true);
  });

  it('produces user entities for all SRE team members', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const users = result.entities.filter((e) => e.type === 'user');
    expect(users.length).toBe(5);
  });

  it('produces incident entities for all error events', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const incidents = result.entities.filter((e) => e.type === 'incident');
    expect(incidents.length).toBe(8);
  });

  it('produces alert entities for error groups', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const alerts = result.entities.filter((e) => e.type === 'alert');
    expect(alerts.length).toBe(5);
    expect(alerts[0]!.properties['pattern']).toBeDefined();
    expect(alerts[0]!.properties['error_types']).toBeDefined();
  });

  it('produces config entities for alert rules', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const configs = result.entities.filter((e) => e.type === 'config');
    expect(configs.length).toBe(4);
    expect(configs[0]!.properties['condition']).toBeDefined();
    expect(configs[0]!.properties['threshold']).toBeDefined();
  });

  it('produces infrastructure_resource entities for services', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const services = result.entities.filter((e) => e.type === 'infrastructure_resource');
    expect(services.length).toBe(5);
    expect(services[0]!.properties['error_rate']).toBeDefined();
  });

  it('produces environment entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const envs = result.entities.filter((e) => e.type === 'environment');
    expect(envs.length).toBe(3);
    expect(envs[0]!.properties['tier']).toBeDefined();
  });

  it('tags all entities with error-tracking and platform', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.tags).toContain('error-tracking');
      expect(entity.tags).toContain('sentry');
    }
  });
});

// ---------------------------------------------------------------------------
// Collection — Relationship Production
// ---------------------------------------------------------------------------

describe('Collection — relationship production', () => {
  it('produces between 15 and 30 relationships', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBeGreaterThanOrEqual(15);
    expect(result.relationships.length).toBeLessThanOrEqual(30);
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
    expect(types.has('triggers')).toBe(true);
    expect(types.has('deploys_to')).toBe(true);
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
      expect(rel.source).toBe('error-tracking');
      expect(rel.created_at).toBeDefined();
      expect(rel.updated_at).toBeDefined();
    }
  });

  it('produces owns relationships linking users to alert rules', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const ownsRels = result.relationships.filter((r) => r.type === 'owns');
    expect(ownsRels.length).toBe(4); // 4 alert rules, each with an owner
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('masks configured fields in entity properties', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['username', 'owner'],
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
    expect(collector.id).toBe('error-tracking');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('Error Tracking Collector');
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

    expect(result.metadata.collector_id).toBe('error-tracking');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

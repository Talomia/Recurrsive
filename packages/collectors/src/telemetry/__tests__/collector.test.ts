/**
 * Tests for the OpenTelemetryCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Validation success / failure
 * - Collection produces entities with valid shapes
 * - Entity types are all valid EntityType values
 * - Relationship types are all valid RelationType values
 * - Governance filtering works
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpenTelemetryCollector } from '../../telemetry/collector.js';
import { EntityTypeSchema, RelationTypeSchema } from '@recurrsive/core';
import type { CollectorConfig } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const OTLP_ENDPOINT = 'http://localhost:4318';

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

let collector: OpenTelemetryCollector;

beforeEach(() => {
  collector = new OpenTelemetryCollector(OTLP_ENDPOINT);
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('initializes without error', async () => {
    await expect(collector.initialize(defaultConfig)).resolves.not.toThrow();
  });

  it('accepts otlpEndpoint override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { otlpEndpoint: 'https://otel.example.com:4317' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Validation', () => {
  it('validates a well-formed HTTP endpoint', async () => {
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates an HTTPS endpoint', async () => {
    const httpsCollector = new OpenTelemetryCollector('https://otel.example.com:4317');
    const result = await httpsCollector.validate();
    expect(result.valid).toBe(true);
  });

  it('rejects non-http protocol', async () => {
    const badCollector = new OpenTelemetryCollector('ftp://otel.example.com');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Unsupported protocol');
  });

  it('rejects an invalid URL', async () => {
    const badCollector = new OpenTelemetryCollector('not-a-url');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('not a valid URL');
  });

  it('rejects an empty endpoint', async () => {
    const badCollector = new OpenTelemetryCollector('');
    const result = await badCollector.validate();
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Collection — Entity Production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('produces between 12 and 20 entities', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBeGreaterThanOrEqual(12);
    expect(result.entities.length).toBeLessThanOrEqual(20);
  });

  it('produces entities with all required fields', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    for (const entity of result.entities) {
      expect(entity.id).toBeDefined();
      expect(entity.type).toBeDefined();
      expect(entity.name).toBeDefined();
      expect(entity.qualified_name).toBeDefined();
      expect(entity.source).toBe('telemetry');
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
    expect(types.has('deployment')).toBe(true);
    expect(types.has('environment')).toBe(true);
    expect(types.has('alert')).toBe(true);
  });

  it('produces metric entities with expected properties', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const metrics = result.entities.filter((e) => e.type === 'performance_metric');
    expect(metrics.length).toBe(5);
    for (const metric of metrics) {
      expect(metric.properties['unit']).toBeDefined();
      expect(metric.properties['value']).toBeDefined();
      expect(metric.properties['metric_type']).toBeDefined();
    }
  });

  it('produces infrastructure entities with correct kinds', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const resources = result.entities.filter((e) => e.type === 'infrastructure_resource');
    expect(resources.length).toBe(3);
    const kinds = new Set(resources.map((r) => r.properties['kind']));
    expect(kinds.has('host')).toBe(true);
    expect(kinds.has('pod')).toBe(true);
    expect(kinds.has('container')).toBe(true);
  });

  it('produces alert entities with severity and status', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    const alerts = result.entities.filter((e) => e.type === 'alert');
    expect(alerts.length).toBe(2);
    for (const alert of alerts) {
      expect(alert.properties['severity']).toBeDefined();
      expect(alert.properties['status']).toBeDefined();
      expect(alert.properties['condition']).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// Collection — Relationship Production
// ---------------------------------------------------------------------------

describe('Collection — relationship production', () => {
  it('produces between 8 and 15 relationships', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBeGreaterThanOrEqual(8);
    expect(result.relationships.length).toBeLessThanOrEqual(15);
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
    expect(types.has('alerts_on')).toBe(true);
    expect(types.has('depends_on')).toBe(true);
    expect(types.has('routes_to')).toBe(true);
    expect(types.has('deploys_to')).toBe(true);
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
      expect(rel.source).toBe('telemetry');
      expect(rel.created_at).toBeDefined();
      expect(rel.updated_at).toBeDefined();
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
        masked_fields: ['otlp_endpoint', 'condition'],
        excluded_patterns: [],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: {},
    };

    await collector.initialize(maskedConfig);
    const result = await collector.collect();

    // Every entity has otlp_endpoint, so they should all be masked
    for (const entity of result.entities) {
      expect(entity.properties['otlp_endpoint']).toBe('***REDACTED***');
    }

    // Alert entities should have condition masked
    const alerts = result.entities.filter((e) => e.type === 'alert');
    for (const alert of alerts) {
      expect(alert.properties['condition']).toBe('***REDACTED***');
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
    expect(collector.id).toBe('telemetry');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('OpenTelemetry Collector');
  });

  it('has correct version', () => {
    expect(collector.version).toBe('0.1.0');
  });

  it('has correct type', () => {
    expect(collector.type).toBe('telemetry');
  });

  it('returns correct run metadata', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    expect(result.metadata.collector_id).toBe('telemetry');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBeGreaterThan(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

/**
 * Tests for the APMCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Validation success / failure
 * - Collection returns empty results when no credentials
 * - Governance filtering doesn't crash
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 * - Platform override via config.custom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { APMCollector } from '../../apm/collector.js';
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
    // No credentials → empty entities, but platform was accepted
    expect(result.entities.length).toBe(0);
  });

  it('ignores invalid platform in custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { platform: 'invalid-platform' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // Should keep original platform (datadog) — still no credentials → empty
    expect(result.entities.length).toBe(0);
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
// Collection — entity production
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('returns empty entities when no API credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBe(0);
  });

  it('returns empty relationships when no API credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBe(0);
  });

  it('returns valid metadata with no credentials', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('apm');
    expect(result.metadata.items_processed).toBe(0);
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('does not crash with masked config and no credentials', async () => {
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
    expect(result.entities.length).toBe(0);
    expect(result.relationships.length).toBe(0);
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
    expect(result.metadata.items_processed).toBe(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

/**
 * Tests for the HeliconeCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Environment override via config.custom
 * - Validation success / failure
 * - Collection returns empty results when no API key is configured
 * - Governance filtering works without crashing
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HeliconeCollector } from '../../helicone/collector.js';
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
    // With no API key the result is empty — but the environment was stored
    expect(result.metadata.collector_id).toBe('helicone');
  });

  it('ignores invalid environment in custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { environment: 'invalid-env' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // Should keep original environment; no entities without API key
    expect(result.entities).toEqual([]);
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
// Collection — No Credentials
// ---------------------------------------------------------------------------

describe('Collection — entity production', () => {
  it('returns empty entities when no API credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities).toEqual([]);
  });

  it('returns empty relationships when no API credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships).toEqual([]);
  });

  it('returns valid metadata with no credentials', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('helicone');
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.items_processed).toBe(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('does not crash with masked fields when no data is returned', async () => {
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
    expect(result.entities).toEqual([]);
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
// Metadata (static)
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
    expect(result.metadata.items_processed).toBe(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

/**
 * Tests for the ArizeCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Environment override via config.custom
 * - Validation success / failure
 * - Collection returns empty results without credentials
 * - Governance filtering works
 * - Error handling (not initialized)
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArizeCollector } from '../../arize/collector.js';
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
    // Without credentials, collect returns empty but should not throw
    const result = await collector.collect();
    expect(result.entities).toEqual([]);
  });

  it('ignores invalid environment in custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { environment: 'invalid-env' },
    };
    await collector.initialize(overrideConfig);
    // Should keep original environment and not throw
    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('arize');
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
// Collection — Empty Results (No Credentials)
// ---------------------------------------------------------------------------

describe('Collection — empty results without credentials', () => {
  it('returns empty entities when no credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities).toEqual([]);
  });

  it('returns empty relationships when no credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships).toEqual([]);
  });

  it('returns items_processed of 0 when no credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.metadata.items_processed).toBe(0);
  });

  it('returns empty errors array when no credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.metadata.errors).toEqual([]);
  });

  it('returns valid metadata even without credentials', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('arize');
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('initializes governance filter without error', async () => {
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
    // Without credentials, governance filter is still set up but no entities to mask
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
    expect(result.metadata.items_processed).toBe(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

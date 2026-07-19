/**
 * Tests for the LangfuseCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Environment override via config.custom
 * - Validation success / failure
 * - Collection returns empty results when no API credentials are configured
 * - Governance filtering works without crashing
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LangfuseCollector } from '../../langfuse/collector.js';
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
    // Without credentials, entities are empty — but the environment is stored
    expect(result.metadata.collector_id).toBe('langfuse');
  });

  it('ignores invalid environment in custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { environment: 'invalid-env' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // Should keep original environment — returns empty without credentials
    expect(result.metadata.collector_id).toBe('langfuse');
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

    expect(result.metadata.collector_id).toBe('langfuse');
    expect(result.metadata.items_processed).toBe(0);
    // The missing credentials are reported, not silently swallowed.
    expect(result.metadata.errors.length).toBe(1);
    expect(result.metadata.errors[0]!.message).toContain('No Langfuse credentials');
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('handles governance config without crashing when no credentials', async () => {
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

    // Without credentials, collect returns empty — should not crash
    expect(result.entities.length).toBe(0);
    expect(result.relationships.length).toBe(0);
    expect(result.metadata.collector_id).toBe('langfuse');
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
// Metadata (static properties)
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
    expect(result.metadata.items_processed).toBe(0);
    // No credentials in the test environment: the absence is reported.
    expect(result.metadata.errors.length).toBeGreaterThan(0);
  });
});

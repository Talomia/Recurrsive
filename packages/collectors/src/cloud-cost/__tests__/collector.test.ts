/**
 * Tests for the CloudCostCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Validation success / failure
 * - Collection returns empty results when no credentials/CSV configured
 * - Governance filtering works (no crash with empty results)
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 * - Provider override via config.custom
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CloudCostCollector } from '../../cloud-cost/collector.js';
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

let collector: CloudCostCollector;

beforeEach(() => {
  collector = new CloudCostCollector('aws');
});

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

describe('Initialization', () => {
  it('initializes without error', async () => {
    await expect(collector.initialize(defaultConfig)).resolves.not.toThrow();
  });

  it('accepts provider override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { provider: 'gcp' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // No credentials in test env, so empty results
    expect(result.entities.length).toBe(0);
  });

  it('ignores invalid provider in custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { provider: 'invalid-provider' },
    };
    await collector.initialize(overrideConfig);
    const result = await collector.collect();
    // Should keep original provider, still empty (no creds)
    expect(result.entities.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

describe('Validation', () => {
  it('validates the default aws provider', async () => {
    const result = await collector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates gcp provider', async () => {
    const gcpCollector = new CloudCostCollector('gcp');
    const result = await gcpCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validates azure provider', async () => {
    const azureCollector = new CloudCostCollector('azure');
    const result = await azureCollector.validate();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Collection — Empty Results (No Credentials)
// ---------------------------------------------------------------------------

describe('Collection — no credentials', () => {
  it('returns empty entities when no cloud cost credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBe(0);
  });

  it('returns empty relationships when no cloud cost credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBe(0);
  });

  it('returns valid metadata with no credentials', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('cloud-cost');
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
  it('does not crash with masked config when no credentials are configured', async () => {
    const maskedConfig: CollectorConfig = {
      governance: {
        masked_fields: ['owner', 'username'],
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
    expect(collector.id).toBe('cloud-cost');
  });

  it('has correct collector name', () => {
    expect(collector.name).toBe('Cloud Cost Collector');
  });

  it('has correct version', () => {
    expect(collector.version).toBe('0.1.0');
  });

  it('has correct type', () => {
    expect(collector.type).toBe('cloud');
  });

  it('returns correct run metadata', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();

    expect(result.metadata.collector_id).toBe('cloud-cost');
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    expect(result.metadata.items_processed).toBe(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

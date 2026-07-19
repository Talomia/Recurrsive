/**
 * Tests for the ErrorTrackingCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Platform configuration (sentry, bugsnag, rollbar)
 * - Validation success / failure
 * - Collection returns empty results when no Sentry credentials configured
 * - Governance filtering works (no crash with empty results)
 * - Error handling (collecting before init)
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ErrorTrackingCollector } from '../../error-tracking/collector.js';
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
    // No Sentry credentials in test env, so empty results
    expect(result.entities.length).toBe(0);
  });

  it('accepts platform override from custom config', async () => {
    const overrideConfig: CollectorConfig = {
      ...defaultConfig,
      custom: { platform: 'bugsnag' },
    };
    const c = new ErrorTrackingCollector('sentry');
    await c.initialize(overrideConfig);
    const result = await c.collect();
    // No credentials, empty results
    expect(result.entities.length).toBe(0);
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
// Collection — Empty Results (No Credentials)
// ---------------------------------------------------------------------------

describe('Collection — no Sentry credentials', () => {
  it('returns empty entities when no Sentry credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBe(0);
  });

  it('returns empty relationships when no Sentry credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBe(0);
  });

  it('returns valid metadata with a descriptive error when no credentials are configured', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('error-tracking');
    expect(result.metadata.items_processed).toBe(0);
    expect(result.metadata.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.metadata.collected_at).toBeDefined();
    // Honest degradation: missing credentials are surfaced in metadata.errors
    expect(result.metadata.errors.length).toBeGreaterThan(0);
    expect(result.metadata.errors[0]!.message).toContain('Sentry credentials');
  });
});

// ---------------------------------------------------------------------------
// Governance Filtering
// ---------------------------------------------------------------------------

describe('Governance filtering', () => {
  it('does not crash with masked config when no credentials are configured', async () => {
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
    expect(result.metadata.items_processed).toBe(0);
    // No credentials in the test environment → honest degradation error
    expect(result.metadata.errors.length).toBeGreaterThan(0);
  });
});

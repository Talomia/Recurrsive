/**
 * Tests for the OpenTelemetryCollector.
 *
 * Tests cover:
 * - Initialization with config
 * - Validation success / failure
 * - Collection returns empty results when no OTEL data files exist
 * - Governance filtering works (no crash with empty results)
 * - Dispose is clean
 * - Metadata has correct collector_id, timing, counts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OpenTelemetryCollector } from '../../telemetry/collector.js';
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
    // No OTEL files exist in test environment, so empty results
    expect(result.entities.length).toBe(0);
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
// Collection — Empty Results (No OTEL Data Files)
// ---------------------------------------------------------------------------

describe('Collection — no OTEL data files', () => {
  it('returns empty entities when no OTEL data files are found', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.entities.length).toBe(0);
  });

  it('returns empty relationships when no OTEL data files are found', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.relationships.length).toBe(0);
  });

  it('returns valid metadata with no data files', async () => {
    await collector.initialize(defaultConfig);
    const result = await collector.collect();
    expect(result.metadata.collector_id).toBe('telemetry');
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
  it('does not crash with masked config when no data files exist', async () => {
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
    expect(result.metadata.items_processed).toBe(0);
    expect(result.metadata.errors).toEqual([]);
  });
});

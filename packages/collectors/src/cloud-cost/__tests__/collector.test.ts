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
    // The missing data source is reported, not silently swallowed.
    expect(result.metadata.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Collection — With CSV Data
// ---------------------------------------------------------------------------

describe('Collection — with CSV data', () => {
  const writeCsvAndCollect = async (csv: string) => {
    const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'cloud-cost-test-'));
    const csvPath = join(dir, 'costs.csv');
    try {
      writeFileSync(csvPath, csv);
      await collector.initialize({
        ...defaultConfig,
        custom: { cloud_cost_csv_path: csvPath },
      });
      return await collector.collect();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };

  it('emits only entities present in the CSV — no synthesized environments', async () => {
    const result = await writeCsvAndCollect(
      'service,resource,monthly_cost,region,status\n' +
      'EC2,i-abc123,120.50,us-east-1,running\n' +
      'S3,bucket-logs,10.25,us-east-1,active\n',
    );

    const types = new Set(result.entities.map((e) => e.type));
    expect(types.has('cost_metric')).toBe(true);
    expect(types.has('infrastructure_resource')).toBe(true);
    expect(types.has('pipeline')).toBe(true);
    expect(types.has('environment')).toBe(false);

    // No status→environment guessing.
    const relTypes = new Set(result.relationships.map((r) => r.type));
    expect(relTypes.has('deploys_to')).toBe(false);
  });

  it('omits billing period and currency when the CSV has no such columns', async () => {
    const result = await writeCsvAndCollect(
      'service,resource,monthly_cost,region,status\n' +
      'EC2,i-abc123,120.50,us-east-1,running\n',
    );
    const metric = result.entities.find((e) => e.type === 'cost_metric');
    expect(metric).toBeDefined();
    expect('period_start' in metric!.properties).toBe(false);
    expect('period_end' in metric!.properties).toBe(false);
    expect('currency' in metric!.properties).toBe(false);
  });

  it('takes billing period and currency from the CSV when present', async () => {
    const result = await writeCsvAndCollect(
      'service,resource,monthly_cost,region,status,period_start,period_end,currency\n' +
      'EC2,i-abc123,120.50,us-east-1,running,2025-03-01,2025-03-31,USD\n' +
      'EC2,i-def456,80.00,us-east-1,running,2025-03-01,2025-03-31,USD\n',
    );
    const metric = result.entities.find((e) => e.type === 'cost_metric');
    expect(metric!.properties['period_start']).toBe('2025-03-01');
    expect(metric!.properties['period_end']).toBe('2025-03-31');
    expect(metric!.properties['currency']).toBe('USD');
    expect(metric!.properties['total_cost']).toBeCloseTo(200.5);
  });

  it('handles quoted CSV fields with embedded commas', async () => {
    const result = await writeCsvAndCollect(
      'service,resource,monthly_cost,region,status\n' +
      '"Amazon EC2","web, primary",99.99,us-east-1,running\n',
    );
    const resource = result.entities.find((e) => e.type === 'infrastructure_resource');
    expect(resource!.name).toBe('web, primary');
    expect(resource!.properties['service']).toBe('Amazon EC2');
    expect(resource!.properties['monthly_cost']).toBeCloseTo(99.99);
  });

  it('reports unknown status when the CSV omits it, never running', async () => {
    const result = await writeCsvAndCollect(
      'service,resource,monthly_cost,region\n' +
      'EC2,i-abc123,120.50,us-east-1\n',
    );
    const resource = result.entities.find((e) => e.type === 'infrastructure_resource');
    expect(resource!.properties['status']).toBe('unknown');
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
    // No data source in the test environment: the absence is reported.
    expect(result.metadata.errors.length).toBeGreaterThan(0);
  });
});

/**
 * @module __tests__/base/governance
 *
 * Comprehensive tests for the GovernanceFilter class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GovernanceFilter } from '../../base/governance.js';
import type { DataGovernance, Entity, EntityType } from '@recurrsive/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const now = new Date().toISOString();

function makeEntity(overrides: Partial<Entity> = {}): Entity {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    type: (overrides.type ?? 'function') as EntityType,
    name: overrides.name ?? 'testFunc',
    qualified_name: overrides.qualified_name ?? 'src/index.ts:testFunc',
    description: overrides.description ?? undefined,
    source: overrides.source ?? 'test-collector',
    properties: overrides.properties ?? {},
    tags: overrides.tags ?? [],
    created_at: overrides.created_at ?? now,
    updated_at: overrides.updated_at ?? now,
    last_seen_at: overrides.last_seen_at ?? now,
  };
}

function createGovernance(overrides: Partial<DataGovernance> = {}): DataGovernance {
  return {
    masked_fields: overrides.masked_fields ?? [],
    excluded_patterns: overrides.excluded_patterns ?? [],
    pii_detection: overrides.pii_detection ?? true,
    audit_log: overrides.audit_log ?? true,
    retention_days: overrides.retention_days ?? 90,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GovernanceFilter', () => {
  // ── PII Detection ─────────────────────────────────────────────────────

  describe('detectPII', () => {
    let filter: GovernanceFilter;

    beforeEach(() => {
      filter = new GovernanceFilter(createGovernance({ pii_detection: true }));
    });

    it('detects email addresses', () => {
      const detections = filter.detectPII('Contact user@example.com for info');
      expect(detections.length).toBeGreaterThanOrEqual(1);
      const email = detections.find((d) => d.type === 'email');
      expect(email).toBeDefined();
      expect(email!.match).toBe('user@example.com');
    });

    it('detects phone numbers', () => {
      const detections = filter.detectPII('Call (555) 123-4567 now');
      const phone = detections.find((d) => d.type === 'phone');
      expect(phone).toBeDefined();
      expect(phone!.match).toContain('555');
    });

    it('detects SSN patterns', () => {
      const detections = filter.detectPII('SSN: 123-45-6789');
      const ssn = detections.find((d) => d.type === 'ssn');
      expect(ssn).toBeDefined();
      expect(ssn!.match).toBe('123-45-6789');
    });

    it('detects API key patterns', () => {
      const detections = filter.detectPII('api_key = "test_key_0123456789abcdef0123456789"');
      const apiKey = detections.find((d) => d.type === 'api_key');
      expect(apiKey).toBeDefined();
    });

    it('detects IP addresses', () => {
      const detections = filter.detectPII('Server at 192.168.1.100');
      const ip = detections.find((d) => d.type === 'ip_address');
      expect(ip).toBeDefined();
      expect(ip!.match).toBe('192.168.1.100');
    });

    it('detects JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4iLCJpYXQiOjE1MTYyMzkwMjJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const detections = filter.detectPII(`Token: ${jwt}`);
      const jwtDetection = detections.find((d) => d.type === 'jwt_token');
      expect(jwtDetection).toBeDefined();
    });

    it('returns empty array when PII detection is disabled', () => {
      const noDetect = new GovernanceFilter(createGovernance({ pii_detection: false }));
      const detections = noDetect.detectPII('user@example.com 123-45-6789');
      expect(detections).toEqual([]);
    });

    it('returns empty array when no PII is present', () => {
      const detections = filter.detectPII('This is a normal function that returns void');
      expect(detections).toEqual([]);
    });

    it('detects multiple PII types in the same text', () => {
      const text = 'Email: admin@company.com, SSN: 111-22-3333';
      const detections = filter.detectPII(text);
      const types = detections.map((d) => d.type);
      expect(types).toContain('email');
      expect(types).toContain('ssn');
    });
  });

  // ── Field Masking ─────────────────────────────────────────────────────

  describe('maskEntity', () => {
    it('replaces masked field values with REDACTED', () => {
      const filter = new GovernanceFilter(
        createGovernance({ masked_fields: ['password', 'token'], pii_detection: false }),
      );
      const entity = makeEntity({
        properties: {
          password: 'super-secret',
          token: 'abc123xyz',
          name: 'safe-value',
        },
      });

      const masked = filter.maskEntity(entity);
      expect(masked.properties['password']).toBe('***REDACTED***');
      expect(masked.properties['token']).toBe('***REDACTED***');
      expect(masked.properties['name']).toBe('safe-value');
    });

    it('does not mutate the original entity', () => {
      const filter = new GovernanceFilter(
        createGovernance({ masked_fields: ['secret'], pii_detection: false }),
      );
      const entity = makeEntity({
        properties: { secret: 'my-secret' },
      });

      const masked = filter.maskEntity(entity);
      expect(entity.properties['secret']).toBe('my-secret');
      expect(masked.properties['secret']).toBe('***REDACTED***');
    });

    it('applies PII detection to string property values during masking', () => {
      const filter = new GovernanceFilter(
        createGovernance({ masked_fields: [], pii_detection: true }),
      );
      const entity = makeEntity({
        properties: {
          notes: 'Contact admin@example.com for help',
        },
      });

      const masked = filter.maskEntity(entity);
      expect(masked.properties['notes']).toContain('[REDACTED:email]');
      expect(masked.properties['notes']).not.toContain('admin@example.com');
    });

    it('leaves non-string properties untouched by PII detection', () => {
      const filter = new GovernanceFilter(
        createGovernance({ masked_fields: [], pii_detection: true }),
      );
      const entity = makeEntity({
        properties: {
          count: 42,
          active: true,
        },
      });

      const masked = filter.maskEntity(entity);
      expect(masked.properties['count']).toBe(42);
      expect(masked.properties['active']).toBe(true);
    });
  });

  // ── Custom Masked Fields ──────────────────────────────────────────────

  describe('custom masked fields', () => {
    it('handles custom field names for masking', () => {
      const filter = new GovernanceFilter(
        createGovernance({
          masked_fields: ['connection_string', 'database_url'],
          pii_detection: false,
        }),
      );
      const entity = makeEntity({
        properties: {
          connection_string: 'postgres://user:pass@localhost/db',
          database_url: 'mysql://root@127.0.0.1/test',
          host: 'localhost',
        },
      });

      const masked = filter.maskEntity(entity);
      expect(masked.properties['connection_string']).toBe('***REDACTED***');
      expect(masked.properties['database_url']).toBe('***REDACTED***');
      expect(masked.properties['host']).toBe('localhost');
    });

    it('handles empty masked_fields list', () => {
      const filter = new GovernanceFilter(
        createGovernance({ masked_fields: [], pii_detection: false }),
      );
      const entity = makeEntity({
        properties: { password: 'secret' },
      });

      const masked = filter.maskEntity(entity);
      expect(masked.properties['password']).toBe('secret');
    });
  });

  // ── Path Exclusion ────────────────────────────────────────────────────

  describe('isExcluded', () => {
    let filter: GovernanceFilter;

    beforeEach(() => {
      filter = new GovernanceFilter(
        createGovernance({
          excluded_patterns: ['*.env', 'secrets/**', 'node_modules/**', '*.log'],
        }),
      );
    });

    it('excludes files matching glob patterns', () => {
      expect(filter.isExcluded('.env')).toBe(true);
      expect(filter.isExcluded('config/.env')).toBe(true);
    });

    it('excludes files in excluded directories', () => {
      expect(filter.isExcluded('secrets/api-keys.json')).toBe(true);
      expect(filter.isExcluded('secrets/nested/deep/key.txt')).toBe(true);
    });

    it('excludes node_modules paths', () => {
      expect(filter.isExcluded('node_modules/express/index.js')).toBe(true);
    });

    it('does not exclude non-matching paths', () => {
      expect(filter.isExcluded('src/index.ts')).toBe(false);
      expect(filter.isExcluded('lib/utils.py')).toBe(false);
    });

    it('excludes log files', () => {
      expect(filter.isExcluded('debug.log')).toBe(true);
      expect(filter.isExcluded('logs/app.log')).toBe(true);
    });

    it('normalizes backslashes to forward slashes', () => {
      expect(filter.isExcluded('secrets\\keys\\private.pem')).toBe(true);
    });

    it('returns false when excluded_patterns is empty', () => {
      const noExclusions = new GovernanceFilter(
        createGovernance({ excluded_patterns: [] }),
      );
      expect(noExclusions.isExcluded('.env')).toBe(false);
      expect(noExclusions.isExcluded('secrets/keys.json')).toBe(false);
    });
  });

  // ── Audit Logging ─────────────────────────────────────────────────────

  describe('audit logging', () => {
    it('records audit entries when audit_log is enabled', () => {
      const filter = new GovernanceFilter(
        createGovernance({ audit_log: true, masked_fields: ['secret'], pii_detection: false }),
      );
      const entity = makeEntity({
        properties: { secret: 'value', name: 'safe' },
      });

      filter.maskEntity(entity);

      const log = filter.getAuditLog();
      expect(log.length).toBeGreaterThanOrEqual(1);
      const maskEntry = log.find((e) => e.action === 'mask_entity');
      expect(maskEntry).toBeDefined();
      expect(maskEntry!.details['entity_id']).toBe(entity.id);
    });

    it('does not record audit entries when audit_log is disabled', () => {
      const filter = new GovernanceFilter(
        createGovernance({ audit_log: false, masked_fields: ['secret'], pii_detection: false }),
      );
      const entity = makeEntity({
        properties: { secret: 'value' },
      });

      filter.maskEntity(entity);

      const log = filter.getAuditLog();
      // maskEntity does not push when audit_log is false
      const maskEntries = log.filter((e) => e.action === 'mask_entity');
      expect(maskEntries).toHaveLength(0);
    });

    it('createAuditEntry returns an entry with timestamp', () => {
      const filter = new GovernanceFilter(
        createGovernance({ audit_log: true }),
      );
      const entry = filter.createAuditEntry('test_action', { key: 'value' });
      expect(entry.action).toBe('test_action');
      expect(entry.details['key']).toBe('value');
      expect(entry.timestamp).toBeDefined();
    });

    it('clearAuditLog empties the log', () => {
      const filter = new GovernanceFilter(
        createGovernance({ audit_log: true }),
      );
      filter.createAuditEntry('test', {});
      filter.createAuditEntry('test2', {});
      expect(filter.getAuditLog().length).toBeGreaterThanOrEqual(2);

      filter.clearAuditLog();
      expect(filter.getAuditLog()).toHaveLength(0);
    });

    it('getAuditLog returns a snapshot (not mutable reference)', () => {
      const filter = new GovernanceFilter(
        createGovernance({ audit_log: true }),
      );
      filter.createAuditEntry('test', {});

      const log1 = filter.getAuditLog();
      filter.createAuditEntry('test2', {});
      const log2 = filter.getAuditLog();

      expect(log2.length).toBeGreaterThan(log1.length);
    });
  });

  // ── sanitizeText ──────────────────────────────────────────────────────

  describe('sanitizeText', () => {
    it('replaces detected PII with [REDACTED:type] placeholders', () => {
      const filter = new GovernanceFilter(createGovernance({ pii_detection: true }));
      const text = 'Email user@test.com and call 555-123-4567';
      const sanitized = filter.sanitizeText(text);
      expect(sanitized).toContain('[REDACTED:email]');
      expect(sanitized).not.toContain('user@test.com');
    });

    it('returns original text when PII detection is disabled', () => {
      const filter = new GovernanceFilter(createGovernance({ pii_detection: false }));
      const text = 'Email user@test.com';
      const sanitized = filter.sanitizeText(text);
      expect(sanitized).toBe(text);
    });

    it('returns original text when no PII is found', () => {
      const filter = new GovernanceFilter(createGovernance({ pii_detection: true }));
      const text = 'This is a clean string with no sensitive data';
      const sanitized = filter.sanitizeText(text);
      expect(sanitized).toBe(text);
    });
  });
});

/**
 * @module __tests__/base/registry
 *
 * Comprehensive tests for the CollectorRegistry class.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CollectorRegistry } from '../../base/registry.js';
import type {
  Collector,
  CollectorConfig,
  CollectorResult,
  DataGovernance,
} from '@recurrsive/core';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createMockCollector(overrides: Partial<Collector> = {}): Collector {
  return {
    id: overrides.id ?? 'test-collector',
    name: overrides.name ?? 'Test Collector',
    description: overrides.description ?? 'A test collector',
    type: overrides.type ?? 'code',
    version: overrides.version ?? '1.0.0',
    initialize: overrides.initialize ?? vi.fn().mockResolvedValue(undefined),
    collect: overrides.collect ?? vi.fn().mockResolvedValue({
      entities: [],
      relationships: [],
      metadata: {
        collector_id: overrides.id ?? 'test-collector',
        collected_at: new Date().toISOString(),
        duration_ms: 100,
        items_processed: 0,
        errors: [],
      },
    } satisfies CollectorResult),
    validate: overrides.validate ?? vi.fn().mockResolvedValue({ valid: true, errors: [] }),
    dispose: overrides.dispose ?? vi.fn().mockResolvedValue(undefined),
  };
}

function createGovernance(): DataGovernance {
  return {
    masked_fields: [],
    excluded_patterns: [],
    pii_detection: false,
    audit_log: false,
    retention_days: 90,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CollectorRegistry', () => {
  let registry: CollectorRegistry;

  beforeEach(() => {
    registry = new CollectorRegistry();
  });

  // ── register ──────────────────────────────────────────────────────────

  describe('register', () => {
    it('registers a collector successfully', () => {
      const collector = createMockCollector({ id: 'git.collector' });
      registry.register(collector);

      expect(registry.get('git.collector')).toBe(collector);
      expect(registry.size).toBe(1);
    });

    it('throws when registering a collector with empty id', () => {
      const collector = createMockCollector({ id: '' });
      expect(() => registry.register(collector)).toThrow('empty id');
    });

    it('replaces existing collector with same id (logs warning)', () => {
      const collector1 = createMockCollector({ id: 'git', name: 'Git V1' });
      const collector2 = createMockCollector({ id: 'git', name: 'Git V2' });

      registry.register(collector1);
      registry.register(collector2);

      expect(registry.size).toBe(1);
      expect(registry.get('git')!.name).toBe('Git V2');
    });

    it('registers multiple different collectors', () => {
      const c1 = createMockCollector({ id: 'git', type: 'git' });
      const c2 = createMockCollector({ id: 'github', type: 'github' });
      const c3 = createMockCollector({ id: 'code.ts', type: 'code' });

      registry.register(c1);
      registry.register(c2);
      registry.register(c3);

      expect(registry.size).toBe(3);
    });
  });

  // ── unregister ────────────────────────────────────────────────────────

  describe('unregister', () => {
    it('removes a registered collector', () => {
      const collector = createMockCollector({ id: 'git' });
      registry.register(collector);
      expect(registry.size).toBe(1);

      registry.unregister('git');
      expect(registry.size).toBe(0);
      expect(registry.get('git')).toBeUndefined();
    });

    it('does not throw when unregistering unknown collector', () => {
      expect(() => registry.unregister('non-existent')).not.toThrow();
    });
  });

  // ── get ───────────────────────────────────────────────────────────────

  describe('get', () => {
    it('returns collector when found', () => {
      const collector = createMockCollector({ id: 'git' });
      registry.register(collector);

      const result = registry.get('git');
      expect(result).toBe(collector);
    });

    it('returns undefined when not found', () => {
      const result = registry.get('non-existent');
      expect(result).toBeUndefined();
    });
  });

  // ── getAll ────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns all registered collectors', () => {
      const c1 = createMockCollector({ id: 'git' });
      const c2 = createMockCollector({ id: 'github' });
      registry.register(c1);
      registry.register(c2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map((c) => c.id).sort()).toEqual(['git', 'github']);
    });

    it('returns empty array when no collectors registered', () => {
      const all = registry.getAll();
      expect(all).toEqual([]);
    });
  });

  // ── getByType ─────────────────────────────────────────────────────────

  describe('getByType', () => {
    it('returns collectors filtered by type', () => {
      const c1 = createMockCollector({ id: 'git1', type: 'git' });
      const c2 = createMockCollector({ id: 'git2', type: 'git' });
      const c3 = createMockCollector({ id: 'code1', type: 'code' });
      registry.register(c1);
      registry.register(c2);
      registry.register(c3);

      const gitCollectors = registry.getByType('git');
      expect(gitCollectors).toHaveLength(2);
      expect(gitCollectors.every((c) => c.type === 'git')).toBe(true);
    });

    it('returns empty array when no collectors match type', () => {
      const c1 = createMockCollector({ id: 'git', type: 'git' });
      registry.register(c1);

      const result = registry.getByType('github');
      expect(result).toEqual([]);
    });
  });

  // ── size ──────────────────────────────────────────────────────────────

  describe('size', () => {
    it('returns 0 for empty registry', () => {
      expect(registry.size).toBe(0);
    });

    it('returns correct count after operations', () => {
      registry.register(createMockCollector({ id: 'a' }));
      registry.register(createMockCollector({ id: 'b' }));
      expect(registry.size).toBe(2);

      registry.unregister('a');
      expect(registry.size).toBe(1);
    });
  });

  // ── collect (single) ─────────────────────────────────────────────────

  describe('collect', () => {
    it('runs a single collector by id', async () => {
      const collector = createMockCollector({ id: 'git' });
      registry.register(collector);

      const result = await registry.collect('git', createGovernance());
      expect(collector.initialize).toHaveBeenCalled();
      expect(collector.validate).toHaveBeenCalled();
      expect(collector.collect).toHaveBeenCalled();
      expect(result.metadata.collector_id).toBe('git');
    });

    it('throws when collector id is not registered', async () => {
      await expect(registry.collect('unknown', createGovernance())).rejects.toThrow(
        "not registered",
      );
    });

    it('throws when collector validation fails', async () => {
      const collector = createMockCollector({
        id: 'bad',
        validate: vi.fn().mockResolvedValue({
          valid: false,
          errors: ['Connection refused'],
        }),
      });
      registry.register(collector);

      await expect(registry.collect('bad', createGovernance())).rejects.toThrow(
        'validation failed',
      );
    });
  });

  // ── collectAll ────────────────────────────────────────────────────────

  describe('collectAll', () => {
    it('runs all registered collectors', async () => {
      const c1 = createMockCollector({ id: 'git' });
      const c2 = createMockCollector({ id: 'code' });
      registry.register(c1);
      registry.register(c2);

      const results = await registry.collectAll(createGovernance());
      expect(results).toHaveLength(2);
      expect(c1.collect).toHaveBeenCalled();
      expect(c2.collect).toHaveBeenCalled();
    });

    it('returns empty array when no collectors are registered', async () => {
      const results = await registry.collectAll(createGovernance());
      expect(results).toEqual([]);
    });

    it('continues on failure and includes error result', async () => {
      const failing = createMockCollector({
        id: 'failing',
        collect: vi.fn().mockRejectedValue(new Error('Boom!')),
      });
      const passing = createMockCollector({ id: 'passing' });
      registry.register(failing);
      registry.register(passing);

      const results = await registry.collectAll(createGovernance());
      expect(results).toHaveLength(2);

      // One should have an error
      const failResult = results.find((r) => r.metadata.errors.length > 0);
      expect(failResult).toBeDefined();
      expect(failResult!.metadata.errors[0]!.message).toContain('Boom!');

      // Other should succeed
      const passResult = results.find((r) => r.metadata.errors.length === 0);
      expect(passResult).toBeDefined();
    });
  });
});

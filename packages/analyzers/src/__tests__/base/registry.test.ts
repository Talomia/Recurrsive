/**
 * Tests for AnalyzerRegistry.
 *
 * Covers: register, get by id, list all, duplicate id throws,
 * get non-existent returns undefined, unregister, getByCategory.
 */

import { describe, it, expect, vi } from 'vitest';
import { AnalyzerRegistry } from '../../base/registry.js';
import { AnalyzerError } from '@recurrsive/core';
import type { Analyzer, AnalysisContext, Finding } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Mock analyzer factory
// ---------------------------------------------------------------------------

function makeAnalyzer(id: string, categories: string[] = ['architecture']): Analyzer {
  return {
    id,
    name: `Analyzer ${id}`,
    description: `Test analyzer ${id}`,
    version: '0.1.0',
    categories: categories as Analyzer['categories'],
    initialize: vi.fn().mockResolvedValue(undefined),
    analyze: vi.fn().mockResolvedValue([]),
    finalize: vi.fn().mockResolvedValue([]),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalyzerRegistry', () => {
  // ── Register ─────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('registers an analyzer without error', () => {
      const registry = new AnalyzerRegistry();
      const analyzer = makeAnalyzer('test-1');
      expect(() => registry.register(analyzer)).not.toThrow();
    });

    it('allows registering multiple analyzers with different ids', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('test-1'));
      registry.register(makeAnalyzer('test-2'));
      registry.register(makeAnalyzer('test-3'));
      expect(registry.getAll()).toHaveLength(3);
    });
  });

  // ── Duplicate ID throws ──────────────────────────────────────────────────

  describe('duplicate id', () => {
    it('throws AnalyzerError for duplicate analyzer id', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('duplicate'));
      expect(() => registry.register(makeAnalyzer('duplicate'))).toThrow(AnalyzerError);
    });

    it('error has DUPLICATE_ANALYZER code', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('dup-id'));

      try {
        registry.register(makeAnalyzer('dup-id'));
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(AnalyzerError);
        expect((err as AnalyzerError).code).toBe('DUPLICATE_ANALYZER');
      }
    });

    it('error message includes the analyzer id', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('my-analyzer'));

      try {
        registry.register(makeAnalyzer('my-analyzer'));
      } catch (err) {
        expect((err as Error).message).toContain('my-analyzer');
      }
    });
  });

  // ── Get by id ────────────────────────────────────────────────────────────

  describe('get()', () => {
    it('returns the registered analyzer by id', () => {
      const registry = new AnalyzerRegistry();
      const analyzer = makeAnalyzer('find-me');
      registry.register(analyzer);

      const found = registry.get('find-me');
      expect(found).toBe(analyzer);
    });

    it('returns undefined for non-existent id', () => {
      const registry = new AnalyzerRegistry();
      const found = registry.get('does-not-exist');
      expect(found).toBeUndefined();
    });

    it('returns undefined for empty registry', () => {
      const registry = new AnalyzerRegistry();
      expect(registry.get('anything')).toBeUndefined();
    });
  });

  // ── List all ─────────────────────────────────────────────────────────────

  describe('getAll()', () => {
    it('returns empty array for empty registry', () => {
      const registry = new AnalyzerRegistry();
      expect(registry.getAll()).toEqual([]);
    });

    it('returns all registered analyzers', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('a'));
      registry.register(makeAnalyzer('b'));
      registry.register(makeAnalyzer('c'));

      const all = registry.getAll();
      expect(all).toHaveLength(3);
      expect(all.map((a) => a.id)).toContain('a');
      expect(all.map((a) => a.id)).toContain('b');
      expect(all.map((a) => a.id)).toContain('c');
    });

    it('returns a new array (defensive copy)', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('x'));

      const all1 = registry.getAll();
      const all2 = registry.getAll();
      expect(all1).not.toBe(all2);
      expect(all1).toEqual(all2);
    });
  });

  // ── Unregister ───────────────────────────────────────────────────────────

  describe('unregister()', () => {
    it('removes a registered analyzer', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('remove-me'));
      registry.unregister('remove-me');

      expect(registry.get('remove-me')).toBeUndefined();
      expect(registry.getAll()).toHaveLength(0);
    });

    it('throws AnalyzerError for non-existent id', () => {
      const registry = new AnalyzerRegistry();
      expect(() => registry.unregister('nope')).toThrow(AnalyzerError);
    });

    it('error has ANALYZER_NOT_FOUND code', () => {
      const registry = new AnalyzerRegistry();
      try {
        registry.unregister('missing');
      } catch (err) {
        expect((err as AnalyzerError).code).toBe('ANALYZER_NOT_FOUND');
      }
    });
  });

  // ── getByCategory ────────────────────────────────────────────────────────

  describe('getByCategory()', () => {
    it('filters analyzers by category', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('arch-1', ['architecture']));
      registry.register(makeAnalyzer('sec-1', ['security']));
      registry.register(makeAnalyzer('perf-1', ['performance']));

      const archAnalyzers = registry.getByCategory('architecture');
      expect(archAnalyzers).toHaveLength(1);
      expect(archAnalyzers[0]!.id).toBe('arch-1');
    });

    it('returns empty array when no analyzers match', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('arch-1', ['architecture']));
      expect(registry.getByCategory('security')).toEqual([]);
    });

    it('returns analyzers that cover multiple categories', () => {
      const registry = new AnalyzerRegistry();
      registry.register(makeAnalyzer('multi', ['architecture', 'security']));

      expect(registry.getByCategory('architecture')).toHaveLength(1);
      expect(registry.getByCategory('security')).toHaveLength(1);
    });
  });

  // ── runAll ───────────────────────────────────────────────────────────────

  describe('runAll()', () => {
    function makeContext(enabled = true): AnalysisContext {
      return {
        graph: {
          getEntity: vi.fn(),
          getEntities: vi.fn(),
          getRelationships: vi.fn(),
          query: vi.fn(),
          getNeighbors: vi.fn(),
        },
        config: {
          enabled,
          severity_threshold: 'low',
          custom: {},
        },
        history: {
          getPreviousFindings: vi.fn().mockResolvedValue([]),
          getAcceptedOpportunities: vi.fn().mockResolvedValue([]),
          getRejectedOpportunities: vi.fn().mockResolvedValue([]),
        },
        project: {
          name: 'test-project',
          root_path: '/tmp/test',
          languages: ['typescript'],
          frameworks: [],
          ai_providers: [],
        },
        emit: vi.fn(),
      };
    }

    it('runs all analyzers and collects findings', async () => {
      const finding: Finding = {
        id: '00000000-0000-4000-8000-000000000001',
        analyzer_id: 'test',
        title: 'Test',
        description: 'Test',
        severity: 'medium',
        category: 'architecture',
        evidence: [],
        locations: [],
        confidence: 0.5,
        tags: [],
        created_at: new Date().toISOString(),
      };

      const analyzer = makeAnalyzer('test-1');
      (analyzer.analyze as ReturnType<typeof vi.fn>).mockResolvedValue([finding]);

      const registry = new AnalyzerRegistry();
      registry.register(analyzer);

      const ctx = makeContext();
      const findings = await registry.runAll(ctx);

      expect(findings).toContainEqual(finding);
      expect(analyzer.initialize).toHaveBeenCalledWith(ctx);
      expect(analyzer.analyze).toHaveBeenCalledWith(ctx);
      expect(analyzer.finalize).toHaveBeenCalledWith(ctx);
    });

    it('skips analyzers when config is disabled', async () => {
      const registry = new AnalyzerRegistry();
      const analyzer = makeAnalyzer('disabled-test');
      registry.register(analyzer);

      const ctx = makeContext(false);
      const findings = await registry.runAll(ctx);

      expect(findings).toEqual([]);
      expect(analyzer.analyze).not.toHaveBeenCalled();
    });
  });
});

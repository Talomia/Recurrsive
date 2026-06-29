/**
 * Tests for AnalyzerRunner.
 *
 * Covers: running all registered analyzers, collecting findings,
 * handling analyzer errors gracefully, respecting enable/disable,
 * parallel execution, timeout, and progress callbacks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzerRunner } from '../../base/runner.js';
import { AnalyzerRegistry } from '../../base/registry.js';
import { AnalyzerError } from '@recurrsive/core';
import type { Analyzer, AnalysisContext, Finding } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAnalyzer(
  id: string,
  findings: Finding[] = [],
  delay = 0,
): Analyzer {
  return {
    id,
    name: `Analyzer ${id}`,
    description: `Test analyzer ${id}`,
    version: '0.1.0',
    categories: ['architecture'],
    initialize: vi.fn().mockResolvedValue(undefined),
    analyze: vi.fn().mockImplementation(async () => {
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      return findings;
    }),
    finalize: vi.fn().mockResolvedValue([]),
  };
}

function makeFinding(id: string, analyzerId: string): Finding {
  return {
    id,
    analyzer_id: analyzerId,
    title: `Finding ${id}`,
    description: `Description ${id}`,
    severity: 'medium',
    category: 'architecture',
    evidence: [],
    locations: [],
    confidence: 0.8,
    tags: [],
    created_at: new Date().toISOString(),
  };
}

function makeContext(): AnalysisContext {
  return {
    graph: {
      getEntity: vi.fn(),
      getEntities: vi.fn(),
      getRelationships: vi.fn(),
      query: vi.fn(),
      getNeighbors: vi.fn(),
    },
    config: {
      enabled: true,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnalyzerRunner', () => {
  let registry: AnalyzerRegistry;
  let runner: AnalyzerRunner;
  let ctx: AnalysisContext;

  beforeEach(() => {
    registry = new AnalyzerRegistry();
    runner = new AnalyzerRunner(registry);
    ctx = makeContext();
  });

  // ── Runs all registered analyzers ────────────────────────────────────────

  describe('runs all analyzers', () => {
    it('runs all analyzers when passed "*"', async () => {
      const f1 = makeFinding('00000000-0000-4000-8000-000000000001', 'a1');
      const f2 = makeFinding('00000000-0000-4000-8000-000000000002', 'a2');

      registry.register(makeAnalyzer('a1', [f1]));
      registry.register(makeAnalyzer('a2', [f2]));

      const result = await runner.run('*', ctx);

      expect(result.findings).toHaveLength(2);
      expect(result.analyzers_run).toContain('a1');
      expect(result.analyzers_run).toContain('a2');
      expect(result.analyzers_failed).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('runs only specified analyzer ids', async () => {
      registry.register(makeAnalyzer('include'));
      registry.register(makeAnalyzer('exclude'));

      const result = await runner.run(['include'], ctx);

      expect(result.analyzers_run).toContain('include');
      expect(result.analyzers_run).not.toContain('exclude');
    });

    it('includes duration_ms in result', async () => {
      registry.register(makeAnalyzer('timer'));
      const result = await runner.run('*', ctx);
      expect(typeof result.duration_ms).toBe('number');
      expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Collects findings from multiple analyzers ────────────────────────────

  describe('collecting findings', () => {
    it('collects findings from analyze()', async () => {
      const finding = makeFinding('00000000-0000-4000-8000-000000000001', 'finder');
      registry.register(makeAnalyzer('finder', [finding]));

      const result = await runner.run('*', ctx);
      expect(result.findings).toContainEqual(finding);
    });

    it('collects findings from finalize()', async () => {
      const finalFinding = makeFinding('00000000-0000-4000-8000-000000000099', 'finalizer');
      const analyzer = makeAnalyzer('finalizer');
      (analyzer.finalize as ReturnType<typeof vi.fn>).mockResolvedValue([finalFinding]);

      registry.register(analyzer);
      const result = await runner.run('*', ctx);
      expect(result.findings).toContainEqual(finalFinding);
    });

    it('combines findings from both analyze and finalize', async () => {
      const analyzeFinding = makeFinding('00000000-0000-4000-8000-000000000001', 'combo');
      const finalizeFinding = makeFinding('00000000-0000-4000-8000-000000000002', 'combo');

      const analyzer = makeAnalyzer('combo', [analyzeFinding]);
      (analyzer.finalize as ReturnType<typeof vi.fn>).mockResolvedValue([finalizeFinding]);

      registry.register(analyzer);
      const result = await runner.run('*', ctx);
      expect(result.findings).toHaveLength(2);
    });
  });

  // ── Handles analyzer errors gracefully ───────────────────────────────────

  describe('error handling', () => {
    it('catches errors from individual analyzers', async () => {
      const failingAnalyzer = makeAnalyzer('failing');
      (failingAnalyzer.analyze as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Analysis failed'),
      );

      registry.register(failingAnalyzer);
      const result = await runner.run('*', ctx);

      expect(result.analyzers_failed).toContain('failing');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.analyzer_id).toBe('failing');
    });

    it('continues running other analyzers when one fails', async () => {
      const finding = makeFinding('00000000-0000-4000-8000-000000000001', 'ok');
      const failingAnalyzer = makeAnalyzer('fails');
      (failingAnalyzer.analyze as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('boom'),
      );

      registry.register(failingAnalyzer);
      registry.register(makeAnalyzer('ok', [finding]));

      const result = await runner.run('*', ctx);

      expect(result.analyzers_run).toContain('ok');
      expect(result.analyzers_failed).toContain('fails');
      expect(result.findings).toHaveLength(1);
    });

    it('throws AnalyzerError for non-existent analyzer id', async () => {
      await expect(
        runner.run(['does-not-exist'], ctx),
      ).rejects.toThrow(AnalyzerError);
    });
  });

  // ── Parallel execution ───────────────────────────────────────────────────

  describe('parallel execution', () => {
    it('runs analyzers in parallel when parallel=true', async () => {
      const f1 = makeFinding('00000000-0000-4000-8000-000000000001', 'p1');
      const f2 = makeFinding('00000000-0000-4000-8000-000000000002', 'p2');

      registry.register(makeAnalyzer('p1', [f1]));
      registry.register(makeAnalyzer('p2', [f2]));

      const result = await runner.run('*', ctx, { parallel: true });

      expect(result.findings).toHaveLength(2);
      expect(result.analyzers_run).toContain('p1');
      expect(result.analyzers_run).toContain('p2');
    });

    it('handles errors in parallel mode', async () => {
      const okFinding = makeFinding('00000000-0000-4000-8000-000000000001', 'ok');
      const failAnalyzer = makeAnalyzer('par-fail');
      (failAnalyzer.analyze as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('parallel boom'),
      );

      registry.register(failAnalyzer);
      registry.register(makeAnalyzer('par-ok', [okFinding]));

      const result = await runner.run('*', ctx, { parallel: true });

      expect(result.analyzers_run).toContain('par-ok');
      expect(result.analyzers_failed).toContain('par-fail');
    });
  });

  // ── Progress callback ────────────────────────────────────────────────────

  describe('progress callback', () => {
    it('calls on_progress for each analyzer', async () => {
      registry.register(makeAnalyzer('prog-1'));
      registry.register(makeAnalyzer('prog-2'));

      const progressFn = vi.fn();
      await runner.run('*', ctx, { on_progress: progressFn });

      // Each analyzer should get 'running' and 'completed'
      expect(progressFn).toHaveBeenCalledWith('prog-1', 'running');
      expect(progressFn).toHaveBeenCalledWith('prog-1', 'completed');
      expect(progressFn).toHaveBeenCalledWith('prog-2', 'running');
      expect(progressFn).toHaveBeenCalledWith('prog-2', 'completed');
    });

    it('calls on_progress with "failed" status on error', async () => {
      const failingAnalyzer = makeAnalyzer('fail-prog');
      (failingAnalyzer.analyze as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('boom'),
      );
      registry.register(failingAnalyzer);

      const progressFn = vi.fn();
      await runner.run('*', ctx, { on_progress: progressFn });

      expect(progressFn).toHaveBeenCalledWith('fail-prog', 'failed');
    });
  });

  // ── Timeout ──────────────────────────────────────────────────────────────

  describe('timeout', () => {
    it('times out slow analyzers', async () => {
      // Create an analyzer that takes a long time
      const slowAnalyzer = makeAnalyzer('slow', [], 5000);
      registry.register(slowAnalyzer);

      const result = await runner.run('*', ctx, { timeout_ms: 50 });

      expect(result.analyzers_failed).toContain('slow');
      expect(result.errors).toHaveLength(1);
    });
  });

  // ── Empty registry ───────────────────────────────────────────────────────

  describe('empty registry', () => {
    it('returns empty result when no analyzers registered', async () => {
      const result = await runner.run('*', ctx);

      expect(result.findings).toEqual([]);
      expect(result.errors).toEqual([]);
      expect(result.analyzers_run).toEqual([]);
      expect(result.analyzers_failed).toEqual([]);
    });
  });
});

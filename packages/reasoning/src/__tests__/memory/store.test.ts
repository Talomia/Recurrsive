/**
 * Tests for FileMemoryStore using a temporary directory.
 *
 * Covers: record/retrieve decisions, record outcomes, specialist
 * accuracy, accepted/rejected patterns, empty store defaults,
 * and file persistence round-trip.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileMemoryStore } from '../../memory/store.js';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

let tmpDir: string;
let store: FileMemoryStore;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'memory-store-test-'));
  store = new FileMemoryStore(tmpDir);
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FileMemoryStore', () => {
  // ── Empty store defaults ─────────────────────────────────────────────────

  describe('empty store', () => {
    it('returns 0 decision count', async () => {
      const count = await store.getDecisionCount();
      expect(count).toBe(0);
    });

    it('returns 0 outcome count', async () => {
      const count = await store.getOutcomeCount();
      expect(count).toBe(0);
    });

    it('returns empty accepted patterns', async () => {
      const patterns = await store.getAcceptedPatterns();
      expect(patterns).toEqual([]);
    });

    it('returns empty rejected patterns', async () => {
      const patterns = await store.getRejectedPatterns();
      expect(patterns).toEqual([]);
    });

    it('specialist accuracy returns zero for unknown role', async () => {
      const result = await store.getSpecialistAccuracy('architecture_engineer');
      expect(result).toEqual({ correct: 0, total: 0, accuracy: 0 });
    });
  });

  // ── Record and retrieve decisions ────────────────────────────────────────

  describe('record and retrieve decisions', () => {
    it('records a decision and increments count', async () => {
      await store.recordDecision('opp-1', 'accepted', 'High ROI');
      const count = await store.getDecisionCount();
      expect(count).toBe(1);
    });

    it('records multiple decisions', async () => {
      await store.recordDecision('opp-1', 'accepted');
      await store.recordDecision('opp-2', 'rejected');
      await store.recordDecision('opp-3', 'accepted');
      const count = await store.getDecisionCount();
      expect(count).toBe(3);
    });

    it('upserts decision for same opportunity ID', async () => {
      await store.recordDecision('opp-1', 'accepted', 'First reason');
      await store.recordDecision('opp-1', 'rejected', 'Changed mind');
      const count = await store.getDecisionCount();
      expect(count).toBe(1);
    });

    it('records decision with specialist role and category', async () => {
      await store.recordDecision(
        'opp-1',
        'accepted',
        'Good idea',
        'architecture_engineer',
        'architecture',
      );
      const patterns = await store.getAcceptedPatterns('architecture');
      expect(patterns).toContain('Good idea');
    });
  });

  // ── Record outcomes ──────────────────────────────────────────────────────

  describe('record outcomes', () => {
    it('records an outcome and increments count', async () => {
      await store.recordOutcome('opp-1', { success: true, metric: 'improved' });
      const count = await store.getOutcomeCount();
      expect(count).toBe(1);
    });

    it('upserts outcome for same opportunity ID', async () => {
      await store.recordOutcome('opp-1', { success: true });
      await store.recordOutcome('opp-1', { success: false });
      const count = await store.getOutcomeCount();
      expect(count).toBe(1);
    });

    it('records outcome with specialist role', async () => {
      await store.recordOutcome('opp-1', { success: true }, 'security_engineer');
      const accuracy = await store.getSpecialistAccuracy('security_engineer');
      expect(accuracy.total).toBe(1);
    });

    it('determines success from outcome.success field', async () => {
      await store.recordOutcome('opp-1', { success: true }, 'performance_engineer');
      const accuracy = await store.getSpecialistAccuracy('performance_engineer');
      expect(accuracy.correct).toBe(1);
    });

    it('determines success from outcome.status field', async () => {
      await store.recordOutcome('opp-1', { status: 'success' }, 'cost_optimizer');
      const accuracy = await store.getSpecialistAccuracy('cost_optimizer');
      expect(accuracy.correct).toBe(1);
    });

    it('determines success from outcome.validated field', async () => {
      await store.recordOutcome('opp-1', { validated: true }, 'sre');
      const accuracy = await store.getSpecialistAccuracy('sre');
      expect(accuracy.correct).toBe(1);
    });

    it('treats outcome without success/status/validated as unsuccessful', async () => {
      await store.recordOutcome('opp-1', { metric: 'unchanged' }, 'qa_engineer');
      const accuracy = await store.getSpecialistAccuracy('qa_engineer');
      expect(accuracy.correct).toBe(0);
    });
  });

  // ── Specialist accuracy calculation ──────────────────────────────────────

  describe('specialist accuracy', () => {
    it('calculates accuracy as correct/total', async () => {
      const role = 'architecture_engineer' as const;
      await store.recordDecision('opp-1', 'accepted', undefined, role);
      await store.recordDecision('opp-2', 'accepted', undefined, role);
      await store.recordDecision('opp-3', 'accepted', undefined, role);

      await store.recordOutcome('opp-1', { success: true }, role);
      await store.recordOutcome('opp-2', { success: true }, role);
      await store.recordOutcome('opp-3', { success: false }, role);

      const accuracy = await store.getSpecialistAccuracy(role);
      expect(accuracy.total).toBe(3);
      expect(accuracy.correct).toBe(2); // accepted + success
      expect(accuracy.accuracy).toBeCloseTo(2 / 3, 5);
    });

    it('counts rejected + unsuccessful as correct (right to reject)', async () => {
      const role = 'security_engineer' as const;
      await store.recordDecision('opp-1', 'rejected', 'Low value', role);
      await store.recordOutcome('opp-1', { success: false }, role);

      const accuracy = await store.getSpecialistAccuracy(role);
      expect(accuracy.correct).toBe(1);
      expect(accuracy.accuracy).toBe(1);
    });

    it('counts accepted + failure as incorrect', async () => {
      const role = 'cost_optimizer' as const;
      await store.recordDecision('opp-1', 'accepted', undefined, role);
      await store.recordOutcome('opp-1', { success: false }, role);

      const accuracy = await store.getSpecialistAccuracy(role);
      expect(accuracy.correct).toBe(0);
      expect(accuracy.accuracy).toBe(0);
    });

    it('returns 0 accuracy for role with no outcomes', async () => {
      const accuracy = await store.getSpecialistAccuracy('product_manager');
      expect(accuracy).toEqual({ correct: 0, total: 0, accuracy: 0 });
    });
  });

  // ── Accepted/rejected patterns ───────────────────────────────────────────

  describe('accepted/rejected patterns', () => {
    it('returns reasons from accepted decisions', async () => {
      await store.recordDecision('opp-1', 'accepted', 'High impact');
      await store.recordDecision('opp-2', 'accepted', 'Quick win');
      await store.recordDecision('opp-3', 'rejected', 'Too risky');

      const patterns = await store.getAcceptedPatterns();
      expect(patterns).toContain('High impact');
      expect(patterns).toContain('Quick win');
      expect(patterns).not.toContain('Too risky');
    });

    it('returns reasons from rejected decisions', async () => {
      await store.recordDecision('opp-1', 'rejected', 'Too complex');
      await store.recordDecision('opp-2', 'accepted', 'Easy');

      const patterns = await store.getRejectedPatterns();
      expect(patterns).toContain('Too complex');
      expect(patterns).not.toContain('Easy');
    });

    it('filters by category', async () => {
      await store.recordDecision('opp-1', 'accepted', 'Arch win', undefined, 'architecture');
      await store.recordDecision('opp-2', 'accepted', 'Perf win', undefined, 'performance');

      const archPatterns = await store.getAcceptedPatterns('architecture');
      expect(archPatterns).toContain('Arch win');
      expect(archPatterns).not.toContain('Perf win');
    });

    it('deduplicates identical reasons', async () => {
      await store.recordDecision('opp-1', 'accepted', 'Same reason');
      await store.recordDecision('opp-2', 'accepted', 'Same reason');

      const patterns = await store.getAcceptedPatterns();
      expect(patterns.filter((p) => p === 'Same reason')).toHaveLength(1);
    });

    it('generates default pattern text when reason is missing', async () => {
      await store.recordDecision('opp-1', 'accepted');
      const patterns = await store.getAcceptedPatterns();
      expect(patterns).toHaveLength(1);
      expect(patterns[0]).toContain('opp-1');
    });
  });

  // ── File persistence round-trip ──────────────────────────────────────────

  describe('file persistence', () => {
    it('data survives across separate FileMemoryStore instances', async () => {
      // Write with first instance
      const store1 = new FileMemoryStore(tmpDir);
      await store1.recordDecision('opp-1', 'accepted', 'Persisted');
      await store1.recordOutcome('opp-1', { success: true }, 'architecture_engineer');

      // Read with a completely new instance (cleared cache)
      const store2 = new FileMemoryStore(tmpDir);
      const count = await store2.getDecisionCount();
      expect(count).toBe(1);

      const patterns = await store2.getAcceptedPatterns();
      expect(patterns).toContain('Persisted');

      const accuracy = await store2.getSpecialistAccuracy('architecture_engineer');
      expect(accuracy.total).toBe(1);
    });

    it('creates the JSON file on disk', async () => {
      await store.recordDecision('opp-1', 'accepted');

      const filePath = path.join(tmpDir, 'reasoning_memory.json');
      const stat = await fs.stat(filePath);
      expect(stat.isFile()).toBe(true);
    });

    it('stores valid JSON', async () => {
      await store.recordDecision('opp-1', 'accepted', 'Reason');

      const filePath = path.join(tmpDir, 'reasoning_memory.json');
      const raw = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);

      expect(parsed.version).toBe('1');
      expect(parsed.decisions).toHaveLength(1);
      expect(parsed.decisions[0].decision).toBe('accepted');
      expect(parsed.updated_at).toBeDefined();
    });

    it('creates directory if it does not exist', async () => {
      const nestedDir = path.join(tmpDir, 'nested', 'deep', 'memory');
      const nestedStore = new FileMemoryStore(nestedDir);
      await nestedStore.recordDecision('opp-1', 'accepted');

      const count = await nestedStore.getDecisionCount();
      expect(count).toBe(1);
    });

    it('handles corrupt file gracefully by initializing empty', async () => {
      // Write corrupt data to the file
      const filePath = path.join(tmpDir, 'reasoning_memory.json');
      await fs.writeFile(filePath, '{broken json!!!', 'utf-8');

      // New instance should handle the corrupt file gracefully
      const freshStore = new FileMemoryStore(tmpDir);
      const count = await freshStore.getDecisionCount();
      expect(count).toBe(0);
    });

    it('backs up a corrupt file before it can be overwritten', async () => {
      const filePath = path.join(tmpDir, 'reasoning_memory.json');
      await fs.writeFile(filePath, '{broken json!!!', 'utf-8');

      const freshStore = new FileMemoryStore(tmpDir);
      // Trigger load + save, which previously overwrote the corrupt file,
      // permanently destroying whatever history it contained.
      await freshStore.recordDecision('opp-1', 'accepted');

      const files = await fs.readdir(tmpDir);
      const backup = files.find((f) => f.startsWith('reasoning_memory.json.corrupt-'));
      expect(backup).toBeDefined();
      const backedUp = await fs.readFile(path.join(tmpDir, backup!), 'utf-8');
      expect(backedUp).toBe('{broken json!!!');
    });
  });
});

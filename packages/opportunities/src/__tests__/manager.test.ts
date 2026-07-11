/**
 * Tests for OpportunityManager.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Opportunity } from '@recurrsive/core';
import { OpportunityManager } from '../manager.js';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Create a minimal valid Opportunity for manager tests.
 * Note: manager.create() generates id + timestamps automatically,
 * but we need full objects for pre-seeding and import tests.
 */
function makeOpp(overrides: Partial<{
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  status: string;
  confidence: number;
  t_shirt: string;
}> = {}): Opportunity {
  const {
    id = crypto.randomUUID(),
    title = 'Test Opportunity',
    severity = 'medium',
    category = 'performance',
    status = 'proposed',
    confidence = 0.8,
    t_shirt = 'm',
  } = overrides;

  return {
    id,
    title,
    type: 'opportunity',
    category,
    severity,
    problem: 'Test problem',
    evidence: [{
      id: crypto.randomUUID(),
      type: 'code',
      source: 'test',
      description: 'Evidence',
      entity_ids: [],
      collected_at: '2026-01-01T00:00:00.000Z',
      confidence: 0.9,
    }],
    recommendation: 'Fix it',
    expected_impact: {
      summary: 'Some impact',
      metrics: [{ name: 'latency', current_value: 100, expected_value: 50, change_percent: -50, direction: 'decrease' }],
      affected_services: ['svc-a'],
    },
    confidence,
    effort: {
      t_shirt,
      estimated_hours: 8,
      skills_required: ['typescript'],
      dependencies: [],
    },
    risk: {
      level: 'low',
      description: 'Low risk',
      mitigations: ['review'],
    },
    validation: {
      steps: [{ description: 'Run tests', type: 'automated_test' }],
      success_criteria: ['All tests pass'],
    },
    rollback: {
      strategy: 'manual',
      steps: ['Revert PR'],
    },
    reasoning: {
      proposer: 'agent-1',
      supporters: ['agent-2'],
      dissenters: [],
      consensus_score: 0.9,
    },
    locations: [{ file: 'src/index.ts', start_line: 10, end_line: 20 }],
    related: [],
    status,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  } as unknown as Opportunity;
}

/** Create data suitable for manager.create() (without id/timestamps). */
function makeCreateData(overrides: Record<string, unknown> = {}) {
  const full = makeOpp(overrides as any);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, updated_at: _ua, ...data } = full;
  return data;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpportunityManager', () => {
  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  describe('constructor', () => {
    it('creates an empty manager', () => {
      const mgr = new OpportunityManager();
      expect(mgr.count).toBe(0);
    });

    it('creates a manager with initial opportunities', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);
      expect(mgr.count).toBe(1);
      expect(mgr.get(opp.id)).toEqual(opp);
    });
  });

  // -----------------------------------------------------------------------
  // create
  // -----------------------------------------------------------------------

  describe('create', () => {
    it('creates an opportunity with auto-generated UUID', () => {
      const mgr = new OpportunityManager();
      const data = makeCreateData();
      const opp = mgr.create(data as any);

      expect(opp.id).toBeTruthy();
      // UUID v4 format check
      expect(opp.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it('sets created_at and updated_at timestamps', () => {
      const mgr = new OpportunityManager();
      const data = makeCreateData();
      const before = new Date().toISOString();
      const opp = mgr.create(data as any);
      const after = new Date().toISOString();

      expect(opp.created_at).toBeTruthy();
      expect(opp.updated_at).toBeTruthy();
      expect(opp.created_at >= before).toBe(true);
      expect(opp.created_at <= after).toBe(true);
    });

    it('stores the opportunity in the manager', () => {
      const mgr = new OpportunityManager();
      const data = makeCreateData();
      const opp = mgr.create(data as any);

      expect(mgr.get(opp.id)).toBeDefined();
      expect(mgr.count).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // get
  // -----------------------------------------------------------------------

  describe('get', () => {
    it('returns the opportunity by id', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);
      expect(mgr.get(opp.id)).toEqual(opp);
    });

    it('returns undefined for unknown id', () => {
      const mgr = new OpportunityManager();
      expect(mgr.get('nonexistent')).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // list with filters
  // -----------------------------------------------------------------------

  describe('list', () => {
    it('returns all opportunities when no filters specified', () => {
      const opps = [makeOpp({ id: crypto.randomUUID() }), makeOpp({ id: crypto.randomUUID() })];
      const mgr = new OpportunityManager(opps);
      const results = mgr.list();
      expect(results).toHaveLength(2);
    });

    it('filters by category', () => {
      const opps = [
        makeOpp({ id: crypto.randomUUID(), category: 'security' }),
        makeOpp({ id: crypto.randomUUID(), category: 'performance' }),
      ];
      const mgr = new OpportunityManager(opps);
      const results = mgr.list({ category: 'security' as any });
      expect(results).toHaveLength(1);
      expect(results[0]!.category).toBe('security');
    });

    it('filters by status', () => {
      const opps = [
        makeOpp({ id: crypto.randomUUID(), status: 'proposed' }),
        makeOpp({ id: crypto.randomUUID(), status: 'accepted' }),
      ];
      const mgr = new OpportunityManager(opps);
      const results = mgr.list({ status: 'accepted' as any });
      expect(results).toHaveLength(1);
      expect(results[0]!.status).toBe('accepted');
    });

    it('filters by severity', () => {
      const opps = [
        makeOpp({ id: crypto.randomUUID(), severity: 'critical' }),
        makeOpp({ id: crypto.randomUUID(), severity: 'low' }),
      ];
      const mgr = new OpportunityManager(opps);
      const results = mgr.list({ severity: 'critical' });
      expect(results).toHaveLength(1);
      expect(results[0]!.severity).toBe('critical');
    });

    it('filters by minConfidence', () => {
      const opps = [
        makeOpp({ id: crypto.randomUUID(), confidence: 0.9 }),
        makeOpp({ id: crypto.randomUUID(), confidence: 0.3 }),
      ];
      const mgr = new OpportunityManager(opps);
      const results = mgr.list({ minConfidence: 0.5 });
      expect(results).toHaveLength(1);
      expect(results[0]!.confidence).toBeGreaterThanOrEqual(0.5);
    });

    it('applies multiple filters together', () => {
      const opps = [
        makeOpp({ id: crypto.randomUUID(), category: 'security', severity: 'critical' }),
        makeOpp({ id: crypto.randomUUID(), category: 'security', severity: 'low' }),
        makeOpp({ id: crypto.randomUUID(), category: 'performance', severity: 'critical' }),
      ];
      const mgr = new OpportunityManager(opps);
      const results = mgr.list({ category: 'security' as any, severity: 'critical' });
      expect(results).toHaveLength(1);
    });

    it('returns results sorted by composite score (descending)', () => {
      const low = makeOpp({ id: crypto.randomUUID(), severity: 'low', confidence: 0.3 });
      const high = makeOpp({ id: crypto.randomUUID(), severity: 'critical', confidence: 0.9 });
      const mgr = new OpportunityManager([low, high]);
      const results = mgr.list();
      expect(results[0]!.id).toBe(high.id);
    });
  });

  // -----------------------------------------------------------------------
  // updateStatus
  // -----------------------------------------------------------------------

  describe('updateStatus', () => {
    it('transitions status and updates timestamp', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);

      const updated = mgr.updateStatus(opp.id, 'accepted');
      expect(updated.status).toBe('accepted');
      expect(updated.updated_at > opp.updated_at).toBe(true);
    });

    it('stores the reason when provided', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);

      const updated = mgr.updateStatus(opp.id, 'rejected', 'Too risky');
      expect(updated.decision_reason).toBe('Too risky');
    });

    it('sets implemented_at when status becomes implemented', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);

      // Walk through the valid transition chain: proposed → accepted → in_progress → implemented
      mgr.updateStatus(opp.id, 'accepted');
      mgr.updateStatus(opp.id, 'in_progress');
      const updated = mgr.updateStatus(opp.id, 'implemented');
      expect(updated.implemented_at).toBeTruthy();
    });

    it('sets validated_at when status becomes validated', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);

      // Walk through the valid transition chain: proposed → accepted → in_progress → implemented → validated
      mgr.updateStatus(opp.id, 'accepted');
      mgr.updateStatus(opp.id, 'in_progress');
      mgr.updateStatus(opp.id, 'implemented');
      const updated = mgr.updateStatus(opp.id, 'validated');
      expect(updated.validated_at).toBeTruthy();
    });

    it('throws when opportunity is not found', () => {
      const mgr = new OpportunityManager();
      expect(() => mgr.updateStatus('nonexistent', 'accepted')).toThrow('Opportunity not found');
    });
  });

  // -----------------------------------------------------------------------
  // getTopN
  // -----------------------------------------------------------------------

  describe('getTopN', () => {
    it('returns the top N opportunities by score', () => {
      const opps = [
        makeOpp({ id: crypto.randomUUID(), severity: 'low', confidence: 0.2 }),
        makeOpp({ id: crypto.randomUUID(), severity: 'critical', confidence: 0.95 }),
        makeOpp({ id: crypto.randomUUID(), severity: 'high', confidence: 0.7 }),
      ];
      const mgr = new OpportunityManager(opps);
      const top = mgr.getTopN(2);

      expect(top).toHaveLength(2);
      // The first result should be the highest-scored
      expect(top[0]!.severity).toBe('critical');
    });

    it('returns all if N exceeds total count', () => {
      const opps = [makeOpp({ id: crypto.randomUUID() })];
      const mgr = new OpportunityManager(opps);
      const top = mgr.getTopN(100);
      expect(top).toHaveLength(1);
    });

    it('returns empty array when manager is empty', () => {
      const mgr = new OpportunityManager();
      expect(mgr.getTopN(5)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // save / load round-trip
  // -----------------------------------------------------------------------

  describe('save / load round-trip', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'opp-manager-test-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('saves and loads opportunities preserving data', async () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);

      const filePath = join(tmpDir, 'opportunities.json');
      await mgr.save(filePath);

      // Verify file was written
      const raw = await readFile(filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);

      // Load into a new manager
      const mgr2 = new OpportunityManager();
      const result = await mgr2.load(filePath);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mgr2.count).toBe(1);
      expect(mgr2.get(opp.id)?.title).toBe(opp.title);
    });

    it('load replaces existing store contents', async () => {
      const opp1 = makeOpp({ id: crypto.randomUUID(), title: 'First' });
      const opp2 = makeOpp({ id: crypto.randomUUID(), title: 'Second' });

      const mgr1 = new OpportunityManager([opp1]);
      const filePath = join(tmpDir, 'data.json');
      await mgr1.save(filePath);

      const mgr2 = new OpportunityManager([opp2]);
      expect(mgr2.count).toBe(1);

      await mgr2.load(filePath);
      expect(mgr2.count).toBe(1);
      expect(mgr2.get(opp1.id)).toBeDefined();
      expect(mgr2.get(opp2.id)).toBeUndefined();
    });

    it('save creates directories if they do not exist', async () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);

      const filePath = join(tmpDir, 'nested', 'deep', 'data.json');
      await mgr.save(filePath);

      const raw = await readFile(filePath, 'utf-8');
      expect(JSON.parse(raw)).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // export
  // -----------------------------------------------------------------------

  describe('export', () => {
    it('exports to JSON format', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);
      const json = mgr.export('json');

      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe(opp.id);
    });

    it('exports to markdown format', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);
      const md = mgr.export('markdown');

      expect(md).toContain('# Recurrsive Opportunity Report');
      expect(md).toContain(opp.title);
    });

    it('exports to SARIF format', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);
      const sarif = mgr.export('sarif');

      const parsed = JSON.parse(sarif);
      expect(parsed.$schema).toBeTruthy();
      expect(parsed.version).toBe('2.1.0');
      expect(parsed.runs).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // import
  // -----------------------------------------------------------------------

  describe('import', () => {
    it('imports valid opportunity data', () => {
      const mgr = new OpportunityManager();
      const opp = makeOpp();
      const result = mgr.import([opp]);

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(0);
      expect(mgr.count).toBe(1);
    });

    it('skips invalid data and records errors', () => {
      const mgr = new OpportunityManager();
      const result = mgr.import([{ bad: 'data' }]);

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // getScore
  // -----------------------------------------------------------------------

  describe('getScore', () => {
    it('returns a score for a known opportunity', () => {
      const opp = makeOpp();
      const mgr = new OpportunityManager([opp]);
      const score = mgr.getScore(opp.id);

      expect(score).toBeDefined();
      expect(typeof score).toBe('number');
      expect(score!).toBeGreaterThanOrEqual(0);
      expect(score!).toBeLessThanOrEqual(1);
    });

    it('returns undefined for unknown id', () => {
      const mgr = new OpportunityManager();
      expect(mgr.getScore('nonexistent')).toBeUndefined();
    });
  });
});

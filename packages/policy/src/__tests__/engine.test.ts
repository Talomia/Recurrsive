/**
 * Tests for the PolicyEngine class.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Opportunity, PolicySet, PolicyRule } from '@recurrsive/core';
import { PolicyEngine } from '../engine.js';
import type { PolicyResult } from '../engine.js';

// ---------------------------------------------------------------------------
// Mock fs so loadFromDirectory doesn't touch the real filesystem
// ---------------------------------------------------------------------------

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
}));

import { readdir, readFile } from 'node:fs/promises';
const mockReaddir = vi.mocked(readdir);
const mockReadFile = vi.mocked(readFile);

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/** Create a minimal valid PolicyRule. */
function makeRule(overrides: Partial<PolicyRule> = {}): PolicyRule {
  return {
    id: 'test-rule-001',
    name: 'Test Rule',
    description: 'A test rule',
    scope: 'global',
    condition: 'severity == "critical"',
    action: 'block',
    message: 'Blocked due to critical severity',
    metadata: {},
    ...overrides,
  };
}

/** Create a minimal valid PolicySet. */
function makePolicySet(overrides: Partial<PolicySet> = {}): PolicySet {
  return {
    id: 'test-policy',
    name: 'Test Policy',
    description: 'A test policy set',
    enabled: true,
    rules: [makeRule()],
    ...overrides,
  };
}

/** Create a minimal Opportunity-like object for evaluation. */
function makeOpportunity(overrides: Record<string, unknown> = {}): Opportunity {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    title: 'Test Opportunity',
    type: 'opportunity',
    category: 'security',
    severity: 'medium',
    problem: 'Test problem',
    evidence: [],
    recommendation: 'Fix it',
    expected_impact: {
      summary: 'Some impact',
      metrics: [],
      affected_services: [],
    },
    confidence: 0.8,
    effort: {
      t_shirt: 'm',
      skills_required: [],
      dependencies: [],
    },
    risk: {
      level: 'low',
      description: 'Low risk',
      mitigations: [],
    },
    validation: {
      steps: [],
      success_criteria: [],
    },
    rollback: {
      strategy: 'manual',
      steps: [],
    },
    reasoning: {
      proposer: 'agent-1',
      supporters: [],
      dissenters: [],
      consensus_score: 0.9,
    },
    locations: [],
    related: [],
    status: 'proposed',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as unknown as Opportunity;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PolicyEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Constructor
  // -----------------------------------------------------------------------

  describe('constructor', () => {
    it('creates an engine with no initial policies', () => {
      const engine = new PolicyEngine();
      expect(engine.getPolicies()).toHaveLength(0);
    });

    it('creates an engine with initial policy sets', () => {
      const ps = makePolicySet();
      const engine = new PolicyEngine([ps]);
      expect(engine.getPolicies()).toHaveLength(1);
      expect(engine.getPolicySet('test-policy')).toEqual(ps);
    });
  });

  // -----------------------------------------------------------------------
  // addPolicySet / removePolicySet / getPolicies / getPolicySet
  // -----------------------------------------------------------------------

  describe('addPolicySet / removePolicySet', () => {
    it('adds a policy set and retrieves it', () => {
      const engine = new PolicyEngine();
      const ps = makePolicySet({ id: 'added' });
      engine.addPolicySet(ps);
      expect(engine.getPolicySet('added')).toBe(ps);
    });

    it('removes a policy set by id', () => {
      const engine = new PolicyEngine([makePolicySet({ id: 'to-remove' })]);
      expect(engine.removePolicySet('to-remove')).toBe(true);
      expect(engine.getPolicySet('to-remove')).toBeUndefined();
    });

    it('returns false when removing a non-existent policy set', () => {
      const engine = new PolicyEngine();
      expect(engine.removePolicySet('nonexistent')).toBe(false);
    });

    it('overwrites an existing policy set with the same id', () => {
      const engine = new PolicyEngine();
      const ps1 = makePolicySet({ id: 'dup', name: 'First' });
      const ps2 = makePolicySet({ id: 'dup', name: 'Second' });
      engine.addPolicySet(ps1);
      engine.addPolicySet(ps2);
      expect(engine.getPolicySet('dup')?.name).toBe('Second');
      expect(engine.getPolicies()).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // loadFromDirectory
  // -----------------------------------------------------------------------

  describe('loadFromDirectory', () => {
    it('loads valid policy JSON files from a directory', async () => {
      mockReaddir.mockResolvedValue(['policy1.json', 'policy2.json'] as any);

      const ps1 = makePolicySet({ id: 'p1', name: 'Policy 1' });
      const ps2 = makePolicySet({ id: 'p2', name: 'Policy 2' });

      mockReadFile
        .mockResolvedValueOnce(JSON.stringify(ps1) as any)
        .mockResolvedValueOnce(JSON.stringify(ps2) as any);

      const engine = new PolicyEngine();
      const result = await engine.loadFromDirectory('/fake/dir');

      expect(result.loaded).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(engine.getPolicies()).toHaveLength(2);
    });

    it('skips non-JSON files', async () => {
      mockReaddir.mockResolvedValue(['readme.md', 'policy.json', 'notes.txt'] as any);

      const ps = makePolicySet({ id: 'p1' });
      mockReadFile.mockResolvedValueOnce(JSON.stringify(ps) as any);

      const engine = new PolicyEngine();
      const result = await engine.loadFromDirectory('/fake/dir');

      expect(result.loaded).toBe(1);
      // readFile only called once (for the json file)
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('skips and reports files with missing required fields', async () => {
      mockReaddir.mockResolvedValue(['bad.json'] as any);
      mockReadFile.mockResolvedValueOnce(JSON.stringify({ id: 'x' }) as any); // missing name, rules

      const engine = new PolicyEngine();
      const result = await engine.loadFromDirectory('/fake/dir');

      expect(result.loaded).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toContain('Invalid policy set');
    });

    it('rejects (fails closed on) a policy set missing "enabled"', async () => {
      mockReaddir.mockResolvedValue(['no-enabled.json'] as any);
      const { enabled: _enabled, ...withoutEnabled } = makePolicySet();
      mockReadFile.mockResolvedValueOnce(JSON.stringify(withoutEnabled) as any);

      const engine = new PolicyEngine();
      const result = await engine.loadFromDirectory('/fake/dir');

      expect(result.loaded).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toContain('Invalid policy set');
      expect(result.errors[0]).toContain('enabled');
      expect(engine.getPolicies()).toHaveLength(0);
    });

    it('rejects (fails closed on) a rule with an invalid action enum', async () => {
      mockReaddir.mockResolvedValue(['bad-action.json'] as any);
      const ps = makePolicySet({
        rules: [makeRule({ action: 'blok' as any })], // typo'd action
      });
      mockReadFile.mockResolvedValueOnce(JSON.stringify(ps) as any);

      const engine = new PolicyEngine();
      const result = await engine.loadFromDirectory('/fake/dir');

      expect(result.loaded).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors[0]).toContain('Invalid policy set');
      expect(engine.getPolicies()).toHaveLength(0);
    });

    it('skips and reports files with invalid JSON', async () => {
      mockReaddir.mockResolvedValue(['corrupt.json'] as any);
      mockReadFile.mockResolvedValueOnce('{not valid json' as any);

      const engine = new PolicyEngine();
      const result = await engine.loadFromDirectory('/fake/dir');

      expect(result.loaded).toBe(0);
      expect(result.skipped).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('throws when directory cannot be read', async () => {
      mockReaddir.mockRejectedValue(new Error('ENOENT'));

      const engine = new PolicyEngine();
      await expect(engine.loadFromDirectory('/nonexistent')).rejects.toThrow(
        'Failed to read policy directory',
      );
    });
  });

  // -----------------------------------------------------------------------
  // evaluate
  // -----------------------------------------------------------------------

  describe('evaluate', () => {
    it('returns evaluations for all enabled policy rules', () => {
      const rule1 = makeRule({ id: 'r1', condition: 'severity == "critical"', action: 'block' });
      const rule2 = makeRule({ id: 'r2', condition: 'severity == "medium"', action: 'warn' });
      const ps = makePolicySet({ rules: [rule1, rule2] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ severity: 'medium' });
      const evals = engine.evaluate(opp);

      expect(evals).toHaveLength(2);
      // r1 condition doesn't match → passes
      const ev1 = evals.find((e) => e.rule_id === 'r1');
      expect(ev1?.passed).toBe(true);
      expect(ev1?.action).toBe('allow');

      // r2 condition matches with warn action → doesn't pass
      const ev2 = evals.find((e) => e.rule_id === 'r2');
      expect(ev2?.passed).toBe(false);
      expect(ev2?.action).toBe('warn');
    });

    it('skips disabled policy sets', () => {
      const ps = makePolicySet({ enabled: false });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ severity: 'critical' });
      const evals = engine.evaluate(opp);

      expect(evals).toHaveLength(0);
    });

    it('evaluates rules from multiple policy sets', () => {
      const ps1 = makePolicySet({ id: 'ps1', rules: [makeRule({ id: 'r1' })] });
      const ps2 = makePolicySet({ id: 'ps2', rules: [makeRule({ id: 'r2', condition: 'severity == "low"', action: 'warn' })] });
      const engine = new PolicyEngine([ps1, ps2]);

      const opp = makeOpportunity({ severity: 'critical' });
      const evals = engine.evaluate(opp);

      expect(evals).toHaveLength(2);
    });

    it('treats evaluation errors as block failures', () => {
      // Invalid condition expression will cause evaluateCondition to throw
      const rule = makeRule({ condition: '(((' });
      const ps = makePolicySet({ rules: [rule] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity();
      const evals = engine.evaluate(opp);

      expect(evals).toHaveLength(1);
      expect(evals[0]!.passed).toBe(false);
      expect(evals[0]!.action).toBe('block');
      expect(evals[0]!.message).toContain('Error evaluating rule');
    });
  });

  // -----------------------------------------------------------------------
  // passes
  // -----------------------------------------------------------------------

  describe('passes', () => {
    it('returns passed=true when no rules produce a block action', () => {
      const rule = makeRule({
        condition: 'severity == "critical"',
        action: 'block',
      });
      const ps = makePolicySet({ rules: [rule] });
      const engine = new PolicyEngine([ps]);

      // severity is medium → condition doesn't match → rule doesn't fire → passes
      const opp = makeOpportunity({ severity: 'medium' });
      const result = engine.passes(opp);

      expect(result.passed).toBe(true);
      expect(result.effectiveAction).toBe('allow');
      expect(result.violations).toHaveLength(0);
    });

    it('returns passed=false when a rule produces a block action', () => {
      const rule = makeRule({
        condition: 'severity == "critical"',
        action: 'block',
      });
      const ps = makePolicySet({ rules: [rule] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ severity: 'critical' });
      const result = engine.passes(opp);

      expect(result.passed).toBe(false);
      expect(result.effectiveAction).toBe('block');
      expect(result.violations).toHaveLength(1);
    });

    it('collects warnings separately from violations', () => {
      const blockRule = makeRule({
        id: 'block-rule',
        condition: 'severity == "critical"',
        action: 'block',
      });
      const warnRule = makeRule({
        id: 'warn-rule',
        condition: 'category == "security"',
        action: 'warn',
      });
      const ps = makePolicySet({ rules: [blockRule, warnRule] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ severity: 'critical', category: 'security' });
      const result = engine.passes(opp);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]!.rule_id).toBe('block-rule');
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]!.rule_id).toBe('warn-rule');
    });

    it('block action takes precedence over warn', () => {
      const warnRule = makeRule({
        id: 'warn-rule',
        condition: 'severity == "critical"',
        action: 'warn',
      });
      const blockRule = makeRule({
        id: 'block-rule',
        condition: 'severity == "critical"',
        action: 'block',
      });
      const ps = makePolicySet({ rules: [warnRule, blockRule] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ severity: 'critical' });
      const result = engine.passes(opp);

      expect(result.passed).toBe(false);
      expect(result.effectiveAction).toBe('block');
    });

    it('require_approval is more restrictive than warn but less than block', () => {
      const warnRule = makeRule({
        id: 'warn-rule',
        condition: 'severity == "high"',
        action: 'warn',
      });
      const approvalRule = makeRule({
        id: 'approval-rule',
        condition: 'severity == "high"',
        action: 'require_approval',
      });
      const ps = makePolicySet({ rules: [warnRule, approvalRule] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ severity: 'high' });
      const result = engine.passes(opp);

      // require_approval is a violation → NOT compliant (an item awaiting
      // approval must not be counted as passing), but it is less restrictive
      // than block, so the three-state verdict is 'needs_approval'.
      expect(result.passed).toBe(false);
      expect(result.compliance).toBe('needs_approval');
      expect(result.effectiveAction).toBe('require_approval');
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]!.rule_id).toBe('approval-rule');
    });

    it('includes the opportunityId in the result', () => {
      const engine = new PolicyEngine();
      const opp = makeOpportunity();
      const result = engine.passes(opp);
      expect(result.opportunityId).toBe(opp.id);
    });

    it('returns all evaluations in the result', () => {
      const rule1 = makeRule({ id: 'r1', condition: 'severity == "critical"', action: 'block' });
      const rule2 = makeRule({ id: 'r2', condition: 'severity == "medium"', action: 'warn' });
      const ps = makePolicySet({ rules: [rule1, rule2] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ severity: 'medium' });
      const result = engine.passes(opp);

      expect(result.evaluations).toHaveLength(2);
    });

    it('passes when no policies are loaded', () => {
      const engine = new PolicyEngine();
      const opp = makeOpportunity({ severity: 'critical' });
      const result = engine.passes(opp);

      expect(result.passed).toBe(true);
      expect(result.effectiveAction).toBe('allow');
      expect(result.evaluations).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Rules with conditions that match/don't match
  // -----------------------------------------------------------------------

  describe('rule condition matching', () => {
    it('rule with allow action that matches sets passed=true', () => {
      const rule = makeRule({
        condition: 'confidence >= 0.85',
        action: 'allow',
      });
      const ps = makePolicySet({ rules: [rule] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ confidence: 0.9 });
      const evals = engine.evaluate(opp);

      expect(evals[0]!.passed).toBe(true);
      expect(evals[0]!.action).toBe('allow');
    });

    it('rule condition with dotted path resolves correctly', () => {
      const rule = makeRule({
        condition: 'risk.level == "critical"',
        action: 'require_approval',
      });
      const ps = makePolicySet({ rules: [rule] });
      const engine = new PolicyEngine([ps]);

      const opp = makeOpportunity({ risk: { level: 'critical', description: 'test', mitigations: [] } });
      const evals = engine.evaluate(opp);

      expect(evals[0]!.passed).toBe(false);
      expect(evals[0]!.action).toBe('require_approval');
    });
  });
});

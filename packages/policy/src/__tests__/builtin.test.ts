/**
 * Tests for built-in policy sets.
 */

import { describe, it, expect } from 'vitest';
import {
  securityBaseline,
  changeManagement,
  costGovernance,
  compliance,
  qualityGates,
  BUILTIN_POLICIES,
  getBuiltinPolicySet,
} from '../builtin.js';
import { evaluateCondition } from '../evaluator.js';
import type { PolicySet, PolicyRule } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// All 5 policy sets load
// ---------------------------------------------------------------------------

describe('built-in policy sets', () => {
  describe('BUILTIN_POLICIES aggregate', () => {
    it('contains exactly 5 policy sets', () => {
      expect(BUILTIN_POLICIES).toHaveLength(5);
    });

    it('includes all named policy sets', () => {
      const ids = BUILTIN_POLICIES.map((ps) => ps.id);
      expect(ids).toContain('builtin:security-baseline');
      expect(ids).toContain('builtin:change-management');
      expect(ids).toContain('builtin:cost-governance');
      expect(ids).toContain('builtin:compliance');
      expect(ids).toContain('builtin:quality-gates');
    });

    it('all policy sets are enabled by default', () => {
      for (const ps of BUILTIN_POLICIES) {
        expect(ps.enabled).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Each has expected structure
  // -----------------------------------------------------------------------

  describe.each([
    ['securityBaseline', securityBaseline],
    ['changeManagement', changeManagement],
    ['costGovernance', costGovernance],
    ['compliance', compliance],
    ['qualityGates', qualityGates],
  ] as const)('%s', (_name, policySet) => {
    it('has a non-empty id', () => {
      expect(policySet.id).toBeTruthy();
      expect(typeof policySet.id).toBe('string');
    });

    it('has a non-empty name', () => {
      expect(policySet.name).toBeTruthy();
      expect(typeof policySet.name).toBe('string');
    });

    it('has a description', () => {
      expect(policySet.description).toBeTruthy();
    });

    it('has at least one rule', () => {
      expect(policySet.rules.length).toBeGreaterThanOrEqual(1);
    });

    it('each rule has valid id, name, condition, action, and message', () => {
      for (const rule of policySet.rules) {
        expect(rule.id).toBeTruthy();
        expect(rule.name).toBeTruthy();
        expect(rule.condition).toBeTruthy();
        expect(['allow', 'warn', 'block', 'require_approval']).toContain(rule.action);
        expect(rule.message).toBeTruthy();
        expect(rule.scope).toBeTruthy();
      }
    });

    it('all rule condition expressions are parseable (do not throw)', () => {
      for (const rule of policySet.rules) {
        // The condition should be parseable with any context — it should
        // not throw a tokenization or parse error. It may evaluate to
        // true or false depending on the context, but structurally it
        // must be valid.
        expect(() => {
          evaluateCondition(rule.condition, {
            // Provide plausible values so dotted paths resolve
            category: 'test',
            severity: 'medium',
            type: 'opportunity',
            status: 'proposed',
            confidence: 0.5,
            risk: { level: 'medium' },
            effort: { t_shirt: 'm' },
          });
        }).not.toThrow();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Individual policy set specifics
  // -----------------------------------------------------------------------

  describe('securityBaseline', () => {
    it('has 3 rules', () => {
      expect(securityBaseline.rules).toHaveLength(3);
    });

    it('includes a block action for critical security', () => {
      const critRule = securityBaseline.rules.find((r) => r.id === 'sec-001');
      expect(critRule).toBeDefined();
      expect(critRule!.action).toBe('block');
    });

    it('includes a warn action for medium security', () => {
      const medRule = securityBaseline.rules.find((r) => r.id === 'sec-003');
      expect(medRule).toBeDefined();
      expect(medRule!.action).toBe('warn');
    });
  });

  describe('changeManagement', () => {
    it('has 3 rules', () => {
      expect(changeManagement.rules).toHaveLength(3);
    });

    it('all rules use require_approval action', () => {
      for (const rule of changeManagement.rules) {
        expect(rule.action).toBe('require_approval');
      }
    });
  });

  describe('costGovernance', () => {
    it('has 3 rules', () => {
      expect(costGovernance.rules).toHaveLength(3);
    });

    it('includes warn, block, and require_approval actions', () => {
      const actions = costGovernance.rules.map((r) => r.action);
      expect(actions).toContain('warn');
      expect(actions).toContain('block');
      expect(actions).toContain('require_approval');
    });
  });

  describe('compliance', () => {
    it('has 3 rules', () => {
      expect(compliance.rules).toHaveLength(3);
    });
  });

  describe('qualityGates', () => {
    it('has 4 rules', () => {
      expect(qualityGates.rules).toHaveLength(4);
    });

    it('includes an allow action for high-confidence opportunities', () => {
      const allowRule = qualityGates.rules.find((r) => r.id === 'qual-003');
      expect(allowRule).toBeDefined();
      expect(allowRule!.action).toBe('allow');
    });
  });

  // -----------------------------------------------------------------------
  // getBuiltinPolicySet
  // -----------------------------------------------------------------------

  describe('getBuiltinPolicySet', () => {
    it('returns the correct policy set by id', () => {
      const ps = getBuiltinPolicySet('builtin:security-baseline');
      expect(ps).toBe(securityBaseline);
    });

    it('returns undefined for unknown id', () => {
      const ps = getBuiltinPolicySet('builtin:nonexistent');
      expect(ps).toBeUndefined();
    });

    it('returns each builtin policy set correctly', () => {
      expect(getBuiltinPolicySet('builtin:change-management')).toBe(changeManagement);
      expect(getBuiltinPolicySet('builtin:cost-governance')).toBe(costGovernance);
      expect(getBuiltinPolicySet('builtin:compliance')).toBe(compliance);
      expect(getBuiltinPolicySet('builtin:quality-gates')).toBe(qualityGates);
    });
  });

  // -----------------------------------------------------------------------
  // Rule IDs are unique across all policy sets
  // -----------------------------------------------------------------------

  describe('rule ID uniqueness', () => {
    it('all rule IDs across all builtin policy sets are unique', () => {
      const allIds = BUILTIN_POLICIES.flatMap((ps) => ps.rules.map((r) => r.id));
      const uniqueIds = new Set(allIds);
      expect(uniqueIds.size).toBe(allIds.length);
    });
  });
});

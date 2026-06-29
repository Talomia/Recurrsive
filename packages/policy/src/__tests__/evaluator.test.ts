/**
 * Tests for the recursive descent expression evaluator.
 */

import { describe, it, expect } from 'vitest';
import { evaluateCondition } from '../evaluator.js';
import type { EvaluationContext } from '../evaluator.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shortcut for calling evaluateCondition with a given context. */
function eval_(condition: string, ctx: EvaluationContext = {}): boolean {
  return evaluateCondition(condition, ctx);
}

// ---------------------------------------------------------------------------
// Simple comparisons
// ---------------------------------------------------------------------------

describe('evaluateCondition', () => {
  describe('equality operator (==)', () => {
    it('returns true for equal strings', () => {
      expect(eval_('severity == "high"', { severity: 'high' })).toBe(true);
    });

    it('returns false for unequal strings', () => {
      expect(eval_('severity == "high"', { severity: 'low' })).toBe(false);
    });

    it('returns true for equal numbers', () => {
      expect(eval_('count == 42', { count: 42 })).toBe(true);
    });

    it('returns false for unequal numbers', () => {
      expect(eval_('count == 42', { count: 99 })).toBe(false);
    });

    it('returns true for equal booleans', () => {
      expect(eval_('active == true', { active: true })).toBe(true);
    });

    it('returns false when comparing different types', () => {
      // number 1 !== string "1" → strict equality
      expect(eval_('count == "1"', { count: 1 })).toBe(false);
    });
  });

  describe('inequality operator (!=)', () => {
    it('returns true for different values', () => {
      expect(eval_('severity != "low"', { severity: 'high' })).toBe(true);
    });

    it('returns false for same values', () => {
      expect(eval_('severity != "high"', { severity: 'high' })).toBe(false);
    });
  });

  describe('greater than (>)', () => {
    it('returns true when left > right', () => {
      expect(eval_('confidence > 0.5', { confidence: 0.9 })).toBe(true);
    });

    it('returns false when left == right', () => {
      expect(eval_('confidence > 0.5', { confidence: 0.5 })).toBe(false);
    });

    it('returns false when left < right', () => {
      expect(eval_('confidence > 0.5', { confidence: 0.1 })).toBe(false);
    });
  });

  describe('less than (<)', () => {
    it('returns true when left < right', () => {
      expect(eval_('confidence < 0.5', { confidence: 0.1 })).toBe(true);
    });

    it('returns false when left >= right', () => {
      expect(eval_('confidence < 0.5', { confidence: 0.5 })).toBe(false);
    });
  });

  describe('greater than or equal (>=)', () => {
    it('returns true when left > right', () => {
      expect(eval_('confidence >= 0.5', { confidence: 0.9 })).toBe(true);
    });

    it('returns true when left == right', () => {
      expect(eval_('confidence >= 0.5', { confidence: 0.5 })).toBe(true);
    });

    it('returns false when left < right', () => {
      expect(eval_('confidence >= 0.5', { confidence: 0.1 })).toBe(false);
    });
  });

  describe('less than or equal (<=)', () => {
    it('returns true when left < right', () => {
      expect(eval_('confidence <= 0.5', { confidence: 0.1 })).toBe(true);
    });

    it('returns true when left == right', () => {
      expect(eval_('confidence <= 0.5', { confidence: 0.5 })).toBe(true);
    });

    it('returns false when left > right', () => {
      expect(eval_('confidence <= 0.5', { confidence: 0.9 })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Boolean operators
  // ---------------------------------------------------------------------------

  describe('logical AND (&&)', () => {
    it('returns true when both sides are true', () => {
      expect(eval_('a == 1 && b == 2', { a: 1, b: 2 })).toBe(true);
    });

    it('returns false when left is false', () => {
      expect(eval_('a == 1 && b == 2', { a: 0, b: 2 })).toBe(false);
    });

    it('returns false when right is false', () => {
      expect(eval_('a == 1 && b == 2', { a: 1, b: 0 })).toBe(false);
    });

    it('returns false when both sides are false', () => {
      expect(eval_('a == 1 && b == 2', { a: 0, b: 0 })).toBe(false);
    });

    it('supports word form "and"', () => {
      expect(eval_('a == 1 and b == 2', { a: 1, b: 2 })).toBe(true);
    });
  });

  describe('logical OR (||)', () => {
    it('returns true when both sides are true', () => {
      expect(eval_('a == 1 || b == 2', { a: 1, b: 2 })).toBe(true);
    });

    it('returns true when only left is true', () => {
      expect(eval_('a == 1 || b == 2', { a: 1, b: 0 })).toBe(true);
    });

    it('returns true when only right is true', () => {
      expect(eval_('a == 1 || b == 2', { a: 0, b: 2 })).toBe(true);
    });

    it('returns false when both sides are false', () => {
      expect(eval_('a == 1 || b == 2', { a: 0, b: 0 })).toBe(false);
    });

    it('supports word form "or"', () => {
      expect(eval_('a == 1 or b == 2', { a: 0, b: 2 })).toBe(true);
    });
  });

  describe('logical NOT (!)', () => {
    it('negates a true value', () => {
      expect(eval_('!active', { active: true })).toBe(false);
    });

    it('negates a false value', () => {
      expect(eval_('!active', { active: false })).toBe(true);
    });

    it('negates a comparison', () => {
      expect(eval_('!(severity == "high")', { severity: 'low' })).toBe(true);
    });

    it('double negation returns original', () => {
      expect(eval_('!!active', { active: true })).toBe(true);
    });

    it('supports word form "not"', () => {
      expect(eval_('not active', { active: true })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // String operations
  // ---------------------------------------------------------------------------

  describe('contains operator', () => {
    it('returns true when string contains substring', () => {
      expect(eval_('name contains "foo"', { name: 'foobar' })).toBe(true);
    });

    it('returns false when string does not contain substring', () => {
      expect(eval_('name contains "xyz"', { name: 'foobar' })).toBe(false);
    });

    it('works with arrays (array contains element)', () => {
      expect(eval_('tags contains "urgent"', { tags: ['urgent', 'bug'] })).toBe(true);
    });

    it('returns false for array not containing element', () => {
      expect(eval_('tags contains "feature"', { tags: ['urgent', 'bug'] })).toBe(false);
    });

    it('returns false for non-string/non-array left operand', () => {
      expect(eval_('count contains "1"', { count: 123 })).toBe(false);
    });
  });

  describe('startsWith operator', () => {
    it('returns true when string starts with prefix', () => {
      expect(eval_('name startsWith "foo"', { name: 'foobar' })).toBe(true);
    });

    it('returns false when string does not start with prefix', () => {
      expect(eval_('name startsWith "bar"', { name: 'foobar' })).toBe(false);
    });

    it('returns false for non-string operands', () => {
      expect(eval_('count startsWith "1"', { count: 123 })).toBe(false);
    });
  });

  describe('endsWith operator', () => {
    it('returns true when string ends with suffix', () => {
      expect(eval_('name endsWith "bar"', { name: 'foobar' })).toBe(true);
    });

    it('returns false when string does not end with suffix', () => {
      expect(eval_('name endsWith "foo"', { name: 'foobar' })).toBe(false);
    });

    it('returns false for non-string operands', () => {
      expect(eval_('count endsWith "3"', { count: 123 })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // in operator
  // ---------------------------------------------------------------------------

  describe('in operator', () => {
    it('returns true when value is in array', () => {
      expect(eval_('"urgent" in tags', { tags: ['urgent', 'bug'] })).toBe(true);
    });

    it('returns false when value is not in array', () => {
      expect(eval_('"feature" in tags', { tags: ['urgent', 'bug'] })).toBe(false);
    });

    it('returns true when substring is in string', () => {
      expect(eval_('"foo" in name', { name: 'foobar' })).toBe(true);
    });

    it('returns false when substring is not in string', () => {
      expect(eval_('"xyz" in name', { name: 'foobar' })).toBe(false);
    });

    it('returns false for non-array/non-string right operand', () => {
      expect(eval_('"a" in count', { count: 123 })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Dotted path resolution
  // ---------------------------------------------------------------------------

  describe('dotted path resolution', () => {
    it('resolves a simple identifier', () => {
      expect(eval_('severity == "high"', { severity: 'high' })).toBe(true);
    });

    it('resolves a dotted path (effort.t_shirt)', () => {
      expect(
        eval_('effort.t_shirt == "xs"', { effort: { t_shirt: 'xs' } }),
      ).toBe(true);
    });

    it('resolves a deeply nested path', () => {
      expect(
        eval_('a.b.c == 42', { a: { b: { c: 42 } } }),
      ).toBe(true);
    });

    it('returns undefined for missing path (comparison fails)', () => {
      // undefined != "high" → should not match ==
      expect(eval_('severity == "high"', {})).toBe(false);
    });

    it('returns undefined for partially valid path (null intermediate)', () => {
      expect(eval_('a.b.c == 1', { a: null })).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Complex expressions
  // ---------------------------------------------------------------------------

  describe('complex expressions', () => {
    it('evaluates severity == "critical" && confidence > 0.8', () => {
      expect(
        eval_('severity == "critical" && confidence > 0.8', {
          severity: 'critical',
          confidence: 0.9,
        }),
      ).toBe(true);
    });

    it('returns false for partial match in compound AND', () => {
      expect(
        eval_('severity == "critical" && confidence > 0.8', {
          severity: 'critical',
          confidence: 0.5,
        }),
      ).toBe(false);
    });

    it('evaluates chained AND with three conditions', () => {
      expect(
        eval_(
          'category == "security" && severity == "critical" && type == "risk"',
          { category: 'security', severity: 'critical', type: 'risk' },
        ),
      ).toBe(true);
    });

    it('evaluates mixed AND/OR with correct precedence (AND binds tighter)', () => {
      // a || b && c → a || (b && c)
      // false || (true && true) → true
      expect(
        eval_('a == 0 || b == 1 && c == 1', { a: 0, b: 1, c: 0 }),
      ).toBe(true); // a==0 is true since 0===0
    });
  });

  // ---------------------------------------------------------------------------
  // Nested boolean (parenthesized)
  // ---------------------------------------------------------------------------

  describe('nested boolean with parentheses', () => {
    it('evaluates (a || b) && c', () => {
      expect(
        eval_('(a == 1 || b == 1) && c == 1', { a: 1, b: 0, c: 1 }),
      ).toBe(true);
    });

    it('returns false when outer AND fails', () => {
      expect(
        eval_('(a == 1 || b == 1) && c == 1', { a: 1, b: 0, c: 0 }),
      ).toBe(false);
    });

    it('evaluates deeply nested parens', () => {
      expect(
        eval_('((a == 1))', { a: 1 }),
      ).toBe(true);
    });

    it('evaluates complex parenthesized expression', () => {
      // (a && b) || (c && d)
      expect(
        eval_('(a == 1 && b == 1) || (c == 1 && d == 1)', {
          a: 0, b: 0, c: 1, d: 1,
        }),
      ).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty string comparison', () => {
      expect(eval_('name == ""', { name: '' })).toBe(true);
    });

    it('handles empty string contains empty string', () => {
      expect(eval_('"" contains ""', {})).toBe(true);
    });

    it('handles undefined path compared to string', () => {
      expect(eval_('missing == "hello"', {})).toBe(false);
    });

    it('handles number zero as falsy but comparison still works', () => {
      expect(eval_('count == 0', { count: 0 })).toBe(true);
    });

    it('handles negative numbers', () => {
      expect(eval_('temp > -10', { temp: 5 })).toBe(true);
    });

    it('handles single-quoted strings', () => {
      expect(eval_("severity == 'high'", { severity: 'high' })).toBe(true);
    });

    it('handles escaped characters in strings', () => {
      expect(eval_('name == "foo\\"bar"', { name: 'foo"bar' })).toBe(true);
    });

    it('boolean literals work standalone', () => {
      expect(eval_('true', {})).toBe(true);
      expect(eval_('false', {})).toBe(false);
    });

    it('treats undefined context value as falsy in boolean conversion', () => {
      // evaluateCondition returns Boolean(result), undefined → false
      expect(eval_('missing', {})).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Error cases
  // ---------------------------------------------------------------------------

  describe('error cases', () => {
    it('throws on unexpected character', () => {
      expect(() => eval_('a @ b', {})).toThrow('Unexpected character');
    });

    it('throws on unterminated string literal', () => {
      expect(() => eval_('name == "hello', {})).toThrow('Unterminated string');
    });

    it('throws on unclosed parenthesis', () => {
      expect(() => eval_('(a == 1', { a: 1 })).toThrow();
    });

    it('throws on unexpected token at start', () => {
      expect(() => eval_('== "hello"', {})).toThrow();
    });

    it('throws on trailing tokens after valid expression', () => {
      expect(() => eval_('a == 1 b == 2', { a: 1, b: 2 })).toThrow();
    });

    it('throws on empty expression', () => {
      // tokenise returns only EOF; parser expects a primary → throws
      expect(() => eval_('', {})).toThrow();
    });

    it('throws on standalone operator', () => {
      expect(() => eval_('&&', {})).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Real-world policy conditions from builtin policies
  // ---------------------------------------------------------------------------

  describe('real-world policy conditions', () => {
    it('matches security baseline: category == "security" && severity == "critical"', () => {
      expect(
        eval_('category == "security" && severity == "critical"', {
          category: 'security',
          severity: 'critical',
        }),
      ).toBe(true);
    });

    it('matches change management: risk.level == "critical"', () => {
      expect(
        eval_('risk.level == "critical"', {
          risk: { level: 'critical' },
        }),
      ).toBe(true);
    });

    it('matches quality gates: confidence >= 0.85 && risk.level != "critical" && risk.level != "high"', () => {
      expect(
        eval_(
          'confidence >= 0.85 && risk.level != "critical" && risk.level != "high"',
          { confidence: 0.9, risk: { level: 'low' } },
        ),
      ).toBe(true);
    });

    it('does not match quality gates when risk is high', () => {
      expect(
        eval_(
          'confidence >= 0.85 && risk.level != "critical" && risk.level != "high"',
          { confidence: 0.9, risk: { level: 'high' } },
        ),
      ).toBe(false);
    });

    it('matches confidence < 0.5 && status == "accepted"', () => {
      expect(
        eval_('confidence < 0.5 && status == "accepted"', {
          confidence: 0.3,
          status: 'accepted',
        }),
      ).toBe(true);
    });
  });
});

/**
 * @module @recurrsive/policy/engine
 *
 * PolicyEngine class — loads, manages, and evaluates policy sets
 * against opportunities.
 *
 * @packageDocumentation
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  Opportunity,
  PolicySet,
  PolicyRule,
  PolicyEvaluation,
  PolicyAction,
} from '@recurrsive/core';
import { PolicySetSchema } from '@recurrsive/core';
import { evaluateCondition, type EvaluationContext } from './evaluator.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Three-state compliance verdict for an opportunity. */
export type PolicyCompliance = 'compliant' | 'needs_approval' | 'blocked';

/** Aggregate result of evaluating all policies against an opportunity. */
export interface PolicyResult {
  /** The opportunity that was evaluated. */
  opportunityId: string;
  /**
   * Whether the opportunity is compliant: true only when NO rule was
   * violated (no `block` and no `require_approval`). An item awaiting
   * approval is NOT compliant.
   */
  passed: boolean;
  /** Three-state compliance verdict (compliant / needs_approval / blocked). */
  compliance: PolicyCompliance;
  /** The most restrictive action across all matching rules. */
  effectiveAction: PolicyAction;
  /** Individual evaluation results. */
  evaluations: PolicyEvaluation[];
  /** Rules that were violated (resulted in block or require_approval). */
  violations: PolicyEvaluation[];
  /** Rules that produced warnings. */
  warnings: PolicyEvaluation[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Action severity ordering: higher index = more restrictive. */
const ACTION_SEVERITY: Record<PolicyAction, number> = {
  allow: 0,
  warn: 1,
  require_approval: 2,
  block: 3,
};

/**
 * Severity of an action, failing CLOSED: an unrecognized action (e.g. a
 * typo'd rule injected programmatically) is treated as the most
 * restrictive action (`block`), never silently as `allow`.
 */
function actionSeverity(action: string): number {
  return ACTION_SEVERITY[action as PolicyAction] ?? ACTION_SEVERITY.block;
}

/**
 * Normalize an action string, failing CLOSED: anything that is not a
 * recognized {@link PolicyAction} collapses to `block`.
 */
function normalizeAction(action: string): PolicyAction {
  return action in ACTION_SEVERITY ? (action as PolicyAction) : 'block';
}

/**
 * Flatten an Opportunity into a context object suitable for the
 * expression evaluator. Nested objects are preserved so dotted path
 * resolution works (e.g. `effort.t_shirt`).
 *
 * @param opp - The opportunity to flatten
 * @returns A context object for the evaluator
 */
function opportunityToContext(opp: Opportunity): EvaluationContext {
  // Spread into a plain Record so the evaluator can access all fields
  // via dotted paths without unsafe double-casting.
  return { ...opp } as EvaluationContext;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Policy evaluation engine.
 *
 * Loads policy sets from JSON files or programmatic registration,
 * and evaluates them against opportunities using the expression
 * evaluator.
 */
export class PolicyEngine {
  private readonly policySets = new Map<string, PolicySet>();

  /**
   * Create a PolicyEngine, optionally pre-loading policy sets.
   *
   * @param initial - Optional array of policy sets to seed
   */
  constructor(initial?: readonly PolicySet[]) {
    if (initial) {
      for (const ps of initial) {
        this.policySets.set(ps.id, ps);
      }
    }
  }

  /**
   * Load policy sets from a directory of `.json` files.
   *
   * Each JSON file should contain a single PolicySet object.
   * Invalid files are skipped with errors collected.
   *
   * @param dir - Absolute path to the directory containing policy JSON files
   * @returns Object with counts and any errors
   * @throws {Error} If the directory cannot be read
   */
  async loadFromDirectory(dir: string): Promise<{
    loaded: number;
    skipped: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let loaded = 0;
    let skipped = 0;

    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (err) {
      throw new Error(
        `Failed to read policy directory '${dir}': ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const jsonFiles = entries.filter((f) => f.endsWith('.json'));

    for (const file of jsonFiles) {
      const filePath = join(dir, file);
      try {
        const raw = await readFile(filePath, 'utf-8');
        const parsed: unknown = JSON.parse(raw);

        // Strict schema validation — FAIL CLOSED. A file with an invalid
        // action enum, missing `enabled`, or any other schema violation is
        // rejected as a load error rather than loaded in a broken state
        // (which would either never run or silently allow).
        const result = PolicySetSchema.safeParse(parsed);
        if (!result.success) {
          skipped++;
          const issues = result.error.issues
            .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
            .join('; ');
          errors.push(`${file}: Invalid policy set: ${issues}`);
          continue;
        }

        this.policySets.set(result.data.id, result.data);
        loaded++;
      } catch (err) {
        skipped++;
        errors.push(
          `${file}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { loaded, skipped, errors };
  }

  /**
   * Manually add a policy set to the engine.
   *
   * @param policySet - The policy set to add
   */
  addPolicySet(policySet: PolicySet): void {
    this.policySets.set(policySet.id, policySet);
  }

  /**
   * Remove a policy set by ID.
   *
   * @param id - The policy set ID to remove
   * @returns True if removed, false if not found
   */
  removePolicySet(id: string): boolean {
    return this.policySets.delete(id);
  }

  /**
   * Evaluate an opportunity against all enabled policy rules.
   *
   * @param opportunity - The opportunity to evaluate
   * @returns Array of individual evaluation results
   */
  evaluate(opportunity: Opportunity): PolicyEvaluation[] {
    const context = opportunityToContext(opportunity);
    const evaluations: PolicyEvaluation[] = [];

    for (const ps of this.policySets.values()) {
      if (!ps.enabled) continue;

      for (const rule of ps.rules) {
        const evaluation = this.evaluateRule(rule, context);
        evaluations.push(evaluation);
      }
    }

    return evaluations;
  }

  /**
   * Check whether an opportunity is compliant with all policy rules.
   *
   * FAIL-CLOSED semantics:
   * - An opportunity "passes" only when NO rule was violated. A fired
   *   `require_approval` rule means NOT compliant (needs_approval), and a
   *   fired `block` rule means blocked.
   * - Any failed evaluation carrying an unrecognized action is treated
   *   as `block`.
   *
   * @param opportunity - The opportunity to check
   * @returns Result with compliance verdict, violations, warnings, and effective action
   */
  passes(opportunity: Opportunity): PolicyResult {
    const evaluations = this.evaluate(opportunity);

    // Unrecognized actions on failed evaluations collapse to 'block'.
    const violations = evaluations.filter((e) => {
      if (e.passed) return false;
      const action = normalizeAction(e.action);
      return action === 'block' || action === 'require_approval';
    });
    const warnings = evaluations.filter(
      (e) => !e.passed && normalizeAction(e.action) === 'warn',
    );

    // The most restrictive action wins; unknown actions count as block.
    let effectiveAction: PolicyAction = 'allow';
    for (const ev of evaluations) {
      if (!ev.passed && actionSeverity(ev.action) > ACTION_SEVERITY[effectiveAction]) {
        effectiveAction = normalizeAction(ev.action);
      }
    }

    // Compliance is the absence of violations — require_approval is NOT
    // counted as compliant.
    const passed = violations.length === 0;
    const compliance: PolicyCompliance =
      effectiveAction === 'block'
        ? 'blocked'
        : effectiveAction === 'require_approval'
          ? 'needs_approval'
          : 'compliant';

    return {
      opportunityId: opportunity.id,
      passed,
      compliance,
      effectiveAction,
      evaluations,
      violations,
      warnings,
    };
  }

  /**
   * Get all loaded policy sets.
   *
   * @returns Array of all policy sets (enabled and disabled)
   */
  getPolicies(): PolicySet[] {
    return Array.from(this.policySets.values());
  }

  /**
   * Get a specific policy set by ID.
   *
   * @param id - The policy set ID
   * @returns The policy set, or undefined if not found
   */
  getPolicySet(id: string): PolicySet | undefined {
    return this.policySets.get(id);
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /**
   * Evaluate a single policy rule against a context.
   *
   * @param rule - The rule to evaluate
   * @param context - The evaluation context
   * @returns The evaluation result
   */
  private evaluateRule(rule: PolicyRule, context: EvaluationContext): PolicyEvaluation {
    try {
      const conditionMet = evaluateCondition(rule.condition, context);

      if (conditionMet) {
        // Condition matched → rule fires
        return {
          rule_id: rule.id,
          passed: rule.action === 'allow',
          action: rule.action,
          message: rule.message,
          details: {
            condition: rule.condition,
            conditionMet: true,
            policyRuleName: rule.name,
          },
        };
      }

      // Condition did not match → rule does not fire → passes
      return {
        rule_id: rule.id,
        passed: true,
        action: 'allow',
        message: `Rule '${rule.name}' did not match.`,
        details: {
          condition: rule.condition,
          conditionMet: false,
          policyRuleName: rule.name,
        },
      };
    } catch (err) {
      // Evaluation errors are treated as failures to be safe
      return {
        rule_id: rule.id,
        passed: false,
        action: 'block',
        message: `Error evaluating rule '${rule.name}': ${err instanceof Error ? err.message : String(err)}`,
        details: {
          condition: rule.condition,
          error: err instanceof Error ? err.message : String(err),
          policyRuleName: rule.name,
        },
      };
    }
  }
}

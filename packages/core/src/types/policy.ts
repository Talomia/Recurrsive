import { z } from 'zod';

// ---------------------------------------------------------------------------
// Policy Enums
// ---------------------------------------------------------------------------

/**
 * What action to take when a policy rule matches.
 */
export const PolicyActionSchema = z.enum([
  'allow',
  'warn',
  'block',
  'require_approval',
]);

/** Inferred TypeScript type for {@link PolicyActionSchema}. */
export type PolicyAction = z.infer<typeof PolicyActionSchema>;

/**
 * Scope at which a policy rule applies.
 */
export const PolicyScopeSchema = z.enum([
  'global',
  'project',
  'team',
  'environment',
]);

/** Inferred TypeScript type for {@link PolicyScopeSchema}. */
export type PolicyScope = z.infer<typeof PolicyScopeSchema>;

// ---------------------------------------------------------------------------
// Policy Rule
// ---------------------------------------------------------------------------

/**
 * A single policy rule that defines a condition and the action to
 * take when the condition is met.
 */
export interface PolicyRule {
  /** Unique identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of what this rule enforces. */
  description: string;
  /** Scope at which this rule applies. */
  scope: PolicyScope;
  /** Expression to evaluate (e.g. `severity == "critical"`). */
  condition: string;
  /** Action to take when the condition matches. */
  action: PolicyAction;
  /** Message to display when the rule fires. */
  message: string;
  /** Arbitrary structured metadata. */
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Policy Evaluation
// ---------------------------------------------------------------------------

/**
 * Result of evaluating a single policy rule against an input.
 */
export interface PolicyEvaluation {
  /** ID of the rule that was evaluated. */
  rule_id: string;
  /** Whether the input passed or failed the rule. */
  passed: boolean;
  /** The action dictated by the rule. */
  action: PolicyAction;
  /** Human-readable result message. */
  message: string;
  /** Additional details about the evaluation. */
  details: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Policy Set
// ---------------------------------------------------------------------------

/**
 * A named collection of policy rules that can be enabled or disabled
 * as a unit.
 */
export interface PolicySet {
  /** Unique identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Description of this policy set. */
  description: string;
  /** Ordered list of rules. */
  rules: PolicyRule[];
  /** Whether this policy set is currently active. */
  enabled: boolean;
}

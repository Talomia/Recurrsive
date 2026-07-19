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
 * Zod schema for a single policy rule.
 *
 * Used to validate untrusted policy definitions (e.g. JSON files loaded
 * from disk) before they are admitted into a policy engine. `action` must
 * be a valid {@link PolicyActionSchema} member — an unknown action is a
 * validation error, never silently accepted.
 */
export const PolicyRuleSchema = z.object({
  /** Unique identifier. */
  id: z.string().min(1),
  /** Human-readable name. */
  name: z.string().min(1),
  /** Description of what this rule enforces. */
  description: z.string().default(''),
  /** Scope at which this rule applies. */
  scope: PolicyScopeSchema.default('global'),
  /** Expression to evaluate (e.g. `severity == "critical"`). */
  condition: z.string().min(1),
  /** Action to take when the condition matches (strict enum). */
  action: PolicyActionSchema,
  /** Message to display when the rule fires. */
  message: z.string().default(''),
  /** Arbitrary structured metadata. */
  metadata: z.record(z.unknown()).default({}),
});

/**
 * Zod schema for a policy set.
 *
 * `enabled` is deliberately REQUIRED (no default): a policy file that
 * omits it would otherwise load but never run (or silently run), so its
 * absence is treated as a validation error and the file is rejected.
 */
export const PolicySetSchema = z.object({
  /** Unique identifier. */
  id: z.string().min(1),
  /** Human-readable name. */
  name: z.string().min(1),
  /** Description of this policy set. */
  description: z.string().default(''),
  /** Ordered list of rules. */
  rules: z.array(PolicyRuleSchema),
  /** Whether this policy set is currently active. REQUIRED — no default. */
  enabled: z.boolean(),
});

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

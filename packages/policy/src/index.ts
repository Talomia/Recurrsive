/**
 * @module @recurrsive/policy
 *
 * Barrel export for the policy package.
 *
 * @packageDocumentation
 */

// Engine
export { PolicyEngine } from './engine.js';
export type { PolicyResult } from './engine.js';

// Evaluator
export { evaluateCondition } from './evaluator.js';
export type { EvaluationContext } from './evaluator.js';

// Built-in policies
export {
  securityBaseline,
  changeManagement,
  costGovernance,
  compliance,
  qualityGates,
  BUILTIN_POLICIES,
  getBuiltinPolicySet,
} from './builtin.js';

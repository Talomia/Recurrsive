/**
 * @module queries
 *
 * Barrel export for reusable graph query builders.
 *
 * @packageDocumentation
 */

export {
  findCallChain,
  findDependencyTree,
  findAIWorkflow,
  findDeadCode,
  findCircularDeps,
  findAllPromptsForAgent,
  findModelUsage,
  findEntitiesByPattern,
  type QueryDialect,
  type ParameterizedQuery,
} from './builders.js';

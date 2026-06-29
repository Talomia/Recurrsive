/**
 * Specialist agents module — barrel export and factory.
 *
 * @module
 */

export { BaseSpecialist } from './base.js';
export type { Specialist } from './base.js';
export {
  ArchitectureEngineer,
  PerformanceEngineer,
  SecurityEngineer,
  CostOptimizer,
  AIQualityEngineer,
  ProductManager,
  ReliabilityEngineer,
  DeveloperExperienceEngineer,
} from './definitions.js';

import type { Specialist } from './base.js';
import {
  ArchitectureEngineer,
  PerformanceEngineer,
  SecurityEngineer,
  CostOptimizer,
  AIQualityEngineer,
  ProductManager,
  ReliabilityEngineer,
  DeveloperExperienceEngineer,
} from './definitions.js';

/**
 * Create the default set of all eight specialist agents.
 *
 * @returns Array of all specialist instances.
 */
export function createDefaultSpecialists(): Specialist[] {
  return [
    new ArchitectureEngineer(),
    new PerformanceEngineer(),
    new SecurityEngineer(),
    new CostOptimizer(),
    new AIQualityEngineer(),
    new ProductManager(),
    new ReliabilityEngineer(),
    new DeveloperExperienceEngineer(),
  ];
}

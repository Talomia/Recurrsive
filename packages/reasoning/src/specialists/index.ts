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
  UXResearcher,
  AccessibilityExpert,
  PrivacyEngineer,
  ComplianceEngineer,
  BackendEngineer,
  FrontendEngineer,
  MLEngineer,
  PromptEngineer,
  DatabaseEngineer,
  DocumentationEngineer,
  ReleaseManager,
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
  UXResearcher,
  AccessibilityExpert,
  PrivacyEngineer,
  ComplianceEngineer,
  BackendEngineer,
  FrontendEngineer,
  MLEngineer,
  PromptEngineer,
  DatabaseEngineer,
  DocumentationEngineer,
  ReleaseManager,
} from './definitions.js';

/**
 * Create the default set of all nineteen specialist agents.
 *
 * Every role defined in {@link SpecialistRoleSchema} has a corresponding
 * specialist implementation. The reasoning engine filters this list to
 * only include roles specified in the configuration.
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
    new UXResearcher(),
    new AccessibilityExpert(),
    new PrivacyEngineer(),
    new ComplianceEngineer(),
    new BackendEngineer(),
    new FrontendEngineer(),
    new MLEngineer(),
    new PromptEngineer(),
    new DatabaseEngineer(),
    new DocumentationEngineer(),
    new ReleaseManager(),
  ];
}

/**
 * Tests for specialist agent definitions.
 *
 * Verifies that all 8 specialists instantiate correctly, have unique
 * identities, and carry non-empty cognitive frameworks and system prompts.
 */

import { describe, it, expect } from 'vitest';
import {
  ArchitectureEngineer,
  PerformanceEngineer,
  SecurityEngineer,
  CostOptimizer,
  AIQualityEngineer,
  ProductManager,
  ReliabilityEngineer,
  DeveloperExperienceEngineer,
} from '../../specialists/definitions.js';
import { createDefaultSpecialists } from '../../specialists/index.js';

// All 8 specialist classes
const specialistClasses = [
  ArchitectureEngineer,
  PerformanceEngineer,
  SecurityEngineer,
  CostOptimizer,
  AIQualityEngineer,
  ProductManager,
  ReliabilityEngineer,
  DeveloperExperienceEngineer,
] as const;

describe('Specialist Definitions', () => {
  // ── Instantiation ──────────────────────────────────────────────────────

  describe('instantiation', () => {
    it('all 8 specialist classes instantiate without error', () => {
      for (const SpecialistClass of specialistClasses) {
        const instance = new SpecialistClass();
        expect(instance).toBeDefined();
      }
    });

    it('createDefaultSpecialists() returns exactly 8 specialists', () => {
      const specialists = createDefaultSpecialists();
      expect(specialists).toHaveLength(8);
    });
  });

  // ── Unique roles ─────────────────────────────────────────────────────────

  describe('unique roles', () => {
    it('each specialist has a unique role', () => {
      const specialists = createDefaultSpecialists();
      const roles = specialists.map((s) => s.role);
      const uniqueRoles = new Set(roles);
      expect(uniqueRoles.size).toBe(specialists.length);
    });

    it('roles are valid SpecialistRole values', () => {
      const validRoles = new Set([
        'architecture_engineer',
        'backend_engineer',
        'frontend_engineer',
        'ml_engineer',
        'prompt_engineer',
        'security_engineer',
        'database_engineer',
        'devops_engineer',
        'qa_engineer',
        'product_manager',
        'ux_researcher',
        'accessibility_expert',
        'performance_engineer',
        'cost_optimizer',
        'privacy_engineer',
        'documentation_engineer',
        'release_manager',
        'sre',
      ]);

      const specialists = createDefaultSpecialists();
      for (const s of specialists) {
        expect(validRoles.has(s.role)).toBe(true);
      }
    });
  });

  // ── Unique names ─────────────────────────────────────────────────────────

  describe('unique names', () => {
    it('each specialist has a unique name', () => {
      const specialists = createDefaultSpecialists();
      const names = specialists.map((s) => s.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(specialists.length);
    });
  });

  // ── Unique cognitive frameworks ──────────────────────────────────────────

  describe('unique cognitive frameworks', () => {
    it('each specialist has a unique cognitive framework', () => {
      const specialists = createDefaultSpecialists();
      const frameworks = specialists.map((s) => s.cognitiveFramework);
      const uniqueFrameworks = new Set(frameworks);
      expect(uniqueFrameworks.size).toBe(specialists.length);
    });
  });

  // ── Non-empty properties ─────────────────────────────────────────────────

  describe('non-empty properties', () => {
    it('all specialists have non-empty names', () => {
      const specialists = createDefaultSpecialists();
      for (const s of specialists) {
        expect(s.name.length).toBeGreaterThan(0);
      }
    });

    it('all specialists have non-empty cognitive frameworks', () => {
      const specialists = createDefaultSpecialists();
      for (const s of specialists) {
        expect(s.cognitiveFramework.length).toBeGreaterThan(0);
      }
    });

    it('all specialists have non-empty system prompts', () => {
      const specialists = createDefaultSpecialists();
      for (const s of specialists) {
        expect(s.systemPrompt.length).toBeGreaterThan(0);
      }
    });

    it('system prompts are substantial (>100 characters)', () => {
      const specialists = createDefaultSpecialists();
      for (const s of specialists) {
        expect(s.systemPrompt.length).toBeGreaterThan(100);
      }
    });
  });

  // ── Individual specialist details ────────────────────────────────────────

  describe('individual specialists', () => {
    it('ArchitectureEngineer has role architecture_engineer', () => {
      const s = new ArchitectureEngineer();
      expect(s.role).toBe('architecture_engineer');
      expect(s.name).toBe('Architecture Engineer');
    });

    it('PerformanceEngineer has role performance_engineer', () => {
      const s = new PerformanceEngineer();
      expect(s.role).toBe('performance_engineer');
      expect(s.name).toBe('Performance Engineer');
    });

    it('SecurityEngineer has role security_engineer', () => {
      const s = new SecurityEngineer();
      expect(s.role).toBe('security_engineer');
      expect(s.name).toBe('Security Engineer');
    });

    it('CostOptimizer has role cost_optimizer', () => {
      const s = new CostOptimizer();
      expect(s.role).toBe('cost_optimizer');
      expect(s.name).toBe('Cost Optimizer');
    });

    it('AIQualityEngineer has role qa_engineer', () => {
      const s = new AIQualityEngineer();
      expect(s.role).toBe('qa_engineer');
      expect(s.name).toBe('AI Quality Engineer');
    });

    it('ProductManager has role product_manager', () => {
      const s = new ProductManager();
      expect(s.role).toBe('product_manager');
      expect(s.name).toBe('Product Manager');
    });

    it('ReliabilityEngineer has role sre', () => {
      const s = new ReliabilityEngineer();
      expect(s.role).toBe('sre');
      expect(s.name).toBe('Reliability Engineer');
    });

    it('DeveloperExperienceEngineer has role devops_engineer', () => {
      const s = new DeveloperExperienceEngineer();
      expect(s.role).toBe('devops_engineer');
      expect(s.name).toBe('Developer Experience Engineer');
    });
  });

  // ── Specialist interface compliance ──────────────────────────────────────

  describe('interface compliance', () => {
    it('all specialists implement analyzeFindings method', () => {
      const specialists = createDefaultSpecialists();
      for (const s of specialists) {
        expect(typeof s.analyzeFindings).toBe('function');
      }
    });

    it('all specialists implement challenge method', () => {
      const specialists = createDefaultSpecialists();
      for (const s of specialists) {
        expect(typeof s.challenge).toBe('function');
      }
    });

    it('all specialists implement defend method', () => {
      const specialists = createDefaultSpecialists();
      for (const s of specialists) {
        expect(typeof s.defend).toBe('function');
      }
    });
  });
});

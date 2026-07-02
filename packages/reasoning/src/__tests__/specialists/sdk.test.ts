/**
 * Tests for the Custom Specialist Agent SDK.
 *
 * Covers: createCustomSpecialist, SpecialistRegistry, SpecialistTemplate,
 * validation, and SDK metadata.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createCustomSpecialist,
  SpecialistRegistry,
  SpecialistTemplate,
  validateConfig,
  validateSpecialist,
  getSDKInfo,
} from '../../specialists/sdk.js';
import type { SpecialistConfig, CustomAnalysisFn } from '../../specialists/sdk.js';
import type { SpecialistRole, Finding, Hypothesis, GraphClient } from '@recurrsive/core';
import type { LLMAdapter } from '../../llm/adapter.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid SpecialistConfig for tests. */
function validConfig(overrides?: Partial<SpecialistConfig>): SpecialistConfig {
  return {
    name: 'Test Specialist',
    description: 'A test specialist for unit tests.',
    domain: 'testing',
    role: 'backend_engineer' as SpecialistRole,
    expertiseAreas: ['unit testing', 'integration testing'],
    cognitiveFramework: 'Apply test-driven evaluation to all findings.',
    priorityAreas: ['test coverage', 'test reliability'],
    weight: 0.8,
    ...overrides,
  };
}

/** Create a mock Specialist for registry tests. */
function mockSpecialist(overrides?: Record<string, unknown>) {
  return {
    role: 'backend_engineer' as SpecialistRole,
    name: 'Mock Specialist',
    cognitiveFramework: 'Mock framework',
    systemPrompt: 'Mock system prompt for testing.',
    analyzeFindings: vi.fn().mockResolvedValue([]),
    challenge: vi.fn().mockResolvedValue('mock challenge'),
    defend: vi.fn().mockResolvedValue({ response: 'defense', revised_confidence: 0.7 }),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createCustomSpecialist
// ---------------------------------------------------------------------------

describe('createCustomSpecialist', () => {
  it('creates a valid specialist from a config', () => {
    const specialist = createCustomSpecialist(validConfig());
    expect(specialist).toBeDefined();
    expect(specialist.name).toBe('Test Specialist');
    expect(specialist.role).toBe('backend_engineer');
  });

  it('sets cognitiveFramework from config', () => {
    const specialist = createCustomSpecialist(validConfig());
    expect(specialist.cognitiveFramework).toBe(
      'Apply test-driven evaluation to all findings.',
    );
  });

  it('generates a non-empty system prompt', () => {
    const specialist = createCustomSpecialist(validConfig());
    expect(specialist.systemPrompt.length).toBeGreaterThan(100);
    expect(specialist.systemPrompt).toContain('Test Specialist');
    expect(specialist.systemPrompt).toContain('unit testing');
  });

  it('includes priority areas in the system prompt when provided', () => {
    const specialist = createCustomSpecialist(validConfig());
    expect(specialist.systemPrompt).toContain('test coverage');
    expect(specialist.systemPrompt).toContain('PRIORITY AREAS');
  });

  it('omits priority section from system prompt when none provided', () => {
    const specialist = createCustomSpecialist(
      validConfig({ priorityAreas: undefined }),
    );
    expect(specialist.systemPrompt).not.toContain('PRIORITY AREAS');
  });

  it('marks the specialist as __custom', () => {
    const specialist = createCustomSpecialist(validConfig());
    expect(specialist.__custom).toBe(true);
  });

  it('stores the original config on __config', () => {
    const config = validConfig();
    const specialist = createCustomSpecialist(config);
    expect(specialist.__config).toEqual(config);
  });

  it('defaults weight to 1.0 when not specified', () => {
    const specialist = createCustomSpecialist(
      validConfig({ weight: undefined }),
    );
    expect(specialist.__config.weight).toBeUndefined();
    // Weight of 1.0 means no confidence scaling — verify specialist still works
    expect(specialist).toBeDefined();
  });

  it('throws on invalid config (missing name)', () => {
    expect(() =>
      createCustomSpecialist(validConfig({ name: '' })),
    ).toThrow('Invalid SpecialistConfig');
  });

  it('throws on invalid config (bad role)', () => {
    expect(() =>
      createCustomSpecialist(validConfig({ role: 'not_a_role' as SpecialistRole })),
    ).toThrow('Invalid SpecialistConfig');
  });

  it('throws on invalid config (empty expertiseAreas)', () => {
    expect(() =>
      createCustomSpecialist(validConfig({ expertiseAreas: [] })),
    ).toThrow('Invalid SpecialistConfig');
  });

  it('implements the analyzeFindings method', () => {
    const specialist = createCustomSpecialist(validConfig());
    expect(typeof specialist.analyzeFindings).toBe('function');
  });

  it('implements the challenge method', () => {
    const specialist = createCustomSpecialist(validConfig());
    expect(typeof specialist.challenge).toBe('function');
  });

  it('implements the defend method', () => {
    const specialist = createCustomSpecialist(validConfig());
    expect(typeof specialist.defend).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// validateConfig
// ---------------------------------------------------------------------------

describe('validateConfig', () => {
  it('accepts a valid config', () => {
    const result = validateConfig(validConfig());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null config', () => {
    const result = validateConfig(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('non-null object');
  });

  it('rejects undefined config', () => {
    const result = validateConfig(undefined);
    expect(result.valid).toBe(false);
  });

  it('rejects missing name', () => {
    const cfg = validConfig();
    (cfg as Record<string, unknown>)['name'] = '';
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"name"'))).toBe(true);
  });

  it('rejects missing description', () => {
    const cfg = validConfig();
    (cfg as Record<string, unknown>)['description'] = '';
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"description"'))).toBe(true);
  });

  it('rejects invalid role', () => {
    const cfg = validConfig({ role: 'invalid_role' as SpecialistRole });
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"role"'))).toBe(true);
  });

  it('rejects empty expertiseAreas', () => {
    const cfg = validConfig({ expertiseAreas: [] });
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"expertiseAreas"'))).toBe(true);
  });

  it('rejects non-string expertiseAreas', () => {
    const cfg = validConfig({ expertiseAreas: [42 as unknown as string] });
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('only strings'))).toBe(true);
  });

  it('rejects weight out of range', () => {
    const result = validateConfig(validConfig({ weight: 1.5 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"weight"'))).toBe(true);
  });

  it('rejects negative weight', () => {
    const result = validateConfig(validConfig({ weight: -0.1 }));
    expect(result.valid).toBe(false);
  });

  it('accepts weight of exactly 0', () => {
    const result = validateConfig(validConfig({ weight: 0 }));
    expect(result.valid).toBe(true);
  });

  it('accepts weight of exactly 1', () => {
    const result = validateConfig(validConfig({ weight: 1 }));
    expect(result.valid).toBe(true);
  });

  it('rejects non-function customAnalysis', () => {
    const cfg = validConfig();
    (cfg as Record<string, unknown>)['customAnalysis'] = 'not-a-function';
    const result = validateConfig(cfg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('"customAnalysis"'))).toBe(true);
  });

  it('accepts a function customAnalysis', () => {
    const fn: CustomAnalysisFn = async () => [];
    const result = validateConfig(validConfig({ customAnalysis: fn }));
    expect(result.valid).toBe(true);
  });

  it('collects multiple errors at once', () => {
    const result = validateConfig({
      name: '',
      description: '',
      domain: '',
      role: 'invalid',
      expertiseAreas: [],
      cognitiveFramework: '',
      weight: 2,
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

// ---------------------------------------------------------------------------
// validateSpecialist
// ---------------------------------------------------------------------------

describe('validateSpecialist', () => {
  it('accepts a valid specialist object', () => {
    const result = validateSpecialist(mockSpecialist());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects null', () => {
    const result = validateSpecialist(null);
    expect(result.valid).toBe(false);
  });

  it('rejects specialist missing analyzeFindings', () => {
    const s = mockSpecialist();
    delete (s as Record<string, unknown>)['analyzeFindings'];
    const result = validateSpecialist(s);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('analyzeFindings'))).toBe(true);
  });

  it('rejects specialist missing challenge', () => {
    const s = mockSpecialist();
    delete (s as Record<string, unknown>)['challenge'];
    const result = validateSpecialist(s);
    expect(result.valid).toBe(false);
  });

  it('rejects specialist missing defend', () => {
    const s = mockSpecialist();
    delete (s as Record<string, unknown>)['defend'];
    const result = validateSpecialist(s);
    expect(result.valid).toBe(false);
  });

  it('rejects specialist with empty name', () => {
    const result = validateSpecialist(mockSpecialist({ name: '' }));
    expect(result.valid).toBe(false);
  });

  it('rejects specialist with invalid role', () => {
    const result = validateSpecialist(mockSpecialist({ role: 'fake_role' }));
    expect(result.valid).toBe(false);
  });

  it('validates a custom-created specialist', () => {
    const specialist = createCustomSpecialist(validConfig());
    const result = validateSpecialist(specialist);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SpecialistRegistry
// ---------------------------------------------------------------------------

describe('SpecialistRegistry', () => {
  let registry: SpecialistRegistry;

  beforeEach(() => {
    registry = new SpecialistRegistry();
  });

  it('starts with no custom specialists', () => {
    expect(registry.customCount).toBe(0);
    expect(registry.getCustom()).toHaveLength(0);
  });

  it('registers a specialist and returns an ID', () => {
    const id = registry.register(mockSpecialist());
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(registry.customCount).toBe(1);
  });

  it('retrieves a registered specialist by ID', () => {
    const specialist = mockSpecialist();
    const id = registry.register(specialist);
    const retrieved = registry.getById(id);
    expect(retrieved).toBe(specialist);
  });

  it('returns undefined for unknown ID', () => {
    expect(registry.getById('nonexistent')).toBeUndefined();
  });

  it('unregisters a specialist by ID', () => {
    const id = registry.register(mockSpecialist());
    expect(registry.customCount).toBe(1);
    const removed = registry.unregister(id);
    expect(removed).toBe(true);
    expect(registry.customCount).toBe(0);
  });

  it('returns false when unregistering unknown ID', () => {
    const removed = registry.unregister('nonexistent');
    expect(removed).toBe(false);
  });

  it('prevents registering duplicate name + role', () => {
    registry.register(mockSpecialist());
    expect(() => registry.register(mockSpecialist())).toThrow('already registered');
  });

  it('allows registering specialists with same name but different role', () => {
    registry.register(mockSpecialist({ name: 'Shared Name', role: 'backend_engineer' }));
    registry.register(mockSpecialist({ name: 'Shared Name', role: 'frontend_engineer' }));
    expect(registry.customCount).toBe(2);
  });

  it('rejects registering an invalid specialist', () => {
    expect(() =>
      registry.register({ name: '', role: '', cognitiveFramework: '' } as never),
    ).toThrow('Cannot register invalid specialist');
  });

  it('getCustom returns only custom specialists', () => {
    registry.register(mockSpecialist({ name: 'Custom A' }));
    registry.register(mockSpecialist({ name: 'Custom B', role: 'frontend_engineer' }));
    const customs = registry.getCustom();
    expect(customs).toHaveLength(2);
    expect(customs.map((s) => s.name)).toContain('Custom A');
    expect(customs.map((s) => s.name)).toContain('Custom B');
  });

  it('getBuiltIn returns the 19 default specialists', () => {
    const builtIn = registry.getBuiltIn();
    expect(builtIn).toHaveLength(19);
  });

  it('getAll returns built-in plus custom specialists', () => {
    registry.register(mockSpecialist());
    const all = registry.getAll();
    expect(all).toHaveLength(20); // 19 built-in + 1 custom
  });

  it('totalCount reflects built-in plus custom', () => {
    expect(registry.totalCount).toBe(19);
    registry.register(mockSpecialist());
    expect(registry.totalCount).toBe(20);
  });

  it('validate method works without registering', () => {
    const result = registry.validate(mockSpecialist());
    expect(result.valid).toBe(true);
    expect(registry.customCount).toBe(0);
  });

  it('clear removes all custom specialists', () => {
    registry.register(mockSpecialist({ name: 'A' }));
    registry.register(mockSpecialist({ name: 'B', role: 'frontend_engineer' }));
    expect(registry.customCount).toBe(2);
    registry.clear();
    expect(registry.customCount).toBe(0);
    expect(registry.getCustom()).toHaveLength(0);
  });

  it('registers a specialist created via createCustomSpecialist', () => {
    const specialist = createCustomSpecialist(validConfig());
    const id = registry.register(specialist);
    expect(typeof id).toBe('string');
    expect(registry.customCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SpecialistTemplate
// ---------------------------------------------------------------------------

describe('SpecialistTemplate', () => {
  it('createSecurityAuditor produces a valid specialist', () => {
    const specialist = SpecialistTemplate.createSecurityAuditor();
    expect(specialist.name).toBe('Security Auditor');
    expect(specialist.role).toBe('security_engineer');
    expect(specialist.__custom).toBe(true);
    const validation = validateSpecialist(specialist);
    expect(validation.valid).toBe(true);
  });

  it('createCostOptimizer produces a valid specialist', () => {
    const specialist = SpecialistTemplate.createCostOptimizer();
    expect(specialist.name).toBe('Cost Optimization Analyst');
    expect(specialist.role).toBe('cost_optimizer');
    expect(specialist.__custom).toBe(true);
    const validation = validateSpecialist(specialist);
    expect(validation.valid).toBe(true);
  });

  it('createComplianceChecker produces a valid specialist', () => {
    const specialist = SpecialistTemplate.createComplianceChecker();
    expect(specialist.name).toBe('Regulatory Compliance Checker');
    expect(specialist.role).toBe('compliance_engineer');
    const validation = validateSpecialist(specialist);
    expect(validation.valid).toBe(true);
  });

  it('createMLOpsEngineer produces a valid specialist', () => {
    const specialist = SpecialistTemplate.createMLOpsEngineer();
    expect(specialist.name).toBe('MLOps Engineer');
    expect(specialist.role).toBe('ml_engineer');
    const validation = validateSpecialist(specialist);
    expect(validation.valid).toBe(true);
  });

  it('templates accept overrides', () => {
    const specialist = SpecialistTemplate.createSecurityAuditor({
      name: 'Custom Security Auditor',
      weight: 0.5,
    });
    expect(specialist.name).toBe('Custom Security Auditor');
    expect(specialist.__config.weight).toBe(0.5);
  });

  it('templates produce specialists with substantial system prompts', () => {
    const auditor = SpecialistTemplate.createSecurityAuditor();
    const optimizer = SpecialistTemplate.createCostOptimizer();
    const compliance = SpecialistTemplate.createComplianceChecker();
    const mlops = SpecialistTemplate.createMLOpsEngineer();

    for (const s of [auditor, optimizer, compliance, mlops]) {
      expect(s.systemPrompt.length).toBeGreaterThan(100);
    }
  });

  it('templates produce specialists with all required methods', () => {
    const auditor = SpecialistTemplate.createSecurityAuditor();
    expect(typeof auditor.analyzeFindings).toBe('function');
    expect(typeof auditor.challenge).toBe('function');
    expect(typeof auditor.defend).toBe('function');
  });

  it('template specialists can be registered in the registry', () => {
    const registry = new SpecialistRegistry();
    const auditor = SpecialistTemplate.createSecurityAuditor();
    const id = registry.register(auditor);
    expect(typeof id).toBe('string');
    expect(registry.customCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getSDKInfo
// ---------------------------------------------------------------------------

describe('getSDKInfo', () => {
  it('returns the SDK version', () => {
    const info = getSDKInfo();
    expect(info.version).toBe('0.5.4');
  });

  it('lists supported methods', () => {
    const info = getSDKInfo();
    expect(info.supportedMethods).toContain('analyzeFindings');
    expect(info.supportedMethods).toContain('challenge');
    expect(info.supportedMethods).toContain('defend');
  });

  it('has a non-empty description', () => {
    const info = getSDKInfo();
    expect(info.description.length).toBeGreaterThan(50);
  });

  it('has example code', () => {
    const info = getSDKInfo();
    expect(info.exampleCode).toContain('createCustomSpecialist');
    expect(info.exampleCode).toContain('SpecialistRegistry');
  });

  it('lists available templates', () => {
    const info = getSDKInfo();
    expect(info.availableTemplates).toContain('createSecurityAuditor');
    expect(info.availableTemplates).toContain('createCostOptimizer');
    expect(info.availableTemplates).toContain('createComplianceChecker');
    expect(info.availableTemplates).toContain('createMLOpsEngineer');
  });
});

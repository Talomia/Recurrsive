/**
 * Custom Specialist Agent SDK
 *
 * Allows users to bring their own specialist agents by:
 * 1. Extending BaseSpecialist with a simple interface
 * 2. Registering them with the reasoning engine
 * 3. Participating in multi-agent debate alongside built-in specialists
 *
 * @module
 */

import { generateId, createLogger } from '@recurrsive/core';
import type {
  SpecialistRole,
  Hypothesis,
  Finding,
  GraphClient,
} from '@recurrsive/core';
import { BaseSpecialist } from './base.js';
import type { Specialist } from './base.js';
import type { LLMAdapter } from '../llm/adapter.js';
import { createDefaultSpecialists } from './index.js';

const logger = createLogger({ context: { component: 'reasoning:sdk' } });

// ---------------------------------------------------------------------------
// SDK version
// ---------------------------------------------------------------------------

/** Current SDK version. */
const SDK_VERSION = '0.1.0' as const;

// ---------------------------------------------------------------------------
// SpecialistConfig — declarative specialist configuration
// ---------------------------------------------------------------------------

/**
 * Optional custom analysis function that a specialist can provide to
 * augment or replace the default LLM-driven analysis.
 *
 * When provided, it is invoked *before* the default LLM analysis, and
 * its returned hypotheses are merged with LLM-produced ones.
 */
export type CustomAnalysisFn = (
  findings: Finding[],
  llm: LLMAdapter,
  graph: GraphClient,
) => Promise<Hypothesis[]>;

/**
 * Declarative configuration for creating a custom specialist agent.
 *
 * @example
 * ```ts
 * const config: SpecialistConfig = {
 *   name: 'Data Pipeline Engineer',
 *   description: 'Evaluates data pipeline health and reliability.',
 *   domain: 'data-engineering',
 *   role: 'backend_engineer',
 *   expertiseAreas: ['ETL', 'streaming', 'batch processing', 'data quality'],
 *   cognitiveFramework: 'Evaluate data pipeline reliability through ...',
 *   priorityAreas: ['data quality', 'pipeline latency', 'schema drift'],
 *   weight: 0.8,
 * };
 * ```
 */
export interface SpecialistConfig {
  /** Human-readable display name. */
  name: string;

  /** Short description of the specialist's focus. */
  description: string;

  /**
   * Domain identifier — a kebab-case slug that scopes the specialist.
   * Used as a namespace for registry look-ups (e.g. `'security'`,
   * `'cost-optimization'`, `'data-engineering'`).
   */
  domain: string;

  /**
   * The specialist role from the canonical enum. Custom specialists
   * must map to an existing {@link SpecialistRole} because the debate
   * protocol and consensus scoring rely on typed roles.
   */
  role: SpecialistRole;

  /** Areas of expertise (used to build the system prompt). */
  expertiseAreas: string[];

  /**
   * Description of the cognitive framework this specialist applies.
   * Passed directly into the specialist base class.
   */
  cognitiveFramework: string;

  /** High-priority topics this specialist emphasises during analysis. */
  priorityAreas?: string[];

  /**
   * Weight (0–1) that scales this specialist's influence during debate.
   * Defaults to `1.0` (equal weight).
   */
  weight?: number;

  /**
   * Optional custom analysis function.
   *
   * When provided, its results are appended to the standard LLM-driven
   * analysis.  This allows rule-based or heuristic augmentation.
   */
  customAnalysis?: CustomAnalysisFn;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Result of a validation check. */
export interface ValidationResult {
  /** Whether the configuration / specialist is valid. */
  valid: boolean;
  /** Human-readable error messages (empty when `valid === true`). */
  errors: string[];
}

/** All canonical specialist roles (kept in sync with SpecialistRoleSchema). */
const VALID_ROLES: ReadonlySet<string> = new Set<string>([
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
  'compliance_engineer',
  'documentation_engineer',
  'release_manager',
  'sre',
]);

/**
 * Validate a {@link SpecialistConfig} object.
 *
 * @param config - The config to validate.
 * @returns Validation result with any errors.
 */
export function validateConfig(config: unknown): ValidationResult {
  const errors: string[] = [];

  if (config === null || config === undefined || typeof config !== 'object') {
    return { valid: false, errors: ['Config must be a non-null object.'] };
  }

  const c = config as Record<string, unknown>;

  // Required string fields
  for (const field of ['name', 'description', 'domain', 'cognitiveFramework'] as const) {
    if (typeof c[field] !== 'string' || (c[field] as string).trim().length === 0) {
      errors.push(`"${field}" must be a non-empty string.`);
    }
  }

  // Role
  if (typeof c['role'] !== 'string' || !VALID_ROLES.has(c['role'] as string)) {
    errors.push(
      `"role" must be one of: ${[...VALID_ROLES].join(', ')}. Got: ${String(c['role'])}.`,
    );
  }

  // Expertise areas
  if (!Array.isArray(c['expertiseAreas']) || (c['expertiseAreas'] as unknown[]).length === 0) {
    errors.push('"expertiseAreas" must be a non-empty array of strings.');
  } else if (!(c['expertiseAreas'] as unknown[]).every((e) => typeof e === 'string')) {
    errors.push('"expertiseAreas" must contain only strings.');
  }

  // Optional weight
  if (c['weight'] !== undefined) {
    if (typeof c['weight'] !== 'number' || c['weight'] < 0 || c['weight'] > 1) {
      errors.push('"weight" must be a number between 0 and 1.');
    }
  }

  // Optional priorityAreas
  if (c['priorityAreas'] !== undefined) {
    if (!Array.isArray(c['priorityAreas'])) {
      errors.push('"priorityAreas" must be an array of strings.');
    } else if (!(c['priorityAreas'] as unknown[]).every((e) => typeof e === 'string')) {
      errors.push('"priorityAreas" must contain only strings.');
    }
  }

  // Optional customAnalysis
  if (c['customAnalysis'] !== undefined && typeof c['customAnalysis'] !== 'function') {
    errors.push('"customAnalysis" must be a function.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate that a specialist object satisfies the {@link Specialist}
 * interface.
 *
 * @param specialist - The specialist instance to validate.
 * @returns Validation result with any errors.
 */
export function validateSpecialist(specialist: unknown): ValidationResult {
  const errors: string[] = [];

  if (specialist === null || specialist === undefined || typeof specialist !== 'object') {
    return { valid: false, errors: ['Specialist must be a non-null object.'] };
  }

  const s = specialist as Record<string, unknown>;

  for (const field of ['role', 'name', 'cognitiveFramework', 'systemPrompt'] as const) {
    if (typeof s[field] !== 'string' || (s[field] as string).trim().length === 0) {
      errors.push(`"${field}" must be a non-empty string.`);
    }
  }

  if (typeof s['role'] === 'string' && !VALID_ROLES.has(s['role'])) {
    errors.push(`"role" is not a recognised SpecialistRole: ${s['role']}.`);
  }

  for (const method of ['analyzeFindings', 'challenge', 'defend'] as const) {
    if (typeof s[method] !== 'function') {
      errors.push(`"${method}" must be a function.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

/**
 * Build a full system prompt from a {@link SpecialistConfig}.
 * Mirrors the structure used by built-in specialists in definitions.ts.
 */
function buildSystemPrompt(config: SpecialistConfig): string {
  const expertiseList = config.expertiseAreas
    .map((area) => `- ${area}`)
    .join('\n');

  const priorityList = config.priorityAreas?.length
    ? `\n\nPRIORITY AREAS:\n${config.priorityAreas.map((p) => `- ${p}`).join('\n')}`
    : '';

  return (
    `You are a specialist agent: ${config.name}.\n` +
    `${config.description}\n\n` +
    `YOUR DOMAIN:\n${expertiseList}\n\n` +
    `YOUR COGNITIVE FRAMEWORK:\n${config.cognitiveFramework}` +
    `${priorityList}\n\n` +
    `CONSTRAINTS:\n` +
    `- Stay within your domain of expertise.\n` +
    `- Provide evidence-backed assessments, not generic advice.\n` +
    `- Be constructive: aim to improve hypotheses, not just criticise.\n` +
    `- Quantify impact and effort wherever possible.`
  );
}

// ---------------------------------------------------------------------------
// createCustomSpecialist — factory function
// ---------------------------------------------------------------------------

/**
 * Create a custom specialist agent from a declarative configuration.
 *
 * The returned specialist extends {@link BaseSpecialist} and can be
 * registered directly with a {@link SpecialistRegistry} or passed to
 * the reasoning engine.
 *
 * @param config - Declarative specialist configuration.
 * @returns A ready-to-use specialist instance.
 * @throws {Error} If the configuration is invalid.
 *
 * @example
 * ```ts
 * const specialist = createCustomSpecialist({
 *   name: 'Data Engineer',
 *   description: 'Focuses on data pipeline reliability.',
 *   domain: 'data-engineering',
 *   role: 'backend_engineer',
 *   expertiseAreas: ['ETL', 'streaming', 'schema evolution'],
 *   cognitiveFramework: 'Evaluate data pipeline health...',
 * });
 * ```
 */
export function createCustomSpecialist(config: SpecialistConfig): Specialist & { __custom: true; __config: SpecialistConfig } {
  const validation = validateConfig(config);
  if (!validation.valid) {
    throw new Error(
      `Invalid SpecialistConfig: ${validation.errors.join(' ')}`,
    );
  }

  const systemPrompt = buildSystemPrompt(config);
  const weight = config.weight ?? 1.0;

  // Dynamically create a concrete subclass of BaseSpecialist
  class CustomSpecialist extends BaseSpecialist {
    override role: SpecialistRole = config.role;
    override name = config.name;
    override cognitiveFramework = config.cognitiveFramework;
    override systemPrompt = systemPrompt;

    /** Marks this specialist as custom-created via the SDK. */
    readonly __custom = true as const;

    /** The original config used to create this specialist. */
    readonly __config: SpecialistConfig = config;

    /**
     * Override analyzeFindings to support custom analysis functions
     * and weight-based confidence scaling.
     */
    override async analyzeFindings(
      findings: Finding[],
      llm: LLMAdapter,
      graph: GraphClient,
    ): Promise<Hypothesis[]> {
      // Run standard LLM analysis from BaseSpecialist
      const baseHypotheses = await super.analyzeFindings(findings, llm, graph);

      // If a custom analysis function is provided, merge its results
      let customHypotheses: Hypothesis[] = [];
      if (config.customAnalysis) {
        try {
          customHypotheses = await config.customAnalysis(findings, llm, graph);
        } catch (err) {
          logger.warn(
            `Custom analysis function for "${config.name}" failed: ` +
            `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Merge and apply weight scaling to confidence values
      const allHypotheses = [...baseHypotheses, ...customHypotheses];
      if (weight < 1.0) {
        for (const h of allHypotheses) {
          h.confidence = Math.max(0, Math.min(1, h.confidence * weight));
        }
      }

      return allHypotheses;
    }
  }

  const instance = new CustomSpecialist();
  logger.info(`Created custom specialist: "${config.name}" (role=${config.role}, domain=${config.domain})`);
  return instance;
}

// ---------------------------------------------------------------------------
// SpecialistRegistry
// ---------------------------------------------------------------------------

/**
 * Registry for managing both built-in and custom specialist agents.
 *
 * Provides CRUD operations for custom specialists and a unified view
 * that includes the default nineteen built-in specialists.
 *
 * @example
 * ```ts
 * const registry = new SpecialistRegistry();
 * registry.register(myCustomSpecialist);
 * const all = registry.getAll(); // built-in + custom
 * ```
 */
export class SpecialistRegistry {
  /** Custom specialists keyed by a generated ID. */
  private readonly customs = new Map<string, Specialist>();

  /** Cached built-in specialists (created lazily on first access). */
  private builtInCache: Specialist[] | null = null;

  // ── Registration ─────────────────────────────────────────────────────

  /**
   * Register a custom specialist.
   *
   * @param specialist - The specialist instance to register.
   * @returns A unique registration ID for later reference.
   * @throws {Error} If the specialist fails validation.
   */
  register(specialist: Specialist): string {
    const validation = validateSpecialist(specialist);
    if (!validation.valid) {
      throw new Error(
        `Cannot register invalid specialist: ${validation.errors.join(' ')}`,
      );
    }

    // Check for duplicate names among custom specialists
    for (const existing of this.customs.values()) {
      if (existing.name === specialist.name && existing.role === specialist.role) {
        throw new Error(
          `A custom specialist with name "${specialist.name}" and role "${specialist.role}" is already registered.`,
        );
      }
    }

    const id = generateId();
    this.customs.set(id, specialist);
    logger.info(`Registered custom specialist "${specialist.name}" with ID ${id}`);
    return id;
  }

  /**
   * Unregister a previously registered custom specialist.
   *
   * @param id - The registration ID returned by {@link register}.
   * @returns `true` if the specialist was found and removed, `false` otherwise.
   */
  unregister(id: string): boolean {
    const specialist = this.customs.get(id);
    if (specialist) {
      this.customs.delete(id);
      logger.info(`Unregistered custom specialist "${specialist.name}" (${id})`);
      return true;
    }
    return false;
  }

  // ── Queries ──────────────────────────────────────────────────────────

  /**
   * Get all specialists — built-in plus custom.
   *
   * @returns Combined array of all specialist instances.
   */
  getAll(): Specialist[] {
    return [...this.getBuiltIn(), ...this.getCustom()];
  }

  /**
   * Get only the custom-registered specialists.
   *
   * @returns Array of custom specialist instances.
   */
  getCustom(): Specialist[] {
    return [...this.customs.values()];
  }

  /**
   * Get the built-in default specialists.
   *
   * @returns Array of the nineteen built-in specialists.
   */
  getBuiltIn(): Specialist[] {
    if (!this.builtInCache) {
      this.builtInCache = createDefaultSpecialists();
    }
    return [...this.builtInCache];
  }

  /**
   * Get a custom specialist by its registration ID.
   *
   * @param id - The registration ID.
   * @returns The specialist, or `undefined` if not found.
   */
  getById(id: string): Specialist | undefined {
    return this.customs.get(id);
  }

  /**
   * Get the number of registered custom specialists.
   */
  get customCount(): number {
    return this.customs.size;
  }

  /**
   * Get the total number of specialists (built-in + custom).
   */
  get totalCount(): number {
    return this.getBuiltIn().length + this.customs.size;
  }

  // ── Validation ───────────────────────────────────────────────────────

  /**
   * Validate a specialist without registering it.
   *
   * @param specialist - The specialist to validate.
   * @returns Validation result.
   */
  validate(specialist: unknown): ValidationResult {
    return validateSpecialist(specialist);
  }

  /**
   * Remove all custom specialists from the registry.
   */
  clear(): void {
    this.customs.clear();
    logger.info('Cleared all custom specialists from registry');
  }
}

// ---------------------------------------------------------------------------
// SpecialistTemplate — pre-built templates for common domains
// ---------------------------------------------------------------------------

/**
 * Pre-built templates for common specialist domains.
 *
 * Each template returns a fully configured {@link Specialist} instance
 * with sensible defaults that can be overridden via an optional partial
 * config.
 *
 * @example
 * ```ts
 * const auditor = SpecialistTemplate.createSecurityAuditor();
 * const optimizer = SpecialistTemplate.createCostOptimizer({
 *   weight: 0.9,
 *   priorityAreas: ['GPU costs', 'token optimization'],
 * });
 * ```
 */
export const SpecialistTemplate = {
  /**
   * Create a security auditor specialist focused on vulnerability
   * detection, OWASP compliance, and threat modelling.
   */
  createSecurityAuditor(
    overrides?: Partial<SpecialistConfig>,
  ): Specialist & { __custom: true; __config: SpecialistConfig } {
    return createCustomSpecialist({
      name: 'Security Auditor',
      description:
        'Performs deep security audits focusing on vulnerability detection, ' +
        'OWASP compliance, and attack surface analysis.',
      domain: 'security',
      role: 'security_engineer',
      expertiseAreas: [
        'OWASP Top 10 vulnerability detection',
        'Authentication and authorization flaws',
        'Input validation and injection prevention',
        'Cryptographic implementation review',
        'Supply chain and dependency security',
        'API security and rate limiting',
        'Secrets management and key rotation',
      ],
      cognitiveFramework:
        '1. Enumerate all attack surfaces and data entry points.\n' +
        '2. Apply STRIDE threat modelling to each component.\n' +
        '3. Assess exploitability using CVSS scoring methodology.\n' +
        '4. Evaluate defence-in-depth: how many controls must fail?\n' +
        '5. Prioritise by exploitability × impact.',
      priorityAreas: [
        'Authentication bypass',
        'Injection vulnerabilities',
        'Sensitive data exposure',
        'Broken access control',
      ],
      weight: 1.0,
      ...overrides,
    });
  },

  /**
   * Create a cost optimizer specialist focused on cloud economics,
   * resource right-sizing, and engineering efficiency.
   */
  createCostOptimizer(
    overrides?: Partial<SpecialistConfig>,
  ): Specialist & { __custom: true; __config: SpecialistConfig } {
    return createCustomSpecialist({
      name: 'Cost Optimization Analyst',
      description:
        'Analyses infrastructure and engineering costs to identify savings ' +
        'opportunities and improve ROI of technical investments.',
      domain: 'cost-optimization',
      role: 'cost_optimizer',
      expertiseAreas: [
        'Cloud resource right-sizing and reservation strategies',
        'Engineering productivity and developer time costs',
        'CI/CD pipeline cost optimization',
        'Licensing and vendor cost analysis',
        'Technical debt economic modelling',
        'Data storage and transfer cost management',
        'AI/ML infrastructure cost optimization',
      ],
      cognitiveFramework:
        '1. Establish cost baselines for current operations.\n' +
        '2. Calculate fully-loaded costs including engineering time.\n' +
        '3. Estimate ROI with payback periods for each opportunity.\n' +
        '4. Model compound costs of inaction (tech debt interest).\n' +
        '5. Identify second-order cost effects.',
      priorityAreas: [
        'Cloud spend reduction',
        'Build pipeline efficiency',
        'License consolidation',
      ],
      weight: 0.9,
      ...overrides,
    });
  },

  /**
   * Create a compliance checker specialist focused on regulatory
   * requirements and audit readiness.
   */
  createComplianceChecker(
    overrides?: Partial<SpecialistConfig>,
  ): Specialist & { __custom: true; __config: SpecialistConfig } {
    return createCustomSpecialist({
      name: 'Regulatory Compliance Checker',
      description:
        'Evaluates codebase and infrastructure against regulatory frameworks ' +
        'including SOC 2, HIPAA, GDPR, and PCI-DSS.',
      domain: 'compliance',
      role: 'compliance_engineer',
      expertiseAreas: [
        'SOC 2 Type II compliance controls',
        'HIPAA technical safeguards',
        'GDPR data protection requirements',
        'PCI-DSS cardholder data security',
        'Audit trail and logging requirements',
        'Data retention and deletion policies',
        'Access control and least privilege enforcement',
      ],
      cognitiveFramework:
        '1. Map technical controls to regulatory requirements.\n' +
        '2. Identify gaps between current state and compliance targets.\n' +
        '3. Assess risk of non-compliance including potential penalties.\n' +
        '4. Prioritise remediation by regulatory deadline and risk.\n' +
        '5. Evaluate audit readiness and evidence collection.',
      priorityAreas: [
        'Data handling compliance',
        'Access control gaps',
        'Audit trail completeness',
        'Encryption requirements',
      ],
      weight: 1.0,
      ...overrides,
    });
  },

  /**
   * Create an MLOps engineer specialist focused on ML pipeline
   * operations, model lifecycle management, and inference optimisation.
   */
  createMLOpsEngineer(
    overrides?: Partial<SpecialistConfig>,
  ): Specialist & { __custom: true; __config: SpecialistConfig } {
    return createCustomSpecialist({
      name: 'MLOps Engineer',
      description:
        'Evaluates ML pipeline operations including model training, deployment, ' +
        'monitoring, and lifecycle management.',
      domain: 'mlops',
      role: 'ml_engineer',
      expertiseAreas: [
        'ML model training pipeline reliability',
        'Model versioning and experiment tracking',
        'Feature store management and feature drift',
        'Model deployment and serving infrastructure',
        'Model monitoring and performance degradation detection',
        'Data pipeline integration and schema validation',
        'GPU utilisation and training cost optimization',
      ],
      cognitiveFramework:
        '1. Evaluate model lifecycle from training to retirement.\n' +
        '2. Assess pipeline reliability and reproducibility.\n' +
        '3. Check monitoring coverage for data/model drift.\n' +
        '4. Analyse inference latency and throughput bottlenecks.\n' +
        '5. Review cost efficiency of compute resources.',
      priorityAreas: [
        'Model drift detection',
        'Training pipeline reliability',
        'Inference optimization',
        'Feature quality',
      ],
      weight: 0.85,
      ...overrides,
    });
  },
} as const;

// ---------------------------------------------------------------------------
// SpecialistSDKInfo — SDK metadata
// ---------------------------------------------------------------------------

/**
 * Metadata about the Custom Specialist SDK.
 */
export interface SpecialistSDKInfoData {
  /** SDK version string (semver). */
  version: string;
  /** Supported methods that custom specialists can use. */
  supportedMethods: readonly string[];
  /** Human-readable overview of the SDK. */
  description: string;
  /** Example code snippet. */
  exampleCode: string;
  /** Available template names. */
  availableTemplates: readonly string[];
}

/**
 * Get metadata about the Custom Specialist SDK.
 *
 * @returns SDK information including version, supported methods, and
 *   example usage.
 */
export function getSDKInfo(): SpecialistSDKInfoData {
  return {
    version: SDK_VERSION,
    supportedMethods: [
      'analyzeFindings',
      'challenge',
      'defend',
    ] as const,
    description:
      'The Custom Specialist Agent SDK allows users to create domain-specific ' +
      'specialist agents that participate in the Recurrsive multi-agent debate ' +
      'system. Specialists can be created declaratively via SpecialistConfig, ' +
      'using pre-built templates, or by extending BaseSpecialist directly.',
    exampleCode: `
import { createCustomSpecialist, SpecialistRegistry, SpecialistTemplate } from '@recurrsive/reasoning';

// Option 1: Declarative config
const specialist = createCustomSpecialist({
  name: 'Data Engineer',
  description: 'Focuses on data pipeline reliability.',
  domain: 'data-engineering',
  role: 'backend_engineer',
  expertiseAreas: ['ETL', 'streaming', 'schema evolution'],
  cognitiveFramework: 'Evaluate data pipeline health...',
});

// Option 2: Use a template
const auditor = SpecialistTemplate.createSecurityAuditor();

// Register with the engine
const registry = new SpecialistRegistry();
registry.register(specialist);
registry.register(auditor);

// Get all specialists (built-in + custom)
const all = registry.getAll();
`.trim(),
    availableTemplates: [
      'createSecurityAuditor',
      'createCostOptimizer',
      'createComplianceChecker',
      'createMLOpsEngineer',
    ] as const,
  };
}

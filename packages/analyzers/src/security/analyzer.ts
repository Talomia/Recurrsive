/**
 * @module @recurrsive/analyzers/security
 *
 * Security analyzer that detects common security vulnerabilities
 * such as hardcoded secrets, SQL injection risks, unsafe
 * deserialization, and permissive CORS.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

/** Regex patterns for detecting hardcoded secrets. */
const SECRET_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'AWS Access Key', pattern: /AKIA[0-9A-Z]{16}/ },
  { name: 'AWS Secret Key', pattern: /(?:aws_secret_access_key|aws_secret)\s*[:=]\s*["'][A-Za-z0-9/+=]{40}["']/ },
  { name: 'Generic API Key', pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][A-Za-z0-9_\-]{20,}["']/i },
  { name: 'Generic Secret', pattern: /(?:secret|password|passwd|token)\s*[:=]\s*["'][^"']{8,}["']/i },
  { name: 'Bearer Token', pattern: /(?:bearer|authorization)\s*[:=]\s*["'](?:Bearer\s+)?[A-Za-z0-9._\-]{20,}["']/i },
  { name: 'Private Key', pattern: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/ },
  { name: 'GitHub Token', pattern: /gh[ps]_[A-Za-z0-9_]{36,}/ },
  { name: 'Stripe Key', pattern: /sk_(?:live|test)_[A-Za-z0-9]{24,}/ },
  { name: 'Slack Token', pattern: /xox[bpors]-[A-Za-z0-9\-]{10,}/ },
  { name: 'JWT Token', pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/ },
];

/** PII patterns for prompt inspection. */
const PII_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
  { name: 'Phone', pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/ },
  { name: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
  { name: 'Credit Card', pattern: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/ },
];

/**
 * Analyzes the knowledge graph for security vulnerabilities.
 *
 * ### Rules
 * 1. Hardcoded secrets — API keys, passwords, tokens in source code
 * 2. PII in prompts — personal information in prompt templates
 * 3. Unsafe deserialization — eval(), Function(), JSON.parse without validation
 * 4. Missing input validation — endpoints without validation
 * 5. Permissive CORS — overly permissive CORS configuration
 * 6. Missing authentication — endpoints without auth middleware
 * 7. Dependency vulnerabilities — known vulnerable dependency patterns
 * 8. SQL injection risk — string concatenation in SQL queries
 */
export class SecurityAnalyzer implements Analyzer {
  readonly id = 'security.vulnerabilities';
  readonly name = 'Security Analyzer';
  readonly description =
    'Detects security vulnerabilities including hardcoded secrets, injection risks, and missing authentication.';
  readonly version = '0.1.0';
  readonly categories = ['security' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      secrets,
      pii,
      deserialization,
      inputValidation,
      cors,
      auth,
      depVulns,
      sqlInjection,
    ] = await Promise.all([
      this.detectHardcodedSecrets(ctx),
      this.detectPIIInPrompts(ctx),
      this.detectUnsafeDeserialization(ctx),
      this.detectMissingInputValidation(ctx),
      this.detectPermissiveCORS(ctx),
      this.detectMissingAuthentication(ctx),
      this.detectDependencyVulnerabilities(ctx),
      this.detectSQLInjectionRisk(ctx),
    ]);

    findings.push(
      ...secrets,
      ...pii,
      ...deserialization,
      ...inputValidation,
      ...cors,
      ...auth,
      ...depVulns,
      ...sqlInjection,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(_ctx: AnalysisContext): Promise<Finding[]> {
    return [];
  }

  // ── Rule 1: Hardcoded Secrets ──────────────────────────────────────

  /**
   * Detect API keys, passwords, and tokens hardcoded in source files.
   *
   * @param ctx - Analysis context.
   * @returns Findings for hardcoded secrets.
   */
  private async detectHardcodedSecrets(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const files = await ctx.graph.getEntities('file');
    const secrets = await ctx.graph.getEntities('secret');

    // Check for secrets entities that are referenced from source files
    for (const secret of secrets) {
      const isHardcoded =
        secret.properties['hardcoded'] === true ||
        secret.tags.includes('hardcoded') ||
        secret.properties['storage'] === 'source_code';

      if (isHardcoded) {
        const loc = locationFromEntity(secret);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Hardcoded secret: ${secret.name}`,
            description: `Secret '${secret.name}' is hardcoded in source code. Hardcoded secrets can be exposed through version control, logs, and error messages.`,
            severity: 'critical',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Secret stored in source code',
                entity_ids: [secret.id],
                confidence: 0.95,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Move secrets to environment variables or a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault). Add the file to .gitignore if it contains local secrets.',
            confidence: 0.95,
            tags: ['hardcoded-secret', 'security', 'credentials'],
          }),
        );
      }
    }

    // Scan file contents for secret patterns
    for (const file of files) {
      // Skip common non-source files
      if (/\.(lock|min\.|map|svg|png|jpg|gif)$/i.test(file.name)) continue;
      if (file.name === '.env.example' || file.name === '.env.template') continue;

      const content = (file.properties['content'] as string | undefined) ?? '';
      if (content.length === 0) continue;

      for (const { name, pattern } of SECRET_PATTERNS) {
        if (pattern.test(content)) {
          const loc = locationFromEntity(file);
          findings.push(
            createFinding({
              analyzer_id: this.id,
              title: `Possible ${name} in ${file.name}`,
              description: `File '${file.name}' may contain a ${name}. Review this file and move any real credentials to a secrets manager.`,
              severity: 'critical',
              category: 'security',
              evidence: [
                createEvidence({
                  type: 'code',
                  source: this.id,
                  description: `Pattern match for ${name}`,
                  entity_ids: [file.id],
                  confidence: 0.8,
                  data: { pattern_name: name },
                }),
              ],
              locations: loc ? [loc] : [],
              suggested_fix: `Remove the ${name} from source code. Use environment variables or a secrets manager instead. Run git filter-branch or BFG to remove from history.`,
              confidence: 0.8,
              tags: ['hardcoded-secret', 'security', name.toLowerCase().replace(/\s+/g, '-')],
            }),
          );
        }
      }
    }

    return findings;
  }

  // ── Rule 2: PII in Prompts ─────────────────────────────────────────

  /**
   * Detect personal information in prompt templates.
   *
   * @param ctx - Analysis context.
   * @returns Findings for PII in prompts.
   */
  private async detectPIIInPrompts(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const prompts = await ctx.graph.getEntities('prompt');

    for (const prompt of prompts) {
      const content =
        (prompt.properties['template'] as string | undefined) ??
        (prompt.properties['content'] as string | undefined) ??
        '';

      const detectedPII: string[] = [];
      for (const { name, pattern } of PII_PATTERNS) {
        if (pattern.test(content)) {
          detectedPII.push(name);
        }
      }

      // Also check for PII markers
      if (prompt.tags.includes('contains-pii') || prompt.properties['contains_pii'] === true) {
        detectedPII.push('tagged PII');
      }

      if (detectedPII.length > 0) {
        const loc = locationFromEntity(prompt);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `PII in prompt template: ${prompt.name}`,
            description: `Prompt '${prompt.name}' contains or references personal information (${detectedPII.join(', ')}). Sending PII to LLM providers may violate privacy regulations (GDPR, CCPA) and create data exposure risks.`,
            severity: 'high',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `PII detected: ${detectedPII.join(', ')}`,
                entity_ids: [prompt.id],
                confidence: 0.75,
                data: { detected_pii_types: detectedPII },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Remove PII from prompt templates. Anonymize or pseudonymize data before sending to LLM providers. Implement PII detection and redaction in the prompt pipeline.',
            confidence: 0.7,
            tags: ['pii', 'security', 'privacy', 'compliance'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: Unsafe Deserialization ─────────────────────────────────

  /**
   * Detect usage of eval(), Function(), or JSON.parse without
   * validation.
   *
   * @param ctx - Analysis context.
   * @returns Findings for unsafe deserialization.
   */
  private async detectUnsafeDeserialization(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    const files = await ctx.graph.getEntities('file');

    // Check function-level markers
    for (const fn of functions) {
      const usesEval =
        fn.properties['uses_eval'] === true ||
        fn.tags.includes('eval') ||
        fn.name.toLowerCase() === 'eval';
      const usesFunction =
        fn.properties['uses_function_constructor'] === true ||
        fn.tags.includes('function-constructor');
      const usesUnsafeParse =
        fn.properties['unsafe_json_parse'] === true ||
        fn.tags.includes('unsafe-parse');

      const issues: string[] = [];
      if (usesEval) issues.push('eval()');
      if (usesFunction) issues.push('Function()');
      if (usesUnsafeParse) issues.push('unvalidated JSON.parse');

      if (issues.length > 0) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Unsafe deserialization: ${fn.name}`,
            description: `Function '${fn.name}' uses ${issues.join(', ')}. These patterns can lead to code injection if the input is not trusted.`,
            severity: 'critical',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `Uses: ${issues.join(', ')}`,
                entity_ids: [fn.id],
                confidence: 0.9,
                data: { unsafe_patterns: issues },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Replace eval() with safe alternatives (e.g., JSON.parse with schema validation). Never use Function() or eval() on untrusted input. Validate all deserialized data with Zod or similar.',
            confidence: 0.9,
            tags: ['unsafe-deserialization', 'security', 'injection'],
          }),
        );
      }
    }

    // Also scan file contents for eval patterns
    for (const file of files) {
      const content = (file.properties['content'] as string | undefined) ?? '';
      if (content.length === 0) continue;

      const hasEval = /\beval\s*\(/.test(content);
      const hasFunctionConstructor = /new\s+Function\s*\(/.test(content);

      if (hasEval || hasFunctionConstructor) {
        const patterns = [];
        if (hasEval) patterns.push('eval()');
        if (hasFunctionConstructor) patterns.push('new Function()');

        const loc = locationFromEntity(file);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Unsafe code execution in ${file.name}`,
            description: `File '${file.name}' contains ${patterns.join(' and ')} calls. These enable arbitrary code execution and are a major security risk.`,
            severity: 'critical',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `Found ${patterns.join(', ')} in file content`,
                entity_ids: [file.id],
                confidence: 0.85,
                data: { patterns },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Remove eval() and new Function() calls. Use JSON.parse for data, template literals for strings, and sandboxed execution environments for dynamic code.',
            confidence: 0.85,
            tags: ['eval', 'security', 'code-injection'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 4: Missing Input Validation ───────────────────────────────

  /**
   * Detect endpoints without input validation.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing input validation.
   */
  private async detectMissingInputValidation(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');

    for (const endpoint of endpoints) {
      const method = ((endpoint.properties['method'] as string | undefined) ?? '').toUpperCase();
      // Focus on endpoints that accept data
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && method !== '') continue;

      const hasValidation =
        endpoint.properties['has_validation'] === true ||
        endpoint.tags.includes('validated') ||
        endpoint.tags.includes('input-validated') ||
        endpoint.tags.includes('schema-validated');

      if (!hasValidation) {
        const path = (endpoint.properties['path'] as string | undefined) ?? endpoint.name;
        const loc = locationFromEntity(endpoint);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing input validation: ${method} ${path}`,
            description: `Endpoint '${method} ${path}' does not validate input. All endpoints that accept user data must validate inputs to prevent injection attacks, data corruption, and unexpected behavior.`,
            severity: 'high',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Endpoint accepts data without validation',
                entity_ids: [endpoint.id],
                confidence: 0.8,
                data: { method, path },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add request body validation using Zod, Joi, or class-validator. Validate query parameters, path parameters, and headers as well.',
            confidence: 0.75,
            tags: ['input-validation', 'security', 'api'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 5: Permissive CORS ────────────────────────────────────────

  /**
   * Detect overly permissive CORS configuration.
   *
   * @param ctx - Analysis context.
   * @returns Findings for permissive CORS.
   */
  private async detectPermissiveCORS(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const configs = await ctx.graph.getEntities('config');

    for (const config of configs) {
      const corsOrigin = config.properties['cors_origin'] as string | undefined;
      const corsConfig = config.properties['cors'] as Record<string, unknown> | undefined;

      const isPermissive =
        corsOrigin === '*' ||
        config.tags.includes('cors-wildcard') ||
        (corsConfig && (corsConfig['origin'] === '*' || corsConfig['origin'] === true));

      if (isPermissive) {
        const loc = locationFromEntity(config);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Permissive CORS: ${config.name}`,
            description: `Config '${config.name}' allows CORS requests from any origin (*). This permits cross-origin attacks and should be restricted to specific trusted domains.`,
            severity: 'high',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'CORS origin set to wildcard (*)',
                entity_ids: [config.id],
                confidence: 0.9,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Restrict CORS origins to specific trusted domains. Use environment-specific CORS configuration (strict in production, permissive in development).',
            confidence: 0.85,
            tags: ['cors', 'security', 'configuration'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 6: Missing Authentication ─────────────────────────────────

  /**
   * Detect endpoints without authentication middleware.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing authentication.
   */
  private async detectMissingAuthentication(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');

    // Skip known public endpoints
    const publicPaths = ['/health', '/ready', '/readiness', '/liveness', '/metrics', '/favicon.ico', '/robots.txt'];

    for (const endpoint of endpoints) {
      const path = ((endpoint.properties['path'] as string | undefined) ?? endpoint.name).toLowerCase();

      // Skip public endpoints
      if (publicPaths.some((pp) => path.includes(pp))) continue;
      if (endpoint.tags.includes('public') || endpoint.properties['public'] === true) continue;

      const hasAuth =
        endpoint.properties['authenticated'] === true ||
        endpoint.properties['has_auth'] === true ||
        endpoint.tags.includes('authenticated') ||
        endpoint.tags.includes('auth-required') ||
        endpoint.tags.includes('protected');

      if (!hasAuth) {
        const method = (endpoint.properties['method'] as string | undefined) ?? '';
        const loc = locationFromEntity(endpoint);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing authentication: ${method} ${path}`,
            description: `Endpoint '${method} ${path}' does not have authentication configured. Unauthenticated endpoints can be accessed by anyone, potentially exposing sensitive data or functionality.`,
            severity: 'high',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Endpoint without authentication middleware',
                entity_ids: [endpoint.id],
                confidence: 0.7,
                data: { method, path },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add authentication middleware (e.g., JWT verification, API key validation). If the endpoint is intentionally public, tag it as "public" to suppress this finding.',
            confidence: 0.65,
            tags: ['missing-auth', 'security', 'authentication'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 7: Dependency Vulnerabilities ─────────────────────────────

  /**
   * Detect known vulnerable dependency patterns.
   *
   * @param ctx - Analysis context.
   * @returns Findings for vulnerable dependencies.
   */
  private async detectDependencyVulnerabilities(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dependencies = await ctx.graph.getEntities('dependency');

    for (const dep of dependencies) {
      const hasVulnerability =
        dep.properties['has_vulnerability'] === true ||
        dep.properties['vulnerabilities'] != null ||
        dep.tags.includes('vulnerable') ||
        dep.tags.includes('cve');

      const isOutdated =
        dep.properties['is_outdated'] === true ||
        dep.tags.includes('outdated') ||
        dep.tags.includes('deprecated');

      if (hasVulnerability) {
        const vulnCount = Array.isArray(dep.properties['vulnerabilities'])
          ? (dep.properties['vulnerabilities'] as unknown[]).length
          : 1;
        const loc = locationFromEntity(dep);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Vulnerable dependency: ${dep.name}`,
            description: `Dependency '${dep.name}' has ${vulnCount} known vulnerability(ies). Update to a patched version or find an alternative package.`,
            severity: 'critical',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `${vulnCount} known vulnerabilities`,
                entity_ids: [dep.id],
                confidence: 0.9,
                data: { vulnerability_count: vulnCount },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Run 'npm audit fix' or 'yarn upgrade ${dep.name}' to update to a patched version. If no patch is available, evaluate alternatives.`,
            confidence: 0.9,
            tags: ['dependency-vulnerability', 'security', 'supply-chain'],
          }),
        );
      }

      if (isOutdated && !hasVulnerability) {
        const loc = locationFromEntity(dep);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Outdated dependency: ${dep.name}`,
            description: `Dependency '${dep.name}' is outdated. Outdated dependencies may have unpatched security issues and miss performance improvements.`,
            severity: 'low',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Dependency marked as outdated',
                entity_ids: [dep.id],
                confidence: 0.7,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Update '${dep.name}' to the latest stable version. Review the changelog for breaking changes before upgrading.`,
            confidence: 0.65,
            tags: ['outdated-dependency', 'security', 'maintenance'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 8: SQL Injection Risk ─────────────────────────────────────

  /**
   * Detect string concatenation in SQL queries suggesting SQL
   * injection risks.
   *
   * @param ctx - Analysis context.
   * @returns Findings for SQL injection risks.
   */
  private async detectSQLInjectionRisk(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const queries = await ctx.graph.getEntities('query');
    const functions = await ctx.graph.getEntities('function');

    for (const query of queries) {
      const usesConcatenation =
        query.properties['uses_string_concatenation'] === true ||
        query.properties['uses_template_literal'] === true ||
        query.tags.includes('string-concatenation') ||
        query.tags.includes('dynamic-sql');

      const usesParameterizedQuery =
        query.properties['parameterized'] === true ||
        query.tags.includes('parameterized') ||
        query.tags.includes('prepared-statement');

      if (usesConcatenation && !usesParameterizedQuery) {
        const loc = locationFromEntity(query);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `SQL injection risk: ${query.name}`,
            description: `Query '${query.name}' uses string concatenation to build SQL, which is vulnerable to SQL injection. Always use parameterized queries.`,
            severity: 'critical',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'SQL built with string concatenation',
                entity_ids: [query.id],
                confidence: 0.9,
                data: { uses_concatenation: usesConcatenation, parameterized: usesParameterizedQuery },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Use parameterized queries or prepared statements. With ORMs, use their built-in query builders. Never interpolate user input into SQL strings.',
            confidence: 0.85,
            tags: ['sql-injection', 'security', 'injection'],
          }),
        );
      }
    }

    // Also check functions for SQL concatenation patterns
    for (const fn of functions) {
      const hasSQLConcat =
        fn.properties['sql_concatenation'] === true ||
        fn.tags.includes('sql-concatenation');

      if (hasSQLConcat) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `SQL injection risk in function: ${fn.name}`,
            description: `Function '${fn.name}' constructs SQL queries using string concatenation. This pattern is vulnerable to SQL injection attacks.`,
            severity: 'critical',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Function builds SQL with string concatenation',
                entity_ids: [fn.id],
                confidence: 0.85,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Replace string concatenation with parameterized queries (e.g., $1 placeholders in PostgreSQL, ? in MySQL).',
            confidence: 0.85,
            tags: ['sql-injection', 'security', 'injection'],
          }),
        );
      }
    }

    return findings;
  }
}

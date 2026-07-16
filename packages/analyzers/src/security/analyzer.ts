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
 * 1. PII in prompts — personal information in prompt templates
 * 2. Missing input validation — mutation endpoints without validation
 * 3. Missing authentication — endpoints without auth middleware
 *
 * ### Removed rules (producer/consumer contract mismatch)
 * The following rules were removed because no parser or collector in the
 * pipeline emits the data they require, so they could only ever false-positive
 * or sit permanently dead:
 * - Hardcoded secrets — required `secret` entities and file `content`, neither
 *   of which is produced (the git collector deliberately does not store file
 *   content).
 * - Unsafe deserialization — required `uses_eval`/`unsafe_json_parse` markers
 *   and file content, none produced.
 * - Permissive CORS — required a `cors_origin`/`cors` property on `config`
 *   entities; config entities only carry `{framework, pattern}`.
 * - Dependency vulnerabilities — required `has_vulnerability`/`vulnerabilities`
 *   markers never set by the git collector. Real CVE detection lives in the
 *   {@link DependencyAnalyzer}, which compares produced name+version data.
 * - SQL injection risk — required `query` entities and `sql_concatenation`
 *   markers, none produced.
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

    const [pii, inputValidation, auth] = await Promise.all([
      this.detectPIIInPrompts(ctx),
      this.detectMissingInputValidation(ctx),
      this.detectMissingAuthentication(ctx),
    ]);

    findings.push(...pii, ...inputValidation, ...auth);

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Systemic check: no endpoints have authentication
    const endpoints = await ctx.graph.getEntities('endpoint');
    if (endpoints.length >= 3) {
      const authenticated = endpoints.filter(
        (e) => e.properties['authenticated'] === true || (e.tags ?? []).includes('authenticated'),
      );
      if (authenticated.length === 0) {
        findings.push(
          createFinding({
            title: 'No authenticated endpoints in the project',
            description:
              `None of the ${endpoints.length} API endpoints have authentication markers. ` +
              `This suggests authentication is either not implemented or not detectable from ` +
              `the codebase. Consider adding auth middleware or documenting public endpoints.`,
            severity: 'high',
            category: 'security',
            analyzer_id: this.id,
            evidence: [
              createEvidence({
                type: 'metric',
                source: 'security.vulnerabilities',
                description: `${endpoints.length} endpoints, 0 authenticated`,
                entity_ids: [],
                confidence: 0.9,
                data: { total: endpoints.length, authenticated: 0 },
              }),
            ],
            locations: [],
            confidence: 0.9,
            tags: ['authentication', 'security', 'endpoints'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 1: PII in Prompts ─────────────────────────────────────────

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

  // ── Rule 2: Missing Input Validation ───────────────────────────────

  /**
   * Detect data-accepting endpoints (POST/PUT/PATCH/DELETE) without input
   * validation.
   *
   * The HTTP method is read from `method` (falling back to `http_method`, the
   * property the parsers actually emit). Endpoints with an empty/unknown method
   * are skipped so this never fires on read-only or unidentifiable endpoints.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing input validation.
   */
  private async detectMissingInputValidation(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');

    for (const endpoint of endpoints) {
      const method = (
        (endpoint.properties['method'] as string | undefined) ??
        (endpoint.properties['http_method'] as string | undefined) ??
        ''
      ).toUpperCase();
      // Only flag mutation endpoints that accept a request body. An empty or
      // unknown method must NOT qualify — otherwise every GET (and every
      // endpoint whose method we couldn't resolve) would false-positive.
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) continue;

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

  // ── Rule 3: Missing Authentication ─────────────────────────────────

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
        const method = (
          (endpoint.properties['method'] as string | undefined) ??
          (endpoint.properties['http_method'] as string | undefined) ??
          ''
        ).toUpperCase();
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
}

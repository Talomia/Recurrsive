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
 * 2. Missing input validation — mutation endpoints whose route registration
 *    shows no validation middleware, flagged per-endpoint only when validation
 *    IS detectable elsewhere in the project (proving the signal works here);
 *    otherwise collapsed into one systemic "not detectable" finding.
 * 3. Missing authentication — same shape, keyed off the parser-observed
 *    `has_auth_middleware` flag scanned from real route-registration
 *    arguments. Previously both rules keyed off markers
 *    (`authenticated`/`has_validation`, tags `validated`/`protected`) that NO
 *    producer emitted, so they fired HIGH on 100% of endpoints and a finalize
 *    pass triple-counted a systemic finding on top.
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
  async finalize(_ctx: AnalysisContext): Promise<Finding[]> {
    // The former systemic "No authenticated endpoints" check lived here and
    // stacked on top of the per-endpoint rules, triple-counting the same
    // (unobservable) condition. The systemic case is now handled once inside
    // detectMissingAuthentication with honest "not detectable" wording.
    return [];
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
        // The Langfuse collector stores prompt text under `prompt`.
        (prompt.properties['prompt'] as string | undefined) ??
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
   * validation, based on the parser-observed `has_validation_middleware`
   * flag (scanned from the real route-registration arguments).
   *
   * Per-endpoint findings are emitted only when validation IS detectably
   * present on at least one endpoint in the project — that proves the signal
   * works for this codebase, so its absence on a specific endpoint is
   * meaningful. When NO endpoint shows detectable validation, the honest
   * statement is systemic: validation is not detectable, which may mean
   * global middleware this pipeline cannot see. That yields ONE medium
   * finding instead of a fabricated HIGH per endpoint.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing input validation.
   */
  private async detectMissingInputValidation(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');

    const hasValidationSignal = (e: (typeof endpoints)[number]): boolean =>
      e.properties['has_validation_middleware'] === true ||
      e.properties['has_validation'] === true ||
      e.tags.includes('validated') ||
      e.tags.includes('input-validated') ||
      e.tags.includes('schema-validated');

    const mutationEndpoints = endpoints.filter((endpoint) => {
      const method = (
        (endpoint.properties['method'] as string | undefined) ??
        (endpoint.properties['http_method'] as string | undefined) ??
        ''
      ).toUpperCase();
      // Only mutation endpoints that accept a request body. An empty or
      // unknown method must NOT qualify — otherwise every GET (and every
      // endpoint whose method we couldn't resolve) would false-positive.
      return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    });

    const anyValidated = endpoints.some(hasValidationSignal);

    if (anyValidated) {
      // Validation is detectable in this project — flag mutation endpoints
      // where the parser explicitly observed NO validation middleware.
      for (const endpoint of mutationEndpoints) {
        if (hasValidationSignal(endpoint)) continue;
        // Require the explicit parser observation; endpoints where the scan
        // never ran (property absent) stay unflagged rather than assumed.
        if (endpoint.properties['has_validation_middleware'] !== false) continue;

        const method = (
          (endpoint.properties['method'] as string | undefined) ??
          (endpoint.properties['http_method'] as string | undefined) ??
          ''
        ).toUpperCase();
        const path = (endpoint.properties['path'] as string | undefined) ?? endpoint.name;
        const loc = locationFromEntity(endpoint);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing input validation: ${method} ${path}`,
            description: `Endpoint '${method} ${path}' shows no validation middleware in its route registration, while other endpoints in this project do validate input. Endpoints that accept user data should validate inputs to prevent injection attacks and data corruption.`,
            severity: 'medium',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'No validation middleware observed in route registration arguments',
                entity_ids: [endpoint.id],
                confidence: 0.7,
                data: { method, path },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add request body validation using Zod, Joi, or class-validator. Validate query parameters, path parameters, and headers as well.',
            confidence: 0.7,
            tags: ['input-validation', 'security', 'api'],
          }),
        );
      }
    } else if (mutationEndpoints.length >= 3) {
      // No validation is detectable anywhere — one honest systemic finding.
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Input validation not detectable on any mutation endpoint',
          description:
            `None of the ${mutationEndpoints.length} data-accepting endpoints (POST/PUT/PATCH/DELETE) ` +
            `show detectable input validation. This may mean validation is missing, or that it is ` +
            `applied via global middleware this analysis cannot observe. Verify request payloads are ` +
            `validated before use.`,
          severity: 'medium',
          category: 'security',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${mutationEndpoints.length} mutation endpoints, 0 with detectable validation`,
              entity_ids: mutationEndpoints.slice(0, 10).map((e) => e.id),
              confidence: 0.7,
              data: { mutation_endpoints: mutationEndpoints.length, validated: 0 },
            }),
          ],
          locations: [],
          suggested_fix:
            'Validate request bodies with Zod, Joi, or class-validator — per-route or via shared middleware. If validation exists globally, this finding can be suppressed by tagging endpoints as "validated".',
          confidence: 0.6,
          tags: ['input-validation', 'security', 'api', 'systemic'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 3: Missing Authentication ─────────────────────────────────

  /**
   * Detect endpoints without authentication, based on the parser-observed
   * `has_auth_middleware` flag (scanned from real route-registration
   * arguments — passport/jwt/requireAuth/etc. identifiers).
   *
   * Per-endpoint findings are emitted only when auth IS detectably present
   * on at least one endpoint in the project. When no endpoint shows
   * detectable auth, the honest statement is a single systemic
   * "not detectable" finding at medium severity — auth may be enforced by
   * global middleware or a gateway this pipeline cannot observe, so
   * asserting per-endpoint "Missing authentication" would fabricate.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing authentication.
   */
  private async detectMissingAuthentication(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');

    // Skip known public endpoints
    const publicPaths = ['/health', '/ready', '/readiness', '/liveness', '/metrics', '/favicon.ico', '/robots.txt'];

    const hasAuthSignal = (e: (typeof endpoints)[number]): boolean =>
      e.properties['has_auth_middleware'] === true ||
      e.properties['authenticated'] === true ||
      e.properties['has_auth'] === true ||
      e.tags.includes('authenticated') ||
      e.tags.includes('auth-required') ||
      e.tags.includes('protected');

    const nonPublicEndpoints = endpoints.filter((endpoint) => {
      const path = ((endpoint.properties['path'] as string | undefined) ?? endpoint.name).toLowerCase();
      if (publicPaths.some((pp) => path.includes(pp))) return false;
      if (endpoint.tags.includes('public') || endpoint.properties['public'] === true) return false;
      return true;
    });

    const anyAuthenticated = endpoints.some(hasAuthSignal);

    if (anyAuthenticated) {
      // Auth is detectable in this project — flag endpoints where the parser
      // explicitly observed NO auth middleware in the registration.
      for (const endpoint of nonPublicEndpoints) {
        if (hasAuthSignal(endpoint)) continue;
        if (endpoint.properties['has_auth_middleware'] !== false) continue;

        const path = ((endpoint.properties['path'] as string | undefined) ?? endpoint.name).toLowerCase();
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
            description: `Endpoint '${method} ${path}' shows no authentication middleware in its route registration, while other endpoints in this project do. Unauthenticated endpoints can be accessed by anyone, potentially exposing sensitive data or functionality.`,
            severity: 'high',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'No auth middleware observed in route registration arguments',
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
    } else if (nonPublicEndpoints.length >= 3) {
      // No auth is detectable anywhere — one honest systemic finding.
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Authentication not detectable on any endpoint',
          description:
            `None of the ${nonPublicEndpoints.length} non-public API endpoints show detectable ` +
            `authentication. This may mean authentication is missing, or that it is enforced by ` +
            `global middleware or an API gateway this analysis cannot observe. Verify how these ` +
            `endpoints are protected.`,
          severity: 'medium',
          category: 'security',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${nonPublicEndpoints.length} endpoints, 0 with detectable authentication`,
              entity_ids: nonPublicEndpoints.slice(0, 10).map((e) => e.id),
              confidence: 0.7,
              data: { total: nonPublicEndpoints.length, authenticated: 0 },
            }),
          ],
          locations: [],
          suggested_fix:
            'Add authentication middleware per route or globally. If endpoints are intentionally public or protected upstream, tag them as "public" or "authenticated" to record that decision.',
          confidence: 0.6,
          tags: ['missing-auth', 'security', 'authentication', 'systemic'],
        }),
      );
    }

    return findings;
  }
}

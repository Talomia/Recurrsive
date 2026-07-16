/**
 * @module @recurrsive/analyzers/api-contract
 *
 * API contract quality analyzer that detects documentation gaps,
 * inconsistencies, and best-practice violations in API endpoint
 * definitions and OpenAPI/Swagger contract entities.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
  Entity,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

/** Regex for snake_case path segments. */
const SNAKE_CASE_PATTERN = /[a-z]+_[a-z]+/;

/** Regex for camelCase path segments. */
const CAMEL_CASE_PATTERN = /[a-z]+[A-Z][a-z]+/;

/**
 * Analyzes the knowledge graph for API contract quality issues
 * including missing documentation, inconsistencies, and violations
 * of REST best practices.
 *
 * ### Rules
 * 1. Inconsistent naming — mixed camelCase/snake_case in paths
 * 2. Missing pagination — list endpoints without pagination params
 * 3. Missing rate limiting — no rate limit headers documented
 * 4. Breaking change risk — endpoints with no versioning
 *
 * ### Removed rules (producer/consumer contract mismatch)
 * "Missing API descriptions", "Missing error responses", and "Missing
 * examples" were removed. They fired on every endpoint because the code
 * extractors that produce `endpoint` entities emit only `http_method`, `path`,
 * and `framework` — never `description`, `summary`, `responses`,
 * `status_codes`, or `*_example`. There is no OpenAPI-spec input path that
 * populates per-endpoint documentation, so these rules could never be
 * satisfied and only produced systematic false positives.
 */
export class APIContractAnalyzer implements Analyzer {
  readonly id = 'api-contract.quality';
  readonly name = 'API Contract Analyzer';
  readonly description =
    'Detects API contract quality issues including missing documentation, inconsistent naming, and missing pagination.';
  readonly version = '0.1.0';
  readonly categories = ['documentation' as const, 'developer_experience' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [naming, pagination, rateLimiting, breakingChange] = await Promise.all([
      this.detectInconsistentNaming(ctx),
      this.detectMissingPagination(ctx),
      this.detectMissingRateLimiting(ctx),
      this.detectBreakingChangeRisk(ctx),
    ]);

    findings.push(...naming, ...pagination, ...rateLimiting, ...breakingChange);

    return findings;
  }

  /** @inheritdoc */
  async finalize(_ctx: AnalysisContext): Promise<Finding[]> {
    // The "undocumented API ratio" systemic check was removed: `endpoint`
    // entities never carry a `description` property or `documented` tag, so the
    // ratio was always 0% and the finding always fired. There is no producer of
    // per-endpoint documentation to evaluate against.
    return [];
  }

  // ── Rule 1: Inconsistent Naming ────────────────────────────────────

  /**
   * Detect mixed camelCase and snake_case in API endpoint paths.
   *
   * @param ctx - Analysis context.
   * @returns Findings for naming inconsistencies.
   */
  private async detectInconsistentNaming(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');
    if (endpoints.length < 2) return findings;

    let snakeCaseCount = 0;
    let camelCaseCount = 0;
    const snakeCaseEndpoints: Entity[] = [];
    const camelCaseEndpoints: Entity[] = [];

    for (const endpoint of endpoints) {
      const path = (endpoint.properties['path'] as string | undefined) ?? endpoint.name;
      // Strip path params and check remaining segments
      const segments = path.replace(/\{[^}]+\}/g, '').replace(/:[^/]+/g, '');

      if (SNAKE_CASE_PATTERN.test(segments)) {
        snakeCaseCount++;
        snakeCaseEndpoints.push(endpoint);
      }
      if (CAMEL_CASE_PATTERN.test(segments)) {
        camelCaseCount++;
        camelCaseEndpoints.push(endpoint);
      }
    }

    if (snakeCaseCount > 0 && camelCaseCount > 0) {
      // Report the minority style as inconsistent
      const minorityStyle = snakeCaseCount <= camelCaseCount ? 'snake_case' : 'camelCase';
      const minorityEndpoints = snakeCaseCount <= camelCaseCount ? snakeCaseEndpoints : camelCaseEndpoints;
      const majorityStyle = minorityStyle === 'snake_case' ? 'camelCase' : 'snake_case';

      const endpointNames = minorityEndpoints.slice(0, 5).map(
        (e) => (e.properties['path'] as string | undefined) ?? e.name,
      );

      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: `Inconsistent API naming: mixed ${minorityStyle} and ${majorityStyle}`,
          description:
            `API paths use both camelCase (${camelCaseCount} endpoints) and snake_case ` +
            `(${snakeCaseCount} endpoints). Inconsistent naming confuses consumers and ` +
            `indicates a lack of API style guidelines. Examples: ${endpointNames.join(', ')}.`,
          severity: 'medium',
          category: 'documentation',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${camelCaseCount} camelCase, ${snakeCaseCount} snake_case endpoints`,
              entity_ids: minorityEndpoints.map((e) => e.id),
              confidence: 0.85,
              data: {
                camel_case_count: camelCaseCount,
                snake_case_count: snakeCaseCount,
              },
            }),
          ],
          locations: [],
          suggested_fix:
            `Standardize on ${majorityStyle} (the majority convention) for all API paths. Update the API style guide to enforce consistent naming.`,
          confidence: 0.8,
          tags: ['inconsistent-naming', 'documentation', 'api', 'conventions'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 2: Missing Pagination ─────────────────────────────────────

  /**
   * Detect list endpoints without pagination parameters.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing pagination.
   */
  private async detectMissingPagination(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');

    for (const endpoint of endpoints) {
      // Read the method from `method`, falling back to `http_method` (the
      // property the parsers actually emit).
      const method = (
        (endpoint.properties['method'] as string | undefined) ??
        (endpoint.properties['http_method'] as string | undefined) ??
        ''
      ).toUpperCase();
      const path = (endpoint.properties['path'] as string | undefined) ?? endpoint.name;

      // Only GET endpoints can be list endpoints. An empty/unknown method must
      // NOT qualify, so this never fires on POST/PUT/PATCH/DELETE endpoints.
      if (method !== 'GET') continue;

      const isList =
        endpoint.properties['returns_list'] === true ||
        endpoint.properties['returns_array'] === true ||
        endpoint.tags.includes('list') ||
        endpoint.tags.includes('collection') ||
        // Path heuristic: ends with plural noun (no path param at the end)
        /\/[a-z]+s$/.test(path.toLowerCase());

      if (!isList) continue;

      const hasPagination =
        endpoint.properties['has_pagination'] === true ||
        endpoint.properties['paginated'] === true ||
        endpoint.tags.includes('paginated') ||
        endpoint.tags.includes('pagination');

      // Check query params for pagination indicators
      const params = endpoint.properties['parameters'] as Array<Record<string, unknown>> | undefined;
      const paginationParams = ['page', 'limit', 'offset', 'cursor', 'per_page', 'page_size', 'pageSize'];
      const hasParamPagination = params?.some(
        (p) => paginationParams.includes(((p['name'] as string) ?? '').toLowerCase()),
      );

      if (!hasPagination && !hasParamPagination) {
        const loc = locationFromEntity(endpoint);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing pagination: ${method} ${path}`,
            description:
              `List endpoint '${method} ${path}' does not support pagination. Without pagination, ` +
              `large datasets can cause performance issues and excessive memory usage for both ` +
              `server and client.`,
            severity: 'medium',
            category: 'documentation',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'List endpoint without pagination parameters',
                entity_ids: [endpoint.id],
                confidence: 0.75,
                data: { method, path },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add pagination support using cursor-based pagination (preferred) or offset/limit. Document pagination parameters and response metadata (total count, next cursor).',
            confidence: 0.7,
            tags: ['missing-pagination', 'documentation', 'api', 'performance'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: Missing Rate Limiting ──────────────────────────────────

  /**
   * Detect APIs without rate limiting documentation.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing rate limiting.
   */
  private async detectMissingRateLimiting(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const contracts = await ctx.graph.getEntities('api_contract');
    const endpoints = await ctx.graph.getEntities('endpoint');

    // Check API contract level first
    const hasRateLimitContract = contracts.some(
      (c) =>
        c.properties['rate_limiting'] != null ||
        c.properties['rate_limit'] != null ||
        c.tags.includes('rate-limited') ||
        c.tags.includes('rate-limiting'),
    );

    // Check endpoint level
    const hasRateLimitEndpoint = endpoints.some(
      (e) =>
        e.properties['rate_limit'] != null ||
        e.properties['rate_limiting'] != null ||
        e.tags.includes('rate-limited') ||
        e.tags.includes('rate-limiting'),
    );

    if (!hasRateLimitContract && !hasRateLimitEndpoint && endpoints.length > 0) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Missing rate limiting documentation',
          description:
            `No rate limiting documentation was found across ${endpoints.length} endpoints ` +
            `and ${contracts.length} API contracts. Rate limits protect against abuse and ` +
            `ensure fair usage. Documenting them helps consumers implement proper retry logic.`,
          severity: 'medium',
          category: 'documentation',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${endpoints.length} endpoints without rate limit documentation`,
              entity_ids: [],
              confidence: 0.8,
              data: {
                endpoint_count: endpoints.length,
                contract_count: contracts.length,
              },
            }),
          ],
          locations: [],
          suggested_fix:
            'Document rate limits in the API spec or response headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset). Include retry-after headers for 429 responses.',
          confidence: 0.75,
          tags: ['missing-rate-limiting', 'documentation', 'api', 'security'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 4: Breaking Change Risk ───────────────────────────────────

  /**
   * Detect endpoints without API versioning, indicating breaking
   * change risk.
   *
   * @param ctx - Analysis context.
   * @returns Findings for breaking change risk.
   */
  private async detectBreakingChangeRisk(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const endpoints = await ctx.graph.getEntities('endpoint');
    if (endpoints.length === 0) return findings;

    // Check if any form of versioning exists
    const versionedEndpoints = endpoints.filter((e) => {
      const path = (e.properties['path'] as string | undefined) ?? e.name;
      const hasVersionInPath = /\/v\d+\//i.test(path);
      const hasVersionProp =
        e.properties['api_version'] != null ||
        e.properties['version'] != null;
      const hasVersionTag =
        e.tags.includes('versioned') ||
        e.tags.some((t) => /^v\d+$/.test(t));

      return hasVersionInPath || hasVersionProp || hasVersionTag;
    });

    // Also check API contracts for versioning
    const contracts = await ctx.graph.getEntities('api_contract');
    const hasContractVersion = contracts.some(
      (c) =>
        c.properties['version'] != null ||
        c.tags.includes('versioned'),
    );

    if (versionedEndpoints.length === 0 && !hasContractVersion && endpoints.length >= 3) {
      const endpointPaths = endpoints.slice(0, 5).map(
        (e) => (e.properties['path'] as string | undefined) ?? e.name,
      );
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Breaking change risk: no API versioning',
          description:
            `None of the ${endpoints.length} API endpoints use versioning (e.g., /v1/, /v2/). ` +
            `Without versioning, any breaking change to the API will impact all consumers ` +
            `simultaneously. Endpoints include: ${endpointPaths.join(', ')}.`,
          severity: 'high',
          category: 'documentation',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${endpoints.length} endpoints without versioning`,
              entity_ids: endpoints.slice(0, 10).map((e) => e.id),
              confidence: 0.85,
              data: {
                total_endpoints: endpoints.length,
                versioned_endpoints: 0,
              },
            }),
          ],
          locations: [],
          suggested_fix:
            'Implement API versioning using URL path versioning (/v1/), header versioning (Accept: application/vnd.api+json;version=1), or query parameter versioning (?version=1).',
          confidence: 0.8,
          tags: ['breaking-change', 'documentation', 'api', 'versioning'],
        }),
      );
    }

    return findings;
  }
}

/**
 * @module @recurrsive/analyzers/docs
 *
 * Documentation analyzer — examines the knowledge graph for
 * documentation gaps such as missing READMEs, undocumented public
 * APIs, missing ADRs, stale documentation, missing examples, and
 * API contract drift.
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

// ─── Constants ────────────────────────────────────────────────────────────────

/** Number of days after which documentation is considered stale. */
const STALE_DOCS_THRESHOLD_DAYS = 180;

// ─── Analyzer ─────────────────────────────────────────────────────────────────

/**
 * Analyzes the knowledge graph for documentation gaps and quality issues.
 *
 * ### Rules
 * 1. **Missing README** — repository without a README file.
 * 2. **Missing API docs** — public functions without JSDoc / docstrings.
 * 3. **Missing ADRs** — architectural patterns without corresponding ADRs.
 * 4. **Stale documentation** — documents not updated within the threshold.
 * 5. **Missing examples** — public APIs without usage examples.
 * 6. **API contract drift** — API contracts that diverge from implementation.
 *
 * @example
 * ```ts
 * const analyzer = new DocsAnalyzer();
 * await analyzer.initialize(ctx);
 * const findings = await analyzer.analyze(ctx);
 * ```
 */
export class DocsAnalyzer implements Analyzer {
  readonly id = 'docs.completeness';
  readonly name = 'Documentation Analyzer';
  readonly description =
    'Detects documentation gaps: missing README, undocumented public APIs, missing ADRs, stale docs, missing examples, and API contract drift.';
  readonly version = '0.1.0';
  readonly categories = ['documentation' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      missingReadme,
      missingApiDocs,
      missingAdrs,
      staleDocs,
      missingExamples,
      contractDrift,
    ] = await Promise.all([
      this.detectMissingReadme(ctx),
      this.detectMissingApiDocs(ctx),
      this.detectMissingAdrs(ctx),
      this.detectStaleDocs(ctx),
      this.detectMissingExamples(ctx),
      this.detectApiContractDrift(ctx),
    ]);

    findings.push(
      ...missingReadme,
      ...missingApiDocs,
      ...missingAdrs,
      ...staleDocs,
      ...missingExamples,
      ...contractDrift,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Cross-cutting check: low documentation coverage
    try {
      const functions = await ctx.graph.getEntities('function');
      const publicFunctions = functions.filter(
        (e) =>
          e.properties['visibility'] === 'public' ||
          e.properties['exported'] === true ||
          e.properties['is_exported'] === true ||
          e.tags.includes('exported'),
      );

      let docEntities: Entity[] = [];
      try {
        docEntities = await ctx.graph.getEntities('document');
      } catch {
        // document entity type may not exist in this graph
      }

      if (publicFunctions.length > 10 && docEntities.length < 3) {
        findings.push(
          createFinding({
            title: 'Low documentation coverage',
            description:
              `The project has ${publicFunctions.length} public/exported functions but only ` +
              `${docEntities.length} documentation entit${docEntities.length === 1 ? 'y' : 'ies'}. ` +
              `Public APIs should be well-documented to enable adoption and reduce support burden.`,
            severity: 'medium',
            category: 'documentation',
            analyzer_id: this.id,
            evidence: [
              createEvidence({
                type: 'metric',
                source: 'docs.cross-cutting',
                description: `${publicFunctions.length} public functions, ${docEntities.length} documentation entities`,
                entity_ids: publicFunctions.slice(0, 10).map((e) => e.id),
                confidence: 0.8,
                data: {
                  public_function_count: publicFunctions.length,
                  documentation_count: docEntities.length,
                },
              }),
            ],
            locations: [],
            confidence: 0.75,
            tags: ['low-doc-coverage', 'documentation', 'public-api'],
          }),
        );
      }

      // Cross-cutting check: API endpoints not documented
      let endpoints: Entity[] = [];
      try {
        endpoints = await ctx.graph.getEntities('endpoint');
      } catch {
        // endpoint entity type may not exist
      }

      const apiDocs = docEntities.filter(
        (d) =>
          d.properties['type'] === 'api_doc' ||
          d.tags.includes('api-doc') ||
          d.tags.includes('api-documentation') ||
          /api/i.test(d.name),
      );

      if (endpoints.length > 0 && apiDocs.length === 0) {
        findings.push(
          createFinding({
            title: 'API endpoints not documented',
            description:
              `The project has ${endpoints.length} API endpoint(s) but no API documentation ` +
              `entities were found. API consumers need clear documentation for each endpoint ` +
              `covering request/response schemas, authentication, rate limits, and error codes.`,
            severity: 'medium',
            category: 'documentation',
            analyzer_id: this.id,
            evidence: [
              createEvidence({
                type: 'metric',
                source: 'docs.cross-cutting',
                description: `${endpoints.length} endpoints with 0 API documentation entities`,
                entity_ids: endpoints.slice(0, 10).map((e) => e.id),
                confidence: 0.8,
                data: {
                  endpoint_count: endpoints.length,
                  api_doc_count: 0,
                },
              }),
            ],
            locations: [],
            confidence: 0.75,
            tags: ['undocumented-api', 'documentation', 'api', 'endpoints'],
          }),
        );
      }
    } catch {
      // If entity types don't exist, return empty findings
    }

    return findings;
  }

  // ── Rule 1: Missing README ──────────────────────────────────────────

  /**
   * Detect repositories or modules without a README file.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing READMEs.
   */
  private async detectMissingReadme(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const files = await ctx.graph.getEntities('file');
    const repos = await ctx.graph.getEntities('repository');
    const modules = await ctx.graph.getEntities('module');
    const documents = await ctx.graph.getEntities('document');

    const isReadmeName = (n: string | undefined): boolean =>
      !!n && /^readme(\.(md|txt|rst))?$/i.test(n);
    const baseName = (p: string): string => p.split('/').pop() ?? p;
    const dirOf = (p: string): string => {
      const i = p.lastIndexOf('/');
      return i === -1 ? '' : p.slice(0, i);
    };

    // A README may be collected as a `file` entity (by name) OR — for markdown —
    // as a `document` entity (named by its title, with the filename in `path`).
    // Consider both so a real README is never falsely reported as missing.
    const readmeNames = new Set<string>();
    for (const f of files) {
      if (isReadmeName(f.name)) {
        readmeNames.add((f.properties['directory'] as string | undefined) ?? '');
      }
    }
    for (const d of documents) {
      const p = (d.properties['path'] ?? d.properties['file_path']) as string | undefined;
      if (p && isReadmeName(baseName(p))) {
        readmeNames.add(dirOf(p));
      }
    }

    // Check top-level README (a file at root, or a top-level README document).
    const hasTopLevelReadme =
      files.some(
        (f) => isReadmeName(f.name) &&
          (f.properties['is_root'] === true ||
           !((f.properties['directory'] as string | undefined) ?? '').includes('/')),
      ) ||
      documents.some((d) => {
        const p = (d.properties['path'] ?? d.properties['file_path']) as string | undefined;
        return !!p && isReadmeName(baseName(p)) && dirOf(p) === '';
      });

    if (!hasTopLevelReadme && (repos.length > 0 || files.length > 0)) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Missing project README',
          description:
            'No top-level README file found. A README is the first thing developers see and should describe the project purpose, setup instructions, and key concepts.',
          severity: 'medium',
          category: 'documentation',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: 'No README.md found in project root',
              entity_ids: repos.map((r) => r.id),
              confidence: 0.9,
            }),
          ],
          locations: [],
          suggested_fix:
            'Create a README.md at the project root. Include: project name, description, installation steps, quick-start guide, contributing guidelines, and license information.',
          confidence: 0.9,
          tags: ['missing-readme', 'documentation', 'onboarding'],
        }),
      );
    }

    // Check modules without READMEs
    for (const mod of modules) {
      const modPath = mod.properties['path'] as string | undefined ?? mod.name;
      if (!readmeNames.has(modPath)) {
        const loc = locationFromEntity(mod);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing README for module: ${mod.name}`,
            description: `Module '${mod.name}' does not have a README. Each significant module or package should document its purpose, public API, and usage patterns.`,
            severity: 'low',
            category: 'documentation',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Module directory lacks README',
                entity_ids: [mod.id],
                confidence: 0.75,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Add a README.md to the '${mod.name}' module explaining its purpose, API surface, and usage examples.`,
            confidence: 0.7,
            tags: ['missing-readme', 'documentation', 'module'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 2: Missing API Docs ────────────────────────────────────────

  /**
   * Detect exported functions and classes without JSDoc / docstrings.
   *
   * @param ctx - Analysis context.
   * @returns Findings for undocumented public APIs.
   */
  private async detectMissingApiDocs(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    const classes = await ctx.graph.getEntities('class');

    const publicEntities = [...functions, ...classes].filter(
      (e) =>
        e.properties['is_exported'] === true ||
        e.tags.includes('exported') ||
        e.properties['visibility'] === 'public',
    );

    for (const entity of publicEntities) {
      const hasDoc =
        entity.properties['jsdoc'] != null ||
        entity.properties['docstring'] != null ||
        entity.description != null ||
        entity.tags.includes('documented');

      if (!hasDoc) {
        const loc = locationFromEntity(entity);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Undocumented public API: ${entity.name}`,
            description: `Exported ${entity.type} '${entity.name}' has no documentation. Public APIs should have JSDoc (TypeScript/JavaScript) or docstrings (Python) explaining purpose, parameters, return values, and usage.`,
            severity: 'medium',
            category: 'documentation',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Public API without documentation',
                entity_ids: [entity.id],
                confidence: 0.85,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Add JSDoc or docstring to '${entity.name}' with @param, @returns, @throws, and @example tags.`,
            confidence: 0.85,
            tags: ['missing-docs', 'documentation', 'api', entity.type],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: Missing ADRs ────────────────────────────────────────────

  /**
   * Detect significant architectural patterns without corresponding ADRs
   * (Architecture Decision Records).
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing ADRs.
   */
  private async detectMissingAdrs(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const adrs = await ctx.graph.getEntities('adr');
    const pipelines = await ctx.graph.getEntities('pipeline');
    const agents = await ctx.graph.getEntities('agent');
    const mcpServers = await ctx.graph.getEntities('mcp_server');

    // Architectural components that should have ADRs
    const architecturalEntities: Entity[] = [
      ...pipelines,
      ...agents,
      ...mcpServers,
    ];

    // If there are significant architectural components but zero ADRs
    if (architecturalEntities.length > 0 && adrs.length === 0) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No Architecture Decision Records found',
          description: `The project has ${architecturalEntities.length} significant architectural component(s) (pipelines, agents, MCP servers) but no ADRs documenting the decisions behind them. ADRs capture the "why" behind architectural choices and help onboard new team members.`,
          severity: 'medium',
          category: 'documentation',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${architecturalEntities.length} architectural components with 0 ADRs`,
              entity_ids: architecturalEntities.slice(0, 10).map((e) => e.id),
              confidence: 0.8,
              data: { component_count: architecturalEntities.length, adr_count: 0 },
            }),
          ],
          locations: [],
          suggested_fix:
            'Create an `docs/adr/` directory with ADR files. Use the format: ADR-001-title.md. Document the context, decision, and consequences for each significant architectural choice.',
          confidence: 0.75,
          tags: ['missing-adr', 'documentation', 'architecture'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 4: Stale Documentation ─────────────────────────────────────

  /**
   * Detect documentation that hasn't been updated recently.
   *
   * @param ctx - Analysis context.
   * @returns Findings for stale documentation.
   */
  private async detectStaleDocs(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const documents = await ctx.graph.getEntities('document');
    const adrs = await ctx.graph.getEntities('adr');
    const rfcs = await ctx.graph.getEntities('rfc');

    const allDocs = [...documents, ...adrs, ...rfcs];
    const now = Date.now();
    const thresholdMs = STALE_DOCS_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    for (const doc of allDocs) {
      const updatedAt = doc.updated_at
        ? new Date(doc.updated_at).getTime()
        : null;
      const lastModified = doc.properties['last_modified'] as string | undefined;
      const lastModifiedTime = lastModified
        ? new Date(lastModified).getTime()
        : null;

      const latestUpdate = Math.max(updatedAt ?? 0, lastModifiedTime ?? 0);

      if (latestUpdate > 0 && now - latestUpdate > thresholdMs) {
        const daysStale = Math.floor((now - latestUpdate) / (24 * 60 * 60 * 1000));
        const loc = locationFromEntity(doc);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Stale documentation: ${doc.name}`,
            description: `Document '${doc.name}' has not been updated in ${daysStale} days (threshold: ${STALE_DOCS_THRESHOLD_DAYS} days). Outdated documentation can mislead developers and cause costly mistakes.`,
            severity: 'low',
            category: 'documentation',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `Last updated ${daysStale} days ago`,
                entity_ids: [doc.id],
                confidence: 0.7,
                data: { days_stale: daysStale, threshold: STALE_DOCS_THRESHOLD_DAYS },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Review and update '${doc.name}'. If the content is still accurate, add a review date comment. If the document is obsolete, archive or remove it.`,
            confidence: 0.65,
            tags: ['stale-docs', 'documentation', 'maintenance'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 5: Missing Examples ────────────────────────────────────────

  /**
   * Detect public API modules or packages without usage examples.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing examples.
   */
  private async detectMissingExamples(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const modules = await ctx.graph.getEntities('module');
    const files = await ctx.graph.getEntities('file');

    // Check if any example or test files exist
    const exampleFiles = files.filter(
      (f) =>
        f.name.includes('example') ||
        f.name.includes('demo') ||
        (f.properties['directory'] as string | undefined ?? '').includes('examples'),
    );

    // If there are modules but no examples directory or files
    if (modules.length > 0 && exampleFiles.length === 0) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'No usage examples found',
          description: `The project has ${modules.length} module(s) but no example files or examples directory. Usage examples accelerate onboarding and serve as living documentation that can be tested.`,
          severity: 'low',
          category: 'documentation',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: 'No example files or examples directory found',
              entity_ids: modules.slice(0, 5).map((m) => m.id),
              confidence: 0.7,
              data: { module_count: modules.length, example_count: 0 },
            }),
          ],
          locations: [],
          suggested_fix:
            'Create an `examples/` directory with runnable example scripts. Each example should demonstrate a specific use case and include inline comments.',
          confidence: 0.65,
          tags: ['missing-examples', 'documentation', 'onboarding'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 6: API Contract Drift ──────────────────────────────────────

  /**
   * Detect API contracts (OpenAPI specs, GraphQL schemas) that may have
   * drifted from the actual implementation.
   *
   * @param ctx - Analysis context.
   * @returns Findings for API contract drift.
   */
  private async detectApiContractDrift(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const contracts = await ctx.graph.getEntities('api_contract');
    const endpoints = await ctx.graph.getEntities('endpoint');

    if (contracts.length === 0 && endpoints.length > 0) {
      // No API contract but endpoints exist
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Missing API contract specification',
          description: `The project has ${endpoints.length} endpoint(s) but no API contract (OpenAPI/Swagger spec, GraphQL schema). API contracts serve as the single source of truth for API consumers and enable automated testing, SDK generation, and documentation.`,
          severity: 'medium',
          category: 'documentation',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${endpoints.length} endpoints without API contract`,
              entity_ids: endpoints.slice(0, 10).map((e) => e.id),
              confidence: 0.8,
              data: { endpoint_count: endpoints.length },
            }),
          ],
          locations: [],
          suggested_fix:
            'Create an OpenAPI (Swagger) specification or GraphQL schema that documents all endpoints. Use tools like tsoa, zod-to-openapi, or swagger-jsdoc to generate specs from code.',
          confidence: 0.75,
          tags: ['missing-api-contract', 'documentation', 'api'],
        }),
      );
    }

    // Check for drift between contracts and endpoints
    for (const contract of contracts) {
      const contractEndpoints = contract.properties['endpoints'] as string[] | undefined ?? [];
      const contractPaths = contract.properties['paths'] as string[] | undefined ?? [];
      const specPaths = new Set([...contractEndpoints, ...contractPaths]);

      if (specPaths.size === 0) continue;

      const implementedPaths = new Set(
        endpoints.map(
          (e) => (e.properties['path'] as string | undefined) ?? e.name,
        ),
      );

      // Paths in spec but not implemented
      const specOnly = [...specPaths].filter((p) => !implementedPaths.has(p));

      // Paths implemented but not in spec
      const implOnly = [...implementedPaths].filter((p) => !specPaths.has(p));

      if (specOnly.length > 0 || implOnly.length > 0) {
        const loc = locationFromEntity(contract);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `API contract drift: ${contract.name}`,
            description: `API contract '${contract.name}' has drifted from implementation. ${specOnly.length} path(s) in spec but not implemented, ${implOnly.length} path(s) implemented but not in spec.`,
            severity: 'high',
            category: 'documentation',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: 'Contract/implementation mismatch',
                entity_ids: [contract.id],
                confidence: 0.75,
                data: {
                  spec_only: specOnly.slice(0, 10),
                  impl_only: implOnly.slice(0, 10),
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Synchronize the API contract with the implementation. Consider using code-first contract generation to prevent drift.',
            confidence: 0.7,
            tags: ['api-drift', 'documentation', 'api', 'contract'],
          }),
        );
      }
    }

    return findings;
  }
}

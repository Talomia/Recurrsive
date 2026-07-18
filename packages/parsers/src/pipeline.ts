/**
 * @module @recurrsive/parsers/pipeline
 *
 * Main parsing pipeline that orchestrates tree-sitter parsing, entity
 * extraction, AI pattern detection, and cross-file resolution into a
 * unified result of core {@link Entity} and {@link Relationship} objects
 * suitable for ingestion into the Recurrsive knowledge graph.
 *
 * @packageDocumentation
 */

import type { Entity, Relationship } from '@recurrsive/core';
import { generateId, nowISO, createLogger } from '@recurrsive/core';
import { TreeSitterParser } from './tree-sitter/parser.js';
import type { ExtractorRegistry } from './extractors/index.js';
import { createDefaultRegistry } from './extractors/index.js';
import { AIPatternDetector } from './ai-patterns/detector.js';
import { CrossFileResolver } from './resolvers/cross-file.js';
import type { ExtractedEntity, ImportInfo } from './extractors/base.js';
import type { AIPattern } from './ai-patterns/detector.js';
import type { ResolvedReference } from './resolvers/cross-file.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * The result of parsing a single source file through the pipeline.
 */
export interface ParsedFile {
  /** Project-relative file path. */
  path: string;
  /** Canonical language name (e.g. `'typescript'`). */
  language: string;
  /** Code entities discovered in this file. */
  entities: ExtractedEntity[];
  /** Import statements found in this file. */
  imports: ImportInfo[];
  /** AI-specific patterns detected in this file. */
  aiPatterns: AIPattern[];
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

/**
 * Orchestrates the full code-analysis pipeline:
 *
 * 1. **Tree-sitter parsing** — build ASTs when native bindings are available.
 * 2. **Entity extraction** — pull functions, classes, endpoints, etc.
 * 3. **AI pattern detection** — identify LLM calls, prompts, agents, RAG, MCP.
 * 4. **Cross-file resolution** — resolve import references across files.
 *
 * The pipeline converts raw extraction results into core {@link Entity}
 * and {@link Relationship} objects ready for graph ingestion.
 *
 * @example
 * ```ts
 * const pipeline = new ParsingPipeline();
 * await pipeline.initialize(['typescript', 'python']);
 *
 * const { entities, relationships } = await pipeline.parseProject([
 *   { path: 'src/app.ts', content: sourceCode, language: 'typescript' },
 * ]);
 * ```
 */
export class ParsingPipeline {
  private parser: TreeSitterParser;
  private extractors: ExtractorRegistry;
  private aiDetector: AIPatternDetector;
  private resolver: CrossFileResolver;

  constructor() {
    this.parser = new TreeSitterParser();
    this.extractors = createDefaultRegistry();
    this.aiDetector = new AIPatternDetector();
    this.resolver = new CrossFileResolver();
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Initialize the parser by loading tree-sitter grammars for the
   * requested languages.
   *
   * This is safe to call even when native bindings are unavailable —
   * the pipeline degrades gracefully to regex-based extraction.
   *
   * @param languages - Array of canonical language names
   *   (e.g. `['typescript', 'python']`).
   */
  async initialize(languages: string[]): Promise<void> {
    await this.parser.initialize(languages);
  }

  /**
   * Parse every file in a project and produce graph-ready entities
   * and relationships.
   *
   * @param files - Array of file descriptors with `path`, `content`,
   *   and `language` fields.
   * @returns An object containing arrays of {@link Entity} and
   *   {@link Relationship} ready for knowledge-graph ingestion.
   */
  async parseProject(
    files: Array<{ path: string; content: string; language: string }>,
  ): Promise<{ entities: Entity[]; relationships: Relationship[] }> {
    // ── Step 1: Parse each file ─────────────────────────────────────────
    const parsedFiles: ParsedFile[] = [];
    const logger = createLogger({ context: { module: 'ParsingPipeline' } });
    for (const file of files) {
      try {
        const parsed = await this.parseFile(file.path, file.content, file.language);
        parsedFiles.push(parsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn(`Failed to parse ${file.path}: ${msg}`);
      }
    }

    // ── Step 2: Build per-file maps for cross-file resolution ───────────
    const entitiesByFile = new Map<string, ExtractedEntity[]>();
    const importsByFile = new Map<string, ImportInfo[]>();

    for (const pf of parsedFiles) {
      // Merge file-level entities with AI-pattern-generated entities
      const allEntities = [
        ...pf.entities,
        ...pf.aiPatterns.flatMap((p) => p.entities),
      ];
      entitiesByFile.set(pf.path, allEntities);
      importsByFile.set(pf.path, pf.imports);
    }

    // ── Step 3: Resolve cross-file references ───────────────────────────
    const resolved = this.resolver.resolve(entitiesByFile, importsByFile);

    // ── Step 4: Convert to graph entities and relationships ─────────────
    const allExtracted = [...entitiesByFile.values()].flat();
    const repoName = this.inferRepoName(files);

    const graphEntities = this.toGraphEntities(allExtracted, repoName);
    const entityMap = new Map<string, Entity>();
    for (const entity of graphEntities) {
      entityMap.set(entity.qualified_name, entity);
    }

    const graphRelationships = this.toGraphRelationships(
      entityMap,
      allExtracted,
      resolved,
    );

    // ── Step 5: Harvest AI-pattern relationships ────────────────────────
    // AI patterns (LLM calls, prompt templates, evaluations …) emit their own
    // relationships (uses_model, has_prompt, evaluates_with). These are keyed
    // to the *enclosing code entity* — the analyzers query them from function
    // and agent entities — so resolve each pattern's placeholder file source to
    // the entity whose source range encloses the pattern.
    const aiRelationships = this.toAIPatternRelationships(
      entityMap,
      graphEntities,
      parsedFiles,
    );
    graphRelationships.push(...aiRelationships);

    return { entities: graphEntities, relationships: graphRelationships };
  }

  /**
   * Parse a single file through the extraction and AI detection stages.
   *
   * Does **not** perform cross-file resolution — use {@link parseProject}
   * for that.
   *
   * @param filePath - Project-relative file path.
   * @param content  - Full source text.
   * @param language - Canonical language name.
   * @returns A {@link ParsedFile} with entities, imports, and AI patterns.
   */
  async parseFile(
    filePath: string,
    content: string,
    language: string,
  ): Promise<ParsedFile> {
    // Attempt tree-sitter parse
    const tree = this.parser.parse(content, language);

    // Extract entities
    const extractor = this.extractors.getForLanguage(language);
    const entities: ExtractedEntity[] = extractor
      ? extractor.extract(content, filePath, tree)
      : [];

    // Extract imports
    const imports: ImportInfo[] = extractor
      ? extractor.extractImports(content, filePath)
      : [];

    // Detect AI patterns
    const aiPatterns = this.aiDetector.detect(content, filePath, language);

    return { path: filePath, language, entities, imports, aiPatterns };
  }

  /**
   * Dispose all resources held by the pipeline (tree-sitter parsers).
   */
  dispose(): void {
    this.parser.dispose();
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Convert an array of {@link ExtractedEntity} values into core
   * {@link Entity} objects with generated IDs and timestamps.
   *
   * @param extracted - Extracted entities from all files.
   * @param repoName - Repository name for the `source` field.
   * @returns Array of graph-ready Entity objects.
   */
  private toGraphEntities(
    extracted: ExtractedEntity[],
    repoName: string,
  ): Entity[] {
    const now = nowISO();
    return extracted.map((ext) => ({
      id: generateId(),
      type: ext.type,
      name: ext.name,
      qualified_name: ext.qualified_name,
      description: (ext.properties['jsdoc'] as string | undefined)
        ?? (ext.properties['docstring'] as string | undefined)
        ?? undefined,
      source: `parser:${repoName}`,
      source_location: {
        file: ext.source_location.file,
        start_line: ext.source_location.start_line,
        end_line: ext.source_location.end_line,
        start_column: ext.source_location.start_column,
        end_column: ext.source_location.end_column,
      },
      properties: ext.properties,
      tags: this.inferTags(ext),
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    }));
  }

  /**
   * Convert extracted relationships and resolved cross-file references
   * into core {@link Relationship} objects.
   *
   * @param entityMap  - Map from qualified_name to Entity (for ID lookup).
   * @param extracted  - All extracted entities (carry inline relationships).
   * @param resolved   - Cross-file resolved references.
   * @returns Array of graph-ready Relationship objects.
   */
  private toGraphRelationships(
    entityMap: Map<string, Entity>,
    extracted: ExtractedEntity[],
    resolved: ResolvedReference[],
  ): Relationship[] {
    const relationships: Relationship[] = [];
    const now = nowISO();

    // ── Inline relationships from extraction ─────────────────────────────
    for (const ext of extracted) {
      const sourceEntity = entityMap.get(ext.qualified_name);
      if (!sourceEntity) continue;

      for (const rel of ext.relationships) {
        // Try to find the target by name in the entity map
        const targetEntity = this.findTarget(entityMap, rel.target_name, ext);
        if (!targetEntity) continue;

        relationships.push({
          id: generateId(),
          type: rel.type,
          source_id: sourceEntity.id,
          target_id: targetEntity.id,
          properties: rel.properties ?? {},
          confidence: 0.8,
          source: 'parser:extraction',
          created_at: now,
          updated_at: now,
        });
      }
    }

    // ── Cross-file resolved references ───────────────────────────────────
    for (const ref of resolved) {
      const sourceEntity = entityMap.get(ref.source_entity);
      const targetEntity = entityMap.get(ref.target_entity);

      if (!sourceEntity || !targetEntity) continue;

      // Avoid duplicates
      const duplicate = relationships.some(
        (r) =>
          r.type === ref.relationship_type &&
          r.source_id === sourceEntity.id &&
          r.target_id === targetEntity.id,
      );
      if (duplicate) continue;

      relationships.push({
        id: generateId(),
        type: ref.relationship_type,
        source_id: sourceEntity.id,
        target_id: targetEntity.id,
        properties: {
          source_file: ref.source_file,
          target_file: ref.target_file,
        },
        confidence: 0.85,
        source: 'parser:cross-file-resolution',
        created_at: now,
        updated_at: now,
      });
    }

    return relationships;
  }

  /**
   * Convert AI-pattern relationships into graph {@link Relationship} objects.
   *
   * Each AI pattern (an LLM call, prompt template, evaluation, …) reports its
   * relationships with a placeholder file path as the source — the real source
   * is the *enclosing code entity* (the function or agent that contains the
   * call site), which is what the AI analyzers query. This resolves that
   * placeholder to the tightest entity whose source range encloses the
   * pattern, and points the edge at the pattern's own generated entity as the
   * target (e.g. `function --uses_model--> model`).
   *
   * Relationships whose enclosing entity cannot be located are skipped rather
   * than anchored to an invented source.
   *
   * @param entityMap     - Map from qualified_name to Entity.
   * @param graphEntities - All graph entities (for location resolution).
   * @param parsedFiles   - Parsed files carrying detected AI patterns.
   * @returns Graph-ready AI-pattern relationships.
   */
  private toAIPatternRelationships(
    entityMap: Map<string, Entity>,
    graphEntities: Entity[],
    parsedFiles: ParsedFile[],
  ): Relationship[] {
    const relationships: Relationship[] = [];
    const now = nowISO();

    // Index entities by file for location-containment resolution.
    const entitiesByFile = new Map<string, Entity[]>();
    for (const e of graphEntities) {
      const file = e.source_location?.file;
      if (!file) continue;
      const list = entitiesByFile.get(file);
      if (list) list.push(e);
      else entitiesByFile.set(file, [e]);
    }

    for (const pf of parsedFiles) {
      const fileEntities = entitiesByFile.get(pf.path) ?? [];

      for (const pattern of pf.aiPatterns) {
        if (pattern.relationships.length === 0) continue;

        // The graph entity this pattern produced is the relationship target.
        const patternExtracted = pattern.entities[0];
        const targetEntity = patternExtracted
          ? entityMap.get(patternExtracted.qualified_name)
          : undefined;
        if (!targetEntity) continue;

        const startLine = pattern.source_location.start_line;
        const endLine = pattern.source_location.end_line;
        if (startLine === undefined || endLine === undefined) continue;

        const source = this.findEnclosingEntity(
          fileEntities,
          startLine,
          endLine,
          targetEntity.id,
        );
        if (!source) continue;

        for (const rel of pattern.relationships) {
          // Guard against duplicate and self edges.
          if (source.id === targetEntity.id) continue;
          const duplicate = relationships.some(
            (r) =>
              r.type === rel.type &&
              r.source_id === source.id &&
              r.target_id === targetEntity.id,
          );
          if (duplicate) continue;

          relationships.push({
            id: generateId(),
            type: rel.type,
            source_id: source.id,
            target_id: targetEntity.id,
            properties: { file: pf.path, ai_pattern: pattern.type },
            confidence: 0.75,
            source: 'parser:ai-pattern',
            created_at: now,
            updated_at: now,
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Find the entity whose source range most tightly encloses a line span,
   * used to anchor an AI-pattern call to the code that contains it.
   *
   * Skips the target entity itself and any entity occupying the exact same
   * span (the pattern-generated entities live at the match location), so the
   * result is a genuine enclosing scope rather than the AI resource node.
   *
   * @param candidates - Entities in the same file.
   * @param startLine  - Pattern span start line.
   * @param endLine    - Pattern span end line.
   * @param targetId   - The relationship target to exclude from candidates.
   * @returns The tightest enclosing entity, or `undefined`.
   */
  private findEnclosingEntity(
    candidates: Entity[],
    startLine: number,
    endLine: number,
    targetId: string,
  ): Entity | undefined {
    let best: Entity | undefined;
    let bestSpan = Number.POSITIVE_INFINITY;

    for (const entity of candidates) {
      if (entity.id === targetId) continue;
      const loc = entity.source_location;
      if (!loc || loc.start_line === undefined || loc.end_line === undefined) continue;
      const entStart = loc.start_line;
      const entEnd = loc.end_line;

      // Skip entities occupying the exact same span (the pattern's own nodes).
      if (entStart === startLine && entEnd === endLine) continue;

      if (entStart <= startLine && entEnd >= endLine) {
        const span = entEnd - entStart;
        if (span < bestSpan) {
          bestSpan = span;
          best = entity;
        }
      }
    }

    return best;
  }

  /**
   * Attempt to find a target entity by symbolic name in the entity map.
   *
   * Tries exact qualified-name match first, then falls back to simple
   * name matching using the source file context.
   *
   * @param entityMap  - Map of qualified_name → Entity.
   * @param targetName - Symbolic target name from an ExtractedRelationship.
   * @param source     - The source entity for context (same file matching).
   * @returns The matched Entity, or `undefined`.
   */
  private findTarget(
    entityMap: Map<string, Entity>,
    targetName: string,
    source: ExtractedEntity,
  ): Entity | undefined {
    // Direct qualified name match
    const direct = entityMap.get(targetName);
    if (direct) return direct;

    // Try qualifying with the same file path
    const filePath = source.source_location.file;
    const withFile = entityMap.get(`${filePath}:${targetName}`);
    if (withFile) return withFile;

    // Scan for simple name match (first match wins)
    for (const entity of entityMap.values()) {
      if (entity.name === targetName) return entity;
    }

    return undefined;
  }

  /**
   * Infer tags from an extracted entity's properties.
   *
   * @param entity - The extracted entity.
   * @returns Array of tag strings.
   */
  private inferTags(entity: ExtractedEntity): string[] {
    const tags: string[] = [entity.type];

    if (entity.properties['is_exported'] === true) tags.push('exported');
    if (entity.properties['is_async'] === true) tags.push('async');
    if (entity.properties['is_abstract'] === true) tags.push('abstract');
    if (entity.properties['is_interface'] === true) tags.push('interface');
    if (entity.properties['is_type_alias'] === true) tags.push('type-alias');
    if (entity.properties['framework']) {
      tags.push(String(entity.properties['framework']));
    }
    if (entity.properties['provider']) {
      tags.push(String(entity.properties['provider']));
    }
    if (entity.properties['http_method']) {
      tags.push(String(entity.properties['http_method']).toLowerCase());
    }

    return tags;
  }

  /**
   * Infer a repository name from the file paths provided.
   *
   * @param files - Input files with `path` fields.
   * @returns A best-guess repository name.
   */
  private inferRepoName(
    files: Array<{ path: string }>,
  ): string {
    if (files.length === 0) return 'unknown';

    // Use the top-most directory component from the first file
    const first = files[0]!.path;
    const parts = first.split('/').filter(Boolean);
    return parts[0] ?? 'unknown';
  }
}

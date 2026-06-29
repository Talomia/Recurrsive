/**
 * @module @recurrsive/collectors/docs/collector
 *
 * Documentation collector — discovers and ingests documentation files,
 * Architecture Decision Records (ADRs), RFCs, and API contracts
 * from a repository.
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  Collector,
  CollectorConfig,
  CollectorResult,
  CollectorType,
  DataGovernance,
  Entity,
  EntityType,
  Relationship,
} from '@recurrsive/core';
import {
  generateId,
  qualifiedName,
  nowISO,
  createLogger,
  CollectorError,
} from '@recurrsive/core';
import { GovernanceFilter } from '../base/governance.js';

const logger = createLogger({ context: { module: 'documentation-collector' } });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum file size in bytes that we will read for content extraction. */
const MAX_DOC_SIZE_BYTES = 1024 * 1024; // 1 MB

/** Maximum number of lines to extract as a description preview. */
const MAX_DESCRIPTION_LINES = 5;

/** Patterns for ADR directories (relative to repo root). */
const ADR_DIRECTORIES = [
  'docs/adr',
  'docs/adrs',
  'docs/decisions',
  'doc/adr',
  'doc/adrs',
  'doc/decisions',
  'adr',
  'adrs',
  'decisions',
  'architecture/decisions',
];

/** Patterns for RFC directories (relative to repo root). */
const RFC_DIRECTORIES = [
  'docs/rfcs',
  'docs/rfc',
  'doc/rfcs',
  'doc/rfc',
  'rfcs',
  'rfc',
];

/** Well-known API contract filenames. */
const API_CONTRACT_NAMES = new Set([
  'openapi.yaml',
  'openapi.yml',
  'openapi.json',
  'swagger.yaml',
  'swagger.yml',
  'swagger.json',
  'schema.graphql',
  'schema.gql',
  'api.graphql',
  'api.gql',
  'api-spec.yaml',
  'api-spec.yml',
  'api-spec.json',
  'asyncapi.yaml',
  'asyncapi.yml',
  'asyncapi.json',
]);

/** README filename patterns (case-insensitive match). */
const README_PATTERNS = [
  /^readme(\.[a-z]+)?$/i,
  /^contributing(\.[a-z]+)?$/i,
  /^changelog(\.[a-z]+)?$/i,
  /^changes(\.[a-z]+)?$/i,
  /^license(\.[a-z]+)?$/i,
  /^code_of_conduct(\.[a-z]+)?$/i,
  /^security(\.[a-z]+)?$/i,
];

/** Generic documentation directories. */
const DOC_DIRECTORIES = [
  'docs',
  'doc',
  'documentation',
  'wiki',
  'guides',
  'tutorials',
];

/** File extensions recognized as documentation. */
const DOC_EXTENSIONS = new Set([
  '.md',
  '.mdx',
  '.markdown',
  '.rst',
  '.txt',
  '.adoc',
  '.asciidoc',
  '.textile',
]);

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Metadata about a discovered documentation file. */
interface DocFileInfo {
  /** Relative path from repo root. */
  relativePath: string;
  /** Absolute path. */
  absolutePath: string;
  /** File basename. */
  name: string;
  /** File size in bytes. */
  sizeBytes: number;
  /** Detected document category. */
  category: 'readme' | 'adr' | 'rfc' | 'api_contract' | 'document';
  /** The entity type to create. */
  entityType: EntityType;
}

// ---------------------------------------------------------------------------
// DocumentationCollector
// ---------------------------------------------------------------------------

/**
 * Collects documentation files from a repository including:
 * - README and contributing guides
 * - Architecture Decision Records (ADRs)
 * - RFCs
 * - API contracts (OpenAPI, GraphQL schema, AsyncAPI)
 * - Generic documentation (docs/ directory)
 *
 * Each document is represented as a knowledge graph entity with
 * `contains` relationships back to the repository.
 *
 * @example
 * ```ts
 * const collector = new DocumentationCollector('/path/to/repo');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: false, audit_log: false, retention_days: 90 },
 *   custom: {},
 * });
 * const result = await collector.collect();
 * // result.entities contains document, adr, rfc, api_contract entities
 * ```
 */
export class DocumentationCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'documentation';
  /** @inheritdoc */
  readonly name = 'Documentation Collector';
  /** @inheritdoc */
  readonly description = 'Collects documentation files, ADRs, RFCs, and API contracts';
  /** @inheritdoc */
  readonly type: CollectorType = 'documentation';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** Absolute path to the repository root. */
  private rootPath: string;
  /** Governance rules. */
  private governance!: DataGovernance;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** Whether the collector has been initialized. */
  private initialized = false;

  /**
   * @param rootPath - Absolute path to the repository root.
   */
  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  // -----------------------------------------------------------------------
  // Collector Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialize the collector with configuration.
   *
   * @param config - Collector configuration.
   */
  async initialize(config: CollectorConfig): Promise<void> {
    this.governance = config.governance;
    this.governanceFilter = new GovernanceFilter(config.governance);

    if (typeof config.custom['rootPath'] === 'string') {
      this.rootPath = path.resolve(config.custom['rootPath']);
    }

    this.initialized = true;
    logger.info('DocumentationCollector initialized', { rootPath: this.rootPath });
  }

  /**
   * Validate that the configured path exists and is a directory.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      const stat = await fs.stat(this.rootPath);
      if (!stat.isDirectory()) {
        errors.push(`'${this.rootPath}' is not a directory`);
      }
    } catch {
      errors.push(`Directory '${this.rootPath}' does not exist or is not accessible`);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform the documentation collection run.
   *
   * @returns Entities and relationships discovered.
   * @throws {CollectorError} If not initialized.
   */
  async collect(): Promise<CollectorResult> {
    if (!this.initialized) {
      throw new CollectorError(
        'DocumentationCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // Discover all documentation files
    let docFiles: DocFileInfo[] = [];
    try {
      docFiles = await this.discoverDocFiles();
    } catch (err) {
      const msg = `Documentation discovery failed: ${err instanceof Error ? err.message : String(err)}`;
      errors.push({ message: msg });
      logger.error(msg, { error: err });
    }

    // Build entities
    const entities: Entity[] = [];
    for (const docFile of docFiles) {
      try {
        const entity = await this.buildDocumentEntity(docFile);
        const masked = this.governanceFilter.maskEntity(entity);
        entities.push(masked);
      } catch (err) {
        const msg = `Failed to build entity for '${docFile.relativePath}': ${err instanceof Error ? err.message : String(err)}`;
        errors.push({ message: msg });
        logger.warn(msg, { error: err });
      }
    }

    // Build relationships (all documents → repository via "contains")
    const relationships = this.buildRelationships(entities);

    const durationMs = Date.now() - startTime;

    return {
      entities,
      relationships,
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed: docFiles.length,
        errors,
      },
    };
  }

  /**
   * Release resources.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('DocumentationCollector disposed', { rootPath: this.rootPath });
  }

  // -----------------------------------------------------------------------
  // Internal: Discovery
  // -----------------------------------------------------------------------

  /**
   * Discover all documentation files in the repository.
   *
   * Scans:
   * 1. Root-level README-like files
   * 2. ADR directories
   * 3. RFC directories
   * 4. API contract files (anywhere in tree, depth-limited)
   * 5. Generic docs/ directories
   *
   * @returns Array of discovered document file info.
   */
  private async discoverDocFiles(): Promise<DocFileInfo[]> {
    const docs: DocFileInfo[] = [];
    const seen = new Set<string>();

    const addDoc = (doc: DocFileInfo) => {
      if (!seen.has(doc.relativePath)) {
        seen.add(doc.relativePath);
        if (!this.governanceFilter.isExcluded(doc.relativePath)) {
          docs.push(doc);
        }
      }
    };

    // 1. Root-level README files
    const rootReadmes = await this.findReadmeFiles(this.rootPath, '');
    for (const doc of rootReadmes) {
      addDoc(doc);
    }

    // 2. ADR directories
    for (const dir of ADR_DIRECTORIES) {
      const adrDocs = await this.scanDocDirectory(dir, 'adr', 'adr');
      for (const doc of adrDocs) {
        addDoc(doc);
      }
    }

    // 3. RFC directories
    for (const dir of RFC_DIRECTORIES) {
      const rfcDocs = await this.scanDocDirectory(dir, 'rfc', 'rfc');
      for (const doc of rfcDocs) {
        addDoc(doc);
      }
    }

    // 4. API contract files in common locations
    const contractDocs = await this.findApiContracts();
    for (const doc of contractDocs) {
      addDoc(doc);
    }

    // 5. Generic docs directories
    for (const dir of DOC_DIRECTORIES) {
      const genericDocs = await this.scanDocDirectory(dir, 'document', 'document');
      for (const doc of genericDocs) {
        addDoc(doc);
      }
    }

    return docs;
  }

  /**
   * Find README-like files in a directory.
   *
   * @param dirPath - Absolute directory path.
   * @param relativeBase - Relative path prefix.
   * @returns Array of README doc infos.
   */
  private async findReadmeFiles(dirPath: string, relativeBase: string): Promise<DocFileInfo[]> {
    const results: DocFileInfo[] = [];

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dirPath, { withFileTypes: true });
    } catch {
      return results;
    }

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const isReadme = README_PATTERNS.some((p) => p.test(entry.name));
      if (isReadme) {
        const relativePath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;
        const absolutePath = path.join(dirPath, entry.name);

        try {
          const stat = await fs.stat(absolutePath);
          results.push({
            relativePath,
            absolutePath,
            name: entry.name,
            sizeBytes: stat.size,
            category: 'readme',
            entityType: 'document',
          });
        } catch {
          // Skip inaccessible files
        }
      }
    }

    return results;
  }

  /**
   * Scan a documentation directory for doc files.
   *
   * @param relativeDir - Directory path relative to repo root.
   * @param category - Document category.
   * @param entityType - Entity type to assign.
   * @returns Array of discovered doc file infos.
   */
  private async scanDocDirectory(
    relativeDir: string,
    category: DocFileInfo['category'],
    entityType: EntityType,
  ): Promise<DocFileInfo[]> {
    const results: DocFileInfo[] = [];
    const absoluteDir = path.join(this.rootPath, relativeDir);

    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(absoluteDir, { withFileTypes: true });
    } catch {
      // Directory doesn't exist — that's expected
      return results;
    }

    for (const entry of entries) {
      if (!entry.isFile()) {
        continue;
      }

      const ext = path.extname(entry.name).toLowerCase();
      if (!DOC_EXTENSIONS.has(ext) && !API_CONTRACT_NAMES.has(entry.name.toLowerCase())) {
        continue;
      }

      const relativePath = `${relativeDir}/${entry.name}`;
      const absolutePath = path.join(absoluteDir, entry.name);

      try {
        const stat = await fs.stat(absolutePath);
        results.push({
          relativePath,
          absolutePath,
          name: entry.name,
          sizeBytes: stat.size,
          category,
          entityType,
        });
      } catch {
        // Skip
      }
    }

    return results;
  }

  /**
   * Find API contract files anywhere in the repository (depth-limited
   * to 3 levels to avoid deep traversal).
   *
   * @returns Array of API contract doc infos.
   */
  private async findApiContracts(): Promise<DocFileInfo[]> {
    const results: DocFileInfo[] = [];

    const search = async (dir: string, relativeBase: string, depth: number): Promise<void> => {
      if (depth > 3) {
        return;
      }

      let entries: import('node:fs').Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const relativePath = relativeBase ? `${relativeBase}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          // Skip common non-doc directories
          if (['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', 'vendor'].includes(entry.name)) {
            continue;
          }
          await search(path.join(dir, entry.name), relativePath, depth + 1);
        } else if (entry.isFile() && API_CONTRACT_NAMES.has(entry.name.toLowerCase())) {
          const absolutePath = path.join(dir, entry.name);
          try {
            const stat = await fs.stat(absolutePath);
            results.push({
              relativePath,
              absolutePath,
              name: entry.name,
              sizeBytes: stat.size,
              category: 'api_contract',
              entityType: 'api_contract',
            });
          } catch {
            // Skip
          }
        }
      }
    };

    await search(this.rootPath, '', 0);
    return results;
  }

  // -----------------------------------------------------------------------
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build a knowledge graph entity for a documentation file.
   *
   * Reads the file content to extract a description preview.
   *
   * @param docFile - The documentation file info.
   * @returns An entity representing this document.
   */
  private async buildDocumentEntity(docFile: DocFileInfo): Promise<Entity> {
    const now = nowISO();
    const repoName = path.basename(this.rootPath);

    // Read content for description preview
    let description = `${docFile.category} document: ${docFile.name}`;
    let content = '';

    if (docFile.sizeBytes <= MAX_DOC_SIZE_BYTES) {
      try {
        content = await fs.readFile(docFile.absolutePath, 'utf-8');
        description = this.extractDescription(content, docFile.category);

        // Sanitize content if PII detection is enabled
        if (this.governance.pii_detection) {
          content = this.governanceFilter.sanitizeText(content);
        }
      } catch {
        // Failed to read — use default description
      }
    }

    // Extract title from markdown content
    const title = this.extractTitle(content, docFile.name);

    return {
      id: generateId(),
      type: docFile.entityType,
      name: title,
      qualified_name: qualifiedName(repoName, docFile.relativePath),
      description,
      source: this.id,
      source_location: {
        file: docFile.relativePath,
        repository: this.rootPath,
      },
      properties: {
        path: docFile.relativePath,
        category: docFile.category,
        size_bytes: docFile.sizeBytes,
        format: this.detectFormat(docFile.name),
        title,
        word_count: content ? content.split(/\s+/).length : 0,
      },
      tags: [docFile.category, this.detectFormat(docFile.name)],
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    };
  }

  /**
   * Build `contains` relationships from a synthetic repository reference
   * to each document entity.
   *
   * Note: The actual repository entity is created by the GitCollector.
   * These relationships reference the repo by convention — they will
   * be linked at graph merge time.
   *
   * @param entities - Document entities.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];
    const now = nowISO();

    // We don't have the repo entity id here — the graph merger will
    // resolve these using qualified_name matching. For now, create
    // relationships between documents if any are in subdirectories
    // of others, or skip inter-entity relationships and let the
    // graph layer handle cross-collector linking.

    // Instead, create a placeholder repo entity id based on path
    // The graph merger should resolve this.
    const repoPlaceholderId = generateId();

    for (const entity of entities) {
      relationships.push({
        id: generateId(),
        type: 'contains',
        source_id: repoPlaceholderId,
        target_id: entity.id,
        properties: {
          path: entity.properties['path'],
          category: entity.properties['category'],
          repo_path: this.rootPath,
        },
        confidence: 0.9, // Slightly lower because repo entity is a placeholder
        source: this.id,
        created_at: now,
        updated_at: now,
      });
    }

    return relationships;
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /**
   * Extract a description from document content.
   *
   * For markdown files, takes the first non-heading, non-empty lines
   * (up to {@link MAX_DESCRIPTION_LINES}).
   *
   * @param content - File content.
   * @param category - Document category for fallback.
   * @returns Extracted description string.
   */
  private extractDescription(content: string, category: string): string {
    if (!content.trim()) {
      return `Empty ${category} document`;
    }

    const lines = content.split('\n');
    const descriptionLines: string[] = [];

    for (const line of lines) {
      if (descriptionLines.length >= MAX_DESCRIPTION_LINES) {
        break;
      }

      const trimmed = line.trim();

      // Skip empty lines at the start
      if (!trimmed && descriptionLines.length === 0) {
        continue;
      }

      // Skip markdown headings
      if (trimmed.startsWith('#')) {
        continue;
      }

      // Skip front matter delimiters
      if (trimmed === '---' || trimmed === '+++') {
        continue;
      }

      // Skip HTML comments
      if (trimmed.startsWith('<!--')) {
        continue;
      }

      if (trimmed) {
        descriptionLines.push(trimmed);
      }
    }

    return descriptionLines.join(' ').slice(0, 300) || `${category} document`;
  }

  /**
   * Extract a title from document content.
   *
   * Looks for a markdown H1 heading (`# Title`), or falls back
   * to the filename.
   *
   * @param content - File content.
   * @param fallbackName - Filename to use if no title is found.
   * @returns Extracted title string.
   */
  private extractTitle(content: string, fallbackName: string): string {
    if (!content) {
      return fallbackName;
    }

    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // Match markdown H1: "# Title"
      const h1Match = /^#\s+(.+)$/.exec(trimmed);
      if (h1Match && h1Match[1]) {
        return h1Match[1].trim();
      }
    }

    // Remove extension from filename for a cleaner title
    const dotIndex = fallbackName.lastIndexOf('.');
    return dotIndex > 0 ? fallbackName.slice(0, dotIndex) : fallbackName;
  }

  /**
   * Detect the document format from the file extension.
   *
   * @param filename - The file basename.
   * @returns Format label (e.g. `'markdown'`, `'yaml'`, `'json'`).
   */
  private detectFormat(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const formatMap: Record<string, string> = {
      '.md': 'markdown',
      '.mdx': 'mdx',
      '.markdown': 'markdown',
      '.rst': 'restructuredtext',
      '.txt': 'plaintext',
      '.adoc': 'asciidoc',
      '.asciidoc': 'asciidoc',
      '.textile': 'textile',
      '.yaml': 'yaml',
      '.yml': 'yaml',
      '.json': 'json',
      '.graphql': 'graphql',
      '.gql': 'graphql',
    };

    return formatMap[ext] ?? 'unknown';
  }
}

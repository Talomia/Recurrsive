/**
 * @module @recurrsive/collectors/git/collector
 *
 * Git Repository Collector — walks the file tree, parses git history,
 * detects project type / frameworks / AI providers, and produces
 * entities and relationships for the knowledge graph.
 *
 * This is the primary collector in the Recurrsive system: every
 * analysis begins with a thorough understanding of the repository.
 *
 * @packageDocumentation
 */

import * as fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import * as path from 'node:path';
import type {
  Collector,
  CollectorConfig,
  CollectorResult,
  CollectorType,
  DataGovernance,
  Entity,
  Relationship,
} from '@recurrsive/core';
import {
  generateId,
  qualifiedName,
  nowISO,
  createLogger,
  CollectorError,
} from '@recurrsive/core';
import { simpleGit, type SimpleGit, type LogResult, type DefaultLogFields } from 'simple-git';
import ignoreModule, { type Ignore } from 'ignore';
const ignore = ignoreModule.default ?? ignoreModule;
import { GovernanceFilter } from '../base/governance.js';
import {
  detectLanguage,
  isSourceFile,
  isBinaryFile,
  isLockfile,
  parsePackageJson,
  parsePyprojectToml,
  parseGoMod,
  detectFrameworks,
  detectAIProviders,
  type FileInfo,
  type DependencyInfo,
} from './utils.js';

const logger = createLogger({ context: { module: 'git-collector' } });

// ---------------------------------------------------------------------------
// Internal Types
// ---------------------------------------------------------------------------

/** Summary of a single git commit. */
export interface GitCommitInfo {
  /** Full commit hash. */
  hash: string;
  /** Commit message subject line. */
  message: string;
  /** Author name. */
  authorName: string;
  /** Author email. */
  authorEmail: string;
  /** ISO-8601 commit date. */
  date: string;
}

/** Detected project type information. */
export interface ProjectTypeInfo {
  /** Primary detected language. */
  primaryLanguage: string;
  /** All languages present, sorted by file count descending. */
  languages: Array<{ language: string; fileCount: number }>;
  /** Detected framework names. */
  frameworks: string[];
  /** Detected AI provider names. */
  aiProviders: string[];
  /** Detected cloud services. */
  cloudServices: string[];
  /** All parsed dependencies. */
  dependencies: DependencyInfo[];
}

/** Maximum number of git log entries to retrieve. */
const MAX_GIT_LOG_ENTRIES = 500;

/** Maximum file size (in bytes) to read content from. */
export const MAX_CONTENT_READ_BYTES = 512 * 1024; // 512 KB

// ---------------------------------------------------------------------------
// GitCollector
// ---------------------------------------------------------------------------

/**
 * Collects source code files, git history, and repository metadata
 * from a local git repository.
 *
 * Lifecycle:
 * 1. {@link initialize} — configure root path and governance rules.
 * 2. {@link validate} — verify the path exists and is a git repo.
 * 3. {@link collect} — walk files, parse history, detect project type,
 *    build entities & relationships.
 * 4. {@link dispose} — release resources.
 *
 * @example
 * ```ts
 * const collector = new GitCollector('/path/to/repo');
 * await collector.initialize({
 *   governance: { masked_fields: [], excluded_patterns: [], pii_detection: true, audit_log: false, retention_days: 90 },
 *   custom: {},
 * });
 * const result = await collector.collect();
 * console.log(`Found ${result.entities.length} entities`);
 * ```
 */
export class GitCollector implements Collector {
  /** @inheritdoc */
  readonly id = 'git';
  /** @inheritdoc */
  readonly name = 'Git Repository Collector';
  /** @inheritdoc */
  readonly description = 'Collects source code files, git history, and repository metadata';
  /** @inheritdoc */
  readonly type: CollectorType = 'git';
  /** @inheritdoc */
  readonly version = '0.1.0';

  /** Absolute path to the repository root. */
  private rootPath: string;
  /** Governance rules applied during collection. */
  private governance!: DataGovernance;
  /** Governance filter instance. */
  private governanceFilter!: GovernanceFilter;
  /** simple-git handle. */
  private git!: SimpleGit;
  /** Whether this collector has been initialized. */
  private initialized = false;

  /**
   * @param rootPath - Absolute path to the repository root.
   */
  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
    // Create the git client eagerly so validate() works as a standalone
    // pre-check before initialize() is called (initialize() recreates it if a
    // custom rootPath override changes the path).
    this.git = simpleGit(this.rootPath);
  }

  // -----------------------------------------------------------------------
  // Collector Lifecycle
  // -----------------------------------------------------------------------

  /**
   * Initialize the collector with configuration.
   *
   * @param config - Collector configuration including governance rules.
   */
  async initialize(config: CollectorConfig): Promise<void> {
    this.governance = config.governance;
    this.governanceFilter = new GovernanceFilter(config.governance);

    // Allow custom root path override
    if (typeof config.custom['rootPath'] === 'string') {
      this.rootPath = path.resolve(config.custom['rootPath']);
    }

    this.git = simpleGit(this.rootPath);
    this.initialized = true;

    logger.info('GitCollector initialized', { rootPath: this.rootPath });
  }

  /**
   * Validate that the configured path exists and is a git repository.
   *
   * @returns Validation result.
   */
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // Check directory exists
    try {
      const stat = await fs.stat(this.rootPath);
      if (!stat.isDirectory()) {
        errors.push(`'${this.rootPath}' is not a directory`);
      }
    } catch (err: unknown) {
      errors.push(`Directory '${this.rootPath}' does not exist or is not accessible`);
    }

    // Check it's a git repo
    if (errors.length === 0) {
      try {
        const isRepo = await this.git.checkIsRepo();
        if (!isRepo) {
          errors.push(`'${this.rootPath}' is not a git repository`);
        }
      } catch (err: unknown) {
        const detail = err instanceof Error ? err.message : String(err);
        errors.push(`Unable to verify git repository at '${this.rootPath}': ${detail}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Perform the full collection run.
   *
   * @returns Entities, relationships, and run metadata.
   * @throws {CollectorError} If the collector has not been initialized.
   */
  async collect(): Promise<CollectorResult> {
    if (!this.initialized) {
      throw new CollectorError(
        'GitCollector has not been initialized. Call initialize() first.',
        'NOT_INITIALIZED',
        this.id,
      );
    }

    const startTime = Date.now();
    const errors: Array<{ message: string; details?: unknown }> = [];

    // 1. Walk the file tree
    let files: FileInfo[] = [];
    try {
      files = await this.walkFileTree();
    } catch (err) {
      const msg = `File tree walk failed: ${err instanceof Error ? err.message : String(err)}`;
      errors.push({ message: msg, details: err instanceof Error ? { stack: err.stack } : undefined });
      logger.error(msg, { error: err });
    }

    // 2. Parse git history. On failure the error is recorded and
    // history-derived properties are omitted from the repository entity —
    // an unreadable history must not be reported as "0 commits".
    let history: GitCommitInfo[] = [];
    let historyAvailable = false;
    try {
      history = await this.parseGitHistory();
      historyAvailable = true;
    } catch (err) {
      const msg = `Git history parse failed: ${err instanceof Error ? err.message : String(err)}`;
      errors.push({ message: msg, details: err instanceof Error ? { stack: err.stack } : undefined });
      logger.error(msg, { error: err });
    }

    // 3. Detect project type
    let project: ProjectTypeInfo;
    try {
      project = await this.detectProjectType(files);
    } catch (err) {
      const msg = `Project type detection failed: ${err instanceof Error ? err.message : String(err)}`;
      errors.push({ message: msg, details: err instanceof Error ? { stack: err.stack } : undefined });
      logger.error(msg, { error: err });
      project = {
        primaryLanguage: 'Unknown',
        languages: [],
        frameworks: [],
        aiProviders: [],
        cloudServices: [],
        dependencies: [],
      };
    }

    // 4. Build entities and relationships
    const entities = this.buildEntities(files, history, project, historyAvailable);
    const relationships = this.buildRelationships(entities);

    // 5. Apply governance masking
    const maskedEntities = entities.map((e) => this.governanceFilter.maskEntity(e));

    const durationMs = Date.now() - startTime;

    return {
      entities: maskedEntities,
      relationships,
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: durationMs,
        items_processed: files.length,
        errors,
      },
    };
  }

  /**
   * Release resources held by this collector.
   */
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('GitCollector disposed', { rootPath: this.rootPath });
  }

  // -----------------------------------------------------------------------
  // Internal: File Tree
  // -----------------------------------------------------------------------

  /**
   * Recursively walk the file tree respecting `.gitignore` rules and
   * governance exclusion patterns.
   *
   * @returns Array of file information objects.
   */
  private async walkFileTree(): Promise<FileInfo[]> {
    const ig = await this.loadGitignore();
    const files: FileInfo[] = [];

    const walk = async (dir: string, relativeBase: string): Promise<void> => {
      let entries: Dirent[];
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch (err: unknown) {
        // Permission denied or other access error — skip silently
        return;
      }

      for (const entry of entries) {
        const relativePath = relativeBase
          ? `${relativeBase}/${entry.name}`
          : entry.name;
        const absolutePath = path.join(dir, entry.name);

        // Skip .git directory
        if (entry.name === '.git') {
          continue;
        }

        // Check gitignore
        if (ig.ignores(relativePath)) {
          continue;
        }

        // Check governance exclusions
        if (this.governanceFilter.isExcluded(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          // Also check directory with trailing slash for gitignore
          if (ig.ignores(`${relativePath}/`)) {
            continue;
          }
          await walk(absolutePath, relativePath);
        } else if (entry.isFile()) {
          // Skip binary files — but keep dependency lockfiles, which some
          // package managers ship with a binary-looking extension (e.g.
          // yarn.lock, bun.lockb) yet must be visible for supply-chain checks.
          if (isBinaryFile(relativePath) && !isLockfile(relativePath)) {
            continue;
          }

          try {
            const stat = await fs.stat(absolutePath);
            const ext = path.extname(entry.name);
            files.push({
              path: relativePath,
              name: entry.name,
              extension: ext,
              sizeBytes: stat.size,
            });
          } catch (err: unknown) {
            // Stat failed — skip the file
          }
        }
      }
    };

    await walk(this.rootPath, '');
    return files;
  }

  /**
   * Load and compile `.gitignore` patterns from the repository root.
   *
   * @returns An `ignore` instance pre-loaded with patterns.
   */
  private async loadGitignore(): Promise<Ignore> {
    const ig = ignore();

    // Always ignore common directories
    ig.add(['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.tox', '.venv', 'venv']);

    // Load .gitignore if present
    const gitignorePath = path.join(this.rootPath, '.gitignore');
    try {
      const content = await fs.readFile(gitignorePath, 'utf-8');
      ig.add(content);
    } catch (err: unknown) {
      // No .gitignore — that's fine
    }

    return ig;
  }

  // -----------------------------------------------------------------------
  // Internal: Git History
  // -----------------------------------------------------------------------

  /**
   * Parse recent git commit history using `simple-git`.
   *
   * @returns Array of commit info objects.
   */
  private async parseGitHistory(): Promise<GitCommitInfo[]> {
    // Failures (not a git repo, git unavailable, …) propagate to the
    // caller, which records them in metadata.errors and omits
    // history-derived properties — never silently reported as empty.
    const logResult: LogResult<DefaultLogFields> = await this.git.log({ maxCount: MAX_GIT_LOG_ENTRIES });

    return logResult.all.map((entry) => ({
      hash: entry.hash,
      message: entry.message,
      authorName: entry.author_name,
      authorEmail: entry.author_email,
      date: entry.date,
    }));
  }

  // -----------------------------------------------------------------------
  // Internal: Project Type Detection
  // -----------------------------------------------------------------------

  /**
   * Detect the project type by analysing files and parsing manifest
   * files for dependencies.
   *
   * @param files - The files discovered during tree walk.
   * @returns Detected project type information.
   */
  private async detectProjectType(files: FileInfo[]): Promise<ProjectTypeInfo> {
    // Count languages
    const langCounts = new Map<string, number>();
    for (const file of files) {
      const lang = detectLanguage(file.path);
      if (lang !== 'Unknown') {
        langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
      }
    }

    const languages = [...langCounts.entries()]
      .map(([language, fileCount]) => ({ language, fileCount }))
      .sort((a, b) => b.fileCount - a.fileCount);

    const primaryLanguage = languages[0]?.language ?? 'Unknown';

    // Parse dependencies from manifest files
    const dependencies: DependencyInfo[] = [];
    const manifestParsers: Array<{ filename: string; parser: (content: string) => DependencyInfo[] }> = [
      { filename: 'package.json', parser: parsePackageJson },
      { filename: 'pyproject.toml', parser: parsePyprojectToml },
      { filename: 'go.mod', parser: parseGoMod },
    ];

    for (const { filename, parser } of manifestParsers) {
      // Prefer the shallowest manifest (fewest path segments): in a
      // monorepo the root manifest describes the repository, not
      // whichever nested package happens to appear first in walk order.
      const manifestFile = files
        .filter((f) => f.name === filename && !f.path.includes('node_modules'))
        .sort((a, b) => a.path.split('/').length - b.path.split('/').length)[0];
      if (manifestFile) {
        try {
          const content = await fs.readFile(
            path.join(this.rootPath, manifestFile.path),
            'utf-8',
          );

          // Respect governance - sanitize content before parsing if PII detection is on
          const safeContent = this.governance.pii_detection
            ? this.governanceFilter.sanitizeText(content)
            : content;

          const parsed = parser(safeContent);
          dependencies.push(...parsed);
        } catch (err) {
          logger.warn(`Failed to parse ${filename}`, { error: err });
        }
      }
    }

    // Detect frameworks and AI providers
    const frameworks = detectFrameworks(files, dependencies);
    const aiProviders = detectAIProviders(files, dependencies);

    // Detect cloud services from dependencies
    const cloudServices = this.detectCloudServices(dependencies);

    return {
      primaryLanguage,
      languages,
      frameworks,
      aiProviders,
      cloudServices,
      dependencies,
    };
  }

  /**
   * Detect cloud service usage from dependency names.
   *
   * @param dependencies - Parsed dependencies.
   * @returns Array of cloud service names.
   */
  private detectCloudServices(dependencies: DependencyInfo[]): string[] {
    const services = new Set<string>();
    const cloudMarkers: Readonly<Record<string, string>> = {
      // AWS
      '@aws-sdk/client-s3': 'AWS S3',
      '@aws-sdk/client-lambda': 'AWS Lambda',
      '@aws-sdk/client-dynamodb': 'AWS DynamoDB',
      '@aws-sdk/client-sqs': 'AWS SQS',
      '@aws-sdk/client-sns': 'AWS SNS',
      'aws-sdk': 'AWS',
      'boto3': 'AWS',
      // GCP
      '@google-cloud/storage': 'Google Cloud Storage',
      '@google-cloud/pubsub': 'Google Cloud Pub/Sub',
      '@google-cloud/bigquery': 'Google BigQuery',
      '@google-cloud/firestore': 'Google Firestore',
      'firebase-admin': 'Firebase',
      'firebase': 'Firebase',
      // Azure
      '@azure/storage-blob': 'Azure Blob Storage',
      '@azure/cosmos': 'Azure CosmosDB',
      '@azure/service-bus': 'Azure Service Bus',
      // Vercel / Netlify / Cloudflare
      '@vercel/kv': 'Vercel KV',
      '@vercel/blob': 'Vercel Blob',
      '@cloudflare/workers-types': 'Cloudflare Workers',
      'wrangler': 'Cloudflare Workers',
      // Databases
      'pg': 'PostgreSQL',
      'mysql2': 'MySQL',
      'mongodb': 'MongoDB',
      'mongoose': 'MongoDB',
      'redis': 'Redis',
      'ioredis': 'Redis',
      '@prisma/client': 'Prisma',
      'drizzle-orm': 'Drizzle',
      'typeorm': 'TypeORM',
      'sequelize': 'Sequelize',
      'knex': 'Knex',
      // Supabase
      '@supabase/supabase-js': 'Supabase',
    };

    for (const dep of dependencies) {
      const service = cloudMarkers[dep.name];
      if (service) {
        services.add(service);
      }
    }

    return [...services].sort();
  }

  // -----------------------------------------------------------------------
  // Internal: Entity Building
  // -----------------------------------------------------------------------

  /**
   * Build knowledge graph entities from the collected data.
   *
   * Creates:
   * - 1 `repository` entity
   * - 1 `file` entity per source, config, lockfile, or security-policy file
   * - 1 `dependency` entity per dependency
   *
   * @param files - Discovered files.
   * @param history - Git commit history.
   * @param project - Detected project type info.
   * @param historyAvailable - Whether git history was actually parsed;
   *   when false, history-derived properties are omitted (not zeroed).
   * @returns Array of entities.
   */
  private buildEntities(
    files: FileInfo[],
    history: GitCommitInfo[],
    project: ProjectTypeInfo,
    historyAvailable: boolean,
  ): Entity[] {
    const entities: Entity[] = [];
    const now = nowISO();
    const repoName = path.basename(this.rootPath);

    // --- Repository entity ---
    const repoId = generateId();
    const contributors = this.extractContributors(history);
    const recentCommits = history.slice(0, 20).map((c) => ({
      hash: c.hash.slice(0, 8),
      message: c.message,
      author: c.authorName,
      date: c.date,
    }));

    entities.push({
      id: repoId,
      type: 'repository',
      name: repoName,
      qualified_name: qualifiedName(repoName),
      description: `Git repository at ${this.rootPath}`,
      source: this.id,
      source_location: { repository: this.rootPath },
      properties: {
        root_path: this.rootPath,
        primary_language: project.primaryLanguage,
        languages: project.languages,
        frameworks: project.frameworks,
        ai_providers: project.aiProviders,
        cloud_services: project.cloudServices,
        total_files: files.length,
        // History-derived properties are only reported when the history
        // was actually parsed — a failed parse is not "0 commits".
        ...(historyAvailable
          ? {
              total_commits: history.length,
              contributors,
              recent_commits: recentCommits,
            }
          : {}),
      },
      tags: [
        project.primaryLanguage.toLowerCase(),
        ...project.frameworks.map((f) => f.toLowerCase()),
        ...project.aiProviders.map((p) => p.toLowerCase()),
      ],
      created_at: now,
      updated_at: now,
      last_seen_at: now,
    });

    // --- File entities ---
    for (const file of files) {
      if (!isSourceFile(file.path) && !this.isConfigFile(file.path)) {
        // Skip non-source, non-config files from entity creation
        // (they were collected for language counting)
        continue;
      }

      const language = detectLanguage(file.path);
      const fileTags: string[] = language !== 'Unknown' ? [language.toLowerCase()] : [];
      if (isLockfile(file.path)) {
        fileTags.push('lockfile');
      }
      if (file.name.toLowerCase() === 'security.md') {
        fileTags.push('security-policy');
      }
      entities.push({
        id: generateId(),
        type: 'file',
        name: file.name,
        qualified_name: qualifiedName(repoName, file.path),
        source: this.id,
        source_location: {
          file: file.path,
          repository: this.rootPath,
        },
        properties: {
          path: file.path,
          absolute_path: path.join(this.rootPath, file.path),
          extension: file.extension,
          language,
          size_bytes: file.sizeBytes,
          repo_id: repoId,
          is_source: isSourceFile(file.path),
          is_lockfile: isLockfile(file.path),
        },
        tags: fileTags,
        created_at: now,
        updated_at: now,
        last_seen_at: now,
      });
    }

    // --- Dependency entities ---
    for (const dep of project.dependencies) {
      entities.push({
        id: generateId(),
        type: 'dependency',
        name: dep.name,
        qualified_name: qualifiedName(repoName, 'dependency', dep.name),
        source: this.id,
        properties: {
          version: dep.version,
          dev: dep.dev,
          manifest_source: dep.source,
          repo_id: repoId,
        },
        tags: dep.dev ? ['dev-dependency'] : ['dependency'],
        created_at: now,
        updated_at: now,
        last_seen_at: now,
      });
    }

    return entities;
  }

  /**
   * Build relationships between entities.
   *
   * Creates:
   * - `contains` — repository → file
   * - `depends_on` — repository → dependency
   *
   * @param entities - All entities built from this collection.
   * @returns Array of relationships.
   */
  private buildRelationships(entities: Entity[]): Relationship[] {
    const relationships: Relationship[] = [];
    const now = nowISO();

    const repoEntity = entities.find((e) => e.type === 'repository');
    if (!repoEntity) {
      return relationships;
    }

    const fileEntities = entities.filter((e) => e.type === 'file');
    const depEntities = entities.filter((e) => e.type === 'dependency');

    // Repository → File (contains)
    for (const file of fileEntities) {
      relationships.push({
        id: generateId(),
        type: 'contains',
        source_id: repoEntity.id,
        target_id: file.id,
        properties: {
          path: file.properties['path'],
        },
        confidence: 1.0,
        source: this.id,
        created_at: now,
        updated_at: now,
      });
    }

    // Repository → Dependency (depends_on)
    for (const dep of depEntities) {
      relationships.push({
        id: generateId(),
        type: 'depends_on',
        source_id: repoEntity.id,
        target_id: dep.id,
        properties: {
          version: dep.properties['version'],
          dev: dep.properties['dev'],
        },
        confidence: 1.0,
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
   * Extract unique contributors from git history.
   *
   * @param history - Git commit history.
   * @returns Sorted array of contributor objects.
   */
  private extractContributors(history: GitCommitInfo[]): Array<{ name: string; email: string; commits: number }> {
    const contributorMap = new Map<string, { name: string; email: string; commits: number }>();

    for (const commit of history) {
      const key = commit.authorEmail.toLowerCase();
      const existing = contributorMap.get(key);
      if (existing) {
        existing.commits += 1;
      } else {
        contributorMap.set(key, {
          name: commit.authorName,
          email: commit.authorEmail,
          commits: 1,
        });
      }
    }

    return [...contributorMap.values()].sort((a, b) => b.commits - a.commits);
  }

  /**
   * Check if a file is a configuration file worth tracking.
   *
   * @param filePath - Relative file path.
   * @returns `true` if the file is a recognized config file.
   */
  private isConfigFile(filePath: string): boolean {
    const basename = filePath.split('/').pop() ?? filePath;

    // Dependency lockfiles must be tracked so supply-chain analyzers can
    // reason about their presence.
    if (isLockfile(filePath)) {
      return true;
    }

    // Security policy files (SECURITY.md) are recognised case-insensitively so
    // the "missing security policy" check can evaluate real repositories.
    if (basename.toLowerCase() === 'security.md') {
      return true;
    }

    const configFiles = new Set([
      'package.json',
      'tsconfig.json',
      'tsconfig.base.json',
      'pyproject.toml',
      'setup.py',
      'setup.cfg',
      'go.mod',
      'go.sum',
      'Cargo.toml',
      'Cargo.lock',
      'pom.xml',
      'build.gradle',
      'build.gradle.kts',
      'Gemfile',
      'composer.json',
      'pubspec.yaml',
      '.eslintrc.json',
      '.eslintrc.js',
      '.prettierrc',
      '.prettierrc.json',
      'jest.config.js',
      'jest.config.ts',
      'vitest.config.ts',
      'vitest.config.js',
      '.env.example',
      'docker-compose.yml',
      'docker-compose.yaml',
      'Dockerfile',
      'Makefile',
      '.github/workflows',
    ]);

    return configFiles.has(basename);
  }
}

/**
 * @module @recurrsive/server/state
 *
 * Shared server state manager for the Fastify API server.
 *
 * Holds references to the knowledge graph client, opportunity manager,
 * analysis status, and evolution timeline so that route handlers can
 * access shared state without global variables.
 *
 * @packageDocumentation
 */

import * as path from 'node:path';
import { createGraphClient, type ExtendedGraphClient } from '@recurrsive/graph';
import { OpportunityManager } from '@recurrsive/opportunities';
import { AnalyzerRegistry, AnalyzerRunner, createDefaultAnalyzers } from '@recurrsive/analyzers';
import { ReasoningEngine } from '@recurrsive/reasoning';
import { GitCollector, DocumentationCollector, EnvironmentCollector, CICDCollector, DatabaseCollector, GitHubCollector, GitLabCollector } from '@recurrsive/collectors';
import { ParsingPipeline } from '@recurrsive/parsers';
import type {
  Finding,
  Opportunity,
  EvolutionSnapshot,
  EvolutionTimeline,
  MaturityScore,
  AnalysisContext,
  ProjectInfo,
  ConsensusResult,
} from '@recurrsive/core';
import { createLogger, generateId, nowISO } from '@recurrsive/core';
import { readFile, mkdir } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { store } from './store.js';
import { computeHealthScore } from './health-score.js';

const execFileAsync = promisify(execFile);

const logger = createLogger({ context: { component: 'server:state' } });

/**
 * Implicit project id used when a caller does not specify one. Enables a
 * single-project self-host deployment to work without juggling project ids,
 * while still keeping analysis cache/history keyed by project in the store.
 */
export const DEFAULT_PROJECT_ID = 'default';

/**
 * Normalize a git remote URL to a standard HTTPS form.
 *
 * Handles the common remote shapes so downstream collectors receive a URL
 * they can parse with the WHATWG `URL` API:
 *   - `git@github.com:owner/repo.git`        → `https://github.com/owner/repo`
 *   - `ssh://git@github.com/owner/repo.git`  → `https://github.com/owner/repo`
 *   - `https://github.com/owner/repo.git`    → `https://github.com/owner/repo`
 *
 * Unrecognized forms are returned unchanged (callers validate the host).
 *
 * @param raw - The raw remote URL from `git remote get-url`.
 * @returns The normalized URL string.
 */
function normalizeGitRemoteUrl(raw: string): string {
  let url = raw.trim();
  // scp-like syntax: git@host:owner/repo(.git)
  const scpMatch = /^[^@]+@([^:]+):(.+)$/.exec(url);
  if (scpMatch && !url.includes('://')) {
    url = `https://${scpMatch[1]}/${scpMatch[2]}`;
  }
  // ssh://user@host/path → https://host/path
  url = url.replace(/^ssh:\/\/(?:[^@/]+@)?/, 'https://');
  // git://host/path → https://host/path
  url = url.replace(/^git:\/\//, 'https://');
  // strip trailing .git and any trailing slash
  url = url.replace(/\.git$/, '').replace(/\/$/, '');
  return url;
}

// ---------------------------------------------------------------------------
// Persistent history helpers (backed by the KV store → PostgreSQL)
// ---------------------------------------------------------------------------

/** Load analysis history from the store by project id. Returns [] on any error. */
async function loadHistory(projectId: string): Promise<AnalysisHistoryEntry[]> {
  try {
    const entries = await store.get<AnalysisHistoryEntry[]>('analysis_history', projectId);
    return entries ?? [];
  } catch {
    return [];
  }
}

/** Persist analysis history to the store, keyed by project id. */
async function saveHistory(projectId: string, history: AnalysisHistoryEntry[]): Promise<void> {
  try {
    await store.set('analysis_history', projectId, history);
  } catch (err) {
    logger.warn(`Failed to persist analysis history: ${err instanceof Error ? err.message : err}`);
  }
}

// ---------------------------------------------------------------------------
// Analysis status tracking
// ---------------------------------------------------------------------------

/** Phase of the analysis pipeline. */
export type AnalysisPhase =
  | 'idle'
  | 'collecting'
  | 'parsing'
  | 'analyzing'
  | 'reasoning'
  | 'complete'
  | 'error';

/**
 * Reasoning-stage outcome. Distinguishes "ran and produced opportunities"
 * from "skipped because no LLM key" and "attempted but failed", so the API
 * never silently reports 0 opportunities as if reasoning had run.
 */
export interface ReasoningStatus {
  /** Whether reasoning ran, was skipped, or failed. */
  status: 'ran' | 'skipped' | 'unavailable' | 'failed';
  /** Machine-readable reason (e.g. 'no_llm_key', 'no_findings'). */
  reason?: string;
}

/** Real-time analysis status for the /api/v1/analysis/status endpoint. */
export interface AnalysisStatus {
  /** Current pipeline phase. */
  phase: AnalysisPhase;
  /** Progress percentage (0–100). */
  progress: number;
  /** Human-readable status message. */
  message: string;
  /** ISO-8601 timestamp of when analysis started. */
  startedAt: string | null;
  /** ISO-8601 timestamp of when analysis completed. */
  completedAt: string | null;
  /** Error message, if phase is 'error'. */
  error: string | null;
  /** Outcome of the reasoning stage for the most recent run, if any. */
  reasoning: ReasoningStatus | null;
}

/** A single record in the analysis history. */
export interface AnalysisHistoryEntry {
  /** Unique run identifier. */
  id: string;
  /** ISO-8601 timestamp of when the analysis started. */
  startedAt: string;
  /** ISO-8601 timestamp of when the analysis completed. */
  completedAt: string;
  /** Duration in milliseconds. */
  durationMs: number;
  /** Number of findings produced. */
  findingCount: number;
  /** Number of opportunities produced. */
  opportunityCount: number;
  /** Whether reasoning actually ran (not merely requested). */
  includeReasoning: boolean;
  /** Health score computed for this run (null for failed runs). */
  healthScore: number | null;
  /** Final status. */
  status: 'success' | 'failed';
  /** Error message if status is 'failed'. */
  error: string | null;
}

/** Cached results from the most recent analysis run. */
export interface AnalysisCache {
  /** Raw findings from analyzers. */
  findings: Finding[];
  /** Opportunities produced by reasoning. */
  opportunities: Opportunity[];
  /** Consensus result from the reasoning engine. */
  consensus: ConsensusResult | null;
  /** ISO-8601 timestamp of when this cache was populated. */
  analyzedAt: string;
  /** Duration of the analysis in milliseconds. */
  durationMs: number;
  /** Outcome of the reasoning stage for this run. */
  reasoning: ReasoningStatus;
}

// ---------------------------------------------------------------------------
// WebSocket event emitter type
// ---------------------------------------------------------------------------

/** WebSocket event types. */
export type WSEventType =
  | 'analysis:started'
  | 'analysis:progress'
  | 'analysis:finding'
  | 'analysis:complete'
  | 'analysis:error';

/** Shape of a WebSocket event payload. */
export interface WSEvent {
  type: WSEventType;
  timestamp: string;
  data: Record<string, unknown>;
}

/** Callback for broadcasting WebSocket events. */
export type WSBroadcast = (event: WSEvent) => void;

// ---------------------------------------------------------------------------
// ServerState
// ---------------------------------------------------------------------------

/**
 * Centralized state container for the Fastify API server.
 *
 * Lazily initializes the graph client and opportunity manager on first
 * use, and caches analysis results between API calls.
 */
export class ServerState {
  private graphClient: ExtendedGraphClient | null = null;
  private opportunityManager: OpportunityManager = new OpportunityManager();
  private projectPath: string | null = null;
  private projectInfo: ProjectInfo | null = null;
  private analysisCache: AnalysisCache | null = null;
  /** Project id the in-memory cache/history/opportunities belong to. */
  private _currentProjectId: string = DEFAULT_PROJECT_ID;
  private _analysisStatus: AnalysisStatus = {
    phase: 'idle',
    progress: 0,
    message: 'No analysis running',
    startedAt: null,
    completedAt: null,
    error: null,
    reasoning: null,
  };
  private _analysisHistory: AnalysisHistoryEntry[] = [];
  private _analysisLock = false;
  private _evolutionTimeline: EvolutionTimeline | null = null;
  private _wsBroadcast: WSBroadcast | null = null;

  /**
   * Set the WebSocket broadcast function.
   *
   * @param broadcast - Callback to broadcast events to all connected WS clients.
   */
  setWSBroadcast(broadcast: WSBroadcast): void {
    this._wsBroadcast = broadcast;
  }

  /**
   * Broadcast a WebSocket event if a broadcast function is registered.
   *
   * @param event - The event to broadcast.
   */
  broadcast(event: WSEvent): void {
    if (this._wsBroadcast) {
      this._wsBroadcast(event);
    }
  }

  /**
   * Initialize the server state for a given project directory.
   *
   * Creates a graph client (SQLite by default, AGE if DATABASE_URL set)
   * and seeds an empty opportunity manager.
   *
   * @param projectPath - Absolute path to the project root.
   * @param projectName - Optional human-readable project name (defaults to path basename).
   * @throws {Error} If graph client creation fails.
   */
  async initialize(projectPath: string, projectName?: string): Promise<void> {
    logger.info(`Initializing server state for project: ${projectPath}`);

    this.projectPath = projectPath;

    const provider = (process.env['GRAPH_PROVIDER'] ?? 'sqlite') as 'sqlite' | 'postgresql_age';
    const connectionString = process.env['DATABASE_URL'];

    if (provider === 'postgresql_age' && connectionString) {
      // Retry connection with exponential backoff — postgres may not be ready
      // immediately in Docker/container environments.
      const MAX_RETRIES = 5;
      let lastError: unknown;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          this.graphClient = await createGraphClient({
            provider: 'postgresql_age',
            connectionString,
            autoMigrate: true,
          });
          logger.info(`Connected to PostgreSQL/AGE (attempt ${attempt}/${MAX_RETRIES})`);
          lastError = undefined;
          break;
        } catch (err) {
          lastError = err;
          const message = err instanceof Error ? err.message : String(err);
          if (attempt < MAX_RETRIES) {
            const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s, 8s, 16s
            logger.warn(
              `Database connection attempt ${attempt}/${MAX_RETRIES} failed: ${message}. ` +
              `Retrying in ${delay / 1000}s…`,
            );
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // If all retries failed, fall back to in-memory SQLite
      if (lastError) {
        const message = lastError instanceof Error ? lastError.message : String(lastError);
        logger.error(
          `All ${MAX_RETRIES} database connection attempts failed: ${message}. ` +
          `Falling back to in-memory SQLite.`,
        );
        this.graphClient = await createGraphClient({
          provider: 'sqlite',
          sqlitePath: ':memory:',
          autoMigrate: true,
        });
      }
    } else {
      if (provider === 'postgresql_age' && !connectionString) {
        logger.warn(
          'GRAPH_PROVIDER is set to "postgresql_age" but DATABASE_URL is not configured. ' +
          'Falling back to in-memory SQLite.',
        );
      }
      this.graphClient = await createGraphClient({
        provider: 'sqlite',
        sqlitePath: ':memory:',
        autoMigrate: true,
      });
    }

    this.opportunityManager = new OpportunityManager();

    this.projectInfo = {
      name: projectName || path.basename(projectPath) || 'unknown',
      root_path: projectPath,
      languages: [],
      frameworks: [],
      ai_providers: [],
    };

    // Load persisted analysis history for the default project (a specific
    // project id, if any, is applied when runAnalysis is invoked).
    this._currentProjectId = DEFAULT_PROJECT_ID;
    this._analysisHistory = await loadHistory(DEFAULT_PROJECT_ID);
    if (this._analysisHistory.length > 0) {
      logger.info(`Loaded ${this._analysisHistory.length} historical analysis entries`);
    }

    // Restore analysis cache from store (survives restarts)
    const cachedAnalysis = await store.get<AnalysisCache>('analysis_cache', DEFAULT_PROJECT_ID);
    if (cachedAnalysis) {
      this.analysisCache = cachedAnalysis;
      this.opportunityManager = new OpportunityManager(cachedAnalysis.opportunities);
      logger.info(`Restored analysis cache from database (${cachedAnalysis.findings.length} findings, ${cachedAnalysis.opportunities.length} opportunities)`);
    }

    logger.info('Server state initialized successfully');
  }

  /**
   * Clone a git repository to a temporary directory for analysis.
   *
   * Uses shallow clone (--depth 50) to minimize disk usage and time.
   * Returns the local path where the repo was cloned.
   */
  async cloneRepo(gitUrl: string): Promise<string> {
    // Validate URL to prevent SSRF and injection
    if (!/^https?:\/\//i.test(gitUrl)) {
      throw new Error('Only HTTP(S) git URLs are allowed');
    }
    if (/[\x00-\x1f\x7f]/.test(gitUrl)) {
      throw new Error('Git URL contains invalid control characters');
    }

    const crypto = await import('node:crypto');
    const hash = crypto.createHash('sha256').update(gitUrl).digest('hex').slice(0, 12);
    const cloneDir = path.join('/tmp', 'recurrsive-repos', hash);

    // If directory already exists from a previous clone, remove it
    if (existsSync(cloneDir)) {
      logger.info(`Removing previous clone at ${cloneDir}`);
      await rm(cloneDir, { recursive: true, force: true });
    }

    await mkdir(path.dirname(cloneDir), { recursive: true });

    logger.info(`Cloning ${gitUrl} → ${cloneDir} (shallow, depth=50)`);
    const startTime = Date.now();

    try {
      await execFileAsync(
        'git',
        ['clone', '--depth', '50', '--single-branch', gitUrl, cloneDir],
        { timeout: 120_000, maxBuffer: 10 * 1024 * 1024 },
      );
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`Clone completed in ${elapsed}s → ${cloneDir}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Git clone failed: ${message}`);
      throw new Error(`Failed to clone repository: ${message}`);
    }

    return cloneDir;
  }

  /**
   * Clean up a previously cloned repository.
   */
  async cleanupClone(cloneDir: string): Promise<void> {
    if (cloneDir.startsWith('/tmp/recurrsive-repos/') && existsSync(cloneDir)) {
      try {
        await rm(cloneDir, { recursive: true, force: true });
        logger.info(`Cleaned up clone at ${cloneDir}`);
      } catch (err) {
        logger.warn(`Failed to clean up clone: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /**
   * Detect the `origin` remote URL of the project's git repository, if any.
   *
   * Works for both cloned remote repositories (origin points at the source
   * URL) and local repositories that have a remote configured. SSH-form
   * remotes (`git@host:owner/repo.git`) are normalized to HTTPS so downstream
   * collectors can parse a standard URL. Returns `null` when the project is
   * not a git repository, has no `origin` remote, or git is unavailable.
   *
   * @returns Normalized HTTPS remote URL, or `null`.
   */
  private async detectRemoteUrl(): Promise<string | null> {
    if (!this.projectPath) return null;
    let raw: string;
    try {
      const { stdout } = await execFileAsync(
        'git',
        ['-C', this.projectPath, 'remote', 'get-url', 'origin'],
        { timeout: 10_000 },
      );
      raw = stdout.trim();
    } catch {
      return null; // not a repo, no origin, or git unavailable
    }
    if (!raw) return null;
    return normalizeGitRemoteUrl(raw);
  }

  /**
   * Mark analysis as starting to prevent race conditions.
   *
   * This should be called synchronously in the route handler BEFORE
   * launching the async `runAnalysis()` call, so that a second concurrent
   * request sees the running state and returns 409.
   */
  markAnalysisStarting(): void {
    this._analysisStatus = {
      phase: 'collecting',
      progress: 0,
      message: 'Starting analysis…',
      startedAt: nowISO(),
      completedAt: null,
      error: null,
      reasoning: null,
    };
  }

  /**
   * Mark analysis as failed. Called when pre-analysis steps
   * (clone, path validation, initialization) fail after markAnalysisStarting().
   */
  markAnalysisError(errorMessage: string): void {
    this._analysisStatus = {
      phase: 'error',
      progress: 0,
      message: errorMessage,
      startedAt: this._analysisStatus.startedAt,
      completedAt: nowISO(),
      error: errorMessage,
      reasoning: this._analysisStatus.reasoning,
    };
  }

  /**
   * Run the full analysis pipeline on the current project.
   *
   * Executes: collect → parse → analyze → (optionally) reason.
   *
   * @param analyzerIds - Optional list of analyzer IDs to run (defaults to all).
   * @param includeReasoning - Whether to run the reasoning engine after analysis.
   * @returns The analysis cache with findings and opportunities.
   * @throws {Error} If the server is not initialized.
   */
  async runAnalysis(
    analyzerIds?: string[],
    includeReasoning?: boolean,
    projectId?: string,
  ): Promise<AnalysisCache> {
    this.assertInitialized();

    // Prevent concurrent analysis runs
    if (this._analysisLock) {
      throw new Error('Analysis already in progress. Wait for the current run to complete.');
    }
    this._analysisLock = true;

    // Everything this run persists is keyed by this project id. Load that
    // project's history so appends and read endpoints stay consistent.
    const activeProjectId = projectId ?? DEFAULT_PROJECT_ID;
    if (activeProjectId !== this._currentProjectId) {
      this._analysisHistory = await loadHistory(activeProjectId);
    }
    this._currentProjectId = activeProjectId;

    const runId = generateId();
    const start = Date.now();
    const startedAt = nowISO();
    let reasoningStatus: ReasoningStatus = { status: 'skipped', reason: 'not_requested' };

    this._analysisStatus = {
      phase: 'collecting',
      progress: 0,
      message: 'Starting data collection…',
      startedAt,
      completedAt: null,
      error: null,
      reasoning: null,
    };

    this.broadcast({
      type: 'analysis:started',
      timestamp: startedAt,
      data: {
        runId,
        projectPath: this.projectPath,
        includeReasoning: includeReasoning ?? false,
      },
    });

    // Declare collectors outside try for cleanup in finally
    let collector: InstanceType<typeof GitCollector> | null = null;
    let docsCollector: InstanceType<typeof DocumentationCollector> | null = null;
    let envCollector: InstanceType<typeof EnvironmentCollector> | null = null;
    let cicdCollector: InstanceType<typeof CICDCollector> | null = null;
    let dbCollector: InstanceType<typeof DatabaseCollector> | null = null;
    let ghCollector: InstanceType<typeof GitHubCollector> | null = null;
    let glCollector: InstanceType<typeof GitLabCollector> | null = null;

    try {
      // ── Step 0: Clear stale graph data ────────────────────────────────
      // Prevent entity duplication across runs — each collector generates
      // new UUIDs, so old entities would accumulate without clearing.
      this.updateStatus('collecting', 5, 'Clearing previous analysis data…');
      await this.graphClient!.clearAll();

      // ── Step 1: Collect ──────────────────────────────────────────────────
      this.updateStatus('collecting', 10, 'Running git collector…');

      collector = new GitCollector(this.projectPath!);

      // Preflight: refuse to "succeed" on a non-git / empty directory. A failed
      // validate() means there is nothing real to analyze — fail honestly
      // instead of recording a run with 0 findings and health 100.
      const validation = await collector.validate();
      if (!validation.valid) {
        throw new Error(
          validation.errors[0] ?? `Not a git repository: ${this.projectPath}`,
        );
      }

      await collector.initialize({
        governance: {
          masked_fields: [],
          excluded_patterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
          pii_detection: false,
          audit_log: false,
          retention_days: 90,
        },
        custom: { root_path: this.projectPath! },
      });

      const collectorResult = await collector.collect();

      // Ingest entities and relationships into the graph
      let skippedRels = 0;
      for (const entity of collectorResult.entities) {
        await this.graphClient!.upsertEntity(entity);
      }
      for (const rel of collectorResult.relationships) {
        try {
          await this.graphClient!.upsertRelationship(rel);
        } catch {
          skippedRels++;
        }
      }
      if (skippedRels > 0) logger.warn(`Skipped ${skippedRels} relationships (missing entity refs)`);

      this.updateStatus(
        'collecting',
        12,
        `Collected ${collectorResult.entities.length} entities and ${collectorResult.relationships.length} relationships`,
      );

      logger.info(
        `Collected ${collectorResult.entities.length} entities and ` +
        `${collectorResult.relationships.length} relationships`,
      );

      // ── Step 1b: Documentation collector ─────────────────────────────
      this.updateStatus('collecting', 15, 'Running documentation collector…');
      docsCollector = new DocumentationCollector(this.projectPath!);
      await docsCollector.initialize({
        governance: {
          masked_fields: [],
          excluded_patterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
          pii_detection: false,
          audit_log: false,
          retention_days: 90,
        },
        custom: {},
      });
      const docsResult = await docsCollector.collect();
      for (const entity of docsResult.entities) {
        await this.graphClient!.upsertEntity(entity);
      }
      for (const rel of docsResult.relationships) {
        try { await this.graphClient!.upsertRelationship(rel); } catch { /* skip */ }
      }
      logger.info(`Documentation: ${docsResult.entities.length} entities`);

      // ── Step 1c: Environment collector ───────────────────────────────
      this.updateStatus('collecting', 18, 'Running environment collector…');
      envCollector = new EnvironmentCollector(this.projectPath!);
      await envCollector.initialize({
        governance: {
          masked_fields: [],
          excluded_patterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
          pii_detection: false,
          audit_log: false,
          retention_days: 90,
        },
        custom: {},
      });
      const envResult = await envCollector.collect();
      for (const entity of envResult.entities) {
        await this.graphClient!.upsertEntity(entity);
      }
      for (const rel of envResult.relationships) {
        try { await this.graphClient!.upsertRelationship(rel); } catch { /* skip */ }
      }
      logger.info(`Environment: ${envResult.entities.length} entities`);

      // ── Step 1d: CI/CD collector ────────────────────────────────────
      this.updateStatus('collecting', 21, 'Running CI/CD collector…');
      cicdCollector = new CICDCollector(this.projectPath!);
      await cicdCollector.initialize({
        governance: {
          masked_fields: [],
          excluded_patterns: [],
          pii_detection: false,
          audit_log: false,
          retention_days: 90,
        },
        custom: {},
      });
      const cicdResult = await cicdCollector.collect();
      for (const entity of cicdResult.entities) {
        await this.graphClient!.upsertEntity(entity);
      }
      for (const rel of cicdResult.relationships) {
        try { await this.graphClient!.upsertRelationship(rel); } catch { /* skip */ }
      }
      logger.info(`CI/CD: ${cicdResult.entities.length} entities`);

      // ── Step 1e: Database collector ──────────────────────────────────
      this.updateStatus('collecting', 24, 'Running database collector…');
      dbCollector = new DatabaseCollector(this.projectPath!);
      await dbCollector.initialize({
        governance: {
          masked_fields: [],
          excluded_patterns: [],
          pii_detection: false,
          audit_log: false,
          retention_days: 90,
        },
        custom: {},
      });
      const dbResult = await dbCollector.collect();
      for (const entity of dbResult.entities) {
        await this.graphClient!.upsertEntity(entity);
      }
      for (const rel of dbResult.relationships) {
        try { await this.graphClient!.upsertRelationship(rel); } catch { /* skip */ }
      }
      logger.info(`Database: ${dbResult.entities.length} entities`);

      // ── Step 1f: Optional remote collectors (GitHub / GitLab) ────────
      // Enrich the graph with PRs, issues, reviews, workflows, and
      // pipelines when the analyzed repository has a recognizable
      // github.com / gitlab.com origin AND the matching API token is
      // present in the environment. This step is fully isolated: any
      // failure (no remote, unsupported host, missing token, API error)
      // logs a skip reason and never interrupts the core pipeline.
      this.updateStatus('collecting', 26, 'Checking remote collectors…');
      try {
        const remoteUrl = await this.detectRemoteUrl();
        const remoteGovernance = {
          masked_fields: [],
          excluded_patterns: [],
          pii_detection: false,
          audit_log: false,
          retention_days: 90,
        };
        let host = '';
        if (remoteUrl) {
          try { host = new URL(remoteUrl).hostname.toLowerCase(); } catch { host = ''; }
        }

        if (!remoteUrl) {
          logger.info('Remote collectors skipped: no git "origin" remote detected');
        } else if (host === 'github.com' || host.endsWith('.github.com')) {
          if (process.env['GITHUB_TOKEN']) {
            try {
              ghCollector = new GitHubCollector(remoteUrl);
              await ghCollector.initialize({ governance: remoteGovernance, custom: {} });
              const ghResult = await ghCollector.collect();
              for (const entity of ghResult.entities) {
                await this.graphClient!.upsertEntity(entity);
              }
              for (const rel of ghResult.relationships) {
                try { await this.graphClient!.upsertRelationship(rel); } catch { /* skip */ }
              }
              logger.info(`GitHub: ${ghResult.entities.length} entities`);
            } catch (err) {
              logger.warn(`GitHub collector skipped: ${err instanceof Error ? err.message : String(err)}`);
            }
          } else {
            logger.info('GitHub collector skipped: GITHUB_TOKEN not set');
          }
        } else if (host === 'gitlab.com' || host.endsWith('.gitlab.com')) {
          if (process.env['GITLAB_TOKEN']) {
            try {
              glCollector = new GitLabCollector(remoteUrl);
              await glCollector.initialize({ governance: remoteGovernance, custom: {} });
              const glResult = await glCollector.collect();
              for (const entity of glResult.entities) {
                await this.graphClient!.upsertEntity(entity);
              }
              for (const rel of glResult.relationships) {
                try { await this.graphClient!.upsertRelationship(rel); } catch { /* skip */ }
              }
              logger.info(`GitLab: ${glResult.entities.length} entities`);
            } catch (err) {
              logger.warn(`GitLab collector skipped: ${err instanceof Error ? err.message : String(err)}`);
            }
          } else {
            logger.info('GitLab collector skipped: GITLAB_TOKEN not set');
          }
        } else {
          logger.info(`Remote collectors skipped: unsupported host "${host}" (github.com/gitlab.com only)`);
        }
      } catch (err) {
        logger.warn(`Remote collector step skipped: ${err instanceof Error ? err.message : String(err)}`);
      }

      // ── Step 2: Parse source code ──────────────────────────────────────
      this.updateStatus('collecting', 28, 'Parsing source code…');

      const detectedLanguages = new Set<string>();
      for (const entity of collectorResult.entities) {
        if (entity.type === 'file') {
          const lang = entity.properties['language'];
          if (typeof lang === 'string' && lang !== 'unknown') {
            detectedLanguages.add(lang);
          }
        }
      }

      const parsingPipeline = new ParsingPipeline();
      await parsingPipeline.initialize([...detectedLanguages]);

      // Read source files from file entities
      const sourceFiles: Array<{ path: string; content: string; language: string }> = [];
      const fileEntities = collectorResult.entities.filter(
        (e) => e.type === 'file' && e.properties['is_source'] === true,
      );
      for (const entity of fileEntities) {
        const filePath = entity.properties['absolute_path'];
        if (typeof filePath !== 'string') continue;
        const language = entity.properties['language'];
        if (typeof language !== 'string') continue;
        try {
          const content = await readFile(filePath, 'utf-8');
          const relativePath = filePath.startsWith(this.projectPath!)
            ? filePath.slice(this.projectPath!.length + 1)
            : filePath;
          sourceFiles.push({ path: relativePath, content, language });
        } catch {
          // Skip unreadable files
        }
      }

      if (sourceFiles.length > 0) {
        const parseResult = await parsingPipeline.parseProject(sourceFiles);
        for (const entity of parseResult.entities) {
          await this.graphClient!.upsertEntity(entity);
        }
        let skippedParserRels = 0;
        for (const rel of parseResult.relationships) {
          try {
            await this.graphClient!.upsertRelationship(rel);
          } catch {
            skippedParserRels++;
          }
        }
        if (skippedParserRels > 0) {
          logger.warn(`Skipped ${skippedParserRels} parser relationships (FK constraint violations)`);
        }
        logger.info(`Parsed ${sourceFiles.length} files → ${parseResult.entities.length} code entities`);
      }

      // ── Enrich project info ────────────────────────────────────────────
      const aiProviders: string[] = [];
      const detectedFrameworks: string[] = [];
      for (const entity of collectorResult.entities) {
        if (entity.type === 'repository') {
          const providers = entity.properties['ai_providers'];
          if (Array.isArray(providers)) aiProviders.push(...(providers as string[]));
          const fws = entity.properties['frameworks'];
          if (Array.isArray(fws)) detectedFrameworks.push(...(fws as string[]));
        }
      }
      this.projectInfo = {
        ...this.projectInfo!,
        languages: [...detectedLanguages],
        frameworks: detectedFrameworks,
        ai_providers: aiProviders,
      };

      // ── Step 3: Analyze ──────────────────────────────────────────────────
      this.updateStatus('analyzing', 35, 'Running analyzers…');

      const defaultAnalyzers = createDefaultAnalyzers();
      const registry = new AnalyzerRegistry();
      for (const analyzer of defaultAnalyzers) {
        registry.register(analyzer);
      }
      const runner = new AnalyzerRunner(registry);

      const analysisContext: AnalysisContext = {
        graph: this.graphClient!,
        config: {
          enabled: true,
          severity_threshold: 'info' as const,
          custom: {},
        },
        history: {
          getPreviousFindings: async () => [],
          getAcceptedOpportunities: async () => [],
          getRejectedOpportunities: async () => [],
        },
        project: this.projectInfo!,
        emit: (finding: Finding) => {
          this.broadcast({
            type: 'analysis:finding',
            timestamp: nowISO(),
            data: {
              findingId: finding.id,
              title: finding.title,
              severity: finding.severity,
              category: finding.category,
              analyzer_id: finding.analyzer_id,
            },
          });
        },
      };

      const idsToRun = analyzerIds ?? ('*' as const);
      const analysisResult = await runner.run(idsToRun, analysisContext, {
        parallel: true,
        timeout_ms: 60_000,
        on_progress: (analyzerId: string, status: string) => {
          this.broadcast({
            type: 'analysis:progress',
            timestamp: nowISO(),
            data: { analyzerId, status, phase: 'analyzing' },
          });
        },
      });

      this.updateStatus(
        'analyzing',
        70,
        `Analysis produced ${analysisResult.findings.length} findings`,
      );

      logger.info(
        `Analysis produced ${analysisResult.findings.length} findings ` +
        `(${analysisResult.analyzers_run.length} analyzers ran, ` +
        `${analysisResult.analyzers_failed.length} failed)`,
      );

      // ── Step 4: Reason (optional) ────────────────────────────────────────
      let consensus: ConsensusResult | null = null;
      let opportunities: Opportunity[] = [];

      if (includeReasoning) {
        const llmKey = process.env['RECURRSIVE_LLM_API_KEY'];
        if (!llmKey || llmKey.trim().length === 0) {
          // No key → do NOT invoke the engine and do NOT pretend it ran.
          reasoningStatus = { status: 'unavailable', reason: 'no_llm_key' };
          logger.warn('Reasoning requested but RECURRSIVE_LLM_API_KEY is not set — skipping engine.');
        } else if (analysisResult.findings.length === 0) {
          reasoningStatus = { status: 'skipped', reason: 'no_findings' };
        } else {
          this.updateStatus('reasoning', 70, 'Running reasoning engine…');
          try {
            const reasoningConfig = {
              llm_provider: process.env['RECURRSIVE_LLM_PROVIDER'] ?? 'openai',
              llm_model: process.env['RECURRSIVE_LLM_MODEL'] ?? 'gpt-4.1-mini',
              llm_api_key: llmKey,
              max_debate_rounds: 3,
              min_consensus_score: 0.6,
              specialists: [
                'architecture_engineer' as const,
                'security_engineer' as const,
                'performance_engineer' as const,
                'cost_optimizer' as const,
              ],
              temperature: 0.3,
            };

            const engine = new ReasoningEngine(reasoningConfig);
            consensus = await engine.process(
              analysisResult.findings,
              this.graphClient!,
            );
            opportunities = consensus.opportunities;
            reasoningStatus = { status: 'ran' };
            logger.info(`Reasoning produced ${opportunities.length} opportunities`);
          } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            reasoningStatus = { status: 'failed', reason };
            logger.error(`Reasoning engine failed: ${reason}`);
            // Fall through — we still have raw findings
          }
        }
      }

      // Seed the opportunity manager
      this.opportunityManager = new OpportunityManager(opportunities);

      const cache: AnalysisCache = {
        findings: analysisResult.findings,
        opportunities,
        consensus,
        analyzedAt: nowISO(),
        durationMs: Date.now() - start,
        reasoning: reasoningStatus,
      };
      this.analysisCache = cache;

      // Persist analysis cache keyed by the explicit project id (survives
      // restarts). No fragile path-hash guessing — the caller owns the id.
      await store.set('analysis_cache', activeProjectId, cache);
      logger.info(`Persisted analysis cache under project id: ${activeProjectId}`);

      const overall = computeHealthScore(cache.findings, cache.opportunities).overall;

      this.updateStatus('complete', 100, 'Analysis complete');

      const completedAt = nowISO();
      this._analysisStatus.completedAt = completedAt;
      this._analysisStatus.reasoning = reasoningStatus;

      this._analysisHistory.push({
        id: runId,
        startedAt,
        completedAt,
        durationMs: cache.durationMs,
        findingCount: cache.findings.length,
        opportunityCount: cache.opportunities.length,
        includeReasoning: reasoningStatus.status === 'ran',
        healthScore: overall,
        status: 'success',
        error: null,
      });

      // Cap history at 100 entries to prevent unbounded growth
      if (this._analysisHistory.length > 100) {
        this._analysisHistory = this._analysisHistory.slice(-100);
      }

      // Persist history keyed by project id
      await saveHistory(activeProjectId, this._analysisHistory);

      this.broadcast({
        type: 'analysis:complete',
        timestamp: completedAt,
        data: {
          runId,
          durationMs: cache.durationMs,
          findingCount: cache.findings.length,
          opportunityCount: cache.opportunities.length,
          reasoning: reasoningStatus,
        },
      });

      // If a project record with this id exists, update its stored health score
      // so the projects list reflects the real "Analyzed" state.
      try {
        const project = await store.get<Record<string, unknown>>('projects', activeProjectId);
        if (project) {
          await store.set('projects', activeProjectId, {
            ...project,
            healthScore: overall,
            lastAnalysis: completedAt,
            updatedAt: completedAt,
          });
          logger.info(`Updated project ${activeProjectId} with health score ${overall}`);
        }
      } catch (err) {
        logger.warn(`Failed to update project record after analysis: ${err instanceof Error ? err.message : String(err)}`);
      }

      return cache;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this._analysisStatus = {
        phase: 'error',
        progress: 0,
        message: `Analysis failed: ${errorMessage}`,
        startedAt,
        completedAt: nowISO(),
        error: errorMessage,
        reasoning: reasoningStatus.status === 'skipped' ? null : reasoningStatus,
      };

      this._analysisHistory.push({
        id: runId,
        startedAt,
        completedAt: nowISO(),
        durationMs: Date.now() - start,
        findingCount: 0,
        opportunityCount: 0,
        includeReasoning: reasoningStatus.status === 'ran',
        healthScore: null,
        status: 'failed',
        error: errorMessage,
      });

      // Cap history at 100 entries to prevent unbounded growth
      if (this._analysisHistory.length > 100) {
        this._analysisHistory = this._analysisHistory.slice(-100);
      }

      // Persist history keyed by project id
      await saveHistory(activeProjectId, this._analysisHistory);
      this.broadcast({
        type: 'analysis:error',
        timestamp: nowISO(),
        data: { runId, error: errorMessage },
      });

      throw err;
    } finally {
      // Always release the analysis lock
      this._analysisLock = false;

      // Always dispose collectors to prevent resource leaks
      const disposals = [collector, docsCollector, envCollector, cicdCollector, dbCollector, ghCollector, glCollector];
      for (const c of disposals) {
        if (c) { try { await c.dispose(); } catch { /* already cleaned up */ } }
      }
    }
  }

  /**
   * Update analysis status and broadcast progress.
   *
   * @param phase - Current pipeline phase.
   * @param progress - Progress percentage (0–100).
   * @param message - Human-readable message.
   */
  private updateStatus(phase: AnalysisPhase, progress: number, message: string): void {
    this._analysisStatus.phase = phase;
    this._analysisStatus.progress = progress;
    this._analysisStatus.message = message;

    this.broadcast({
      type: 'analysis:progress',
      timestamp: nowISO(),
      data: { phase, progress, message },
    });
  }

  /**
   * Return the graph client instance.
   *
   * @returns The extended graph client.
   * @throws {Error} If the server has not been initialized.
   */
  getGraph(): ExtendedGraphClient {
    this.assertInitialized();
    return this.graphClient!;
  }

  /**
   * Return the opportunity manager instance.
   *
   * @returns The opportunity manager.
   */
  getOpportunities(): OpportunityManager {
    return this.opportunityManager;
  }

  /**
   * Return the current project info.
   *
   * @returns Project metadata.
   * @throws {Error} If the server has not been initialized.
   */
  getProjectInfo(): ProjectInfo {
    this.assertInitialized();
    return this.projectInfo!;
  }

  /**
   * Return the path of the currently loaded project.
   *
   * @returns Absolute path string.
   * @throws {Error} If the server has not been initialized.
   */
  getProjectPath(): string {
    this.assertInitialized();
    return this.projectPath!;
  }

  /**
   * Return the cached analysis results, if any.
   *
   * @returns The analysis cache or null if no analysis has been run.
   */
  getAnalysisCache(): AnalysisCache | null {
    return this.analysisCache;
  }

  /**
   * Return the current analysis status.
   *
   * @returns Analysis status object.
   */
  getAnalysisStatus(): AnalysisStatus {
    return { ...this._analysisStatus };
  }

  /**
   * Return the analysis history.
   *
   * @returns Array of analysis history entries.
   */
  getAnalysisHistory(): AnalysisHistoryEntry[] {
    return [...this._analysisHistory];
  }

  /**
   * Return the evolution timeline.
   *
   * @returns Evolution timeline or a default empty timeline.
   */
  getEvolutionTimeline(): EvolutionTimeline {
    if (this._evolutionTimeline) {
      return this._evolutionTimeline;
    }

    // Build a basic timeline from analysis cache. With no analysis, there are
    // NO snapshots — we do not fabricate a synthetic point with a stand-in score.
    const cache = this.analysisCache;
    if (!cache) {
      return {
        project_id: this._currentProjectId,
        snapshots: [],
        trends: [],
      };
    }

    const snapshot: EvolutionSnapshot = {
      id: generateId(),
      timestamp: nowISO(),
      maturity_scores: [],
      overall_health: computeHealthScore(cache.findings, cache.opportunities).overall,
      opportunity_count: cache.opportunities.length,
      debt_count: cache.opportunities.filter((o) => o.type === 'debt').length,
      risk_count: cache.opportunities.filter((o) => o.type === 'risk').length,
      top_opportunities: cache.opportunities.slice(0, 5).map((o) => o.id),
      changes_since_last: {
        new_opportunities: cache.opportunities.length,
        resolved_opportunities: 0,
        new_risks: cache.opportunities.filter((o) => o.type === 'risk').length,
        resolved_risks: 0,
        maturity_changes: [],
      },
    };

    return {
      project_id: this._currentProjectId,
      snapshots: [snapshot],
      trends: [],
    };
  }

  /**
   * Build the evolution timeline for a SPECIFIC project from its persisted
   * cache, so timeline endpoints honor `?projectId=` instead of always returning
   * the in-memory current project (which bled one project's data to every
   * project's Timeline page).
   *
   * @param projectId - Project id, or undefined for the default project.
   */
  async getEvolutionTimelineForProject(projectId?: string): Promise<EvolutionTimeline> {
    const id = projectId ?? DEFAULT_PROJECT_ID;
    // Use the in-memory timeline only when it belongs to the requested project.
    if (this._evolutionTimeline && id === this._currentProjectId) {
      return this._evolutionTimeline;
    }

    const cache = await this.loadCacheForProject(id);
    if (!cache) {
      return { project_id: id, snapshots: [], trends: [] };
    }

    const snapshot: EvolutionSnapshot = {
      id: generateId(),
      timestamp: cache.analyzedAt ?? nowISO(),
      maturity_scores: [],
      overall_health: computeHealthScore(cache.findings, cache.opportunities).overall,
      opportunity_count: cache.opportunities.length,
      debt_count: cache.opportunities.filter((o) => o.type === 'debt').length,
      risk_count: cache.opportunities.filter((o) => o.type === 'risk').length,
      top_opportunities: cache.opportunities.slice(0, 5).map((o) => o.id),
      changes_since_last: {
        new_opportunities: cache.opportunities.length,
        resolved_opportunities: 0,
        new_risks: cache.opportunities.filter((o) => o.type === 'risk').length,
        resolved_risks: 0,
        maturity_changes: [],
      },
    };

    return { project_id: id, snapshots: [snapshot], trends: [] };
  }

  /**
   * Compute the project health score from the in-memory analysis cache.
   *
   * Delegates to the canonical {@link computeHealthScore}. Returns an explicit
   * `not_analyzed` sentinel (overall `null`) when no analysis has run — NEVER
   * a fabricated stand-in like 50/70/0/100.
   *
   * @returns Overall score (or null), dimensions, and analyzed/not-analyzed status.
   */
  getHealthScore(): { overall: number | null; dimensions: MaturityScore[]; status: 'analyzed' | 'not_analyzed' } {
    const cache = this.analysisCache;
    if (!cache) {
      return { overall: null, dimensions: [], status: 'not_analyzed' };
    }
    const result = computeHealthScore(cache.findings, cache.opportunities);
    return { overall: result.overall, dimensions: result.dimensions, status: 'analyzed' };
  }

  /** Project id the in-memory state currently represents. */
  getCurrentProjectId(): string {
    return this._currentProjectId;
  }

  /**
   * Load the persisted analysis cache for a project id. Returns the in-memory
   * cache when it belongs to the requested project, otherwise reads the store.
   * Returns null when that project has no analysis (never another project's data).
   *
   * @param projectId - Project id, or undefined for the default project.
   */
  async loadCacheForProject(projectId?: string): Promise<AnalysisCache | null> {
    const id = projectId ?? DEFAULT_PROJECT_ID;
    if (this.analysisCache && id === this._currentProjectId) {
      return this.analysisCache;
    }
    try {
      return (await store.get<AnalysisCache>('analysis_cache', id)) ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Load the persisted analysis history for a project id.
   *
   * @param projectId - Project id, or undefined for the default project.
   */
  async loadHistoryForProject(projectId?: string): Promise<AnalysisHistoryEntry[]> {
    const id = projectId ?? DEFAULT_PROJECT_ID;
    if (id === this._currentProjectId) {
      return [...this._analysisHistory];
    }
    return loadHistory(id);
  }

  /**
   * Return an OpportunityManager scoped to a project. Uses the live manager
   * (including in-session status changes) for the current project, otherwise
   * builds a manager from that project's persisted opportunities.
   *
   * @param projectId - Project id, or undefined for the default project.
   */
  async loadOpportunitiesForProject(projectId?: string): Promise<OpportunityManager> {
    const id = projectId ?? DEFAULT_PROJECT_ID;
    if (id === this._currentProjectId) {
      return this.opportunityManager;
    }
    const cache = await this.loadCacheForProject(id);
    return new OpportunityManager(cache?.opportunities ?? []);
  }

  /**
   * Update an opportunity's lifecycle status for a SPECIFIC project and persist
   * the change back to that project's analysis cache.
   *
   * Fixes two problems with mutating the in-memory current manager: the change
   * targeted whichever project was analyzed last (not the one being viewed),
   * and it never survived a restart. Now the correct project's opportunities are
   * loaded, updated, and written back to the store.
   *
   * @param projectId - Project the opportunity belongs to (defaults to the implicit project).
   * @param id - Opportunity id.
   * @param status - New lifecycle status.
   * @param reason - Optional reason recorded with the transition.
   * @returns The updated opportunity.
   */
  async setOpportunityStatus(
    projectId: string | undefined,
    id: string,
    status: Opportunity['status'],
    reason?: string,
  ): Promise<Opportunity> {
    const pid = projectId ?? DEFAULT_PROJECT_ID;
    const manager = await this.loadOpportunitiesForProject(pid);
    const updated = manager.updateStatus(id, status, reason);

    // Persist the mutated set back to the project's cache so the change sticks.
    const cache = await this.loadCacheForProject(pid);
    if (cache) {
      cache.opportunities = manager.list();
      await store.set('analysis_cache', pid, cache);
      if (pid === this._currentProjectId) {
        this.analysisCache = cache;
        this.opportunityManager = manager;
      }
    }
    return updated;
  }

  /**
   * Check whether the server state has been initialized.
   *
   * @returns `true` if initialized with a project path.
   */
  isInitialized(): boolean {
    return this.graphClient !== null && this.projectPath !== null;
  }

  /**
   * Dispose of the server state, releasing all resources.
   */
  async dispose(): Promise<void> {
    if (this.graphClient) {
      await this.graphClient.dispose();
      this.graphClient = null;
    }
    this.opportunityManager = new OpportunityManager();
    this.projectPath = null;
    this.projectInfo = null;
    this.analysisCache = null;
    this._currentProjectId = DEFAULT_PROJECT_ID;
    this._analysisStatus = {
      phase: 'idle',
      progress: 0,
      message: 'No analysis running',
      startedAt: null,
      completedAt: null,
      error: null,
      reasoning: null,
    };
    this._analysisHistory = [];
    this._analysisLock = false;
    this._evolutionTimeline = null;
    logger.info('Server state disposed');
  }

  /**
   * Assert that the server has been initialized.
   *
   * @throws {Error} If not initialized.
   */
  private assertInitialized(): void {
    if (!this.isInitialized()) {
      throw new Error(
        'Server not initialized. Call POST /api/v1/analyze with a project path first.',
      );
    }
  }
}

/**
 * Singleton server state instance shared across all route handlers
 * in the API server.
 */
export const state = new ServerState();

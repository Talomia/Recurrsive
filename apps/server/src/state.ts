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
import { GitCollector, DocumentationCollector, EnvironmentCollector, CICDCollector, DatabaseCollector } from '@recurrsive/collectors';
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
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const logger = createLogger({ context: { component: 'server:state' } });

// ---------------------------------------------------------------------------
// Persistent history helpers
// ---------------------------------------------------------------------------

/** Path to the history file within the project. */
function historyPath(projectRoot: string): string {
  return path.join(projectRoot, '.recurrsive', 'history.json');
}

/** Load analysis history from disk. Returns [] on any error. */
async function loadHistory(projectRoot: string): Promise<AnalysisHistoryEntry[]> {
  try {
    const raw = await readFile(historyPath(projectRoot), 'utf-8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Persist analysis history to disk. */
async function saveHistory(projectRoot: string, history: AnalysisHistoryEntry[]): Promise<void> {
  try {
    const dir = path.join(projectRoot, '.recurrsive');
    await mkdir(dir, { recursive: true });
    await writeFile(historyPath(projectRoot), JSON.stringify(history, null, 2), 'utf-8');
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
  /** Whether reasoning was included. */
  includeReasoning: boolean;
  /** Final status. */
  status: 'success' | 'error';
  /** Error message if status is 'error'. */
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
  private _analysisStatus: AnalysisStatus = {
    phase: 'idle',
    progress: 0,
    message: 'No analysis running',
    startedAt: null,
    completedAt: null,
    error: null,
  };
  private _analysisHistory: AnalysisHistoryEntry[] = [];
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
   * @throws {Error} If graph client creation fails.
   */
  async initialize(projectPath: string): Promise<void> {
    logger.info(`Initializing server state for project: ${projectPath}`);

    this.projectPath = projectPath;

    const provider = (process.env['GRAPH_PROVIDER'] ?? 'sqlite') as 'sqlite' | 'postgresql_age';
    const connectionString = process.env['DATABASE_URL'];

    if (provider === 'postgresql_age' && connectionString) {
      this.graphClient = await createGraphClient({
        provider: 'postgresql_age',
        connectionString,
        autoMigrate: true,
      });
    } else {
      this.graphClient = await createGraphClient({
        provider: 'sqlite',
        sqlitePath: ':memory:',
        autoMigrate: true,
      });
    }

    this.opportunityManager = new OpportunityManager();

    this.projectInfo = {
      name: path.basename(projectPath) || 'unknown',
      root_path: projectPath,
      languages: [],
      frameworks: [],
      ai_providers: [],
    };

    // Load persisted analysis history
    this._analysisHistory = await loadHistory(projectPath);
    if (this._analysisHistory.length > 0) {
      logger.info(`Loaded ${this._analysisHistory.length} historical analysis entries`);
    }

    logger.info('Server state initialized successfully');
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
  ): Promise<AnalysisCache> {
    this.assertInitialized();

    const runId = generateId();
    const start = Date.now();
    const startedAt = nowISO();

    this._analysisStatus = {
      phase: 'collecting',
      progress: 0,
      message: 'Starting data collection…',
      startedAt,
      completedAt: null,
      error: null,
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

    try {
      // ── Step 1: Collect ──────────────────────────────────────────────────
      this.updateStatus('collecting', 10, 'Running git collector…');

      const collector = new GitCollector(this.projectPath!);
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
      for (const entity of collectorResult.entities) {
        await this.graphClient!.upsertEntity(entity);
      }
      for (const rel of collectorResult.relationships) {
        await this.graphClient!.upsertRelationship(rel);
      }

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
      const docsCollector = new DocumentationCollector(this.projectPath!);
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
        await this.graphClient!.upsertRelationship(rel);
      }
      logger.info(`Documentation: ${docsResult.entities.length} entities`);

      // ── Step 1c: Environment collector ───────────────────────────────
      this.updateStatus('collecting', 18, 'Running environment collector…');
      const envCollector = new EnvironmentCollector(this.projectPath!);
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
        await this.graphClient!.upsertRelationship(rel);
      }
      logger.info(`Environment: ${envResult.entities.length} entities`);

      // ── Step 1d: CI/CD collector ────────────────────────────────────
      this.updateStatus('collecting', 21, 'Running CI/CD collector…');
      const cicdCollector = new CICDCollector(this.projectPath!);
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
        await this.graphClient!.upsertRelationship(rel);
      }
      logger.info(`CI/CD: ${cicdResult.entities.length} entities`);

      // ── Step 1e: Database collector ──────────────────────────────────
      this.updateStatus('collecting', 24, 'Running database collector…');
      const dbCollector = new DatabaseCollector(this.projectPath!);
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
        await this.graphClient!.upsertRelationship(rel);
      }
      logger.info(`Database: ${dbResult.entities.length} entities`);

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
        for (const rel of parseResult.relationships) {
          await this.graphClient!.upsertRelationship(rel);
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

      if (includeReasoning && analysisResult.findings.length > 0) {
        this.updateStatus('reasoning', 70, 'Running reasoning engine…');

        try {
          const reasoningConfig = {
            llm_provider: process.env['RECURRSIVE_LLM_PROVIDER'] ?? 'openai',
            llm_model: process.env['RECURRSIVE_LLM_MODEL'] ?? 'gpt-4.1-mini',
            llm_api_key: process.env['RECURRSIVE_LLM_API_KEY'],
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
          logger.info(`Reasoning produced ${opportunities.length} opportunities`);
        } catch (err) {
          logger.error(
            `Reasoning engine failed: ${err instanceof Error ? err.message : String(err)}`,
          );
          // Fall through — we still have raw findings
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
      };
      this.analysisCache = cache;

      this.updateStatus('complete', 100, 'Analysis complete');

      const completedAt = nowISO();
      this._analysisStatus.completedAt = completedAt;

      this._analysisHistory.push({
        id: runId,
        startedAt,
        completedAt,
        durationMs: cache.durationMs,
        findingCount: cache.findings.length,
        opportunityCount: cache.opportunities.length,
        includeReasoning: includeReasoning ?? false,
        status: 'success',
        error: null,
      });

      // Persist history to disk
      await saveHistory(this.projectPath!, this._analysisHistory);
      this.broadcast({
        type: 'analysis:complete',
        timestamp: completedAt,
        data: {
          runId,
          durationMs: cache.durationMs,
          findingCount: cache.findings.length,
          opportunityCount: cache.opportunities.length,
        },
      });

      // ── Dispose collectors ─────────────────────────────────────────────
      await collector.dispose();
      await docsCollector.dispose();
      await envCollector.dispose();
      await cicdCollector.dispose();
      await dbCollector.dispose();

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
      };

      this._analysisHistory.push({
        id: runId,
        startedAt,
        completedAt: nowISO(),
        durationMs: Date.now() - start,
        findingCount: 0,
        opportunityCount: 0,
        includeReasoning: includeReasoning ?? false,
        status: 'error',
        error: errorMessage,
      });

      // Persist history to disk
      await saveHistory(this.projectPath!, this._analysisHistory);
      this.broadcast({
        type: 'analysis:error',
        timestamp: nowISO(),
        data: { runId, error: errorMessage },
      });

      throw err;
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

    // Build a basic timeline from analysis cache
    const cache = this.analysisCache;
    const now = nowISO();

    const snapshot: EvolutionSnapshot = {
      id: generateId(),
      timestamp: now,
      maturity_scores: [],
      overall_health: cache ? Math.max(0, 100 - cache.findings.length * 2) : 50,
      opportunity_count: cache?.opportunities.length ?? 0,
      debt_count: cache?.opportunities.filter((o) => o.type === 'debt').length ?? 0,
      risk_count: cache?.opportunities.filter((o) => o.type === 'risk').length ?? 0,
      top_opportunities: cache?.opportunities.slice(0, 5).map((o) => o.id) ?? [],
      changes_since_last: {
        new_opportunities: cache?.opportunities.length ?? 0,
        resolved_opportunities: 0,
        new_risks: cache?.opportunities.filter((o) => o.type === 'risk').length ?? 0,
        resolved_risks: 0,
        maturity_changes: [],
      },
    };

    return {
      project_id: this.projectPath ?? 'unknown',
      snapshots: [snapshot],
      trends: [],
    };
  }

  /**
   * Compute the project health score from analysis data.
   *
   * @returns Health score (0–100) and maturity dimension scores.
   */
  getHealthScore(): { overall: number; dimensions: MaturityScore[] } {
    const cache = this.analysisCache;
    if (!cache) {
      return { overall: 50, dimensions: [] };
    }

    // Derive a health score from findings: base 100, subtract per severity
    const severityPenalty: Record<string, number> = {
      critical: 15,
      high: 8,
      medium: 4,
      low: 2,
      info: 0,
    };

    let penalty = 0;
    for (const finding of cache.findings) {
      penalty += severityPenalty[finding.severity] ?? 0;
    }

    const overall = Math.max(0, Math.min(100, 100 - penalty));

    // Group findings by category to derive dimension scores
    const categoryFindings = new Map<string, number>();
    for (const finding of cache.findings) {
      const count = categoryFindings.get(finding.category) ?? 0;
      categoryFindings.set(finding.category, count + 1);
    }

    const dimensions: MaturityScore[] = [
      'architecture',
      'security',
      'reliability',
      'data',
      'documentation',
      'testing',
    ].map((dim) => {
      const count = categoryFindings.get(dim) ?? 0;
      const score = Math.max(0, 100 - count * 10);
      return {
        dimension: dim as MaturityScore['dimension'],
        level: score >= 80 ? 'optimizing' : score >= 60 ? 'managed' : score >= 40 ? 'defined' : score >= 20 ? 'developing' : 'initial',
        score,
        trend: 'stable' as const,
        evidence: [`${count} findings in ${dim} category`],
        recommendations: count > 0 ? [`Address ${count} ${dim} findings`] : [],
      };
    });

    return { overall, dimensions };
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

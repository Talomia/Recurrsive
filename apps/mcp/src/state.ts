/**
 * @module @recurrsive/mcp/state
 *
 * Shared server state manager for the MCP server.
 *
 * Holds references to the knowledge graph client, opportunity manager,
 * and last analysis results so that tools and resources can access
 * shared state without global variables.
 *
 * @packageDocumentation
 */

import * as path from 'node:path';
import { createGraphClient, type ExtendedGraphClient } from '@recurrsive/graph';
import { OpportunityManager } from '@recurrsive/opportunities';
import { AnalyzerRegistry, AnalyzerRunner, createDefaultAnalyzers } from '@recurrsive/analyzers';
import { ReasoningEngine } from '@recurrsive/reasoning';
import { GitCollector, DocumentationCollector, EnvironmentCollector, CICDCollector, DatabaseCollector } from '@recurrsive/collectors';
import type {
  Finding,
  Opportunity,
  AnalysisContext,
  ProjectInfo,
  ConsensusResult,
} from '@recurrsive/core';
import { createLogger, nowISO } from '@recurrsive/core';

const logger = createLogger({ context: { component: 'mcp:state' } });

// ---------------------------------------------------------------------------
// Analysis result cache
// ---------------------------------------------------------------------------

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
// ServerState
// ---------------------------------------------------------------------------

/**
 * Centralized state container for the MCP server.
 *
 * Lazily initializes the graph client and opportunity manager on first
 * use, and caches analysis results between tool invocations.
 */
export class ServerState {
  private graphClient: ExtendedGraphClient | null = null;
  private opportunityManager: OpportunityManager | null = null;
  private projectPath: string | null = null;
  private projectInfo: ProjectInfo | null = null;
  private analysisCache: AnalysisCache | null = null;

  /**
   * Initialize the server state for a given project directory.
   *
   * Creates a SQLite-backed graph client and seeds an empty
   * opportunity manager.
   *
   * @param projectPath - Absolute path to the project root.
   * @throws {Error} If graph client creation fails.
   */
  async initialize(projectPath: string): Promise<void> {
    logger.info(`Initializing server state for project: ${projectPath}`);

    this.projectPath = projectPath;

    // Create an in-memory SQLite graph for the MCP session
    this.graphClient = await createGraphClient({
      provider: 'sqlite',
      sqlitePath: ':memory:',
      autoMigrate: true,
    });

    this.opportunityManager = new OpportunityManager();

    this.projectInfo = {
      name: path.basename(projectPath) || 'unknown',
      root_path: projectPath,
      languages: [],
      frameworks: [],
      ai_providers: [],
    };

    logger.info('Server state initialized successfully');
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

    const start = Date.now();
    logger.info('Starting analysis pipeline');

    // ── Step 1: Collect ──────────────────────────────────────────────────
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

    logger.info(
      `Git: ${collectorResult.entities.length} entities, ` +
      `${collectorResult.relationships.length} relationships`,
    );

    // ── Step 1b: Documentation collector ──────────────────────────────
    const governanceConfig = {
      governance: {
        masked_fields: [] as string[],
        excluded_patterns: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
        pii_detection: false,
        audit_log: false,
        retention_days: 90,
      },
      custom: {},
    };

    const docsCollector = new DocumentationCollector(this.projectPath!);
    await docsCollector.initialize(governanceConfig);
    const docsResult = await docsCollector.collect();
    for (const entity of docsResult.entities) await this.graphClient!.upsertEntity(entity);
    for (const rel of docsResult.relationships) await this.graphClient!.upsertRelationship(rel);
    logger.info(`Documentation: ${docsResult.entities.length} entities`);

    // ── Step 1c: Environment collector ────────────────────────────────
    const envCollector = new EnvironmentCollector(this.projectPath!);
    await envCollector.initialize(governanceConfig);
    const envResult = await envCollector.collect();
    for (const entity of envResult.entities) await this.graphClient!.upsertEntity(entity);
    for (const rel of envResult.relationships) await this.graphClient!.upsertRelationship(rel);
    logger.info(`Environment: ${envResult.entities.length} entities`);

    // ── Step 1d: CI/CD collector ──────────────────────────────────────
    const cicdCollector = new CICDCollector(this.projectPath!);
    await cicdCollector.initialize(governanceConfig);
    const cicdResult = await cicdCollector.collect();
    for (const entity of cicdResult.entities) await this.graphClient!.upsertEntity(entity);
    for (const rel of cicdResult.relationships) await this.graphClient!.upsertRelationship(rel);
    logger.info(`CI/CD: ${cicdResult.entities.length} entities`);

    // ── Step 1e: Database collector ───────────────────────────────────
    const dbCollector = new DatabaseCollector(this.projectPath!);
    await dbCollector.initialize(governanceConfig);
    const dbResult = await dbCollector.collect();
    for (const entity of dbResult.entities) await this.graphClient!.upsertEntity(entity);
    for (const rel of dbResult.relationships) await this.graphClient!.upsertRelationship(rel);
    logger.info(`Database: ${dbResult.entities.length} entities`);

    // ── Enrich project info ───────────────────────────────────────────
    const detectedLanguages: string[] = [];
    const detectedFrameworks: string[] = [];
    const detectedAIProviders: string[] = [];
    for (const entity of collectorResult.entities) {
      if (entity.type === 'file') {
        const lang = entity.properties['language'];
        if (typeof lang === 'string' && lang !== 'unknown') detectedLanguages.push(lang);
      }
      if (entity.type === 'repository') {
        const fws = entity.properties['frameworks'];
        if (Array.isArray(fws)) detectedFrameworks.push(...(fws as string[]));
        const providers = entity.properties['ai_providers'];
        if (Array.isArray(providers)) detectedAIProviders.push(...(providers as string[]));
      }
    }
    this.projectInfo = {
      ...this.projectInfo!,
      languages: [...new Set(detectedLanguages)],
      frameworks: detectedFrameworks,
      ai_providers: detectedAIProviders,
    };

    // ── Step 2: Analyze ──────────────────────────────────────────────────
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
      emit: () => { /* no-op for MCP — we collect from return value */ },
    };

    const idsToRun = analyzerIds ?? '*' as const;
    const analysisResult = await runner.run(idsToRun, analysisContext, {
      parallel: true,
      timeout_ms: 60_000,
    });

    logger.info(
      `Analysis produced ${analysisResult.findings.length} findings ` +
      `(${analysisResult.analyzers_run.length} analyzers ran, ` +
      `${analysisResult.analyzers_failed.length} failed)`,
    );

    // ── Step 3: Reason (optional) ────────────────────────────────────────
    let consensus: ConsensusResult | null = null;
    let opportunities: Opportunity[] = [];

    if (includeReasoning && analysisResult.findings.length > 0) {
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

    return cache;
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
   * @throws {Error} If the server has not been initialized.
   */
  getOpportunities(): OpportunityManager {
    this.assertInitialized();
    return this.opportunityManager!;
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
    this.opportunityManager = null;
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
        'Server not initialized. Run the "analyze_project" tool first ' +
        'with a project path to initialize the server.',
      );
    }
  }
}

/**
 * Singleton server state instance shared across all tool and resource
 * handlers in the MCP server.
 */
export const state = new ServerState();

/**
 * Main reasoning engine — orchestrates the full multi-agent debate pipeline.
 *
 * Pipeline stages:
 * 1. **Analysis** — Specialists analyze raw findings and propose hypotheses.
 * 2. **Debate** — Specialists challenge and defend hypotheses across domains.
 * 3. **Synthesis** — Surviving hypotheses are enriched into full opportunities.
 * 4. **Ranking** — Opportunities are scored and ordered by a weighted model.
 *
 * @module
 */

import { createLogger, ReasoningError } from '@recurrsive/core';
import type {
  ReasoningConfig,
  Finding,
  GraphClient,
  ConsensusResult,
  Hypothesis,
} from '@recurrsive/core';
import { createLLMAdapter } from './llm/index.js';
import type { LLMAdapter } from './llm/adapter.js';
import { createDefaultSpecialists } from './specialists/index.js';
import type { Specialist } from './specialists/base.js';
import { DebateProtocol } from './debate/protocol.js';
import { Synthesizer } from './synthesizer/synthesizer.js';
import { Judge } from './judge/judge.js';
import { FileMemoryStore } from './memory/store.js';

const logger = createLogger({ context: { component: 'reasoning:engine' } });

// ---------------------------------------------------------------------------
// ReasoningEngine
// ---------------------------------------------------------------------------

/**
 * The top-level reasoning engine that transforms raw {@link Finding}s
 * into prioritized {@link Opportunity} objects through multi-agent
 * debate.
 *
 * @example
 * ```ts
 * const config: ReasoningConfig = {
 *   llm_provider: 'openai',
 *   llm_model: 'gpt-4.1-mini',
 *   llm_api_key: process.env.OPENAI_API_KEY,
 *   max_debate_rounds: 3,
 *   min_consensus_score: 0.6,
 *   specialists: ['architecture_engineer', 'security_engineer', 'performance_engineer'],
 *   temperature: 0.3,
 * };
 *
 * const engine = new ReasoningEngine(config, '/tmp/reasoning-memory');
 * const result = await engine.process(findings, graphClient);
 * console.log(`Generated ${result.opportunities.length} opportunities`);
 * ```
 */
export class ReasoningEngine {
  private readonly config: ReasoningConfig;
  private readonly llm: LLMAdapter;
  private readonly specialists: Specialist[];
  private readonly debateProtocol: DebateProtocol;
  private readonly synthesizer: Synthesizer;
  private readonly judge: Judge;
  private readonly memory: FileMemoryStore;

  /**
   * @param config - Reasoning engine configuration.
   * @param memoryPath - Optional path for persistent memory storage.
   *   Defaults to `.recurrsive/reasoning-memory` in the CWD.
   */
  constructor(config: ReasoningConfig, memoryPath?: string) {
    this.config = config;
    this.llm = createLLMAdapter(config);

    // Filter default specialists to only those configured
    const allSpecialists = createDefaultSpecialists();
    if (config.specialists.length > 0) {
      this.specialists = allSpecialists.filter((s) =>
        config.specialists.includes(s.role),
      );
    } else {
      this.specialists = allSpecialists;
    }

    if (this.specialists.length === 0) {
      throw new ReasoningError(
        'No specialists configured. At least one specialist role must be specified.',
        'NO_SPECIALISTS',
      );
    }

    this.debateProtocol = new DebateProtocol(
      this.llm,
      config.max_debate_rounds,
      config.min_consensus_score,
    );

    this.synthesizer = new Synthesizer(this.llm);
    this.judge = new Judge();
    this.memory = new FileMemoryStore(
      memoryPath ?? '.recurrsive/reasoning-memory',
    );

    logger.info(
      `ReasoningEngine initialized with ${this.specialists.length} specialists ` +
      `(model: ${this.llm.getModel()}, provider: ${this.llm.getProvider()})`,
    );
  }

  /**
   * Process raw findings through the full reasoning pipeline.
   *
   * Pipeline:
   * 1. Each specialist analyzes findings and proposes hypotheses.
   * 2. Hypotheses are debated across specialists.
   * 3. Surviving hypotheses are synthesized into opportunities.
   * 4. Opportunities are scored and ranked.
   *
   * @param findings - Raw findings from analyzers.
   * @param graphClient - Knowledge graph client for contextual queries.
   * @returns Consensus result with ranked opportunities.
   * @throws {ReasoningError} If the pipeline fails fatally.
   */
  async process(
    findings: Finding[],
    graphClient: GraphClient,
  ): Promise<ConsensusResult> {
    if (findings.length === 0) {
      logger.info('No findings to process — returning empty result');
      return {
        hypotheses: [],
        rounds: [],
        final_rankings: [],
        opportunities: [],
      };
    }

    logger.info(`Processing ${findings.length} findings through reasoning pipeline`);

    // ── Stage 1: Analysis ──────────────────────────────────────────────────
    logger.info(`Stage 1: Specialist analysis (${this.specialists.length} specialists)`);
    const allHypotheses = await this.gatherHypotheses(findings, graphClient);

    if (allHypotheses.length === 0) {
      logger.info('No hypotheses generated — returning empty result');
      return {
        hypotheses: [],
        rounds: [],
        final_rankings: [],
        opportunities: [],
      };
    }

    logger.info(`Generated ${allHypotheses.length} hypotheses across all specialists`);

    // ── Stage 2: Debate ────────────────────────────────────────────────────
    logger.info(
      `Stage 2: Multi-agent debate (max ${this.config.max_debate_rounds} rounds)`,
    );
    const rounds = await this.debateProtocol.execute(
      allHypotheses,
      this.specialists,
      graphClient,
      findings,
    );

    logger.info(`Debate concluded after ${rounds.length} rounds`);

    // Get the final hypothesis state from the last round
    const finalHypotheses =
      rounds.length > 0 && rounds[rounds.length - 1]
        ? rounds[rounds.length - 1]!.hypotheses
        : allHypotheses;

    // ── Stage 3: Synthesis ─────────────────────────────────────────────────
    logger.info(`Stage 3: Synthesizing ${finalHypotheses.length} hypotheses into opportunities`);
    const opportunities = await this.synthesizer.synthesize(
      finalHypotheses,
      rounds,
      findings,
    );

    logger.info(`Synthesized ${opportunities.length} opportunities`);

    // ── Stage 4: Ranking ───────────────────────────────────────────────────
    logger.info(`Stage 4: Scoring and ranking opportunities`);
    const { opportunities: ranked, rankings } =
      this.judge.rankWithDetails(opportunities);

    logger.info(
      `Ranking complete. Top opportunity: ` +
      `"${ranked[0]?.title ?? 'none'}" (score: ${rankings[0]?.final_score?.toFixed(3) ?? 'N/A'})`,
    );

    return {
      hypotheses: finalHypotheses,
      rounds,
      final_rankings: rankings,
      opportunities: ranked,
    };
  }

  /**
   * Get the memory store instance for external access.
   *
   * @returns The file-based memory store.
   */
  getMemory(): FileMemoryStore {
    return this.memory;
  }

  /**
   * Get the LLM adapter instance.
   *
   * @returns The configured LLM adapter.
   */
  getLLM(): LLMAdapter {
    return this.llm;
  }

  /**
   * Get the active specialists.
   *
   * @returns Array of configured specialist instances.
   */
  getSpecialists(): readonly Specialist[] {
    return this.specialists;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Run all specialists in parallel to gather hypotheses from findings.
   *
   * Each specialist analyzes findings independently. Failures in
   * individual specialists are logged but don't block other specialists.
   *
   * @param findings - Raw findings to analyze.
   * @param graphClient - Knowledge graph client.
   * @returns All hypotheses from all specialists, concatenated.
   */
  private async gatherHypotheses(
    findings: Finding[],
    graphClient: GraphClient,
  ): Promise<Hypothesis[]> {
    const results = await Promise.allSettled(
      this.specialists.map(async (specialist) => {
        logger.debug(`${specialist.name} analyzing ${findings.length} findings`);
        try {
          const hypotheses = await specialist.analyzeFindings(
            findings,
            this.llm,
            graphClient,
          );
          logger.debug(
            `${specialist.name} produced ${hypotheses.length} hypotheses`,
          );
          return hypotheses;
        } catch (err) {
          logger.warn(
            `${specialist.name} failed to analyze findings: ` +
            `${err instanceof Error ? err.message : String(err)}`,
          );
          return [];
        }
      }),
    );

    const allHypotheses: Hypothesis[] = [];

    for (const result of results) {
      if (result.status === 'fulfilled') {
        allHypotheses.push(...result.value);
      }
      // Rejected results are already logged in the catch block above
    }

    return allHypotheses;
  }
}

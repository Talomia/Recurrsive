/**
 * Multi-agent debate protocol.
 *
 * Orchestrates structured debate rounds where specialist agents
 * challenge and defend hypotheses. Each round:
 * 1. Specialists challenge hypotheses outside their own domain.
 * 2. Proposers defend their hypotheses.
 * 3. Confidence scores are revised.
 * 4. Consensus is checked — debate ends when convergence is reached
 *    or the maximum number of rounds is exhausted.
 *
 * @module
 */

import { createLogger } from '@recurrsive/core';
import type {
  Hypothesis,
  DebateRound,
  DebateChallenge,
  DebateResponse,
  GraphClient,
} from '@recurrsive/core';
import type { Specialist } from '../specialists/base.js';
import type { LLMAdapter } from '../llm/adapter.js';

const logger = createLogger({ context: { component: 'reasoning:debate' } });

// ---------------------------------------------------------------------------
// Convergence detector
// ---------------------------------------------------------------------------

/**
 * Measures the average absolute change in confidence scores between
 * the last two rounds. Used to detect when specialists have converged
 * on stable assessments.
 *
 * @param currentHypotheses - Hypotheses after the current round.
 * @param previousHypotheses - Hypotheses from the previous round.
 * @returns Mean absolute confidence change across all hypotheses.
 */
function averageConfidenceChange(
  currentHypotheses: Hypothesis[],
  previousHypotheses: Hypothesis[],
): number {
  if (currentHypotheses.length === 0) return 0;

  const prevMap = new Map(previousHypotheses.map((h) => [h.id, h.confidence]));
  let totalDelta = 0;
  let count = 0;

  for (const h of currentHypotheses) {
    const prev = prevMap.get(h.id);
    if (prev !== undefined) {
      totalDelta += Math.abs(h.confidence - prev);
      count++;
    }
  }

  return count > 0 ? totalDelta / count : 0;
}

// ---------------------------------------------------------------------------
// Debate Protocol
// ---------------------------------------------------------------------------

/**
 * Orchestrates multi-agent debate between specialist agents.
 *
 * The debate follows a structured protocol:
 * 1. Each specialist can challenge hypotheses from other specialists.
 * 2. The proposing specialist defends their hypothesis.
 * 3. Confidence is revised based on the exchange.
 * 4. Debate continues until consensus or max rounds.
 *
 * @example
 * ```ts
 * const protocol = new DebateProtocol(llm, 3, 0.6);
 * const rounds = await protocol.execute(hypotheses, specialists, graph);
 * ```
 */
export class DebateProtocol {
  private readonly llm: LLMAdapter;
  private readonly maxRounds: number;
  private readonly minConsensus: number;

  /**
   * @param llm - LLM adapter for specialist reasoning.
   * @param maxRounds - Maximum number of debate rounds.
   * @param minConsensus - Minimum average confidence for consensus (0–1).
   */
  constructor(llm: LLMAdapter, maxRounds: number, minConsensus: number) {
    this.llm = llm;
    this.maxRounds = maxRounds;
    this.minConsensus = minConsensus;
  }

  /**
   * Execute the full debate protocol.
   *
   * @param hypotheses - Initial hypotheses to debate.
   * @param specialists - Specialist agents participating in the debate.
   * @param _graph - Knowledge graph client for additional context.
   * @returns Ordered list of debate rounds with challenges and responses.
   * @throws {ReasoningError} If LLM calls fail during debate.
   */
  async execute(
    hypotheses: Hypothesis[],
    specialists: Specialist[],
    _graph: GraphClient,
  ): Promise<DebateRound[]> {
    if (hypotheses.length === 0 || specialists.length === 0) {
      return [];
    }

    const rounds: DebateRound[] = [];
    let currentHypotheses = [...hypotheses];

    for (let roundNum = 1; roundNum <= this.maxRounds; roundNum++) {
      logger.info(`Starting debate round ${roundNum}/${this.maxRounds}`);

      const round = await this.executeRound(
        roundNum,
        currentHypotheses,
        specialists,
      );
      rounds.push(round);

      // Update hypothesis confidences based on defense responses
      currentHypotheses = this.applyRevisions(currentHypotheses, round);
      // Update the round's hypotheses snapshot to reflect revised values
      round.hypotheses = currentHypotheses.map((h) => ({ ...h }));

      // Check for consensus (convergence)
      if (this.hasConsensus(rounds)) {
        logger.info(
          `Consensus reached after ${roundNum} rounds ` +
          `(avg confidence: ${this.averageConfidence(currentHypotheses).toFixed(3)})`,
        );
        break;
      }
    }

    return rounds;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Execute a single debate round.
   *
   * @param roundNumber - Sequential round number (1-indexed).
   * @param hypotheses - Current hypotheses to debate.
   * @param specialists - All participating specialists.
   * @returns A complete debate round with challenges and responses.
   */
  private async executeRound(
    roundNumber: number,
    hypotheses: Hypothesis[],
    specialists: Specialist[],
  ): Promise<DebateRound> {
    const challenges: DebateChallenge[] = [];
    const responses: DebateResponse[] = [];

    // Build lookup of specialists by role
    const specialistMap = new Map(specialists.map((s) => [s.role, s]));

    // Each specialist challenges hypotheses from OTHER specialists
    for (const specialist of specialists) {
      // Find hypotheses proposed by OTHER specialists
      const otherHypotheses = hypotheses.filter(
        (h) => h.proposed_by !== specialist.role,
      );

      // Limit challenges per specialist per round to avoid excessive LLM calls
      const toChallenge = otherHypotheses.slice(0, 3);

      for (const hypothesis of toChallenge) {
        try {
          logger.debug(
            `${specialist.name} challenging "${hypothesis.title}" ` +
            `(proposed by ${hypothesis.proposed_by})`,
          );

          const challengeText = await specialist.challenge(hypothesis, this.llm);

          const challenge: DebateChallenge = {
            challenger: specialist.role,
            hypothesis_id: hypothesis.id,
            challenge: challengeText,
            evidence: `Challenge from ${specialist.name} applying ${specialist.cognitiveFramework}`,
          };
          challenges.push(challenge);

          // Now the proposer defends
          const proposer = specialistMap.get(hypothesis.proposed_by);
          if (proposer) {
            const defense = await proposer.defend(
              hypothesis,
              challengeText,
              this.llm,
            );

            const response: DebateResponse = {
              defender: hypothesis.proposed_by,
              hypothesis_id: hypothesis.id,
              response: defense.response,
              revised_confidence: defense.revised_confidence,
            };
            responses.push(response);
          }
        } catch (err) {
          logger.warn(
            `Challenge/defense failed for "${hypothesis.title}": ` +
            `${err instanceof Error ? err.message : String(err)}`,
          );
          // Continue debate even if individual exchanges fail
        }
      }
    }

    return {
      round_number: roundNumber,
      hypotheses: hypotheses.map((h) => ({ ...h })),
      challenges,
      responses,
    };
  }

  /**
   * Apply confidence revisions from defense responses to the current
   * set of hypotheses.
   *
   * For each hypothesis, the revised confidence is the average of all
   * defense responses for that hypothesis in this round. If there are
   * no responses (no challenges), the confidence is unchanged.
   *
   * @param hypotheses - Current hypotheses.
   * @param round - The completed debate round.
   * @returns Updated hypotheses with revised confidences.
   */
  private applyRevisions(
    hypotheses: Hypothesis[],
    round: DebateRound,
  ): Hypothesis[] {
    // Group responses by hypothesis ID and average revised_confidence
    const revisionMap = new Map<string, number[]>();
    for (const response of round.responses) {
      const existing = revisionMap.get(response.hypothesis_id) ?? [];
      existing.push(response.revised_confidence);
      revisionMap.set(response.hypothesis_id, existing);
    }

    return hypotheses.map((h) => {
      const revisions = revisionMap.get(h.id);
      if (!revisions || revisions.length === 0) {
        return h;
      }
      const avgRevised =
        revisions.reduce((sum, v) => sum + v, 0) / revisions.length;
      return { ...h, confidence: Math.max(0, Math.min(1, avgRevised)) };
    });
  }

  /**
   * Check whether the debate has reached consensus.
   *
   * Consensus is reached when EITHER:
   * 1. The average confidence across all hypotheses exceeds
   *    {@link minConsensus}, OR
   * 2. The average confidence change between the last two rounds is
   *    below a convergence threshold (0.02), meaning specialists
   *    have stopped changing their minds.
   *
   * @param rounds - All debate rounds so far.
   * @returns True if consensus has been reached.
   */
  private hasConsensus(rounds: DebateRound[]): boolean {
    if (rounds.length === 0) return false;

    const lastRound = rounds[rounds.length - 1];
    if (!lastRound) return false;

    // Check if average confidence meets the minimum threshold
    const avgConf = this.averageConfidence(lastRound.hypotheses);
    if (avgConf >= this.minConsensus) {
      return true;
    }

    // Check for convergence (confidence not changing meaningfully)
    if (rounds.length >= 2) {
      const prevRound = rounds[rounds.length - 2];
      if (prevRound) {
        const delta = averageConfidenceChange(
          lastRound.hypotheses,
          prevRound.hypotheses,
        );
        // Converged when average change is < 2%
        if (delta < 0.02) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Calculate the average confidence across a set of hypotheses.
   *
   * @param hypotheses - Hypotheses to average.
   * @returns Average confidence score (0–1).
   */
  private averageConfidence(hypotheses: Hypothesis[]): number {
    if (hypotheses.length === 0) return 0;
    const total = hypotheses.reduce((sum, h) => sum + h.confidence, 0);
    return total / hypotheses.length;
  }
}

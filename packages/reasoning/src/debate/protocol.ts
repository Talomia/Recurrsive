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
  Finding,
  GraphClient,
} from '@recurrsive/core';
import type { Specialist } from '../specialists/base.js';
import { buildHypothesisContext } from '../specialists/base.js';
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

/**
 * Maximum hypotheses a single specialist will challenge per round. The set is
 * ordered by {@link importance} first, so a bound never silently drops the
 * highest-stakes hypotheses the way array-order truncation did.
 */
const MAX_CHALLENGES_PER_SPECIALIST = 10;

/**
 * Debate-priority of a hypothesis. Higher-confidence, better-evidenced
 * hypotheses are the ones most worth scrutinising, since they are the ones
 * that will drive downstream opportunities.
 *
 * @param h - The hypothesis to score.
 * @returns A priority value; larger means challenge sooner.
 */
function importance(h: Hypothesis): number {
  return 0.6 * h.confidence + 0.4 * h.evidence_strength;
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
   * @param minConsensus - Minimum inter-agent AGREEMENT ratio (0–1) required to
   *   declare consensus — i.e. the fraction of challenges the hypotheses must
   *   withstand. This is NOT an average-confidence threshold.
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
   * @param graph - Knowledge graph client used to ground challenges/defenses.
   * @param findings - Findings backing the hypotheses (for evidence context).
   * @returns Ordered list of debate rounds with challenges and responses.
   * @throws {ReasoningError} If LLM calls fail during debate.
   */
  async execute(
    hypotheses: Hypothesis[],
    specialists: Specialist[],
    graph: GraphClient,
    findings: Finding[] = [],
  ): Promise<DebateRound[]> {
    if (hypotheses.length === 0 || specialists.length === 0) {
      return [];
    }

    // Pre-build real evidence + graph context per hypothesis so every
    // challenge and defense reasons over collected data, not titles alone.
    const contextByHypothesis = new Map<string, string>();
    for (const h of hypotheses) {
      try {
        contextByHypothesis.set(
          h.id,
          await buildHypothesisContext(h, findings, graph),
        );
      } catch {
        contextByHypothesis.set(h.id, '');
      }
    }

    const rounds: DebateRound[] = [];
    let currentHypotheses = [...hypotheses];

    for (let roundNum = 1; roundNum <= this.maxRounds; roundNum++) {
      logger.info(`Starting debate round ${roundNum}/${this.maxRounds}`);

      const round = await this.executeRound(
        roundNum,
        currentHypotheses,
        specialists,
        contextByHypothesis,
      );
      rounds.push(round);

      // Update hypothesis confidences based on defense responses
      currentHypotheses = this.applyRevisions(currentHypotheses, round);
      // Update the round's hypotheses snapshot to reflect revised values
      round.hypotheses = currentHypotheses.map((h) => ({ ...h }));

      // Check for consensus (actual inter-agent agreement / convergence)
      if (this.hasConsensus(rounds)) {
        logger.info(
          `Consensus reached after ${roundNum} rounds ` +
          `(agreement: ${this.agreementRatio(round).toFixed(3)})`,
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
    contextByHypothesis: Map<string, string>,
  ): Promise<DebateRound> {
    const challenges: DebateChallenge[] = [];
    const responses: DebateResponse[] = [];

    // Build lookup of specialists by role
    const specialistMap = new Map(specialists.map((s) => [s.role, s]));

    // Each specialist challenges hypotheses from OTHER specialists
    for (const specialist of specialists) {
      // Find hypotheses proposed by OTHER specialists, ordered by importance so
      // that when we bound the work we scrutinise the highest-stakes claims —
      // not whatever happened to appear first in the array.
      const otherHypotheses = hypotheses
        .filter((h) => h.proposed_by !== specialist.role)
        .sort((a, b) => importance(b) - importance(a));

      // Bound challenges per specialist per round to keep LLM cost finite, but
      // select by importance rather than array order. When the set is small,
      // every hypothesis is covered.
      const toChallenge = otherHypotheses.slice(0, MAX_CHALLENGES_PER_SPECIALIST);

      for (const hypothesis of toChallenge) {
        logger.debug(
          `${specialist.name} challenging "${hypothesis.title}" ` +
          `(proposed by ${hypothesis.proposed_by})`,
        );

        const context = contextByHypothesis.get(hypothesis.id);

        // Step 1 — challenge. If generating the challenge fails, we record
        // NEITHER a challenge nor a response, so the per-hypothesis
        // challenge/response arrays stay length-aligned.
        let challengeText: string;
        try {
          challengeText = await specialist.challenge(hypothesis, this.llm, context);
        } catch (err) {
          logger.warn(
            `Challenge failed for "${hypothesis.title}": ` +
            `${err instanceof Error ? err.message : String(err)}`,
          );
          continue;
        }

        const challenge: DebateChallenge = {
          challenger: specialist.role,
          hypothesis_id: hypothesis.id,
          challenge: challengeText,
          evidence: `Challenge from ${specialist.name} applying ${specialist.cognitiveFramework}`,
        };
        challenges.push(challenge);

        // Step 2 — defense. Every recorded challenge gets EXACTLY ONE recorded
        // response, so the k-th challenge for a hypothesis always pairs with
        // the k-th response for that hypothesis (relied on by agreementRatio
        // and the synthesizer's provenance). If the defense LLM call throws, or
        // no proposer is available, we push a placeholder that leaves the
        // hypothesis's confidence unchanged — a transient failure must never
        // silently shift the pairing or fabricate a concession.
        const proposer = specialistMap.get(hypothesis.proposed_by);
        let response: DebateResponse;
        if (proposer) {
          try {
            const defense = await proposer.defend(
              hypothesis,
              challengeText,
              this.llm,
              context,
            );
            response = {
              defender: hypothesis.proposed_by,
              hypothesis_id: hypothesis.id,
              response: defense.response,
              revised_confidence: defense.revised_confidence,
            };
          } catch (err) {
            logger.warn(
              `Defense failed for "${hypothesis.title}": ` +
              `${err instanceof Error ? err.message : String(err)}`,
            );
            response = {
              defender: hypothesis.proposed_by,
              hypothesis_id: hypothesis.id,
              response:
                `Defense unavailable — the defender could not respond ` +
                `(error: ${err instanceof Error ? err.message : String(err)}).`,
              revised_confidence: hypothesis.confidence,
            };
          }
        } else {
          response = {
            defender: hypothesis.proposed_by,
            hypothesis_id: hypothesis.id,
            response: '(no defender available to respond to this challenge)',
            revised_confidence: hypothesis.confidence,
          };
        }
        responses.push(response);
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
   * Consensus is about actual inter-agent AGREEMENT, not how confident agents
   * feel. It is reached when EITHER:
   * 1. Agreement in the latest round is high — the fraction of challenges the
   *    hypotheses withstood (defender kept confidence ≥ 0.5) is at or above
   *    {@link minConsensus}. A round with no challenges means nothing was
   *    disputed, which is also agreement. This correctly ends the debate when
   *    agents agree even that a hypothesis is *weak* (low confidence, no
   *    dissent), instead of forcing more rounds as the old confidence-average
   *    test did.
   * 2. Positions have converged — the average confidence change between the
   *    last two rounds is below 2%, meaning agents have stopped moving. This is
   *    a genuine "no more disagreement is being resolved" signal.
   *
   * @param rounds - All debate rounds so far.
   * @returns True if consensus has been reached.
   */
  private hasConsensus(rounds: DebateRound[]): boolean {
    if (rounds.length === 0) return false;

    const lastRound = rounds[rounds.length - 1];
    if (!lastRound) return false;

    // 1. High agreement / low dissent in the latest round.
    if (this.agreementRatio(lastRound) >= this.minConsensus) {
      return true;
    }

    // 2. Convergence — agents have stopped changing their minds.
    if (rounds.length >= 2) {
      const prevRound = rounds[rounds.length - 2];
      if (prevRound) {
        const delta = averageConfidenceChange(
          lastRound.hypotheses,
          prevRound.hypotheses,
        );
        if (delta < 0.02) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Measure inter-agent agreement within a round.
   *
   * For each challenge, the defender's post-exchange confidence is the real
   * signal: if it stayed at or above 0.5 the defense held (the challenger's
   * objection did not land — agreement); if it fell below 0.5 the defender
   * conceded doubt (dissent). Agreement is the fraction of challenges that were
   * withstood. A round with no challenges has nothing in dispute and so counts
   * as full agreement (1.0).
   *
   * @param round - The debate round to assess.
   * @returns Agreement ratio in [0, 1].
   */
  private agreementRatio(round: DebateRound): number {
    const DISSENT_CONFIDENCE = 0.5;
    // Pair each challenge with the defense it provoked (k-th challenge for a
    // hypothesis ↔ k-th response for that hypothesis, as pushed in order).
    // executeRound guarantees one response per challenge (a placeholder is
    // recorded if a defense fails), so these arrays stay aligned; the
    // `revised === undefined` fallback below remains as defensive robustness.
    let total = 0;
    let withstood = 0;

    const byHypothesis = new Map<string, { challenges: number; responses: number[] }>();
    for (const c of round.challenges) {
      const entry = byHypothesis.get(c.hypothesis_id) ?? { challenges: 0, responses: [] };
      entry.challenges += 1;
      byHypothesis.set(c.hypothesis_id, entry);
    }
    for (const r of round.responses) {
      const entry = byHypothesis.get(r.hypothesis_id) ?? { challenges: 0, responses: [] };
      entry.responses.push(r.revised_confidence);
      byHypothesis.set(r.hypothesis_id, entry);
    }

    for (const { challenges, responses } of byHypothesis.values()) {
      for (let i = 0; i < challenges; i++) {
        total += 1;
        const revised = responses[i];
        // A challenge with a defense that held counts as withstood. A challenge
        // with no recorded defense is treated as unresolved (not withstood).
        if (revised !== undefined && revised >= DISSENT_CONFIDENCE) {
          withstood += 1;
        }
      }
    }

    if (total === 0) return 1; // nothing disputed → agreement
    return withstood / total;
  }
}

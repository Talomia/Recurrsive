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
 * Maximum number of challenge/defense units evaluated concurrently within a
 * debate round. The units are independent, so running them in parallel turns
 * the round's wall-clock from O(units × LLM latency) into roughly
 * O(units / concurrency × LLM latency). Bounded to keep provider concurrency
 * (and rate-limit exposure) reasonable.
 */
const DEBATE_CONCURRENCY = 5;

/**
 * Map over `items` running at most `limit` invocations of `fn` concurrently,
 * preserving input order in the returned results array. Order preservation is
 * essential here: the debate relies on challenges[i] pairing with responses[i].
 *
 * @param items - Work items.
 * @param limit - Maximum concurrent invocations.
 * @param fn - Async mapper.
 * @returns Results in the same order as `items`.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) break;
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

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

      // Update hypothesis confidences based on defense responses. The revised
      // values go into a SEPARATE snapshot: `round.hypotheses` must keep the
      // start-of-round baseline, because agreementRatio() and the synthesizer's
      // provenance both measure how far each defense moved confidence FROM that
      // baseline. Overwriting it with the revised values (the old behavior)
      // made baseline === revised for every exchange, so every challenge
      // counted as "withstood" and consensus was fabricated at ~1.0.
      currentHypotheses = this.applyRevisions(currentHypotheses, round);
      round.revised_hypotheses = currentHypotheses.map((h) => ({ ...h }));

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

    // Each specialist challenges hypotheses proposed by OTHER specialists. The
    // (specialist, hypothesis) challenge→defense units are independent, so they
    // are resolved concurrently (bounded) and then collected in the original
    // deterministic order — preserving the exact challenge/response pairing and
    // ordering the sequential version produced, at a fraction of the wall-clock.
    interface ChallengeUnit { specialist: Specialist; hypothesis: Hypothesis; }
    const units: ChallengeUnit[] = [];
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
        units.push({ specialist, hypothesis });
      }
    }

    // Resolve each unit to a challenge/response pair, or null when the challenge
    // itself failed (in which case NEITHER is recorded, keeping the arrays
    // length-aligned exactly as the sequential implementation did).
    const paired = await mapWithConcurrency(
      units,
      DEBATE_CONCURRENCY,
      async ({ specialist, hypothesis }): Promise<{ challenge: DebateChallenge; response: DebateResponse } | null> => {
        logger.debug(
          `${specialist.name} challenging "${hypothesis.title}" ` +
          `(proposed by ${hypothesis.proposed_by})`,
        );

        const context = contextByHypothesis.get(hypothesis.id);

        // Step 1 — challenge. If generating the challenge fails, we still record
        // the exchange (marked unresolved) so the round reflects that scrutiny
        // was ATTEMPTED — a failed challenge must not be silently dropped and
        // thereby counted as "nothing disputed → agreement."
        let challengeText: string;
        try {
          challengeText = await specialist.challenge(hypothesis, this.llm, context);
        } catch (err) {
          logger.warn(
            `Challenge failed for "${hypothesis.title}": ` +
            `${err instanceof Error ? err.message : String(err)}`,
          );
          const failedChallenge: DebateChallenge = {
            challenger: specialist.role,
            hypothesis_id: hypothesis.id,
            challenge:
              `Challenge could not be generated ` +
              `(error: ${err instanceof Error ? err.message : String(err)}).`,
            evidence: `Challenge from ${specialist.name} applying ${specialist.cognitiveFramework}`,
          };
          return {
            challenge: failedChallenge,
            response: {
              defender: hypothesis.proposed_by,
              hypothesis_id: hypothesis.id,
              response: '(challenge failed — exchange unresolved)',
              revised_confidence: hypothesis.confidence,
              unresolved: true,
            },
          };
        }

        const challenge: DebateChallenge = {
          challenger: specialist.role,
          hypothesis_id: hypothesis.id,
          challenge: challengeText,
          evidence: `Challenge from ${specialist.name} applying ${specialist.cognitiveFramework}`,
        };

        // Step 2 — defense. Every recorded challenge gets EXACTLY ONE recorded
        // response, so the k-th challenge for a hypothesis always pairs with the
        // k-th response for that hypothesis (relied on by agreementRatio and the
        // synthesizer's provenance). If the defense LLM call throws, or no
        // proposer is available, we record a placeholder that leaves the
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
              unresolved: true,
            };
          }
        } else {
          response = {
            defender: hypothesis.proposed_by,
            hypothesis_id: hypothesis.id,
            response: '(no defender available to respond to this challenge)',
            revised_confidence: hypothesis.confidence,
            unresolved: true,
          };
        }
        return { challenge, response };
      },
    );

    for (const unit of paired) {
      if (unit) {
        challenges.push(unit.challenge);
        responses.push(unit.response);
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

    // 2. Convergence — agents have stopped changing their minds. Compare the
    // POST-revision states of the last two rounds (round.hypotheses is the
    // start-of-round baseline, so it lags one round behind and would measure
    // the previous round's movement, not the latest one's).
    if (rounds.length >= 2) {
      const prevRound = rounds[rounds.length - 2];
      if (prevRound) {
        const delta = averageConfidenceChange(
          lastRound.revised_hypotheses ?? lastRound.hypotheses,
          prevRound.revised_hypotheses ?? prevRound.hypotheses,
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
   * A challenge is "withstood" when the defender considered it and did NOT
   * lower their confidence — i.e. the objection failed to move them. We measure
   * that as a *change* against the hypothesis's confidence at the start of the
   * round, not against an absolute cutoff: a hypothesis everyone honestly rates
   * at 0.35 whose defense holds each challenge is agreement, not dissent, even
   * though 0.35 < 0.5. A drop beyond {@link CHALLENGE_LANDED_EPSILON} means the
   * challenge landed (dissent).
   *
   * Exchanges flagged `unresolved` (the challenge or defense LLM call failed, or
   * no defender was available) are counted in the denominator but never as
   * withstood — an outage must depress agreement, never inflate it. A round with
   * no challenges at all has nothing in dispute and counts as full agreement.
   *
   * @param round - The debate round to assess.
   * @returns Agreement ratio in [0, 1].
   */
  private agreementRatio(round: DebateRound): number {
    // A confidence drop smaller than this is treated as noise (the defense
    // held); a larger drop means the challenge moved the proposer.
    const CHALLENGE_LANDED_EPSILON = 0.05;

    // Confidence of each hypothesis at the START of this round — the baseline
    // the revised confidence is compared against.
    const originalConfidence = new Map<string, number>();
    for (const h of round.hypotheses) {
      originalConfidence.set(h.id, h.confidence);
    }

    // Pair each challenge with the defense it provoked (k-th challenge for a
    // hypothesis ↔ k-th response for that hypothesis, as pushed in order).
    // executeRound records exactly one response per challenge, so these arrays
    // stay aligned.
    let total = 0;
    let withstood = 0;

    const byHypothesis = new Map<
      string,
      { challenges: number; responses: DebateResponse[] }
    >();
    for (const c of round.challenges) {
      const entry = byHypothesis.get(c.hypothesis_id) ?? { challenges: 0, responses: [] };
      entry.challenges += 1;
      byHypothesis.set(c.hypothesis_id, entry);
    }
    for (const r of round.responses) {
      const entry = byHypothesis.get(r.hypothesis_id) ?? { challenges: 0, responses: [] };
      entry.responses.push(r);
      byHypothesis.set(r.hypothesis_id, entry);
    }

    for (const [hypothesisId, { challenges, responses }] of byHypothesis.entries()) {
      const baseline = originalConfidence.get(hypothesisId);
      for (let i = 0; i < challenges; i++) {
        total += 1;
        const response = responses[i];
        if (!response || response.unresolved) {
          // Unresolved (failed challenge/defense, or no defender): the objection
          // was never actually answered — not withstood.
          continue;
        }
        // Withstood iff the defender's confidence did not materially fall. When
        // no baseline is known (defensive fallback), require the older absolute
        // ≥ 0.5 signal rather than crediting agreement for free.
        const revised = response.revised_confidence;
        const held =
          baseline !== undefined
            ? revised >= baseline - CHALLENGE_LANDED_EPSILON
            : revised >= 0.5;
        if (held) {
          withstood += 1;
        }
      }
    }

    if (total === 0) return 1; // nothing disputed → agreement
    return withstood / total;
  }
}

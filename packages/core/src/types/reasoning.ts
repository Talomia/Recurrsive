import { z } from 'zod';
import type { Opportunity } from './opportunities.js';

// ---------------------------------------------------------------------------
// Specialist Roles
// ---------------------------------------------------------------------------

/**
 * Roles that specialist agents can assume during the multi-agent
 * reasoning / debate process.
 */
export const SpecialistRoleSchema = z.enum([
  'architecture_engineer',
  'backend_engineer',
  'frontend_engineer',
  'ml_engineer',
  'prompt_engineer',
  'security_engineer',
  'database_engineer',
  'devops_engineer',
  'qa_engineer',
  'product_manager',
  'ux_researcher',
  'accessibility_expert',
  'performance_engineer',
  'cost_optimizer',
  'privacy_engineer',
  'compliance_engineer',
  'documentation_engineer',
  'release_manager',
  'sre',
]);

/** Inferred TypeScript type for {@link SpecialistRoleSchema}. */
export type SpecialistRole = z.infer<typeof SpecialistRoleSchema>;

// ---------------------------------------------------------------------------
// Hypothesis
// ---------------------------------------------------------------------------

/**
 * A hypothesis proposed by a specialist agent during the reasoning
 * phase.  Hypotheses are derived from one or more raw findings and
 * represent a candidate opportunity before consensus is reached.
 */
export interface Hypothesis {
  /** Unique identifier. */
  id: string;
  /** IDs of the raw findings that support this hypothesis. */
  finding_ids: string[];
  /** Short title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Which specialist proposed it. */
  proposed_by: SpecialistRole;
  /** Proposer's confidence in the hypothesis (0–1). */
  confidence: number;
  /** Strength of the supporting evidence (0–1). */
  evidence_strength: number;
  /** Qualitative impact estimate. */
  impact_estimate: string;
  /** Qualitative effort estimate. */
  effort_estimate: string;
  /** Qualitative risk level. */
  risk_level: string;
  /** Arguments in favour. */
  supporting_arguments: string[];
  /** Arguments against. */
  counter_arguments: string[];
  /** Assumptions that must hold for this hypothesis to be valid. */
  assumptions: string[];
}

// ---------------------------------------------------------------------------
// Debate
// ---------------------------------------------------------------------------

/**
 * A single challenge issued by one specialist against a hypothesis
 * proposed by another specialist during a debate round.
 */
export interface DebateChallenge {
  /** Role of the challenger. */
  challenger: SpecialistRole;
  /** ID of the hypothesis being challenged. */
  hypothesis_id: string;
  /** The challenge statement. */
  challenge: string;
  /** Evidence backing the challenge. */
  evidence: string;
}

/**
 * A response from the hypothesis defender to a challenge.
 */
export interface DebateResponse {
  /** Role of the defender. */
  defender: SpecialistRole;
  /** ID of the hypothesis being defended. */
  hypothesis_id: string;
  /** The rebuttal / response. */
  response: string;
  /** Updated confidence after considering the challenge. */
  revised_confidence: number;
  /**
   * True when the challenge could not actually be resolved — the challenge or
   * the defense LLM call failed, or no defender was available. An unresolved
   * exchange carries the pre-challenge confidence purely to keep the transcript
   * aligned; it must never be counted as the hypothesis "withstanding" scrutiny
   * (that would let an outage masquerade as agreement).
   */
  unresolved?: boolean;
}

/**
 * One round of the multi-agent debate.  Each round presents
 * hypotheses, challenges, and responses.
 */
export interface DebateRound {
  /** Sequential round number (1-indexed). */
  round_number: number;
  /**
   * Hypotheses as they stood at the START of this round — the baseline the
   * round's challenges were issued against. Consumers that measure whether a
   * challenge moved a proposer (agreement / dissent) MUST compare
   * `revised_confidence` against these values; overwriting them with
   * post-revision confidences fabricates 100% agreement.
   */
  hypotheses: Hypothesis[];
  /**
   * Hypotheses AFTER this round's confidence revisions were applied. Absent on
   * rounds produced before this field existed; fall back to `hypotheses`.
   */
  revised_hypotheses?: Hypothesis[];
  /** Challenges issued during this round. */
  challenges: DebateChallenge[];
  /** Responses to challenges in this round. */
  responses: DebateResponse[];
}

// ---------------------------------------------------------------------------
// Consensus
// ---------------------------------------------------------------------------

/**
 * Per-hypothesis ranking produced after the debate concludes.
 */
export interface HypothesisRanking {
  /** Hypothesis ID. */
  hypothesis_id: string;
  /** Consensus score (0–1). */
  consensus_score: number;
  /** Business impact sub-score (0–1). */
  business_impact_score: number;
  /** Technical impact sub-score (0–1). */
  technical_impact_score: number;
  /** Confidence sub-score (0–1). */
  confidence_score: number;
  /** Effort sub-score (lower is better, 0–1). */
  effort_score: number;
  /** Risk sub-score (lower is better, 0–1). */
  risk_score: number;
  /** Weighted final score (0–1). */
  final_score: number;
}

/**
 * The final output of the reasoning engine after multi-agent debate
 * has concluded.
 */
export interface ConsensusResult {
  /** All hypotheses that were considered. */
  hypotheses: Hypothesis[];
  /** Transcript of all debate rounds. */
  rounds: DebateRound[];
  /** Final ranked list of hypotheses. */
  final_rankings: HypothesisRanking[];
  /** Opportunities promoted from the top-ranked hypotheses. */
  opportunities: Opportunity[];
}

// ---------------------------------------------------------------------------
// Reasoning Config
// ---------------------------------------------------------------------------

/**
 * Configuration for the reasoning (multi-agent debate) engine.
 */
export interface ReasoningConfig {
  /** LLM provider name (e.g. `'openai'`, `'anthropic'`). */
  llm_provider: string;
  /** Model identifier (e.g. `'gpt-4.1-mini'`). */
  llm_model: string;
  /** API key for the LLM provider. */
  llm_api_key?: string;
  /** Custom base URL for the LLM API. */
  llm_base_url?: string;
  /** Maximum number of debate rounds. */
  max_debate_rounds: number;
  /**
   * Agreement ratio (0–1) at which the debate is considered settled and stops
   * early. This is the debate *termination* threshold, not a promotion gate:
   * hypotheses are promoted to opportunities based on their post-debate
   * confidence, and each opportunity carries its own measured `consensus_score`
   * in its provenance for the consumer to weigh.
   */
  min_consensus_score: number;
  /** Which specialist roles participate in the debate. */
  specialists: SpecialistRole[];
  /** LLM sampling temperature. */
  temperature: number;
}

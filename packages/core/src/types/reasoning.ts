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
}

/**
 * One round of the multi-agent debate.  Each round presents
 * hypotheses, challenges, and responses.
 */
export interface DebateRound {
  /** Sequential round number (1-indexed). */
  round_number: number;
  /** Hypotheses under consideration in this round. */
  hypotheses: Hypothesis[];
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
  /** Minimum consensus score for a hypothesis to be promoted. */
  min_consensus_score: number;
  /** Which specialist roles participate in the debate. */
  specialists: SpecialistRole[];
  /** LLM sampling temperature. */
  temperature: number;
}

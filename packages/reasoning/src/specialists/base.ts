/**
 * Base specialist agent abstraction for the multi-agent reasoning engine.
 *
 * Each specialist represents a domain expert that can:
 * 1. Analyze raw findings and propose hypotheses
 * 2. Challenge hypotheses from other specialists
 * 3. Defend its own hypotheses against challenges
 *
 * Subclasses only need to define `role`, `name`, `cognitiveFramework`,
 * and `systemPrompt` — all LLM interaction logic is handled by the
 * base class.
 *
 * @module
 */

import { generateId } from '@recurrsive/core';
import type {
  SpecialistRole,
  Hypothesis,
  Finding,
  GraphClient,
} from '@recurrsive/core';
import type { LLMAdapter, LLMMessage } from '../llm/adapter.js';

// ---------------------------------------------------------------------------
// Specialist interface
// ---------------------------------------------------------------------------

/**
 * Interface for a specialist agent in the multi-agent debate system.
 */
export interface Specialist {
  /** The specialist's assigned role. */
  role: SpecialistRole;
  /** Human-readable display name. */
  name: string;
  /** Description of the cognitive framework this specialist applies. */
  cognitiveFramework: string;
  /** System prompt that defines the specialist's persona and expertise. */
  systemPrompt: string;

  /**
   * Analyze a batch of findings and generate hypotheses.
   *
   * @param findings - Raw findings from analyzers.
   * @param llm - LLM adapter for reasoning.
   * @param graph - Knowledge graph client for additional context.
   * @returns Proposed hypotheses.
   */
  analyzeFindings(
    findings: Finding[],
    llm: LLMAdapter,
    graph: GraphClient,
  ): Promise<Hypothesis[]>;

  /**
   * Challenge a hypothesis proposed by another specialist.
   *
   * @param hypothesis - The hypothesis to challenge.
   * @param llm - LLM adapter for reasoning.
   * @returns A challenge statement with evidence.
   */
  challenge(hypothesis: Hypothesis, llm: LLMAdapter): Promise<string>;

  /**
   * Defend a hypothesis against a challenge.
   *
   * @param hypothesis - The hypothesis being defended.
   * @param challenge - The challenge statement to address.
   * @param llm - LLM adapter for reasoning.
   * @returns Defense response with revised confidence.
   */
  defend(
    hypothesis: Hypothesis,
    challenge: string,
    llm: LLMAdapter,
  ): Promise<{ response: string; revised_confidence: number }>;
}

// ---------------------------------------------------------------------------
// JSON schemas for structured LLM output
// ---------------------------------------------------------------------------

/** JSON schema for hypothesis array output. */
const HYPOTHESIS_ARRAY_SCHEMA = {
  type: 'object',
  properties: {
    hypotheses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          evidence_strength: { type: 'number', minimum: 0, maximum: 1 },
          impact_estimate: { type: 'string' },
          effort_estimate: { type: 'string' },
          risk_level: { type: 'string' },
          supporting_arguments: { type: 'array', items: { type: 'string' } },
          counter_arguments: { type: 'array', items: { type: 'string' } },
          assumptions: { type: 'array', items: { type: 'string' } },
          finding_ids: { type: 'array', items: { type: 'string' } },
        },
        required: [
          'title',
          'description',
          'confidence',
          'evidence_strength',
          'impact_estimate',
          'effort_estimate',
          'risk_level',
          'supporting_arguments',
          'counter_arguments',
          'assumptions',
          'finding_ids',
        ],
      },
    },
  },
  required: ['hypotheses'],
};

/** JSON schema for challenge output. */
const CHALLENGE_SCHEMA = {
  type: 'object',
  properties: {
    challenge: { type: 'string' },
    evidence: { type: 'string' },
  },
  required: ['challenge', 'evidence'],
};

/** JSON schema for defense output. */
const DEFENSE_SCHEMA = {
  type: 'object',
  properties: {
    response: { type: 'string' },
    revised_confidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['response', 'revised_confidence'],
};

// ---------------------------------------------------------------------------
// LLM output type guards
// ---------------------------------------------------------------------------

interface HypothesisLLMOutput {
  title: string;
  description: string;
  confidence: number;
  evidence_strength: number;
  impact_estimate: string;
  effort_estimate: string;
  risk_level: string;
  supporting_arguments: string[];
  counter_arguments: string[];
  assumptions: string[];
  finding_ids: string[];
}

interface HypothesesResponse {
  hypotheses: HypothesisLLMOutput[];
}

interface ChallengeResponse {
  challenge: string;
  evidence: string;
}

interface DefenseResponse {
  response: string;
  revised_confidence: number;
}

// ---------------------------------------------------------------------------
// Base specialist class
// ---------------------------------------------------------------------------

/**
 * Abstract base class for all specialist agents.
 *
 * Handles LLM prompt construction and response parsing. Concrete
 * subclasses need only provide their identity (role, name, cognitive
 * framework, system prompt).
 *
 * @example
 * ```ts
 * class MySpecialist extends BaseSpecialist {
 *   role = 'architecture_engineer' as const;
 *   name = 'Architecture Engineer';
 *   cognitiveFramework = 'Structural integrity analysis';
 *   systemPrompt = 'You are an architecture specialist...';
 * }
 * ```
 */
export abstract class BaseSpecialist implements Specialist {
  abstract role: SpecialistRole;
  abstract name: string;
  abstract cognitiveFramework: string;
  abstract systemPrompt: string;

  /**
   * Analyze findings and propose hypotheses using the LLM.
   *
   * Constructs a prompt that:
   * 1. Sets the specialist persona via system prompt
   * 2. Provides all findings as structured context
   * 3. Asks for hypotheses in a structured JSON format
   *
   * @param findings - Raw findings from analyzers.
   * @param llm - LLM adapter.
   * @param _graph - Knowledge graph client (available for subclass overrides).
   * @returns Array of proposed hypotheses.
   */
  async analyzeFindings(
    findings: Finding[],
    llm: LLMAdapter,
    _graph: GraphClient,
  ): Promise<Hypothesis[]> {
    if (findings.length === 0) {
      return [];
    }

    const findingsSummary = findings
      .map(
        (f, i) =>
          `[Finding ${i + 1}] ID: ${f.id}\n` +
          `  Title: ${f.title}\n` +
          `  Description: ${f.description}\n` +
          `  Severity: ${f.severity}\n` +
          `  Category: ${f.category}\n` +
          `  Confidence: ${f.confidence}\n` +
          `  Tags: ${f.tags.join(', ')}\n` +
          `  Evidence count: ${f.evidence.length}\n` +
          `  Locations: ${f.locations.map((l) => l.file).join(', ')}`,
      )
      .join('\n\n');

    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content:
          `You are analyzing ${findings.length} findings as a ${this.name}.\n` +
          `Your cognitive framework: ${this.cognitiveFramework}\n\n` +
          `FINDINGS:\n${findingsSummary}\n\n` +
          `INSTRUCTIONS:\n` +
          `1. Identify patterns, correlations, and actionable opportunities across these findings.\n` +
          `2. Group related findings into hypotheses where appropriate.\n` +
          `3. For each hypothesis, assess confidence (0–1), evidence strength (0–1), ` +
          `impact estimate, effort estimate, risk level, supporting arguments, ` +
          `counter arguments, and assumptions.\n` +
          `4. Reference the finding IDs that support each hypothesis.\n` +
          `5. Only propose hypotheses you have genuine confidence in — do NOT pad with low-quality ideas.\n` +
          `6. Aim for 1–5 high-quality hypotheses.\n\n` +
          `Respond with JSON containing a "hypotheses" array.`,
      },
    ];

    const parsed = await llm.chatJSON<HypothesesResponse>(
      messages,
      HYPOTHESIS_ARRAY_SCHEMA,
      { temperature: 0.4, max_tokens: 4096 },
    );

    return (parsed.hypotheses ?? []).map(
      (h): Hypothesis => ({
        id: generateId(),
        finding_ids: h.finding_ids,
        title: h.title,
        description: h.description,
        proposed_by: this.role,
        confidence: Math.max(0, Math.min(1, h.confidence)),
        evidence_strength: Math.max(0, Math.min(1, h.evidence_strength)),
        impact_estimate: h.impact_estimate,
        effort_estimate: h.effort_estimate,
        risk_level: h.risk_level,
        supporting_arguments: h.supporting_arguments,
        counter_arguments: h.counter_arguments,
        assumptions: h.assumptions,
      }),
    );
  }

  /**
   * Challenge a hypothesis from another specialist's perspective.
   *
   * @param hypothesis - The hypothesis to challenge.
   * @param llm - LLM adapter.
   * @returns Challenge statement as text (includes embedded evidence).
   */
  async challenge(hypothesis: Hypothesis, llm: LLMAdapter): Promise<string> {
    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content:
          `As a ${this.name}, critically evaluate the following hypothesis ` +
          `proposed by the ${hypothesis.proposed_by} specialist.\n\n` +
          `HYPOTHESIS:\n` +
          `  Title: ${hypothesis.title}\n` +
          `  Description: ${hypothesis.description}\n` +
          `  Confidence: ${hypothesis.confidence}\n` +
          `  Evidence Strength: ${hypothesis.evidence_strength}\n` +
          `  Impact: ${hypothesis.impact_estimate}\n` +
          `  Effort: ${hypothesis.effort_estimate}\n` +
          `  Risk: ${hypothesis.risk_level}\n` +
          `  Supporting Arguments:\n${hypothesis.supporting_arguments.map((a) => `    - ${a}`).join('\n')}\n` +
          `  Assumptions:\n${hypothesis.assumptions.map((a) => `    - ${a}`).join('\n')}\n\n` +
          `INSTRUCTIONS:\n` +
          `1. Apply your ${this.cognitiveFramework} framework to find weaknesses.\n` +
          `2. Identify assumptions that may not hold.\n` +
          `3. Consider risks the proposer may have overlooked.\n` +
          `4. Provide specific, evidence-backed challenges — not generic criticisms.\n` +
          `5. Be constructive: the goal is to improve the hypothesis, not destroy it.\n\n` +
          `Respond with JSON containing "challenge" (your challenge statement) and "evidence" (supporting evidence).`,
      },
    ];

    const parsed = await llm.chatJSON<ChallengeResponse>(
      messages,
      CHALLENGE_SCHEMA,
      { temperature: 0.5, max_tokens: 2048 },
    );

    return `${parsed.challenge}\n\nEvidence: ${parsed.evidence}`;
  }

  /**
   * Defend a hypothesis against a challenge.
   *
   * @param hypothesis - The hypothesis being defended.
   * @param challenge - The challenge text to respond to.
   * @param llm - LLM adapter.
   * @returns Defense response with revised confidence.
   */
  async defend(
    hypothesis: Hypothesis,
    challenge: string,
    llm: LLMAdapter,
  ): Promise<{ response: string; revised_confidence: number }> {
    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content:
          `Your hypothesis is being challenged. As the proposing ${this.name}, defend it or adjust your confidence.\n\n` +
          `YOUR HYPOTHESIS:\n` +
          `  Title: ${hypothesis.title}\n` +
          `  Description: ${hypothesis.description}\n` +
          `  Original Confidence: ${hypothesis.confidence}\n` +
          `  Supporting Arguments:\n${hypothesis.supporting_arguments.map((a) => `    - ${a}`).join('\n')}\n\n` +
          `CHALLENGE:\n${challenge}\n\n` +
          `INSTRUCTIONS:\n` +
          `1. Honestly assess the validity of the challenge.\n` +
          `2. If the challenge raises valid points, acknowledge them and lower your confidence.\n` +
          `3. If you can refute the challenge with evidence, maintain or raise your confidence.\n` +
          `4. Provide a revised confidence score between 0 and 1.\n` +
          `5. Be intellectually honest — stubbornly defending a weak position helps nobody.\n\n` +
          `Respond with JSON containing "response" (your defense) and "revised_confidence" (0–1).`,
      },
    ];

    const parsed = await llm.chatJSON<DefenseResponse>(
      messages,
      DEFENSE_SCHEMA,
      { temperature: 0.3, max_tokens: 2048 },
    );

    return {
      response: parsed.response,
      revised_confidence: Math.max(0, Math.min(1, parsed.revised_confidence)),
    };
  }
}

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
   * @param evidenceContext - Optional real evidence/graph context for the
   *   hypothesis, so the challenge is grounded in collected data.
   * @returns A challenge statement with evidence.
   */
  challenge(hypothesis: Hypothesis, llm: LLMAdapter, evidenceContext?: string): Promise<string>;

  /**
   * Defend a hypothesis against a challenge.
   *
   * @param hypothesis - The hypothesis being defended.
   * @param challenge - The challenge statement to address.
   * @param llm - LLM adapter for reasoning.
   * @param evidenceContext - Optional real evidence/graph context for the
   *   hypothesis, so the defense is grounded in collected data.
   * @returns Defense response with revised confidence.
   */
  defend(
    hypothesis: Hypothesis,
    challenge: string,
    llm: LLMAdapter,
    evidenceContext?: string,
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
    graph: GraphClient,
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
          `  Evidence:\n${formatFindingEvidence(f)}\n` +
          `  Locations: ${f.locations.map((l) => l.file).join(', ') || '(none)'}`,
      )
      .join('\n\n');

    // Pull real context for the entities these findings reference from the
    // knowledge graph, so hypotheses are grounded in what was actually
    // collected rather than the finding text alone.
    const graphContext = await buildGraphContextFor(findings, graph);

    const messages: LLMMessage[] = [
      { role: 'system', content: this.systemPrompt },
      {
        role: 'user',
        content:
          `You are analyzing ${findings.length} findings as a ${this.name}.\n` +
          `Your cognitive framework: ${this.cognitiveFramework}\n\n` +
          `FINDINGS:\n${findingsSummary}\n\n` +
          (graphContext ? `KNOWLEDGE GRAPH CONTEXT:\n${graphContext}\n\n` : '') +
          `INSTRUCTIONS:\n` +
          `1. Identify patterns, correlations, and actionable opportunities across these findings.\n` +
          `2. Group related findings into hypotheses where appropriate.\n` +
          `3. For each hypothesis, assess confidence (0–1), evidence strength (0–1), ` +
          `impact estimate, effort estimate, risk level, supporting arguments, ` +
          `counter arguments, and assumptions.\n` +
          `4. Reference the finding IDs that support each hypothesis.\n` +
          `5. Only propose hypotheses you have genuine confidence in — do NOT pad with low-quality ideas.\n` +
          `6. Ground every hypothesis in the evidence and graph context above. ` +
          `Do NOT invent facts, metrics, or numbers that are not supported by them; ` +
          `state any projection as an assumption.\n` +
          `7. Aim for 1–5 high-quality hypotheses.\n\n` +
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
  async challenge(
    hypothesis: Hypothesis,
    llm: LLMAdapter,
    evidenceContext?: string,
  ): Promise<string> {
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
          (evidenceContext ? `SUPPORTING EVIDENCE & GRAPH CONTEXT:\n${evidenceContext}\n\n` : '') +
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
    evidenceContext?: string,
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
          (evidenceContext ? `SUPPORTING EVIDENCE & GRAPH CONTEXT:\n${evidenceContext}\n\n` : '') +
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

// ---------------------------------------------------------------------------
// Shared evidence / graph context helpers
// ---------------------------------------------------------------------------

/**
 * Format a finding's actual evidence content for a prompt.
 *
 * Specialists must reason over the real evidence, not just a count. Each
 * evidence item is rendered with its type, description, source and a compact
 * view of any structured data payload.
 *
 * @param finding - The finding whose evidence to render.
 * @returns Indented, human-readable evidence block (or a "(none)" marker).
 */
export function formatFindingEvidence(finding: Finding): string {
  if (finding.evidence.length === 0) {
    return '    (no evidence collected)';
  }
  return finding.evidence
    .map((e) => {
      const parts = [`    - [${e.type}] ${e.description}`];
      parts.push(`      source: ${e.source}, confidence: ${e.confidence}`);
      if (e.data && Object.keys(e.data).length > 0) {
        let dataStr: string;
        try {
          dataStr = JSON.stringify(e.data);
        } catch {
          dataStr = '[unserializable]';
        }
        if (dataStr.length > 400) dataStr = `${dataStr.slice(0, 400)}…`;
        parts.push(`      data: ${dataStr}`);
      }
      return parts.join('\n');
    })
    .join('\n');
}

/**
 * Build a compact knowledge-graph context block for the entities referenced
 * by a set of findings' evidence.
 *
 * For each distinct referenced entity (bounded to avoid oversized prompts),
 * the entity and its immediate relationships are pulled from the graph so the
 * caller reasons over what was actually collected. Failures to resolve an
 * entity are skipped silently — missing context must never fabricate facts.
 *
 * @param findings - Findings whose evidence entity IDs seed the lookup.
 * @param graph - Knowledge graph client.
 * @param maxEntities - Maximum entities to include (default 12).
 * @returns A formatted context block, or an empty string if none available.
 */
export async function buildGraphContextFor(
  findings: Finding[],
  graph: GraphClient,
  maxEntities = 12,
): Promise<string> {
  const entityIds: string[] = [];
  const seen = new Set<string>();
  for (const f of findings) {
    for (const e of f.evidence) {
      for (const id of e.entity_ids) {
        if (!seen.has(id)) {
          seen.add(id);
          entityIds.push(id);
        }
      }
    }
  }
  if (entityIds.length === 0) return '';

  const blocks: string[] = [];
  for (const id of entityIds.slice(0, maxEntities)) {
    try {
      const entity = await graph.getEntity(id);
      if (!entity) continue;
      const rels = await graph.getRelationships(id, 'both');
      // Render direction honestly: outgoing edges point AT their target, while
      // incoming edges point FROM their source. Rendering every edge as
      // `type -> target_id` made incoming edges point at the entity itself,
      // mislabeling who relates to whom in the LLM context.
      const relSummary =
        rels.length > 0
          ? rels
              .slice(0, 8)
              .map((r) =>
                r.source_id === id
                  ? `      ${r.type} -> ${r.target_id}`
                  : `      ${r.type} <- ${r.source_id}`,
              )
              .join('\n')
          : '      (no relationships)';
      blocks.push(
        `  - ${entity.type} "${entity.name}" (id: ${entity.id})\n` +
          `    relationships:\n${relSummary}`,
      );
    } catch {
      // Skip unresolved entities rather than invent context.
    }
  }

  if (blocks.length === 0) return '';
  const suffix =
    entityIds.length > maxEntities
      ? `\n  … and ${entityIds.length - maxEntities} more referenced entities not shown.`
      : '';
  return blocks.join('\n') + suffix;
}

/**
 * Build a combined evidence + graph context string for a single hypothesis,
 * using only the findings that support it. Used by the debate protocol so
 * challenges and defenses are grounded in the same real data the proposer saw.
 *
 * @param hypothesis - The hypothesis to contextualise.
 * @param findings - All findings available to the run.
 * @param graph - Knowledge graph client.
 * @returns A formatted context block, or an empty string if none available.
 */
export async function buildHypothesisContext(
  hypothesis: Hypothesis,
  findings: Finding[],
  graph: GraphClient,
): Promise<string> {
  const related = findings.filter((f) => hypothesis.finding_ids.includes(f.id));
  if (related.length === 0) return '';
  const evidence = related
    .map((f) => `  Finding "${f.title}":\n${formatFindingEvidence(f)}`)
    .join('\n');
  const graphContext = await buildGraphContextFor(related, graph);
  return graphContext
    ? `${evidence}\n  Graph context:\n${graphContext}`
    : evidence;
}

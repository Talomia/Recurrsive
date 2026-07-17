/**
 * Hypothesis-to-Opportunity synthesizer.
 *
 * Takes debated hypotheses and transforms them into fully-specified
 * {@link Opportunity} objects with Impact, ValidationPlan, RollbackPlan,
 * and EffortEstimate — all generated via LLM reasoning.
 *
 * @module
 */

import { generateId, nowISO, createLogger } from '@recurrsive/core';
import type {
  Hypothesis,
  DebateRound,
  Finding,
  Opportunity,
  Impact,
  EffortEstimate,
  RiskAssessment,
  ValidationPlan,
  RollbackPlan,
  AgentProvenance,
} from '@recurrsive/core';
import type { LLMAdapter, LLMMessage } from '../llm/adapter.js';

const logger = createLogger({ context: { component: 'reasoning:synthesizer' } });

// ---------------------------------------------------------------------------
// JSON schemas for structured LLM output
// ---------------------------------------------------------------------------

const OPPORTUNITY_DETAIL_SCHEMA = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['opportunity', 'risk', 'debt'] },
    category: { type: 'string' },
    severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'info'] },
    problem: { type: 'string' },
    recommendation: { type: 'string' },
    impact: {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        metrics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              // current_value is a MEASURED baseline. Only provide it when the
              // value appears in the supplied findings/evidence. Never invent one.
              current_value: { type: 'string' },
              expected_value: { type: 'string' },
              change_percent: { type: 'number' },
              direction: { type: 'string', enum: ['increase', 'decrease', 'unchanged'] },
              // is_estimate MUST be true for any projected/model-generated value.
              is_estimate: { type: 'boolean' },
              // assumptions the projection rests on; required when is_estimate is true.
              assumptions: { type: 'array', items: { type: 'string' } },
            },
            required: ['name'],
          },
        },
        affected_services: { type: 'array', items: { type: 'string' } },
        affected_users: { type: 'string' },
        business_value: { type: 'string' },
        interest_rate: { type: 'string' },
      },
      required: ['summary', 'metrics', 'affected_services'],
    },
    effort: {
      type: 'object',
      properties: {
        t_shirt: { type: 'string', enum: ['xs', 's', 'm', 'l', 'xl'] },
        estimated_hours: { type: 'number' },
        estimated_days: { type: 'number' },
        skills_required: { type: 'array', items: { type: 'string' } },
        dependencies: { type: 'array', items: { type: 'string' } },
      },
      required: ['t_shirt', 'skills_required', 'dependencies'],
    },
    risk: {
      type: 'object',
      properties: {
        level: { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'negligible'] },
        description: { type: 'string' },
        mitigations: { type: 'array', items: { type: 'string' } },
      },
      required: ['level', 'description', 'mitigations'],
    },
    validation: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              type: {
                type: 'string',
                enum: ['automated_test', 'manual_test', 'a_b_test', 'benchmark', 'review', 'monitoring'],
              },
              duration: { type: 'string' },
            },
            required: ['description', 'type'],
          },
        },
        success_criteria: { type: 'array', items: { type: 'string' } },
        monitoring_duration: { type: 'string' },
      },
      required: ['steps', 'success_criteria'],
    },
    rollback: {
      type: 'object',
      properties: {
        strategy: {
          type: 'string',
          enum: ['automatic', 'manual', 'feature_flag', 'blue_green', 'canary'],
        },
        steps: { type: 'array', items: { type: 'string' } },
        estimated_duration: { type: 'string' },
        data_impact: { type: 'string' },
      },
      required: ['strategy', 'steps'],
    },
  },
  required: [
    'type', 'category', 'severity', 'problem', 'recommendation',
    'impact', 'effort', 'risk', 'validation', 'rollback',
  ],
};

// ---------------------------------------------------------------------------
// LLM response type
// ---------------------------------------------------------------------------

interface OpportunityLLMOutput {
  type: 'opportunity' | 'risk' | 'debt';
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  problem: string;
  recommendation: string;
  impact: {
    summary: string;
    metrics: Array<{
      name: string;
      current_value?: string | number;
      expected_value?: string | number;
      change_percent?: number;
      direction?: 'increase' | 'decrease' | 'unchanged';
      is_estimate?: boolean;
      assumptions?: string[];
    }>;
    affected_services: string[];
    affected_users?: string;
    business_value?: string;
    interest_rate?: string;
  };
  effort: {
    t_shirt: 'xs' | 's' | 'm' | 'l' | 'xl';
    estimated_hours?: number;
    estimated_days?: number;
    skills_required: string[];
    dependencies: string[];
  };
  risk: {
    level: 'critical' | 'high' | 'medium' | 'low' | 'negligible';
    description: string;
    mitigations: string[];
  };
  validation: {
    steps: Array<{
      description: string;
      type: 'automated_test' | 'manual_test' | 'a_b_test' | 'benchmark' | 'review' | 'monitoring';
      duration?: string;
    }>;
    success_criteria: string[];
    monitoring_duration?: string;
  };
  rollback: {
    strategy: 'automatic' | 'manual' | 'feature_flag' | 'blue_green' | 'canary';
    steps: string[];
    estimated_duration?: string;
    data_impact?: string;
  };
}

// ---------------------------------------------------------------------------
// Synthesizer
// ---------------------------------------------------------------------------

/**
 * Converts debated hypotheses into fully-specified {@link Opportunity}
 * objects.
 *
 * For each hypothesis that survived the debate (confidence > 0), the
 * synthesizer prompts the LLM to generate:
 * - Problem statement and recommendation
 * - Quantified impact assessment
 * - Effort estimate
 * - Risk assessment
 * - Validation plan
 * - Rollback plan
 *
 * @example
 * ```ts
 * const synthesizer = new Synthesizer(llmAdapter);
 * const opportunities = await synthesizer.synthesize(hypotheses, rounds, findings);
 * ```
 */
export class Synthesizer {
  private readonly llm: LLMAdapter;

  /**
   * @param llm - LLM adapter for opportunity generation.
   */
  constructor(llm: LLMAdapter) {
    this.llm = llm;
  }

  /**
   * Synthesize hypotheses into opportunities.
   *
   * Filters out hypotheses with very low confidence (< 0.1) before
   * synthesis. Each surviving hypothesis is enriched with full impact,
   * effort, risk, validation, and rollback details.
   *
   * @param hypotheses - Hypotheses that went through debate.
   * @param rounds - Debate round transcripts for context.
   * @param findings - Original raw findings for evidence linking.
   * @returns Array of fully-specified opportunities.
   */
  async synthesize(
    hypotheses: Hypothesis[],
    rounds: DebateRound[],
    findings: Finding[],
  ): Promise<Opportunity[]> {
    // Filter out hypotheses that have been debated down to negligible confidence
    const viable = hypotheses.filter((h) => h.confidence >= 0.1);

    if (viable.length === 0) {
      logger.info('No viable hypotheses after debate — returning empty opportunities');
      return [];
    }

    // Collapse hypotheses that address the same source finding(s): a multi-agent
    // debate frequently produces several near-identical hypotheses about one
    // finding (e.g. five restatements of "missing lockfile"). Synthesizing each
    // 1:1 yields a noisy, redundant opportunity list. Keep the highest-confidence
    // representative per source-finding signature — this both de-noises the output
    // and cuts the number of (expensive) synthesis LLM calls.
    const deduped = this.dedupeHypotheses(viable);
    if (deduped.length < viable.length) {
      logger.info(
        `Collapsed ${viable.length} viable hypotheses to ${deduped.length} ` +
        `by shared source findings before synthesis`,
      );
    }

    logger.info(`Synthesizing ${deduped.length} hypotheses into opportunities`);

    const opportunities: Opportunity[] = [];

    for (const hypothesis of deduped) {
      try {
        const opportunity = await this.synthesizeOne(
          hypothesis,
          rounds,
          findings,
        );
        opportunities.push(opportunity);
      } catch (err) {
        logger.warn(
          `Failed to synthesize hypothesis "${hypothesis.title}": ` +
          `${err instanceof Error ? err.message : String(err)}`,
        );
        // Continue with remaining hypotheses
      }
    }

    return opportunities;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Deduplicate hypotheses that address the same source finding(s).
   *
   * Hypotheses are grouped by the sorted set of `finding_ids` they derive from;
   * within each group only the highest-confidence hypothesis is kept. Hypotheses
   * with no source findings fall back to a normalized-title signature so exact
   * restatements still collapse, while genuinely distinct items are preserved.
   *
   * @param hypotheses - Viable (post-debate) hypotheses.
   * @returns One representative hypothesis per distinct source-finding signature.
   */
  private dedupeHypotheses(hypotheses: Hypothesis[]): Hypothesis[] {
    // Highest confidence first, so the representative kept per group is the strongest.
    const ordered = [...hypotheses].sort((a, b) => b.confidence - a.confidence);
    const seen = new Set<string>();
    const result: Hypothesis[] = [];
    for (const h of ordered) {
      const sig = this.hypothesisSignature(h);
      if (seen.has(sig)) continue;
      seen.add(sig);
      result.push(h);
    }
    return result;
  }

  /**
   * Compute a dedup signature for a hypothesis: its sorted source-finding ids,
   * or a normalized title when it references no findings.
   */
  private hypothesisSignature(h: Hypothesis): string {
    const findingIds = [...(h.finding_ids ?? [])].sort();
    if (findingIds.length > 0) return `f:${findingIds.join('|')}`;
    const title = (h.title ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .sort()
      .join(' ');
    return `t:${title}`;
  }

  /**
   * Synthesize a single hypothesis into an opportunity.
   *
   * @param hypothesis - The hypothesis to synthesize.
   * @param rounds - Debate round transcripts.
   * @param findings - Raw findings for evidence linking.
   * @returns A fully-specified opportunity.
   */
  private async synthesizeOne(
    hypothesis: Hypothesis,
    rounds: DebateRound[],
    findings: Finding[],
  ): Promise<Opportunity> {
    // Gather the debate transcript for this hypothesis
    const debateContext = this.extractDebateContext(hypothesis.id, rounds);

    // Gather the source findings
    const relatedFindings = findings.filter((f) =>
      hypothesis.finding_ids.includes(f.id),
    );

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content:
          `You are a senior engineering advisor synthesizing a multi-agent debate ` +
          `into a concrete, actionable opportunity. Produce a comprehensive assessment ` +
          `that an engineering team can immediately act on.\n\n` +
          `EVIDENCE-ONLY RULE — this is critical:\n` +
          `- Ground every statement in the supplied FINDINGS and EVIDENCE. Do NOT ` +
          `invent specific numbers, percentages, or multipliers.\n` +
          `- Only populate a metric's "current_value" when that baseline value ` +
          `actually appears in the provided findings/evidence. If no measured ` +
          `baseline exists, leave current_value empty.\n` +
          `- Any projected "expected_value" or "change_percent" is a MODEL ESTIMATE, ` +
          `not a measurement. For every such metric set "is_estimate": true and ` +
          `list the "assumptions" the projection rests on. Never fabricate precise ` +
          `figures (do NOT write things like "reduces p99 latency by 30-40%" unless ` +
          `that range is directly supported by the supplied evidence).\n` +
          `- Prefer qualitative impact ("expected to reduce tail latency; magnitude ` +
          `unverified without benchmarking") over invented quantities. It is better ` +
          `to omit a number than to fabricate one.`,
      },
      {
        role: 'user',
        content:
          `Synthesize this hypothesis into a full opportunity specification.\n\n` +
          `HYPOTHESIS:\n` +
          `  Title: ${hypothesis.title}\n` +
          `  Description: ${hypothesis.description}\n` +
          `  Proposed by: ${hypothesis.proposed_by}\n` +
          `  Final Confidence: ${hypothesis.confidence}\n` +
          `  Evidence Strength: ${hypothesis.evidence_strength}\n` +
          `  Impact Estimate: ${hypothesis.impact_estimate}\n` +
          `  Effort Estimate: ${hypothesis.effort_estimate}\n` +
          `  Risk Level: ${hypothesis.risk_level}\n` +
          `  Supporting Arguments:\n${hypothesis.supporting_arguments.map((a) => `    - ${a}`).join('\n')}\n` +
          `  Counter Arguments:\n${hypothesis.counter_arguments.map((a) => `    - ${a}`).join('\n')}\n` +
          `  Assumptions:\n${hypothesis.assumptions.map((a) => `    - ${a}`).join('\n')}\n\n` +
          `SUPPORTING FINDINGS:\n${this.formatFindings(relatedFindings)}\n\n` +
          `DEBATE TRANSCRIPT:\n${debateContext}\n\n` +
          `Generate a complete opportunity specification with:\n` +
          `1. type: "opportunity", "risk", or "debt"\n` +
          `2. category: the most appropriate category\n` +
          `3. severity: "critical", "high", "medium", "low", or "info"\n` +
          `4. problem: clear problem statement\n` +
          `5. recommendation: specific actionable recommendation\n` +
          `6. impact: evidence-grounded impact assessment. Provide current_value ` +
          `only when a measured baseline exists in the evidence; flag every ` +
          `projection with is_estimate=true and its assumptions\n` +
          `7. effort: t-shirt size, estimated hours/days, skills required\n` +
          `8. risk: implementation risk with mitigations\n` +
          `9. validation: how to verify success after implementation\n` +
          `10. rollback: how to safely revert if needed`,
      },
    ];

    const detail = await this.llm.chatJSON<OpportunityLLMOutput>(
      messages,
      OPPORTUNITY_DETAIL_SCHEMA,
      { temperature: 0.3, max_tokens: 4096 },
    );

    // Build the provenance record from debate data
    const provenance = this.buildProvenance(hypothesis, rounds);

    const now = nowISO();
    const opportunity: Opportunity = {
      id: generateId(),
      title: hypothesis.title,
      type: detail.type,
      category: this.sanitizeCategory(detail.category),
      severity: detail.severity,
      problem: detail.problem,
      evidence: relatedFindings.flatMap((f) => f.evidence),
      recommendation: detail.recommendation,
      expected_impact: this.buildImpact(detail.impact, hypothesis),
      confidence: hypothesis.confidence,
      effort: this.buildEffort(detail.effort),
      risk: this.buildRisk(detail.risk),
      validation: this.buildValidation(detail.validation),
      rollback: this.buildRollback(detail.rollback),
      reasoning: provenance,
      locations: relatedFindings.flatMap((f) => f.locations),
      related: [],
      assumptions: hypothesis.assumptions.length > 0 ? [...hypothesis.assumptions] : undefined,
      status: 'proposed',
      created_at: now,
      updated_at: now,
    };

    return opportunity;
  }

  /**
   * Extract the debate context for a specific hypothesis across all rounds.
   *
   * @param hypothesisId - The hypothesis ID.
   * @param rounds - All debate rounds.
   * @returns Formatted debate transcript.
   */
  private extractDebateContext(
    hypothesisId: string,
    rounds: DebateRound[],
  ): string {
    const lines: string[] = [];

    for (const round of rounds) {
      const challenges = round.challenges.filter(
        (c) => c.hypothesis_id === hypothesisId,
      );
      const responses = round.responses.filter(
        (r) => r.hypothesis_id === hypothesisId,
      );

      if (challenges.length === 0 && responses.length === 0) continue;

      lines.push(`--- Round ${round.round_number} ---`);

      for (const challenge of challenges) {
        lines.push(`  [Challenge by ${challenge.challenger}]: ${challenge.challenge}`);
      }
      for (const response of responses) {
        lines.push(
          `  [Defense by ${response.defender}] (revised confidence: ${response.revised_confidence}): ${response.response}`,
        );
      }
    }

    return lines.length > 0 ? lines.join('\n') : 'No debate activity for this hypothesis.';
  }

  /**
   * Format findings into a human-readable summary.
   *
   * @param findings - Findings to format.
   * @returns Formatted string.
   */
  private formatFindings(findings: Finding[]): string {
    if (findings.length === 0) return '(none)';
    return findings
      .map(
        (f) =>
          `  [${f.severity.toUpperCase()}] ${f.title}: ${f.description} (confidence: ${f.confidence})`,
      )
      .join('\n');
  }

  /**
   * Build the agent provenance record from debate data.
   *
   * @param hypothesis - The original hypothesis.
   * @param rounds - All debate rounds.
   * @returns Provenance record.
   */
  private buildProvenance(
    hypothesis: Hypothesis,
    rounds: DebateRound[],
  ): AgentProvenance {
    // Pair each challenge with the defense it provoked. Within a round the
    // protocol pushes a defense immediately after each challenge, so the k-th
    // challenge for a hypothesis matches the k-th response for that hypothesis.
    interface Exchange {
      challenger: string;
      challenge: string;
      revisedConfidence: number;
    }
    const exchanges: Exchange[] = [];

    for (const round of rounds) {
      const challenges = round.challenges.filter(
        (c) => c.hypothesis_id === hypothesis.id,
      );
      const responses = round.responses.filter(
        (r) => r.hypothesis_id === hypothesis.id,
      );
      challenges.forEach((challenge, i) => {
        const response = responses[i];
        if (!response) return; // challenge with no recorded defense
        exchanges.push({
          challenger: challenge.challenger,
          challenge: challenge.challenge,
          revisedConfidence: response.revised_confidence,
        });
      });
    }

    // A challenger dissents when the defender's own post-exchange confidence
    // fell below 0.5 — i.e. the defender conceded doubt, so the challenge
    // landed. This is inter-agent disagreement, not the proposer's self-report.
    // Keep each dissenting challenger once, recording their strongest concern
    // (the exchange where confidence dropped lowest).
    const DISSENT_CONFIDENCE = 0.5;
    const dissentByAgent = new Map<string, { reason: string; conf: number }>();
    const challengers = new Set<string>();

    for (const ex of exchanges) {
      challengers.add(ex.challenger);
      if (ex.revisedConfidence < DISSENT_CONFIDENCE) {
        const existing = dissentByAgent.get(ex.challenger);
        if (!existing || ex.revisedConfidence < existing.conf) {
          dissentByAgent.set(ex.challenger, {
            reason: ex.challenge.slice(0, 200),
            conf: ex.revisedConfidence,
          });
        }
      }
    }

    const dissenters = [...dissentByAgent.entries()].map(([agent_id, v]) => ({
      agent_id,
      reason: v.reason,
    }));

    // This challenge/defense protocol has no explicit "support" signal, so we
    // do not fabricate supporters. A challenger whose challenge the hypothesis
    // withstood is not a supporter — they simply did not dissent.
    const supporters: string[] = [];

    return {
      proposer: hypothesis.proposed_by,
      supporters,
      dissenters,
      consensus_score: this.computeConsensus(challengers.size, dissenters.length),
    };
  }

  /**
   * Compute a real consensus score from debate structure.
   *
   * Consensus is the fraction of distinct challengers whose objections the
   * hypothesis withstood (i.e. did not become dissenters) — genuine inter-agent
   * agreement, distinct from the proposer's self-reported confidence. When no
   * peer ever challenged the hypothesis there is no agreement signal to measure,
   * so we return a neutral 0.5 to flag it as untested rather than assuming
   * agreement.
   *
   * @param challengerCount - Number of distinct agents that challenged.
   * @param dissenterCount - Number of those challengers that dissented.
   * @returns Consensus score in [0, 1].
   */
  private computeConsensus(challengerCount: number, dissenterCount: number): number {
    if (challengerCount === 0) return 0.5;
    const agreed = challengerCount - dissenterCount;
    return Math.max(0, Math.min(1, agreed / challengerCount));
  }

  /**
   * Sanitize a category string to match the OpportunityCategory enum.
   *
   * @param raw - Raw category from LLM output.
   * @returns Valid OpportunityCategory string.
   */
  private sanitizeCategory(raw: string): Opportunity['category'] {
    const validCategories = [
      'architecture', 'performance', 'security', 'cost', 'ai_quality',
      'reliability', 'ux', 'accessibility', 'privacy', 'compliance',
      'developer_experience', 'product', 'data', 'documentation', 'infrastructure',
    ] as const;

    const normalized = raw.toLowerCase().replace(/[\s-]/g, '_');
    const match = validCategories.find((c) => c === normalized);
    return match ?? 'architecture';
  }

  /**
   * Build an Impact object from LLM output, enforcing the evidence-only rule.
   *
   * Every metric produced by the LLM is a model projection unless it carries a
   * measured `current_value` baseline. This method:
   * - Flags any forward-looking metric (one with an expected value, a percent
   *   change, or an explicit `is_estimate`) as an estimate and attaches the
   *   assumptions it rests on (falling back to the hypothesis assumptions).
   * - Drops `change_percent` when there is no measured `current_value`, because
   *   a percentage change against a non-existent baseline is fabricated.
   *
   * @param raw - The LLM impact output.
   * @param hypothesis - The source hypothesis (for assumption fallback).
   * @returns A sanitized {@link Impact} where estimates are honestly labelled.
   */
  private buildImpact(
    raw: OpportunityLLMOutput['impact'],
    hypothesis: Hypothesis,
  ): Impact {
    return {
      summary: raw.summary,
      metrics: raw.metrics.map((m) => {
        const hasMeasuredBaseline =
          m.current_value !== undefined && m.current_value !== '';
        const isProjection =
          m.is_estimate === true ||
          m.expected_value !== undefined ||
          m.change_percent !== undefined;

        // Assumptions are required (in spirit) for any estimate. Prefer the
        // metric's own assumptions, otherwise fall back to the hypothesis'.
        let assumptions: string[] | undefined;
        if (isProjection) {
          const provided = (m.assumptions ?? []).filter((a) => a.trim() !== '');
          assumptions =
            provided.length > 0
              ? provided
              : hypothesis.assumptions.length > 0
                ? [...hypothesis.assumptions]
                : ['Projection is model-generated and has not been measured.'];
        }

        return {
          name: m.name,
          current_value: hasMeasuredBaseline ? m.current_value : undefined,
          expected_value: m.expected_value,
          // A percent change is only meaningful against a measured baseline;
          // otherwise it would be a fabricated figure, so we drop it.
          change_percent: hasMeasuredBaseline ? m.change_percent : undefined,
          direction: m.direction,
          is_estimate: isProjection ? true : undefined,
          assumptions,
        };
      }),
      affected_services: raw.affected_services,
      affected_users: raw.affected_users,
      business_value: raw.business_value,
      interest_rate: raw.interest_rate,
    };
  }

  /**
   * Build an EffortEstimate from LLM output.
   */
  private buildEffort(raw: OpportunityLLMOutput['effort']): EffortEstimate {
    return {
      t_shirt: raw.t_shirt,
      estimated_hours: raw.estimated_hours,
      estimated_days: raw.estimated_days,
      skills_required: raw.skills_required,
      dependencies: raw.dependencies,
    };
  }

  /**
   * Build a RiskAssessment from LLM output.
   */
  private buildRisk(raw: OpportunityLLMOutput['risk']): RiskAssessment {
    return {
      level: raw.level,
      description: raw.description,
      mitigations: raw.mitigations,
    };
  }

  /**
   * Build a ValidationPlan from LLM output.
   */
  private buildValidation(raw: OpportunityLLMOutput['validation']): ValidationPlan {
    return {
      steps: raw.steps.map((s) => ({
        description: s.description,
        type: s.type,
        duration: s.duration,
      })),
      success_criteria: raw.success_criteria,
      monitoring_duration: raw.monitoring_duration,
    };
  }

  /**
   * Build a RollbackPlan from LLM output.
   */
  private buildRollback(raw: OpportunityLLMOutput['rollback']): RollbackPlan {
    return {
      strategy: raw.strategy,
      steps: raw.steps,
      estimated_duration: raw.estimated_duration,
      data_impact: raw.data_impact,
    };
  }
}

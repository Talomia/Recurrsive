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
              current_value: { type: 'string' },
              expected_value: { type: 'string' },
              change_percent: { type: 'number' },
              direction: { type: 'string', enum: ['increase', 'decrease', 'unchanged'] },
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

    logger.info(`Synthesizing ${viable.length} hypotheses into opportunities`);

    const opportunities: Opportunity[] = [];

    for (const hypothesis of viable) {
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
          `Be specific and quantitative where possible. Avoid vague statements like ` +
          `"may improve performance" — instead say "expected to reduce p99 latency by 30-40%".`,
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
          `6. impact: quantified impact assessment with metrics\n` +
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
      expected_impact: this.buildImpact(detail.impact),
      confidence: hypothesis.confidence,
      effort: this.buildEffort(detail.effort),
      risk: this.buildRisk(detail.risk),
      validation: this.buildValidation(detail.validation),
      rollback: this.buildRollback(detail.rollback),
      reasoning: provenance,
      locations: relatedFindings.flatMap((f) => f.locations),
      related: [],
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
    const supporters: string[] = [];
    const dissenters: Array<{ agent_id: string; reason: string }> = [];

    // Analyze debate responses to classify supporters vs dissenters
    for (const round of rounds) {
      for (const response of round.responses) {
        if (response.hypothesis_id !== hypothesis.id) continue;

        // Look for challenges to this hypothesis
        const relatedChallenges = round.challenges.filter(
          (c) => c.hypothesis_id === hypothesis.id,
        );

        for (const challenge of relatedChallenges) {
          // If the defense resulted in higher confidence, the challenger's
          // point was addressed — we consider them a constructive participant
          if (response.revised_confidence >= hypothesis.confidence * 0.9) {
            if (!supporters.includes(challenge.challenger)) {
              supporters.push(challenge.challenger);
            }
          } else {
            dissenters.push({
              agent_id: challenge.challenger,
              reason: challenge.challenge.slice(0, 200),
            });
          }
        }
      }
    }

    return {
      proposer: hypothesis.proposed_by,
      supporters,
      dissenters,
      consensus_score: hypothesis.confidence,
    };
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
   * Build an Impact object from LLM output.
   */
  private buildImpact(raw: OpportunityLLMOutput['impact']): Impact {
    return {
      summary: raw.summary,
      metrics: raw.metrics.map((m) => ({
        name: m.name,
        current_value: m.current_value,
        expected_value: m.expected_value,
        change_percent: m.change_percent,
        direction: m.direction,
      })),
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

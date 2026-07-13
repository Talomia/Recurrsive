/**
 * Evidence-bounded hypothesis-to-opportunity synthesis.
 *
 * Multi-agent debate is advisory: it may add provenance to an analyzer
 * finding, but it must not invent impact metrics, effort estimates,
 * implementation risk, service scope, or business outcomes. Every returned
 * opportunity therefore has a one-to-one source finding and keeps planning
 * fields explicitly unknown until a human records them.
 *
 * @module
 */

import {
  OpportunitySchema,
  createLogger,
  generateId,
  nowISO,
} from '@recurrsive/core';
import type {
  AgentProvenance,
  DebateRound,
  Finding,
  Hypothesis,
  Opportunity,
  OpportunityCategory,
  OpportunityType,
} from '@recurrsive/core';
import type { LLMAdapter } from '../llm/adapter.js';

const logger = createLogger({ context: { component: 'reasoning:synthesizer' } });

const RISK_CATEGORIES = new Set<OpportunityCategory>([
  'security',
  'privacy',
  'compliance',
  'reliability',
  'infrastructure',
]);

const DEBT_CATEGORIES = new Set<OpportunityCategory>([
  'architecture',
  'data',
  'documentation',
  'developer_experience',
]);

function opportunityType(finding: Finding): OpportunityType {
  if (RISK_CATEGORIES.has(finding.category) || finding.severity === 'critical') return 'risk';
  if (DEBT_CATEGORIES.has(finding.category)) return 'debt';
  return 'opportunity';
}

/**
 * Convert findings into decision artefacts while retaining optional debate
 * provenance. The adapter argument is accepted because the surrounding engine
 * owns one, but synthesis intentionally performs no model call.
 */
export class Synthesizer {
  constructor(_llm?: LLMAdapter) {}

  async synthesize(
    hypotheses: Hypothesis[],
    rounds: DebateRound[],
    findings: Finding[],
  ): Promise<Opportunity[]> {
    const viable = hypotheses.filter((hypothesis) => hypothesis.confidence >= 0.1);

    const opportunities = findings.map((finding) => {
      const hypothesis = viable
        .filter((candidate) => candidate.finding_ids.includes(finding.id))
        .sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id))[0];
      return this.promoteFinding(finding, hypothesis, rounds);
    });

    logger.info(
      `Promoted ${opportunities.length} findings into evidence-bounded opportunities ` +
      `(${opportunities.filter((opportunity) => opportunity.tags?.includes('reasoned')).length} with debate provenance)`,
    );
    return opportunities;
  }

  private promoteFinding(
    finding: Finding,
    hypothesis: Hypothesis | undefined,
    rounds: DebateRound[],
  ): Opportunity {
    const now = nowISO();
    const recommendation = finding.suggested_fix?.trim()
      || `Review the cited evidence and remediate the identified ${finding.category.replaceAll('_', ' ')} gap.`;
    const locationSummary = finding.locations.length > 0
      ? finding.locations.map((location) => location.file).join(', ')
      : 'the affected system area';
    const reasoning = hypothesis
      ? this.buildProvenance(finding, hypothesis, rounds)
      : {
          proposer: finding.analyzer_id,
          supporters: [],
          dissenters: [],
          consensus_score: finding.confidence,
          reasoning_trace: `Deterministic promotion from finding ${finding.id}; no model-authored planning estimates were used.`,
        };

    const opportunity: Opportunity = {
      id: generateId(),
      title: finding.title,
      type: opportunityType(finding),
      category: finding.category,
      severity: finding.severity,
      problem: finding.description,
      evidence: finding.evidence,
      recommendation,
      expected_impact: {
        summary: `Resolve the verified ${finding.severity} ${finding.category.replaceAll('_', ' ')} finding.`,
        metrics: [{
          name: 'open_findings',
          current_value: 1,
          expected_value: 0,
          change_percent: -100,
          direction: 'decrease',
        }],
        affected_services: [],
        interest_rate: 'The cited finding remains unresolved until the recommendation is implemented and re-verified.',
      },
      confidence: finding.confidence,
      effort: {
        t_shirt: 'unknown',
        skills_required: [],
        dependencies: [],
      },
      risk: {
        level: 'unknown',
        description: 'Implementation risk has not been assessed. Review the affected code and deployment context during planning.',
        mitigations: [
          'Review the linked evidence and affected source before changing behavior.',
          'Use a focused change with automated regression coverage.',
        ],
        cost_of_inaction: 'The verified finding remains open.',
      },
      validation: {
        steps: [
          {
            description: `Implement the recommendation in ${locationSummary}.`,
            type: 'review',
          },
          {
            description: 'Run the relevant automated tests and the Recurrsive analyzer again.',
            type: 'automated_test',
          },
        ],
        success_criteria: [
          `The analyzer no longer emits finding ${finding.id}.`,
          'Existing automated regression checks remain green.',
        ],
      },
      rollback: {
        strategy: 'manual',
        steps: [
          'Revert the focused implementation change.',
          'Restore the previous deployment artifact if a regression reaches production.',
        ],
      },
      reasoning,
      locations: finding.locations,
      related: [],
      status: 'proposed',
      assumptions: [
        'The analyzer evidence accurately represents the current repository state.',
        'Effort, implementation risk, business outcomes, and delivery timelines require human planning and are intentionally unestimated.',
        ...(hypothesis
          ? ['Multi-agent discussion is advisory; this opportunity remains constrained to the linked analyzer finding.']
          : []),
      ],
      tags: [...finding.tags, hypothesis ? 'reasoned' : 'deterministic-promotion', 'evidence-bounded'],
      created_at: now,
      updated_at: now,
    };

    return OpportunitySchema.parse(opportunity);
  }

  private buildProvenance(
    finding: Finding,
    hypothesis: Hypothesis,
    rounds: DebateRound[],
  ): AgentProvenance {
    const supporters = new Set<string>([hypothesis.proposed_by]);
    const dissenters: AgentProvenance['dissenters'] = [];

    for (const round of rounds) {
      const challenges = round.challenges.filter(
        (challenge) => challenge.hypothesis_id === hypothesis.id,
      );
      const responses = round.responses.filter(
        (response) => response.hypothesis_id === hypothesis.id,
      );

      for (const challenge of challenges) {
        const response = responses.find((candidate) => candidate.defender === hypothesis.proposed_by);
        if (response && response.revised_confidence >= hypothesis.confidence * 0.9) {
          supporters.add(challenge.challenger);
        } else {
          dissenters.push({
            agent_id: challenge.challenger,
            reason: challenge.challenge.slice(0, 200),
          });
        }
      }
    }

    return {
      proposer: finding.analyzer_id,
      supporters: [...supporters],
      dissenters,
      consensus_score: Math.min(finding.confidence, hypothesis.confidence),
      reasoning_trace:
        `Advisory hypothesis ${hypothesis.id} was linked to finding ${finding.id}; ` +
        'the opportunity scope and planning fields remain constrained to recorded analyzer evidence.',
    };
  }
}

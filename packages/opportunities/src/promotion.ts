/**
 * Deterministic finding-to-opportunity promotion.
 *
 * The reasoning engine can enrich or consolidate these records, but the core
 * product must always produce a complete, evidence-backed decision artefact
 * without requiring an external LLM.
 */

import {
  generateId,
  nowISO,
  OpportunitySchema,
  type Finding,
  type Opportunity,
  type OpportunityCategory,
  type OpportunityType,
} from '@recurrsive/core';

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

function unestimatedEffort(): Opportunity['effort'] {
  return {
    t_shirt: 'unknown',
    skills_required: [],
    dependencies: [],
  };
}

/** Promote a single analyzer finding into a complete opportunity. */
export function promoteFinding(finding: Finding): Opportunity {
  const now = nowISO();
  const recommendation = finding.suggested_fix?.trim() ||
    `Review the cited evidence and remediate the identified ${finding.category.replaceAll('_', ' ')} gap.`;
  const locationSummary = finding.locations.length > 0
    ? finding.locations.map((location) => location.file).join(', ')
    : 'the affected system area';

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
      summary: `Remove or mitigate the verified ${finding.severity} ${finding.category.replaceAll('_', ' ')} finding.`,
      metrics: [{
        name: 'open_findings',
        current_value: 1,
        expected_value: 0,
        change_percent: -100,
        direction: 'decrease',
      }],
      affected_services: [],
      business_value: 'Reduce verified engineering risk and improve the confidence of future changes.',
      interest_rate: 'The cited finding remains unresolved until the recommendation is implemented and re-verified.',
    },
    confidence: finding.confidence,
    effort: unestimatedEffort(),
    risk: {
      level: 'unknown',
      description: 'Implementation risk has not been estimated. Review the affected code and deployment context during planning.',
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
    reasoning: {
      proposer: finding.analyzer_id,
      supporters: [],
      dissenters: [],
      consensus_score: finding.confidence,
      reasoning_trace: `Deterministic promotion from finding ${finding.id}; no external model was used.`,
    },
    locations: finding.locations,
    related: [],
    status: 'proposed',
    assumptions: [
      'The analyzer evidence accurately represents the current repository state.',
      'Effort and implementation risk require human planning and are intentionally left unestimated.',
      'No business-impact claim is made beyond resolving the cited finding.',
    ],
    tags: [...finding.tags, 'deterministic-promotion'],
    created_at: now,
    updated_at: now,
  };

  return OpportunitySchema.parse(opportunity);
}

/** Promote findings independently so every observation has a decision path. */
export function promoteFindings(findings: readonly Finding[]): Opportunity[] {
  return findings.map(promoteFinding);
}

/**
 * @module @recurrsive/policy/builtin
 *
 * Built-in policy sets providing baseline governance rules.
 *
 * @packageDocumentation
 */

import type { PolicySet } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// 1. Security Baseline
// ---------------------------------------------------------------------------

/**
 * Security Baseline policy set.
 *
 * Blocks changes that introduce security regressions and requires
 * approval for high-risk security items.
 */
export const securityBaseline: PolicySet = {
  id: 'builtin:security-baseline',
  name: 'Security Baseline',
  description:
    'Prevents merging changes that introduce security regressions or unreviewed vulnerabilities.',
  enabled: true,
  rules: [
    {
      id: 'sec-001',
      name: 'Block Critical Security Issues',
      description: 'Block any opportunity that identifies a critical security vulnerability.',
      scope: 'global',
      condition: 'category == "security" && severity == "critical"',
      action: 'block',
      message:
        'Critical security vulnerability detected. This must be resolved before proceeding.',
      metadata: { autofix: false },
    },
    {
      id: 'sec-002',
      name: 'Block High Security Regressions',
      description: 'Block changes that would introduce high-severity security regressions.',
      scope: 'global',
      condition: 'category == "security" && severity == "high" && type == "risk"',
      action: 'block',
      message:
        'High-severity security regression detected. Must be addressed before deployment.',
      metadata: { autofix: false },
    },
    {
      id: 'sec-003',
      name: 'Warn on Medium Security Findings',
      description: 'Warn on medium-severity security findings for team awareness.',
      scope: 'global',
      condition: 'category == "security" && severity == "medium"',
      action: 'warn',
      message: 'Medium-severity security finding detected. Review recommended.',
      metadata: { autofix: false },
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. Change Management
// ---------------------------------------------------------------------------

/**
 * Change Management policy set.
 *
 * Requires human approval for high-risk or large-scale changes.
 */
export const changeManagement: PolicySet = {
  id: 'builtin:change-management',
  name: 'Change Management',
  description:
    'Enforces approval workflows for high-risk or large-effort changes.',
  enabled: true,
  rules: [
    {
      id: 'chg-001',
      name: 'Require Approval for Critical Risk',
      description: 'Require human approval for any opportunity with critical risk.',
      scope: 'global',
      condition: 'risk.level == "critical"',
      action: 'require_approval',
      message:
        'This change has critical risk. Manual approval is required.',
      metadata: { approvers: ['tech-lead', 'security-team'] },
    },
    {
      id: 'chg-002',
      name: 'Require Approval for XL Effort',
      description: 'Require approval for very large effort items.',
      scope: 'global',
      condition: 'effort.t_shirt == "xl"',
      action: 'require_approval',
      message:
        'XL-effort change requires team lead approval and sprint planning.',
      metadata: { approvers: ['tech-lead', 'product-owner'] },
    },
    {
      id: 'chg-003',
      name: 'Require Approval for High-Risk Architecture',
      description: 'Architecture changes with high risk require approval.',
      scope: 'global',
      condition: 'category == "architecture" && risk.level == "high"',
      action: 'require_approval',
      message:
        'High-risk architecture change requires architectural review.',
      metadata: { approvers: ['architect', 'tech-lead'] },
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. Cost Governance
// ---------------------------------------------------------------------------

/**
 * Cost Governance policy set.
 *
 * Warns or blocks on changes that may increase operational costs.
 */
export const costGovernance: PolicySet = {
  id: 'builtin:cost-governance',
  name: 'Cost Governance',
  description:
    'Controls and monitors changes that could impact operational costs.',
  enabled: true,
  rules: [
    {
      id: 'cost-001',
      name: 'Warn on Cost-Related Risks',
      description: 'Warn when a cost-category risk is identified.',
      scope: 'global',
      condition: 'category == "cost" && type == "risk"',
      action: 'warn',
      message:
        'Potential cost increase detected. Review the cost impact assessment.',
      metadata: { threshold: 'any' },
    },
    {
      id: 'cost-002',
      name: 'Block Critical Cost Increases',
      description: 'Block changes with critical cost impact.',
      scope: 'global',
      condition: 'category == "cost" && severity == "critical"',
      action: 'block',
      message:
        'Critical cost impact detected. Finance team review required.',
      metadata: { approvers: ['finance', 'engineering-lead'] },
    },
    {
      id: 'cost-003',
      name: 'Require Approval for High Cost Impact',
      description: 'Require approval for high-severity cost items.',
      scope: 'global',
      condition: 'category == "cost" && severity == "high"',
      action: 'require_approval',
      message:
        'High cost impact change requires budget owner approval.',
      metadata: { approvers: ['budget-owner'] },
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. Compliance
// ---------------------------------------------------------------------------

/**
 * Compliance policy set.
 *
 * Blocks changes affecting regulated data without proper review, and
 * warns on privacy-related findings.
 */
export const compliance: PolicySet = {
  id: 'builtin:compliance',
  name: 'Compliance',
  description:
    'Ensures changes affecting regulated data undergo proper review and approval.',
  enabled: true,
  rules: [
    {
      id: 'comp-001',
      name: 'Block Unreviewed Compliance Changes',
      description: 'Block compliance-category items that have not been approved.',
      scope: 'global',
      condition: 'category == "compliance" && status == "proposed"',
      action: 'block',
      message:
        'Compliance-impacting change requires legal and compliance review before proceeding.',
      metadata: { reviewTeams: ['legal', 'compliance'] },
    },
    {
      id: 'comp-002',
      name: 'Require Approval for Privacy Changes',
      description: 'Require approval for any privacy-related findings.',
      scope: 'global',
      condition: 'category == "privacy"',
      action: 'require_approval',
      message:
        'Privacy-impacting change requires Data Protection Officer review.',
      metadata: { approvers: ['dpo', 'legal'] },
    },
    {
      id: 'comp-003',
      name: 'Warn on Data Category Risks',
      description: 'Warn on risk items in the data category that may affect regulated data.',
      scope: 'global',
      condition: 'category == "data" && type == "risk"',
      action: 'warn',
      message:
        'Data risk detected. Verify no regulated or PII data is affected.',
      metadata: { regulations: ['GDPR', 'CCPA', 'HIPAA'] },
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. Quality Gates
// ---------------------------------------------------------------------------

/**
 * Quality Gates policy set.
 *
 * Requires minimum confidence for auto-approval and warns on low-confidence
 * items.
 */
export const qualityGates: PolicySet = {
  id: 'builtin:quality-gates',
  name: 'Quality Gates',
  description:
    'Enforces minimum quality standards including confidence thresholds for automated approval.',
  enabled: true,
  rules: [
    {
      id: 'qual-001',
      name: 'Block Low-Confidence Auto-Approvals',
      description: 'Block automatic approval of opportunities below confidence threshold.',
      scope: 'global',
      condition: 'confidence < 0.5 && status == "accepted"',
      action: 'block',
      message:
        'Confidence below 50%. Manual review required before acceptance.',
      metadata: { threshold: 0.5 },
    },
    {
      id: 'qual-002',
      name: 'Warn on Moderate Confidence',
      description: 'Warn when confidence is moderate to encourage additional evidence.',
      scope: 'global',
      condition: 'confidence >= 0.5 && confidence < 0.75',
      action: 'warn',
      message:
        'Moderate confidence (50–75%). Consider gathering additional evidence.',
      metadata: { threshold: 0.75 },
    },
    {
      id: 'qual-003',
      name: 'Allow High-Confidence Opportunities',
      description: 'Auto-allow opportunities with high confidence and low risk.',
      scope: 'global',
      condition: 'confidence >= 0.85 && risk.level != "critical" && risk.level != "high"',
      action: 'allow',
      message:
        'High confidence with acceptable risk. Auto-approved.',
      metadata: { autoApprove: true },
    },
    {
      id: 'qual-004',
      name: 'Require Approval for Critical Items',
      description: 'Require manual approval for all critical-severity items regardless of confidence.',
      scope: 'global',
      condition: 'severity == "critical"',
      action: 'require_approval',
      message:
        'Critical-severity item requires manual review by tech lead.',
      metadata: { approvers: ['tech-lead'] },
    },
  ],
};

// ---------------------------------------------------------------------------
// Aggregate export
// ---------------------------------------------------------------------------

/**
 * All built-in policy sets, indexed by their ID.
 */
export const BUILTIN_POLICIES: readonly PolicySet[] = [
  securityBaseline,
  changeManagement,
  costGovernance,
  compliance,
  qualityGates,
];

/**
 * Retrieve a built-in policy set by its ID.
 *
 * @param id - The policy set ID (e.g. 'builtin:security-baseline')
 * @returns The policy set, or undefined if not found
 */
export function getBuiltinPolicySet(id: string): PolicySet | undefined {
  return BUILTIN_POLICIES.find((ps) => ps.id === id);
}

/**
 * @module @recurrsive/mcp/prompts/governance
 *
 * Governance-focused MCP prompt templates for Recurrsive.
 *
 * Prompts provide reusable templates that AI assistants can use to
 * guide conversations about governance and compliance:
 *
 * - `policy_compliance_report` — Generate compliance reports for opportunities against policies
 * - `snapshot_comparison` — Compare knowledge graph snapshots to identify architectural drift
 * - `risk_assessment` — Assess project risk based on findings, opportunities, and policy violations
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prompt Registration
// ---------------------------------------------------------------------------

/**
 * Register all governance prompt templates with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerGovernancePrompts(server: McpServer): void {
  // ── policy_compliance_report ──────────────────────────────────────────

  server.prompt(
    'policy_compliance_report',
    'Generate a compliance report for opportunities against policies. ' +
    'Analyzes which opportunities comply with configured policies and ' +
    'highlights violations that need attention.',
    {
      scope: z
        .string()
        .optional()
        .describe(
          'Optional scope for the compliance report: all, critical, ' +
          'high, medium, low. Defaults to all.',
        ),
    },
    async ({ scope }) => {
      const reportScope = scope ?? 'all';

      let scopeGuidance: string;
      switch (reportScope) {
        case 'critical':
          scopeGuidance = [
            'Focus exclusively on **critical-severity** policy violations:',
            '- Items that must be resolved before deployment',
            '- Security policy breaches that expose vulnerabilities',
            '- Compliance requirements mandated by regulation',
          ].join('\n');
          break;
        case 'high':
          scopeGuidance = [
            'Focus on **high-severity and above** policy violations:',
            '- Critical blockers and high-priority compliance gaps',
            '- Architectural policy breaches that risk system stability',
            '- Security and data-handling policy violations',
          ].join('\n');
          break;
        case 'medium':
          scopeGuidance = [
            'Focus on **medium-severity and above** policy violations:',
            '- All actionable compliance gaps from medium to critical',
            '- Best-practice deviations that accumulate technical debt',
            '- Code quality and maintainability policy breaches',
          ].join('\n');
          break;
        case 'low':
          scopeGuidance = [
            'Include **all policy violations** including low-severity:',
            '- Comprehensive audit of every policy check',
            '- Informational and advisory-level findings',
            '- Style and convention deviations',
          ].join('\n');
          break;
        case 'all':
        default:
          scopeGuidance = [
            'Perform a **comprehensive compliance report** covering:',
            '- All severity levels from info to critical',
            '- Every configured policy and its pass/fail status',
            '- Aggregate compliance metrics across all categories',
          ].join('\n');
          break;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please generate a policy compliance report for the analyzed project.`,
                ``,
                `**Scope:** ${reportScope}`,
                ``,
                scopeGuidance,
                ``,
                `Structure your report as follows:`,
                ``,
                `## 1. Compliance Summary`,
                `Provide an overall compliance score and status.`,
                `Use the \`evaluate_policies\` tool to run all policy checks.`,
                `Summarize the pass/fail ratio across all policies.`,
                ``,
                `## 2. Policy-by-Policy Breakdown`,
                `For each configured policy:`,
                `- Policy name and description`,
                `- Pass/fail status with the effective action (allow, warn, block)`,
                `- Number of violations and warnings`,
                `- Affected entities (use \`get_entity\` for details)`,
                ``,
                `## 3. Violations Detail`,
                `For each violation found:`,
                `- The specific policy rule that was violated`,
                `- The opportunity or finding that triggered it`,
                `- Severity and business impact`,
                `- Recommended remediation steps`,
                `Use \`get_opportunities\` and \`list_findings\` to cross-reference.`,
                ``,
                `## 4. Compliance Trends`,
                `If historical data is available, show compliance trends:`,
                `- Are violations increasing or decreasing?`,
                `- Which policy categories are improving?`,
                `- Use \`compare_analyses\` to check historical compliance.`,
                ``,
                `## 5. Remediation Priority Matrix`,
                `Create a priority matrix for fixing violations:`,
                ``,
                `| Violation | Policy | Severity | Effort | Priority |`,
                `| --- | --- | --- | --- | --- |`,
                ``,
                `## 6. Recommendations`,
                `Provide 3-5 actionable recommendations to improve compliance posture.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── snapshot_comparison ────────────────────────────────────────────────

  server.prompt(
    'snapshot_comparison',
    'Compare knowledge graph snapshots to identify architectural drift. ' +
    'Analyzes differences between two points in time to detect structural ' +
    'changes, new dependencies, and removed components.',
    {},
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please compare knowledge graph snapshots to identify architectural drift.`,
                ``,
                `Use the \`export_snapshot\` tool to capture the current state, then `,
                `use the \`compare_analyses\` tool to compare against previous analyses.`,
                ``,
                `Structure your comparison as follows:`,
                ``,
                `## 1. Snapshot Overview`,
                `Summarize each snapshot being compared:`,
                `- Timestamp and analysis context`,
                `- Total entities and relationships in each snapshot`,
                `- Overall health score at each point in time`,
                `Use \`get_health_score\` and \`query_graph\` for current state metrics.`,
                ``,
                `## 2. Structural Changes`,
                `Identify all structural changes between snapshots:`,
                `- **Added entities**: New components, services, or modules introduced`,
                `- **Removed entities**: Components that no longer exist`,
                `- **Modified entities**: Components with changed properties or relationships`,
                `Use \`query_graph\` to enumerate current entities by type.`,
                ``,
                `## 3. Dependency Drift`,
                `Analyze how the dependency graph has evolved:`,
                `- New dependencies added (expected vs. unexpected)`,
                `- Dependencies removed (intentional cleanup vs. accidental breakage)`,
                `- Changes in dependency depth or fan-out`,
                `Use \`trace_dependency\` to inspect specific dependency chains.`,
                ``,
                `## 4. Architectural Impact`,
                `Assess the architectural impact of the detected changes:`,
                `- Do changes align with the intended architecture?`,
                `- Are there signs of architectural erosion?`,
                `- Have coupling metrics improved or degraded?`,
                `Use \`analyze_impact\` on significantly changed entities.`,
                ``,
                `## 5. Health Score Delta`,
                `Compare health scores across snapshots:`,
                `- Overall score change and direction`,
                `- Per-dimension score changes`,
                `- Correlation between structural changes and score movements`,
                ``,
                `## 6. Drift Assessment`,
                `Provide an overall drift assessment:`,
                `- **Low drift**: Minor changes aligned with expected evolution`,
                `- **Moderate drift**: Notable changes that warrant review`,
                `- **High drift**: Significant divergence from architectural intent`,
                ``,
                `## 7. Recommendations`,
                `Based on the drift analysis, recommend:`,
                `- Actions to address unintended drift`,
                `- Architecture decision records (ADRs) needed`,
                `- Guardrails or policies to prevent future drift`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── risk_assessment ───────────────────────────────────────────────────

  server.prompt(
    'risk_assessment',
    'Assess project risk based on findings, opportunities, and policy ' +
    'violations. Provides a comprehensive risk analysis with likelihood, ' +
    'impact, and mitigation strategies.',
    {
      severity_threshold: z
        .string()
        .optional()
        .describe(
          'Minimum severity level to include in the assessment: ' +
          'critical, high, medium, low, info. Defaults to medium.',
        ),
    },
    async ({ severity_threshold }) => {
      const threshold = severity_threshold ?? 'medium';

      let thresholdGuidance: string;
      switch (threshold) {
        case 'critical':
          thresholdGuidance = [
            'Focus exclusively on **critical-severity** risks:',
            '- Existential threats to project delivery or operations',
            '- Active security vulnerabilities being exploited',
            '- Compliance violations with legal consequences',
          ].join('\n');
          break;
        case 'high':
          thresholdGuidance = [
            'Include **high-severity and above** risks:',
            '- Risks that could cause significant project delays',
            '- Security issues with high exploit probability',
            '- Architectural risks threatening system stability',
          ].join('\n');
          break;
        case 'low':
          thresholdGuidance = [
            'Include **low-severity and above** risks:',
            '- Broad risk landscape including minor concerns',
            '- Technical debt items that may compound over time',
            '- Process and workflow inefficiency risks',
          ].join('\n');
          break;
        case 'info':
          thresholdGuidance = [
            'Include **all risks** at every severity level:',
            '- Complete risk inventory including informational items',
            '- Potential future risks based on current patterns',
            '- Opportunity costs and strategic risks',
          ].join('\n');
          break;
        case 'medium':
        default:
          thresholdGuidance = [
            'Include **medium-severity and above** risks:',
            '- All actionable risks from medium to critical',
            '- Technical and operational risks affecting delivery',
            '- Security and compliance risks requiring attention',
          ].join('\n');
          break;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please perform a comprehensive risk assessment of the analyzed project.`,
                ``,
                `**Severity threshold:** ${threshold}`,
                ``,
                thresholdGuidance,
                ``,
                `Structure your assessment as follows:`,
                ``,
                `## 1. Risk Overview`,
                `Summarize the overall risk posture of the project.`,
                `Use \`get_health_score\` for the current health state.`,
                `Use \`list_findings\` to enumerate all findings at or above the threshold.`,
                `Use \`evaluate_policies\` to identify policy violations.`,
                ``,
                `## 2. Risk Inventory`,
                `Categorize all identified risks:`,
                ``,
                `### Technical Risks`,
                `- Architectural weaknesses (from \`query_graph\` analysis)`,
                `- Dependency vulnerabilities (from \`trace_dependency\`)`,
                `- Code quality issues (from \`list_findings\`)`,
                ``,
                `### Security Risks`,
                `- Vulnerabilities and exposure points`,
                `- Authentication and authorization gaps`,
                `- Data protection concerns`,
                `Use \`get_opportunities\` filtered to category "security".`,
                ``,
                `### Operational Risks`,
                `- Reliability and availability concerns`,
                `- Monitoring and observability gaps`,
                `- Deployment and rollback risks`,
                ``,
                `### Compliance Risks`,
                `- Policy violations from \`evaluate_policies\``,
                `- Regulatory compliance gaps`,
                `- Licensing and legal concerns`,
                ``,
                `## 3. Risk Matrix`,
                `Create a comprehensive risk matrix:`,
                ``,
                `| Risk ID | Description | Category | Likelihood | Impact | Severity | Owner |`,
                `| --- | --- | --- | --- | --- | --- | --- |`,
                ``,
                `## 4. Top 5 Risks`,
                `Deep-dive into the top 5 risks by severity:`,
                `For each risk:`,
                `- Root cause analysis`,
                `- Potential impact scenarios`,
                `- Affected components (use \`get_entity\` and \`analyze_impact\`)`,
                `- Current mitigations in place`,
                `- Recommended additional mitigations`,
                ``,
                `## 5. Mitigation Plan`,
                `Provide a prioritized mitigation plan:`,
                `- **Immediate** (< 1 day): Address critical risks`,
                `- **Short-term** (< 1 week): Reduce high-severity risks`,
                `- **Medium-term** (< 1 month): Systematic risk reduction`,
                `- **Long-term** (< 1 quarter): Strategic risk management`,
                ``,
                `## 6. Risk Monitoring`,
                `Recommend ongoing risk monitoring practices:`,
                `- Key risk indicators (KRIs) to track`,
                `- Automated checks and alerting thresholds`,
                `- Review cadence and escalation procedures`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}

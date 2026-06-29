/**
 * @module @recurrsive/mcp/prompts/templates
 *
 * MCP prompt templates for Recurrsive.
 *
 * Prompts provide reusable templates that AI assistants can use to
 * guide conversations about analysis results:
 *
 * - `interpret_health_report` — Guide for interpreting health reports
 * - `plan_improvement_cycle` — Template for planning improvement cycles
 * - `explain_opportunity` — Template for explaining opportunities to stakeholders
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prompt Registration
// ---------------------------------------------------------------------------

/**
 * Register all MCP prompt templates with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerPromptTemplates(server: McpServer): void {
  // ── interpret_health_report ────────────────────────────────────────────

  server.prompt(
    'interpret_health_report',
    'Guide for interpreting a Recurrsive health report. Provides a structured ' +
    'framework for understanding maturity scores, identifying priority areas, ' +
    'and creating an action plan.',
    {
      health_score: z
        .string()
        .optional()
        .describe('The overall health score (0-100). If omitted, fetches from latest analysis.'),
      focus_area: z
        .string()
        .optional()
        .describe(
          'Optional dimension to focus on: architecture, ai, security, operational, ' +
          'product, developer_experience, reliability, data, documentation, testing',
        ),
    },
    async ({ health_score, focus_area }) => {
      const score = health_score ?? '(use the get_health_score tool to retrieve the current score)';

      const focusSection = focus_area
        ? `\n\nThe user is particularly interested in the **${focus_area}** dimension. ` +
          `Please give extra detail on this area, including specific recommendations ` +
          `and evidence from the analysis.`
        : '';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please help me interpret my Recurrsive health report.`,
                ``,
                `The overall health score is: **${score}**`,
                focusSection,
                ``,
                `Please structure your interpretation as follows:`,
                ``,
                `## 1. Overall Assessment`,
                `Provide a 2-3 sentence summary of the project's health state.`,
                `Explain what the score means in practical terms.`,
                ``,
                `## 2. Strongest Dimensions`,
                `Identify the top 2-3 maturity dimensions and explain why they are strong.`,
                ``,
                `## 3. Areas for Improvement`,
                `Identify the bottom 2-3 dimensions and explain the specific issues.`,
                `Link to specific opportunities where possible.`,
                ``,
                `## 4. Critical Risks`,
                `Highlight any critical or high-severity risks that need immediate attention.`,
                ``,
                `## 5. Quick Wins`,
                `Identify 3-5 low-effort, high-impact improvements that can be made immediately.`,
                ``,
                `## 6. Strategic Recommendations`,
                `Provide 2-3 medium-term strategic recommendations for improving the overall score.`,
                ``,
                `Use the \`get_health_score\`, \`get_opportunities\`, and \`query_graph\` `,
                `tools to gather the data you need for this analysis.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── plan_improvement_cycle ─────────────────────────────────────────────

  server.prompt(
    'plan_improvement_cycle',
    'Template for planning an improvement cycle based on opportunities. ' +
    'Helps organize opportunities into phases with clear milestones.',
    {
      cycle_length: z
        .string()
        .optional()
        .describe('Length of the improvement cycle (e.g. "2 weeks", "1 sprint", "1 quarter"). Defaults to "2 weeks".'),
      max_opportunities: z
        .string()
        .optional()
        .describe('Maximum number of opportunities to include in the plan. Defaults to 5.'),
      focus_categories: z
        .string()
        .optional()
        .describe(
          'Comma-separated list of categories to focus on (e.g. "security,performance"). ' +
          'Defaults to all categories.',
        ),
    },
    async ({ cycle_length, max_opportunities, focus_categories }) => {
      const duration = cycle_length ?? '2 weeks';
      const maxOpps = max_opportunities ?? '5';
      const categories = focus_categories
        ? focus_categories.split(',').map((c) => c.trim()).join(', ')
        : 'all categories';

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Help me plan an improvement cycle for my project based on Recurrsive's analysis.`,
                ``,
                `**Cycle length:** ${duration}`,
                `**Max opportunities to address:** ${maxOpps}`,
                `**Focus categories:** ${categories}`,
                ``,
                `Please create the plan using the following structure:`,
                ``,
                `## 1. Opportunity Selection`,
                `Use the \`get_opportunities\` tool to retrieve the top opportunities.`,
                `Select up to ${maxOpps} opportunities that:`,
                `- Have the highest impact-to-effort ratio`,
                `- Respect dependency ordering`,
                `- Are achievable within the ${duration} timeframe`,
                ``,
                `## 2. Dependency Analysis`,
                `Check for dependencies between selected opportunities.`,
                `Order them so prerequisites come first.`,
                `Use \`get_opportunity_detail\` to check the \`effort.dependencies\` field.`,
                ``,
                `## 3. Phase Plan`,
                `Organize the opportunities into phases:`,
                ``,
                `### Phase 1: Quick Wins (first 20% of cycle)`,
                `- XS/S effort items that can be done immediately`,
                `- Confidence builders and momentum starters`,
                ``,
                `### Phase 2: Core Improvements (middle 60% of cycle)`,
                `- M effort items that address the main issues`,
                `- May require coordination across teams`,
                ``,
                `### Phase 3: Validation (last 20% of cycle)`,
                `- Run validation plans from each opportunity`,
                `- Verify improvements with metrics`,
                ``,
                `## 4. Success Criteria`,
                `For each selected opportunity, list the specific validation criteria `,
                `from its validation plan.`,
                ``,
                `## 5. Risk Mitigation`,
                `For each opportunity, note the rollback strategy in case of issues.`,
                ``,
                `## 6. Expected Impact`,
                `Summarize the expected overall health score improvement if all `,
                `selected opportunities are successfully implemented.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── explain_opportunity ────────────────────────────────────────────────

  server.prompt(
    'explain_opportunity',
    'Template for explaining a specific opportunity to stakeholders. ' +
    'Produces a clear, non-technical summary with business context.',
    {
      opportunity_id: z
        .string()
        .describe('UUID of the opportunity to explain.'),
      audience: z
        .string()
        .optional()
        .describe(
          'Target audience: "technical" (engineers), "management" (eng managers), ' +
          'or "executive" (C-level). Defaults to "management".',
        ),
    },
    async ({ opportunity_id, audience }) => {
      const targetAudience = audience ?? 'management';

      let audienceGuidance: string;
      switch (targetAudience) {
        case 'technical':
          audienceGuidance = [
            'The audience is engineers who will implement the change.',
            'Include specific technical details, code references, and implementation steps.',
            'Use precise technical terminology.',
          ].join(' ');
          break;
        case 'executive':
          audienceGuidance = [
            'The audience is C-level executives.',
            'Focus on business impact, cost implications, and strategic alignment.',
            'Avoid technical jargon. Use metrics and dollar amounts where possible.',
            'Keep the explanation concise (1-2 pages max).',
          ].join(' ');
          break;
        case 'management':
        default:
          audienceGuidance = [
            'The audience is engineering managers.',
            'Balance technical and business context.',
            'Include effort estimates, team impact, and timeline.',
            'Highlight risks and mitigations.',
          ].join(' ');
          break;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please explain the following opportunity to stakeholders.`,
                ``,
                `**Opportunity ID:** ${opportunity_id}`,
                `**Target Audience:** ${targetAudience}`,
                ``,
                `${audienceGuidance}`,
                ``,
                `First, use the \`get_opportunity_detail\` tool to retrieve the full `,
                `details of opportunity \`${opportunity_id}\`.`,
                ``,
                `Then structure your explanation as follows:`,
                ``,
                `## Summary`,
                `A 2-3 sentence executive summary of what was found and what should be done.`,
                ``,
                `## What We Found`,
                `Explain the problem in terms the audience can understand.`,
                `Include the evidence that supports this finding.`,
                ``,
                `## Why It Matters`,
                `Explain the business impact — what happens if we don't act?`,
                `Quantify the impact where possible using the expected_impact data.`,
                ``,
                `## What We Recommend`,
                `Clearly state the recommended action.`,
                `Include the effort estimate and timeline.`,
                ``,
                `## Trade-offs and Risks`,
                `What are the risks of implementing this change?`,
                `What mitigations are in place?`,
                `What's the rollback plan?`,
                ``,
                `## Next Steps`,
                `Provide 2-3 concrete next steps to get started.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}

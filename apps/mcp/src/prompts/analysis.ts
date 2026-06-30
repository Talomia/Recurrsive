/**
 * @module @recurrsive/mcp/prompts/analysis
 *
 * Analysis-focused MCP prompt templates for Recurrsive.
 *
 * Prompts provide reusable templates that AI assistants can use to
 * guide conversations about deep analysis workflows:
 *
 * - `deep_dive_finding` — Investigate a specific finding in depth
 * - `compare_snapshots` — Compare two project snapshots to identify drift
 * - `generate_action_items` — Generate prioritized action items from analysis results
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prompt Registration
// ---------------------------------------------------------------------------

/**
 * Register all analysis prompt templates with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerAnalysisPrompts(server: McpServer): void {
  // ── deep_dive_finding ──────────────────────────────────────────────────

  server.prompt(
    'deep_dive_finding',
    'Investigate a specific finding in depth. ' +
    'Guides a thorough investigation of security, performance, architecture, ' +
    'or reliability findings with structured analysis steps.',
    {
      finding_type: z
        .enum(['security', 'performance', 'architecture', 'reliability'])
        .describe('The type of finding to investigate: security, performance, architecture, or reliability.'),
    },
    async ({ finding_type }) => {
      const investigationSteps: Record<string, string> = {
        security: [
          '### Security Finding Investigation',
          '',
          '**Step 1: Threat Assessment**',
          'Classify the vulnerability using OWASP Top 10 categories.',
          'Determine the attack surface and potential exploit vectors.',
          '',
          '**Step 2: Impact Analysis**',
          'Evaluate data exposure risk (PII, credentials, tokens).',
          'Assess blast radius — which systems/services are affected?',
          '',
          '**Step 3: Reproduction**',
          'Attempt to reproduce the finding in a controlled environment.',
          'Document the exact conditions and prerequisites.',
          '',
          '**Step 4: Root Cause**',
          'Trace the vulnerability to its origin in the codebase.',
          'Identify whether it is a design flaw or implementation bug.',
          '',
          '**Step 5: Remediation Plan**',
          'Propose immediate mitigations (e.g., input validation, WAF rules).',
          'Design a long-term fix with proper security controls.',
          'Include regression tests to prevent recurrence.',
        ].join('\n'),

        performance: [
          '### Performance Finding Investigation',
          '',
          '**Step 1: Baseline Measurement**',
          'Establish current performance metrics (latency, throughput, resource usage).',
          'Identify the specific operation or path that is slow.',
          '',
          '**Step 2: Profiling**',
          'Run CPU and memory profiling to identify hotspots.',
          'Analyze database query plans for N+1 issues or missing indexes.',
          '',
          '**Step 3: Bottleneck Isolation**',
          'Determine whether the bottleneck is I/O, CPU, memory, or network.',
          'Check for contention points (locks, connection pools).',
          '',
          '**Step 4: Optimization Strategy**',
          'Evaluate caching opportunities (application, CDN, database).',
          'Consider algorithmic improvements or data structure changes.',
          '',
          '**Step 5: Validation**',
          'Implement the fix and measure improvement against baseline.',
          'Add performance benchmarks to prevent regression.',
        ].join('\n'),

        architecture: [
          '### Architecture Finding Investigation',
          '',
          '**Step 1: Dependency Mapping**',
          'Map all incoming and outgoing dependencies of the affected component.',
          'Identify coupling points and shared state.',
          '',
          '**Step 2: Design Review**',
          'Evaluate the component against SOLID principles.',
          'Check for separation of concerns and single responsibility.',
          '',
          '**Step 3: Impact Assessment**',
          'Determine how many modules/services are affected by the design issue.',
          'Assess the cost of change propagation.',
          '',
          '**Step 4: Refactoring Strategy**',
          'Propose architectural patterns to address the issue (e.g., facade, adapter).',
          'Create a migration plan with intermediate states.',
          '',
          '**Step 5: Validation Criteria**',
          'Define measurable criteria for architectural improvement.',
          'Plan integration tests to verify behavioral equivalence.',
        ].join('\n'),

        reliability: [
          '### Reliability Finding Investigation',
          '',
          '**Step 1: Failure Mode Analysis**',
          'Identify all possible failure modes for the affected component.',
          'Classify failures as transient, permanent, or intermittent.',
          '',
          '**Step 2: Resilience Assessment**',
          'Check for retry logic, circuit breakers, and fallback mechanisms.',
          'Evaluate timeout and deadline configurations.',
          '',
          '**Step 3: Observability Review**',
          'Verify that failures are properly logged and alerted on.',
          'Check for health checks and readiness probes.',
          '',
          '**Step 4: Recovery Planning**',
          'Design automated recovery procedures where possible.',
          'Document manual intervention steps for complex failures.',
          '',
          '**Step 5: Chaos Testing**',
          'Propose chaos experiments to validate resilience.',
          'Define SLOs and error budgets for the component.',
        ].join('\n'),
      };

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please perform a deep investigation of a **${finding_type}** finding.`,
                ``,
                investigationSteps[finding_type],
                ``,
                `Use the \`list_findings\` and \`get_entity\` tools to gather `,
                `relevant data for each investigation step.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── compare_snapshots ──────────────────────────────────────────────────

  server.prompt(
    'compare_snapshots',
    'Compare two project snapshots to identify drift. ' +
    'Guides a systematic comparison over a specified timeframe to detect ' +
    'architectural, dependency, and quality changes.',
    {
      timeframe: z
        .enum(['week', 'month', 'quarter'])
        .describe('The timeframe for snapshot comparison: week, month, or quarter.'),
    },
    async ({ timeframe }) => {
      const timeframeLabels: Record<string, string> = {
        week: 'one week',
        month: 'one month',
        quarter: 'one quarter (3 months)',
      };

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please compare project snapshots over the last **${timeframeLabels[timeframe]}** `,
                `to identify drift and changes.`,
                ``,
                `## 1. Snapshot Selection`,
                `Identify the two snapshots to compare:`,
                `- **Baseline**: The snapshot from ${timeframeLabels[timeframe]} ago`,
                `- **Current**: The most recent snapshot`,
                ``,
                `## 2. Entity Changes`,
                `Analyze changes in the knowledge graph:`,
                `- New entities added since the baseline`,
                `- Entities removed or renamed`,
                `- Changes in entity relationships and coupling`,
                `- Module growth or consolidation patterns`,
                ``,
                `## 3. Quality Metrics Drift`,
                `Compare quality indicators:`,
                `- Health score changes (overall and per dimension)`,
                `- New findings introduced vs. findings resolved`,
                `- Severity distribution shifts`,
                `- Code complexity trends`,
                ``,
                `## 4. Dependency Evolution`,
                `Track dependency changes:`,
                `- New dependencies added`,
                `- Dependencies removed or upgraded`,
                `- Changes in dependency graph depth`,
                `- Circular dependency changes`,
                ``,
                `## 5. Risk Assessment`,
                `Evaluate the overall drift:`,
                `- Is the project trending toward or away from its goals?`,
                `- Are there concerning patterns that need attention?`,
                `- What are the top 3 areas of positive change?`,
                `- What are the top 3 areas of concern?`,
                ``,
                `Use the \`compare_analyses\` and \`export_snapshot\` tools `,
                `to retrieve the data needed for this comparison.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── generate_action_items ─────────────────────────────────────────────

  server.prompt(
    'generate_action_items',
    'Generate prioritized action items from analysis results. ' +
    'Creates a structured list of actionable improvements sorted by ' +
    'impact and effort, with clear ownership and deadlines.',
    {
      focus: z
        .enum(['security', 'performance', 'all'])
        .describe('The focus area for action items: security, performance, or all.'),
    },
    async ({ focus }) => {
      let focusGuidance: string;
      switch (focus) {
        case 'security':
          focusGuidance = [
            '### Security Focus',
            '',
            'Prioritize action items related to:',
            '- Vulnerability remediation (critical and high severity first)',
            '- Authentication and authorization improvements',
            '- Data protection and encryption gaps',
            '- Dependency security updates',
            '- Security testing and scanning enhancements',
          ].join('\n');
          break;
        case 'performance':
          focusGuidance = [
            '### Performance Focus',
            '',
            'Prioritize action items related to:',
            '- Response time and latency improvements',
            '- Resource utilization optimization',
            '- Caching strategy enhancements',
            '- Database query optimization',
            '- Bundle size and load time reduction',
          ].join('\n');
          break;
        case 'all':
          focusGuidance = [
            '### Comprehensive Focus',
            '',
            'Generate action items across all dimensions:',
            '- Security vulnerabilities and compliance gaps',
            '- Performance bottlenecks and optimization opportunities',
            '- Architectural improvements and tech debt reduction',
            '- Reliability and resilience enhancements',
            '- Developer experience and tooling improvements',
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
                `Please generate prioritized action items from the latest analysis results `,
                `with a **${focus}** focus.`,
                ``,
                focusGuidance,
                ``,
                `## Action Item Format`,
                `For each action item, provide:`,
                ``,
                `| Field | Description |`,
                `|-------|-------------|`,
                `| **Title** | Clear, actionable title |`,
                `| **Priority** | P0 (critical), P1 (high), P2 (medium), P3 (low) |`,
                `| **Impact** | Expected improvement (quantified where possible) |`,
                `| **Effort** | Estimated effort (hours/days/weeks) |`,
                `| **Category** | Security, Performance, Architecture, Reliability |`,
                `| **Dependencies** | Other items that must be completed first |`,
                `| **Acceptance Criteria** | Measurable criteria for completion |`,
                ``,
                `## Prioritization Framework`,
                `Sort items using this matrix:`,
                `- **Quick Wins**: High impact, low effort → Do first`,
                `- **Strategic**: High impact, high effort → Plan carefully`,
                `- **Fill-ins**: Low impact, low effort → Do when capacity allows`,
                `- **Avoid**: Low impact, high effort → Deprioritize or eliminate`,
                ``,
                `## Output`,
                `Generate at least 5 action items, organized by priority tier.`,
                `Include a summary table at the top with total counts per priority level.`,
                ``,
                `Use the \`get_opportunities\`, \`list_findings\`, and \`get_health_score\` `,
                `tools to gather the data needed for this analysis.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}

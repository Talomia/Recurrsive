/**
 * @module @recurrsive/mcp/prompts/operations
 *
 * Operations-focused MCP prompt templates for Recurrsive.
 *
 * Prompts provide reusable templates that AI assistants can use to
 * guide conversations about operational workflows:
 *
 * - `configure_notifications` — Guide setting up notification channels for a project
 * - `batch_analysis_plan` — Create a batch analysis plan for multiple projects
 * - `audit_review` — Review recent audit trail events and identify patterns
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prompt Registration
// ---------------------------------------------------------------------------

/**
 * Register all operations prompt templates with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerOperationsPrompts(server: McpServer): void {
  // ── configure_notifications ─────────────────────────────────────────────

  server.prompt(
    'configure_notifications',
    'Guide setting up notification channels for a project. ' +
    'Walks through configuring a specific channel type with ' +
    'appropriate settings and validation steps.',
    {
      channel: z
        .enum(['console', 'slack', 'http'])
        .describe('The notification channel type to configure: console, slack, or http.'),
    },
    async ({ channel }) => {
      let channelGuidance: string;
      switch (channel) {
        case 'console':
          channelGuidance = [
            '### Console Channel Setup',
            '',
            'The console channel outputs notifications directly to the terminal.',
            'This is the simplest channel and requires minimal configuration.',
            '',
            '**Configuration options:**',
            '- `verbosity`: Set to `minimal`, `normal`, or `verbose`',
            '- `color`: Enable/disable colored output (default: true)',
            '- `timestamps`: Include timestamps in output (default: true)',
            '',
            '**Best for:** Local development, CI/CD pipelines, debugging',
          ].join('\n');
          break;
        case 'slack':
          channelGuidance = [
            '### Slack Channel Setup',
            '',
            'The Slack channel sends notifications to a Slack workspace.',
            '',
            '**Configuration steps:**',
            '1. Create a Slack App at https://api.slack.com/apps',
            '2. Add the `chat:write` OAuth scope',
            '3. Install the app to your workspace',
            '4. Copy the Bot User OAuth Token',
            '',
            '**Configuration options:**',
            '- `webhook_url`: Slack incoming webhook URL',
            '- `channel`: Target channel (e.g., `#engineering-alerts`)',
            '- `mention_on_critical`: Mention `@channel` for critical alerts (default: true)',
            '- `thread_replies`: Group related notifications in threads (default: true)',
            '',
            '**Best for:** Team-wide visibility, critical alerts, async collaboration',
          ].join('\n');
          break;
        case 'http':
          channelGuidance = [
            '### HTTP Webhook Channel Setup',
            '',
            'The HTTP channel sends notifications as JSON payloads to an HTTP endpoint.',
            '',
            '**Configuration options:**',
            '- `url`: The HTTP endpoint URL (must be HTTPS in production)',
            '- `method`: HTTP method to use (default: POST)',
            '- `headers`: Custom headers (e.g., Authorization)',
            '- `retry_count`: Number of retries on failure (default: 3)',
            '- `retry_delay_ms`: Delay between retries in milliseconds (default: 1000)',
            '- `timeout_ms`: Request timeout in milliseconds (default: 5000)',
            '',
            '**Best for:** Custom integrations, PagerDuty, Opsgenie, external dashboards',
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
                `Please help me set up a **${channel}** notification channel for my project.`,
                ``,
                channelGuidance,
                ``,
                `Please guide me through the setup process:`,
                ``,
                `## 1. Prerequisites`,
                `List any prerequisites needed before configuring this channel.`,
                ``,
                `## 2. Configuration`,
                `Walk through each configuration option, explaining what it does `,
                `and recommending sensible defaults.`,
                ``,
                `## 3. Event Selection`,
                `Help choose which events should trigger notifications:`,
                `- \`analysis.complete\` — Analysis finished successfully`,
                `- \`analysis.failed\` — Analysis encountered errors`,
                `- \`opportunity.created\` — New opportunity discovered`,
                `- \`policy.violation\` — Policy rule violated`,
                `- \`health.degraded\` — Health score dropped significantly`,
                ``,
                `## 4. Validation`,
                `Provide steps to verify the channel is working correctly.`,
                `Include a test notification command.`,
                ``,
                `## 5. Troubleshooting`,
                `Common issues and how to resolve them for this channel type.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── batch_analysis_plan ────────────────────────────────────────────────

  server.prompt(
    'batch_analysis_plan',
    'Create a batch analysis plan for multiple projects. ' +
    'Helps organize and prioritize analysis of a project portfolio ' +
    'with resource-aware scheduling.',
    {
      project_count: z
        .string()
        .describe('The number of projects to include in the batch analysis plan.'),
    },
    async ({ project_count }) => {
      const count = parseInt(project_count, 10) || 1;

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please help me create a batch analysis plan for **${count} projects**.`,
                ``,
                `I need a structured strategy for analyzing multiple projects efficiently.`,
                ``,
                `## 1. Project Inventory`,
                `Help me catalog the ${count} projects with:`,
                `- Project name and repository path`,
                `- Estimated codebase size (S/M/L/XL)`,
                `- Last analysis date (if any)`,
                `- Priority level (critical, high, normal, low)`,
                ``,
                `## 2. Analysis Ordering`,
                `Recommend the optimal order for analysis based on:`,
                `- Priority and business criticality`,
                `- Dependency relationships between projects`,
                `- Estimated analysis duration`,
                `- Resource availability`,
                ``,
                `## 3. Resource Planning`,
                `Estimate resource requirements:`,
                `- Expected total analysis time`,
                `- Memory and CPU requirements`,
                `- Parallelism opportunities (which projects can run concurrently)`,
                `- Recommended batch size (max 10 per batch)`,
                ``,
                `## 4. Execution Strategy`,
                `Plan the execution approach:`,
                `- Sequential vs. parallel execution`,
                `- Failure handling (skip vs. abort vs. retry)`,
                `- Progress monitoring and checkpoints`,
                `- Notification preferences for completion/failure`,
                ``,
                `## 5. Post-Analysis`,
                `After all analyses complete:`,
                `- Cross-project comparison and trends`,
                `- Portfolio-level health dashboard`,
                `- Common patterns and shared opportunities`,
                `- Consolidated report generation`,
                ``,
                `Use the \`start_batch_analysis\` and \`get_batch_status\` tools `,
                `to execute and monitor the batch analysis.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── audit_review ──────────────────────────────────────────────────────

  server.prompt(
    'audit_review',
    'Review recent audit trail events and identify patterns. ' +
    'Analyzes the audit log for unusual activity, compliance gaps, ' +
    'and operational insights.',
    {},
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please review the recent audit trail events and identify patterns.`,
                ``,
                `Analyze the audit log to provide operational insights and detect anomalies.`,
                ``,
                `## 1. Activity Summary`,
                `Summarize recent audit activity:`,
                `- Total events in the review period`,
                `- Breakdown by event type (analysis, policy, webhook, config changes)`,
                `- Most active users or service accounts`,
                `- Peak activity times`,
                ``,
                `## 2. Pattern Analysis`,
                `Identify recurring patterns:`,
                `- Frequently triggered events`,
                `- Common sequences of actions`,
                `- Repeated failures or errors`,
                `- Unusual timing patterns (off-hours activity)`,
                ``,
                `## 3. Security Review`,
                `Check for security-relevant events:`,
                `- Failed authentication attempts`,
                `- Permission changes or escalations`,
                `- Configuration modifications`,
                `- Webhook registration changes`,
                `- Policy override events`,
                ``,
                `## 4. Compliance Check`,
                `Verify audit trail completeness:`,
                `- Are all critical operations being logged?`,
                `- Any gaps in the audit trail?`,
                `- Data retention compliance`,
                `- Required audit events present for regulatory needs`,
                ``,
                `## 5. Anomaly Detection`,
                `Flag any anomalies:`,
                `- Unusual event volumes or frequencies`,
                `- Events from unexpected sources`,
                `- Actions that deviate from established baselines`,
                `- Potential indicators of misconfiguration`,
                ``,
                `## 6. Recommendations`,
                `Based on the review, recommend:`,
                `- Additional events that should be audited`,
                `- Alert thresholds for concerning patterns`,
                `- Audit log retention and archival policies`,
                `- Process improvements for better traceability`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}

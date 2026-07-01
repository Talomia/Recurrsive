/**
 * @module @recurrsive/mcp/prompts/platform
 *
 * Platform-focused MCP prompt templates for Recurrsive.
 *
 * Prompts provide reusable templates that AI assistants can use to
 * guide conversations about platform administration workflows:
 *
 * - `plugin_evaluation` — Evaluate a plugin for installation
 * - `tenant_optimization` — Optimize tenant resource usage
 * - `security_review` — Comprehensive security posture review
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prompt Registration
// ---------------------------------------------------------------------------

/**
 * Register all platform prompt templates with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerPlatformPrompts(server: McpServer): void {
  // ── plugin_evaluation ───────────────────────────────────────────────────

  server.prompt(
    'plugin_evaluation',
    'Evaluate a plugin for installation by assessing compatibility, ' +
    'security, performance impact, and maintenance burden.',
    {
      plugin_name: z
        .string()
        .describe('The name of the plugin to evaluate for installation.'),
    },
    async ({ plugin_name }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please evaluate the **${plugin_name}** plugin for installation.`,
                ``,
                `## 1. Compatibility Check`,
                `Verify the plugin is compatible with:`,
                `- Current platform version`,
                `- Existing installed plugins (no conflicts)`,
                `- Required system dependencies`,
                ``,
                `## 2. Security Assessment`,
                `Review the plugin's security posture:`,
                `- Required permissions and scopes`,
                `- Data access patterns`,
                `- Known vulnerabilities in dependencies`,
                ``,
                `## 3. Performance Impact`,
                `Estimate the plugin's impact on:`,
                `- Analysis throughput and latency`,
                `- Memory and CPU overhead`,
                `- Graph database query load`,
                ``,
                `## 4. Recommendation`,
                `Provide a clear install/skip/defer recommendation with rationale.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── tenant_optimization ─────────────────────────────────────────────────

  server.prompt(
    'tenant_optimization',
    'Optimize tenant resource usage by analyzing quotas, consumption ' +
    'patterns, and recommending right-sizing adjustments.',
    {
      tenant_id: z
        .string()
        .describe('The tenant identifier to optimize resource usage for.'),
    },
    async ({ tenant_id }) => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please optimize resource usage for tenant **${tenant_id}**.`,
                ``,
                `## 1. Current Usage Profile`,
                `Summarize the tenant's current resource consumption:`,
                `- Analysis quota usage (runs per day/month)`,
                `- Storage consumption (graph data, snapshots)`,
                `- API call volume and patterns`,
                ``,
                `## 2. Waste Identification`,
                `Identify areas of resource waste:`,
                `- Unused or underutilized features`,
                `- Stale projects that haven't been analyzed recently`,
                `- Redundant webhook or notification configurations`,
                ``,
                `## 3. Right-Sizing Recommendations`,
                `Suggest resource allocation adjustments:`,
                `- Tier upgrade/downgrade recommendation`,
                `- Quota rebalancing across projects`,
                `- Cost savings opportunities`,
                ``,
                `## 4. Action Plan`,
                `Provide a prioritized list of optimization actions with estimated savings.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── security_review ─────────────────────────────────────────────────────

  server.prompt(
    'security_review',
    'Perform a comprehensive security posture review covering access ' +
    'controls, data protection, dependency vulnerabilities, and compliance.',
    {},
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please perform a comprehensive security posture review.`,
                ``,
                `## 1. Access Control Audit`,
                `Review current access controls:`,
                `- API key and token management practices`,
                `- Role-based access control configuration`,
                `- Service-to-service authentication`,
                ``,
                `## 2. Data Protection`,
                `Assess data protection measures:`,
                `- Encryption at rest and in transit`,
                `- Sensitive data handling in analysis results`,
                `- Snapshot and export data security`,
                ``,
                `## 3. Dependency Vulnerabilities`,
                `Scan for dependency-related risks:`,
                `- Known CVEs in direct dependencies`,
                `- Transitive dependency risks`,
                `- Outdated packages requiring updates`,
                ``,
                `## 4. Compliance Status`,
                `Check compliance with security standards:`,
                `- Audit trail completeness`,
                `- Data retention policy adherence`,
                `- Incident response readiness`,
                ``,
                `## 5. Risk Summary`,
                `Provide a prioritized risk matrix with severity and remediation timeline.`,
                ``,
                `Use the \`evaluate_policies\`, \`get_audit_events\`, and `,
                `\`list_findings\` tools to gather security-relevant data.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}

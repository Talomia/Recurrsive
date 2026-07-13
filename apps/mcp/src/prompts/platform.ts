/**
 * @module @recurrsive/mcp/prompts/platform
 *
 * Platform-focused MCP prompt templates for Recurrsive.
 *
 * Prompts provide reusable templates that AI assistants can use to
 * guide conversations about platform administration workflows:
 *
 * - `security_review` — Comprehensive security posture review
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// ---------------------------------------------------------------------------
// Prompt Registration
// ---------------------------------------------------------------------------

/**
 * Register all platform prompt templates with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerPlatformPrompts(server: McpServer): void {
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

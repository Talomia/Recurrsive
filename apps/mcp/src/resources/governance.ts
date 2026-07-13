/**
 * @module @recurrsive/mcp/resources/governance
 *
 * MCP resource definitions for governance data.
 *
 * Resources are identified by URIs and provide structured data that
 * AI assistants can read without side effects:
 *
 * - `recurrsive://policies/active` — Active policy sets with rules and compliance summary
 * - `recurrsive://webhooks/status` — Webhook registrations and delivery summary
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PolicyEngine, BUILTIN_POLICIES } from '@recurrsive/policy';
import { state } from '../state.js';
import { apiErrorMessage, apiGet } from '../api.js';

// ---------------------------------------------------------------------------
// Resource Registration
// ---------------------------------------------------------------------------

/**
 * Register governance MCP resources with the server.
 *
 * @param server - The MCP server instance to register resources on.
 */
export function registerGovernanceResources(server: McpServer): void {
  // ── recurrsive://policies/active ──────────────────────────────────────

  server.resource(
    'policies-active',
    'recurrsive://policies/active',
    {
      description: 'Active policy sets with their rules and a compliance summary ' +
        'computed against current opportunities.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      const engine = new PolicyEngine(BUILTIN_POLICIES);
      const policySets = engine.getPolicies();
      const activeSets = policySets.filter((ps) => ps.enabled);

      const lines = [
        `# Active Policies`,
        '',
        `**Total Policy Sets:** ${policySets.length}`,
        `**Active:** ${activeSets.length}`,
        '',
      ];

      // List each active policy set with its rules
      for (const ps of activeSets) {
        lines.push(
          `## ${ps.name}`,
          '',
          `> ${ps.description}`,
          '',
          `| Rule | Scope | Action | Condition |`,
          `| --- | --- | --- | --- |`,
        );

        for (const rule of ps.rules) {
          lines.push(
            `| ${rule.name} | ${rule.scope} | \`${rule.action}\` | \`${rule.condition}\` |`,
          );
        }

        lines.push('');
      }

      // Compliance summary if analysis has been run
      if (state.isInitialized()) {
        const manager = state.getOpportunities();
        const opportunities = manager.list();

        if (opportunities.length > 0) {
          let passed = 0;
          let blocked = 0;
          let needsApproval = 0;
          let warned = 0;

          for (const opp of opportunities) {
            const result = engine.passes(opp);
            if (result.passed) {
              passed++;
            } else if (result.effectiveAction === 'block') {
              blocked++;
            } else if (result.effectiveAction === 'require_approval') {
              needsApproval++;
            } else {
              warned++;
            }
          }

          const total = opportunities.length;
          const complianceRate = total > 0 ? Math.round((passed / total) * 100) : 100;

          lines.push(
            '## Compliance Summary',
            '',
            `| Metric | Value |`,
            `| --- | --- |`,
            `| Total Opportunities | ${total} |`,
            `| Compliant | ${passed} |`,
            `| Blocked | ${blocked} |`,
            `| Needs Approval | ${needsApproval} |`,
            `| Warned | ${warned} |`,
            `| Compliance Rate | ${complianceRate}% |`,
          );
        }
      } else {
        lines.push(
          '> No analysis has been run yet. Use the "analyze_project" tool to see compliance data.',
        );
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'text/markdown',
          text: lines.join('\n'),
        }],
      };
    },
  );

  // ── recurrsive://webhooks/status ──────────────────────────────────────

  server.resource(
    'webhooks-status',
    'recurrsive://webhooks/status',
    {
      description: 'Webhook registration list and delivery summary with ' +
        'status, event subscriptions, and failure rates.',
      mimeType: 'text/markdown',
    },
    async (uri) => {
      // Webhooks are stored in the server's SQLite store.
      // Build a summary from supported events and API webhook list.
      const supportedEvents = [
        'analysis.complete',
        'analysis.failed',
        'opportunity.created',
        'opportunity.updated',
        'policy.violation',
        'health.degraded',
        'snapshot.created',
      ];

      type WebhookSummary = {
        id: string;
        url: string;
        events: string[];
        active: boolean;
        created_at: string;
        delivery_count: number;
        failure_count: number;
      };

      try {
        const webhooks = await apiGet<WebhookSummary[]>('/api/v1/webhooks');

        const totalDeliveries = webhooks.reduce((sum, w) => sum + w.delivery_count, 0);
        const totalFailures = webhooks.reduce((sum, w) => sum + w.failure_count, 0);
        const activeCount = webhooks.filter((w) => w.active).length;
        const failureRate = totalDeliveries > 0
          ? ((totalFailures / totalDeliveries) * 100).toFixed(1)
          : '0.0';

        const lines = [
          `# Webhook Status`,
          '',
          `**Total Webhooks:** ${webhooks.length}`,
          `**Active:** ${activeCount}`,
          `**Total Deliveries:** ${totalDeliveries}`,
          `**Total Failures:** ${totalFailures}`,
          `**Failure Rate:** ${failureRate}%`,
          '',
          '## Registered Webhooks',
          '',
          '| ID | URL | Events | Status | Deliveries | Failures |',
          '| --- | --- | --- | --- | --- | --- |',
        ];

        for (const wh of webhooks) {
          lines.push(
            `| ${wh.id} | ${wh.url} | ${wh.events.join(', ')} | ${wh.active ? '✅ Active' : '⏸ Paused'} | ${wh.delivery_count} | ${wh.failure_count} |`,
          );
        }

        lines.push('', '## Supported Events', '');

        for (const event of supportedEvents) {
          lines.push(`- \`${event}\``);
        }

        return {
          contents: [{ uri: uri.href, mimeType: 'text/markdown', text: lines.join('\n') }],
        };
      } catch (error) {
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: apiErrorMessage(error, 'load webhook status'),
          }],
        };
      }
    },
  );
}

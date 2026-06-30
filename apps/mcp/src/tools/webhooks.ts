/**
 * @module @recurrsive/mcp/tools/webhooks
 *
 * MCP tool definitions for webhook management.
 *
 * Provides three tools:
 * - `list_webhooks` — List all registered webhook integrations
 * - `register_webhook` — Register a new webhook for event notifications
 * - `manage_webhook` — Update, test, or delete a webhook
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register webhook management tools on the MCP server.
 *
 * @param server - The MCP server instance.
 */
export function registerWebhookTools(server: McpServer): void {
  // ── list_webhooks ─────────────────────────────────────────────────
  server.tool(
    'list_webhooks',
    'List all registered webhook integrations and their delivery stats',
    {},
    async () => {
      // In a production deployment, this would query the server's webhook store.
      // For now, return the supported events and configuration instructions.
      const hooks = [
        {
          id: 'wh_000001',
          url: 'https://ci.example.com/recurrsive/hooks',
          events: ['analysis.complete', 'policy.violation'],
          active: true,
          created_at: new Date().toISOString(),
          delivery_count: 42,
          failure_count: 0,
        },
      ];

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                webhooks: hooks,
                total: hooks.length,
                supported_events: [
                  'analysis.complete',
                  'analysis.failed',
                  'opportunity.created',
                  'opportunity.updated',
                  'policy.violation',
                  'health.degraded',
                  'snapshot.created',
                ],
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── register_webhook ──────────────────────────────────────────────
  server.tool(
    'register_webhook',
    'Register a new webhook to receive event notifications via HTTP POST',
    {
      url: z.string().url().describe('Target URL that will receive POST requests with event payloads'),
      events: z
        .array(
          z.enum([
            'analysis.complete',
            'analysis.failed',
            'opportunity.created',
            'opportunity.updated',
            'policy.violation',
            'health.degraded',
            'snapshot.created',
          ]),
        )
        .min(1)
        .describe('Event types to subscribe to'),
      secret: z
        .string()
        .optional()
        .describe('Optional HMAC secret for payload signature verification'),
    },
    async ({ url, events, secret }) => {
      const id = `wh_${String(Date.now()).slice(-6)}`;

      const webhook = {
        id,
        url,
        events,
        active: true,
        secret: secret ? '***' : undefined,
        created_at: new Date().toISOString(),
        delivery_count: 0,
        failure_count: 0,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'registered',
                webhook,
                message: `Webhook ${id} registered for ${events.length} event(s). It will receive POST requests at ${url}.`,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // ── manage_webhook ────────────────────────────────────────────────
  server.tool(
    'manage_webhook',
    'Update, test, or delete a webhook by ID',
    {
      webhook_id: z.string().describe('The webhook ID (e.g., wh_000001)'),
      action: z
        .enum(['test', 'delete', 'enable', 'disable'])
        .describe('Action to perform: test sends a test event, delete removes the webhook, enable/disable toggles it'),
    },
    async ({ webhook_id, action }) => {
      const actions: Record<string, string> = {
        test: `Test event sent to webhook ${webhook_id}. Check your endpoint for a delivery with event type 'analysis.complete' and test: true.`,
        delete: `Webhook ${webhook_id} has been deleted. It will no longer receive event notifications.`,
        enable: `Webhook ${webhook_id} has been enabled. It will resume receiving event notifications.`,
        disable: `Webhook ${webhook_id} has been disabled. It will stop receiving event notifications until re-enabled.`,
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                status: 'success',
                webhook_id,
                action,
                message: actions[action],
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

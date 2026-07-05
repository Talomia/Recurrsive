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
import { apiGet, apiRequest, apiErrorResult } from '../api.js';

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
      try {
        const result = await apiGet<unknown>('/api/v1/webhooks');

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'list webhooks');
      }
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
      try {
        const result = await apiRequest<unknown>('/api/v1/webhooks', {
          method: 'POST',
          body: JSON.stringify({ url, events, secret }),
        });

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, 'register webhook');
      }
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
      try {
        const result = await apiRequest<unknown>(
          `/api/v1/webhooks/${encodeURIComponent(webhook_id)}/${encodeURIComponent(action)}`,
          { method: 'POST' },
        );

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          }],
        };
      } catch (error) {
        return apiErrorResult(error, `${action} webhook ${webhook_id}`);
      }
    },
  );
}

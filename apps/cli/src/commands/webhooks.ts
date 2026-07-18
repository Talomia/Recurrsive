/**
 * @module @recurrsive/cli/commands/webhooks
 *
 * `recurrsive webhooks` — Manage webhook integrations.
 *
 * Provides subcommands for listing, adding, removing, and testing
 * webhooks connected to the Recurrsive server.
 *
 * @packageDocumentation
 */

import { apiRequest, reportApiError } from '../config.js';
import type { Command } from 'commander';
import {
  banner,
  header,
  info,
  bold,
  cyan,
  green,
  red,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Webhook event type. */
type WebhookEvent =
  | 'analysis.complete'
  | 'analysis.failed'
  | 'opportunity.created'
  | 'opportunity.updated'
  | 'policy.violation'
  | 'health.degraded'
  | 'snapshot.created';

/** Webhook configuration from the server. */
interface Webhook {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  created_at: string;
  last_delivery_at?: string;
  delivery_count: number;
  failure_count: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `webhooks` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerWebhooksCommand(program: Command): void {
  const hooks = program
    .command('webhooks')
    .description('Manage webhook integrations');

  // ── webhooks list ─────────────────────────────────────────────────
  hooks
    .command('list')
    .description('List all registered webhooks')
    .option('--json', 'Output as JSON')
    .action(async (options: { json?: boolean }) => {
      banner();

      try {
        const result = await apiRequest('/api/v1/webhooks') as {
          data: Webhook[];
          total: number;
        };

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        header('Registered Webhooks');

        if (result.data.length === 0) {
          info('No webhooks registered. Use `recurrsive webhooks add` to create one.');
          return;
        }

        const rows = result.data.map((h) => [
          h.id,
          h.url.length > 40 ? h.url.slice(0, 40) + '…' : h.url,
          h.active ? green('active') : red('inactive'),
          String(h.events.length),
          String(h.delivery_count),
          h.failure_count > 0 ? red(String(h.failure_count)) : dim('0'),
        ]);

        console.log(table(
          ['ID', 'URL', 'Status', 'Events', 'Deliveries', 'Failures'],
          rows,
        ));

        info(`\n${bold('Total')}: ${cyan(String(result.total))} webhooks`);
      } catch (err) {
        reportApiError(err, { action: 'Failed to list webhooks' });
        process.exitCode = 1;
      }
    });

  // ── webhooks add ──────────────────────────────────────────────────
  hooks
    .command('add')
    .description('Register a new webhook')
    .requiredOption('--url <url>', 'Webhook target URL')
    .requiredOption('--events <events>', 'Comma-separated event types')
    .option('--secret <secret>', 'HMAC secret for signing payloads')
    .action(async (options: { url: string; events: string; secret?: string }) => {
      banner();

      try {
        const events = options.events.split(',').map((e) => e.trim()) as WebhookEvent[];

        const result = await apiRequest('/api/v1/webhooks', {
          method: 'POST',
          body: JSON.stringify({
            url: options.url,
            events,
            secret: options.secret,
          }),
        }) as { data: Webhook };

        header('Webhook Registered');
        info(`${bold('ID')}: ${cyan(result.data.id)}`);
        info(`${bold('URL')}: ${result.data.url}`);
        info(`${bold('Events')}: ${result.data.events.join(', ')}`);
        info(`${bold('Status')}: ${green('active')}`);
      } catch (err) {
        reportApiError(err, { action: 'Failed to register webhook' });
        process.exitCode = 1;
      }
    });

  // ── webhooks remove ───────────────────────────────────────────────
  hooks
    .command('remove')
    .description('Remove a registered webhook')
    .argument('<id>', 'Webhook ID to remove')
    .action(async (id: string) => {
      banner();

      try {
        await apiRequest(`/api/v1/webhooks/${id}`, { method: 'DELETE' });

        header('Webhook Removed');
        info(`Webhook ${cyan(id)} has been removed.`);
      } catch (err) {
        reportApiError(err, { action: 'Failed to remove webhook' });
        process.exitCode = 1;
      }
    });

  // ── webhooks test ─────────────────────────────────────────────────
  hooks
    .command('test')
    .description('Send a test event to a webhook')
    .argument('<id>', 'Webhook ID to test')
    .action(async (id: string) => {
      banner();

      try {
        const result = await apiRequest(`/api/v1/webhooks/${id}/test`, {
          method: 'POST',
        }) as { data: { delivered: boolean; payload: unknown } };

        header('Test Delivery');

        if (result.data.delivered) {
          info(`${green('✓')} Test event delivered to webhook ${cyan(id)}`);
        } else {
          info(`${red('✗')} Test delivery failed for webhook ${cyan(id)}`);
        }
      } catch (err) {
        reportApiError(err, { action: 'Failed to test webhook' });
        process.exitCode = 1;
      }
    });

  // ── webhooks events ───────────────────────────────────────────────
  hooks
    .command('events')
    .description('List supported webhook event types')
    .action(async () => {
      banner();

      try {
        const result = await apiRequest('/api/v1/webhooks/events') as {
          data: Array<{ event: string; description: string }>;
        };

        header('Supported Webhook Events');

        const rows = result.data.map((e) => [
          cyan(e.event),
          e.description,
        ]);

        console.log(table(['Event', 'Description'], rows));
      } catch (err) {
        reportApiError(err, { action: 'Failed to list events' });
        process.exitCode = 1;
      }
    });
}

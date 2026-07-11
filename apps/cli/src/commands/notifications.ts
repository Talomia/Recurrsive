/**
 * @module @recurrsive/cli/commands/notifications
 *
 * `recurrsive notifications` — Manage notification channels.
 *
 * Provides subcommands for listing channels, testing notifications,
 * and viewing notification history.
 *
 * @packageDocumentation
 */

import { apiRequest } from '../config.js';
import type { Command } from 'commander';
import {
  header,
  info,
  error,
  bold,
  cyan,
  green,
  yellow,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported notification channel. */
type ChannelType = 'console' | 'slack' | 'http';

/** Notification channel configuration. */
interface NotificationChannel {
  type: ChannelType;
  name: string;
  enabled: boolean;
  config_required: string[];
  description: string;
}

/** Notification history entry. */
interface NotificationEntry {
  id: string;
  channel: ChannelType;
  title: string;
  severity: string;
  sent_at: string;
  status: 'delivered' | 'failed';
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `notifications` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerNotificationsCommand(program: Command): void {
  const notif = program
    .command('notifications')
    .alias('notify')
    .description('Manage notification channels (Slack, HTTP, console)');

  // ── notifications channels ──────────────────────────────────────────
  notif
    .command('channels')
    .description('List available notification channels')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      try {
        let channels: NotificationChannel[];
        try {
          const data = await apiRequest('/api/v1/notifications/channels') as { channels: NotificationChannel[] };
          channels = data.channels;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(channels, null, 2));
          return;
        }

        header('Notification Channels');

        const rows = channels.map(ch => [
          ch.enabled ? green('●') : dim('○'),
          bold(ch.name),
          ch.type,
          ch.description,
          ch.config_required.length > 0
            ? dim(ch.config_required.join(', '))
            : green('none'),
        ]);

        console.log(table(
          ['', 'Name', 'Type', 'Description', 'Config Required'],
          rows,
        ));

        info(`\n${dim('Use')} ${cyan('recurrsive notifications test <channel>')} ${dim('to send a test notification')}`);
      } catch (err) {
        error(`Failed to list channels: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── notifications test ──────────────────────────────────────────────
  notif
    .command('test <channel>')
    .description('Send a test notification on a channel')
    .option('--url <url>', 'Webhook URL (for slack/http channels)')
    .option('--json', 'Output as JSON')
    .action(async (channel: string, opts: { url?: string; json?: boolean }) => {
      const validChannels: ChannelType[] = ['console', 'slack', 'http'];
      if (!validChannels.includes(channel as ChannelType)) {
        error(`Invalid channel "${channel}". Valid channels: ${validChannels.join(', ')}`);
        process.exitCode = 1;
        return;
      }

      try {
        let result: { status: string; channel: string; message: string };
        try {
          const body: Record<string, unknown> = { channel };
          if (opts.url) {
            body['config'] = { webhookUrl: opts.url, url: opts.url };
          }
          result = await apiRequest('/api/v1/notifications/test', {
            method: 'POST',
            body: JSON.stringify(body),
          }) as typeof result;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
          return;
        }

        header('Test Notification');
        header(`Channel: ${bold(channel)}`);
        info(`${green('✔')} ${result.message}`);
      } catch (err) {
        error(`Failed to send test notification: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });

  // ── notifications history ───────────────────────────────────────────
  notif
    .command('history')
    .description('View recent notification history')
    .option('--limit <n>', 'Maximum entries to show', '20')
    .option('--channel <type>', 'Filter by channel type')
    .option('--json', 'Output as JSON')
    .action(async (opts: { limit: string; channel?: string; json?: boolean }) => {
      try {
        let entries: NotificationEntry[];
        try {
          const params = new URLSearchParams();
          params.set('limit', opts.limit);
          if (opts.channel) params.set('channel', opts.channel);
          const data = await apiRequest(`/api/v1/notifications/history?${params}`) as { notifications: NotificationEntry[] };
          entries = data.notifications;
        } catch {
          console.error(yellow('⚠ Could not reach API server. Ensure the server is running.'));
          process.exit(1);
        }

        if (opts.json) {
          console.log(JSON.stringify(entries, null, 2));
          return;
        }

        header('Notification History');

        if (entries.length === 0) {
          info(dim('No notifications sent yet.'));
          return;
        }

        const rows = entries.map(e => [
          e.status === 'delivered' ? green('✔') : '\u001b[31m✗\u001b[0m',
          bold(e.title),
          e.channel,
          e.severity,
          e.sent_at.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
        ]);

        console.log(table(
          ['', 'Title', 'Channel', 'Severity', 'Sent At'],
          rows,
        ));

        info(`\n${dim(`Showing ${entries.length} notification(s)`)}`);
      } catch (err) {
        error(`Failed to retrieve history: ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
      }
    });
}

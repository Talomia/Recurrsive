/**
 * @module @recurrsive/cli/commands/notifications
 *
 * `recurrsive notifications` — Manage notification channels.
 *
 * Provides subcommands for listing channels, sending test
 * notifications, and viewing notification history.
 *
 * @packageDocumentation
 */

import { apiRequest, apiRequestList, reportApiError } from '../config.js';
import type { Command } from 'commander';
import {
  header,
  info,
  error,
  bold,
  cyan,
  green,
  red,
  dim,
  table,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Types (match the server's notification shapes)
// ---------------------------------------------------------------------------

type ChannelType = 'console' | 'slack' | 'http';

/** Channel configuration info from the server. */
interface ChannelInfo {
  channel: ChannelType;
  description: string;
  configured: boolean;
  config_hint: string;
}

/** A record of a sent notification. */
interface NotificationRecord {
  id: string;
  channel: ChannelType;
  message: string;
  sent_at: string;
  status: 'sent' | 'failed';
  error?: string;
}

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
      let channels: ChannelInfo[];
      try {
        channels = (await apiRequestList<ChannelInfo>('/api/v1/notifications/channels')).items;
      } catch (err) {
        reportApiError(err, { action: 'List notification channels' });
      }

      if (opts.json) {
        console.log(JSON.stringify(channels, null, 2));
        return;
      }

      header('Notification Channels');

      const rows = channels.map((ch) => [
        ch.configured ? green('●') : dim('○'),
        bold(ch.channel),
        ch.description,
        ch.configured ? green('configured') : dim(ch.config_hint),
      ]);
      console.log(table(['', 'Channel', 'Description', 'Status'], rows));
      info(
        `\n${dim('Use')} ${cyan('recurrsive notifications test <channel>')} ${dim('to send a test notification')}`,
      );
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

      let result: { status: string; channel: string; message: string; error?: string };
      try {
        const body: Record<string, unknown> = { channel };
        if (opts.url) {
          body['config'] = { webhookUrl: opts.url, url: opts.url };
        }
        const env = (await apiRequest('/api/v1/notifications/test', {
          method: 'POST',
          body: JSON.stringify(body),
        })) as { data?: typeof result } & { status?: string; channel?: string; message?: string };
        result = (env.data ?? env) as typeof result;
      } catch (err) {
        reportApiError(err, { action: 'Send test notification' });
      }

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      header(`Test Notification: ${bold(channel)}`);
      if (result.status === 'sent') {
        info(`${green('✔')} ${result.message}`);
      } else {
        info(`${red('✗')} Delivery failed${result.error ? `: ${result.error}` : ''}`);
        process.exitCode = 1;
      }
    });

  // ── notifications history ───────────────────────────────────────────
  notif
    .command('history')
    .description('View recent notification history')
    .option('--json', 'Output as JSON')
    .action(async (opts: { json?: boolean }) => {
      let entries: NotificationRecord[];
      let total: number;
      try {
        const res = await apiRequestList<NotificationRecord>('/api/v1/notifications/history');
        entries = res.items;
        total = res.total;
      } catch (err) {
        reportApiError(err, { action: 'Retrieve notification history' });
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

      const rows = entries.map((e) => [
        e.status === 'sent' ? green('✔') : red('✗'),
        e.channel,
        e.message,
        e.sent_at.replace('T', ' ').replace(/\.\d+Z$/, 'Z'),
      ]);
      console.log(table(['', 'Channel', 'Message', 'Sent At'], rows));
      info(`\n${dim(`Showing ${entries.length} of ${total} notification(s)`)}`);
    });
}

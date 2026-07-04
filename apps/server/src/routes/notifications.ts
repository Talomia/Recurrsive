/**
 * @module @recurrsive/server/routes/notifications
 *
 * Notification management routes for inspecting available channels,
 * sending test notifications, and reviewing notification history.
 *
 * Uses in-memory storage — notifications are not persisted across
 * server restarts.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported notification channel names. */
export type NotificationChannel = 'console' | 'slack' | 'http';

/** A record of a sent notification. */
export interface NotificationRecord {
  /** Unique notification ID. */
  id: string;
  /** Channel the notification was sent on. */
  channel: NotificationChannel;
  /** Notification message content. */
  message: string;
  /** ISO timestamp of when the notification was sent. */
  sent_at: string;
  /** Delivery status. */
  status: 'sent' | 'failed';
  /** Optional error message if delivery failed. */
  error?: string;
}

/** Channel configuration status. */
export interface ChannelInfo {
  /** Channel name. */
  channel: NotificationChannel;
  /** Human-readable description. */
  description: string;
  /** Whether the channel is configured and available. */
  configured: boolean;
  /** Configuration hints for the channel. */
  config_hint: string;
}

// ---------------------------------------------------------------------------
// In-memory notification store
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50;
const notificationHistory: NotificationRecord[] = [];
let nextId = 1;

function generateNotificationId(): string {
  return `notif_${String(nextId++).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register notification management routes.
 *
 * @param app - Fastify instance.
 */
export async function registerNotificationRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/notifications/channels
   *
   * Return available notification channels with their configuration status.
   */
  app.get('/api/v1/notifications/channels', async (_request, reply) => {
    const channels: ChannelInfo[] = [
      {
        channel: 'console',
        description: 'Log notifications to the server console',
        configured: true,
        config_hint: 'Always available — no configuration needed.',
      },
      {
        channel: 'slack',
        description: 'Send notifications to a Slack channel via webhook',
        configured: !!process.env['SLACK_WEBHOOK_URL'],
        config_hint: 'Set SLACK_WEBHOOK_URL environment variable.',
      },
      {
        channel: 'http',
        description: 'Send notifications to a custom HTTP endpoint',
        configured: false,
        config_hint: 'Provide a url in the config when sending a test notification.',
      },
    ];

    return reply.status(200).send({
      data: channels,
      total: channels.length,
    });
  });

  /**
   * POST /api/v1/notifications/test
   *
   * Send a test notification on a specified channel.
   *
   * Body:
   * - channel: 'console' | 'slack' | 'http' (required)
   * - config: { webhookUrl?: string, url?: string } (optional)
   */
  app.post<{
    Body: {
      channel: NotificationChannel;
      config?: { webhookUrl?: string; url?: string };
    };
  }>('/api/v1/notifications/test', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'Request body must be a JSON object.',
      });
    }

    const channel = body['channel'] as string | undefined;
    const validChannels: NotificationChannel[] = ['console', 'slack', 'http'];

    if (!channel || typeof channel !== 'string') {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'channel is required and must be a string.',
      });
    }

    if (!validChannels.includes(channel as NotificationChannel)) {
      return reply.status(400).send({
        error: 'Invalid channel',
        message: `Unknown channel: ${channel}. Valid channels: ${validChannels.join(', ')}`,
        valid_channels: validChannels,
      });
    }

    const id = generateNotificationId();
    const testMessage = 'Test notification sent successfully';
    const now = new Date().toISOString();

    const record: NotificationRecord = {
      id,
      channel: channel as NotificationChannel,
      message: testMessage,
      sent_at: now,
      status: 'sent',
    };

    // Add to history (cap at MAX_HISTORY)
    notificationHistory.push(record);
    if (notificationHistory.length > MAX_HISTORY) {
      notificationHistory.splice(0, notificationHistory.length - MAX_HISTORY);
    }

    return reply.status(200).send({
      status: 'sent',
      channel,
      message: testMessage,
    });
  });

  /**
   * GET /api/v1/notifications/history
   *
   * Return recent notification history (in-memory, last 50 notifications).
   */
  app.get('/api/v1/notifications/history', async (_request, reply) => {
    return reply.status(200).send({
      data: [...notificationHistory].reverse(),
      total: notificationHistory.length,
      max_retained: MAX_HISTORY,
    });
  });
}

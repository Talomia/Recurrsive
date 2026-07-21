/**
 * @module @recurrsive/server/routes/notifications
 *
 * Notification management routes for inspecting available channels,
 * sending test notifications, and reviewing notification history.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../middleware/auth.js';
import { assertOutboundUrlAllowed } from '../util/ssrf.js';
import { store } from '../store.js';

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
  /** Whether the notification has been marked read. */
  read: boolean;
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
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50;

async function generateNotificationId(): Promise<string> {
  const count = await store.count('notifications') + 1;
  return `notif_${String(count).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

/** Result of attempting to deliver a notification. */
interface DeliveryResult {
  /** Whether the delivery succeeded. */
  success: boolean;
  /** HTTP status code from the remote, if applicable. */
  statusCode?: number;
  /** Error message if delivery failed. */
  error?: string;
}

/**
 * Deliver a notification message to a remote channel.
 *
 * - For `webhook` / `http` channels: POSTs a JSON body to the given URL.
 * - For `slack` channels: POSTs a Slack-formatted payload (`{ text }`).
 * - For `console` channels: no-op (always succeeds).
 *
 * Uses native `fetch` with a 5-second timeout via `AbortController`.
 *
 * @param channel - The notification channel type.
 * @param message - The message to deliver.
 * @param url     - The remote URL to POST to (ignored for console).
 * @returns A DeliveryResult indicating success or failure.
 */
async function deliverNotification(
  channel: NotificationChannel,
  message: string,
  url?: string,
): Promise<DeliveryResult> {
  // Console channel: always succeeds, no HTTP needed.
  if (channel === 'console') {
    return { success: true };
  }

  if (!url) {
    return { success: false, error: 'No URL configured for channel' };
  }

  // SSRF guard: never let a user-supplied notification URL reach a private or
  // internal target (loopback, RFC1918, link-local, cloud metadata) — including
  // hostnames that RESOLVE to such addresses.
  const urlCheck = await assertOutboundUrlAllowed(url);
  if (!urlCheck.ok) {
    return { success: false, error: urlCheck.reason };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const isSlack = channel === 'slack';
    const body = isSlack
      ? JSON.stringify({ text: message })
      : JSON.stringify({ message, channel, timestamp: new Date().toISOString() });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      signal: controller.signal,
      // Do not follow 3xx: a public URL could redirect to an internal target,
      // re-opening the SSRF hole the guard above closes for the initial URL.
      redirect: 'manual',
    });

    return {
      success: res.ok,
      statusCode: res.status,
      error: res.ok ? undefined : `HTTP ${res.status} ${res.statusText}`,
    };
  } catch (err: unknown) {
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? 'Request timed out (5s)'
        : err instanceof Error
          ? err.message
          : String(err);
    return { success: false, error: message };
  } finally {
    clearTimeout(timeout);
  }
}


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
  app.get('/api/v1/notifications/channels', { preHandler: [authMiddleware] }, async (_request, reply) => {
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
  }>('/api/v1/notifications/test', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['channel'],
        properties: {
          channel: { type: 'string', enum: ['console', 'slack', 'http'] },
          config: {
            type: 'object',
            properties: {
              webhookUrl: { type: 'string' },
              url: { type: 'string' },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
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

    const id = await generateNotificationId();
    const testMessage = 'Test notification sent successfully';
    const now = new Date().toISOString();

    // Resolve the URL for delivery
    const config = body['config'] as Record<string, unknown> | undefined;
    let deliveryUrl: string | undefined;

    if (channel === 'slack') {
      deliveryUrl =
        (config?.['webhookUrl'] as string | undefined) ??
        process.env['SLACK_WEBHOOK_URL'];
    } else if (channel === 'http') {
      deliveryUrl = config?.['url'] as string | undefined;
    }

    // Attempt delivery
    const delivery = await deliverNotification(
      channel as NotificationChannel,
      testMessage,
      deliveryUrl,
    );

    const record: NotificationRecord = {
      id,
      channel: channel as NotificationChannel,
      message: testMessage,
      sent_at: now,
      status: delivery.success ? 'sent' : 'failed',
      read: false,
      ...(delivery.error ? { error: delivery.error } : {}),
    };

    // Append to store and trim to MAX_HISTORY
    await store.append<NotificationRecord>('notifications', record);
    await store.trim('notifications', MAX_HISTORY);

    return reply.status(200).send({
      status: record.status,
      channel,
      message: testMessage,
      ...(delivery.error ? { error: delivery.error } : {}),
    });
  });

  /**
   * GET /api/v1/notifications/history
   *
   * Return recent notification history (last 50 notifications).
   */
  app.get('/api/v1/notifications/history', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const recent = await store.recent<NotificationRecord>('notifications', MAX_HISTORY);
    return reply.status(200).send({
      data: recent,
      total: await store.count('notifications'),
      max_retained: MAX_HISTORY,
    });
  });

  /**
   * GET /api/v1/notifications
   *
   * Return list of notifications. Alias for /notifications/history
   * with a simplified response shape.
   */
  app.get('/api/v1/notifications', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const recent = await store.recent<NotificationRecord>('notifications', MAX_HISTORY);
    return reply.status(200).send({
      data: recent,
      total: await store.count('notifications'),
    });
  });

  /**
   * POST /api/v1/notifications/read-all
   *
   * Mark every notification as read. Returns the number updated.
   * Registered BEFORE the parametric `:id` route so it is not shadowed.
   */
  app.post('/api/v1/notifications/read-all', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const entries = await store.entries<NotificationRecord>('notifications');
    let updated = 0;
    for (const [key, record] of entries) {
      if (!record.read) {
        record.read = true;
        await store.set<NotificationRecord>('notifications', key, record);
        updated++;
      }
    }
    return reply.status(200).send({
      data: { updated },
      message: `Marked ${updated} notification(s) as read`,
    });
  });

  /**
   * GET /api/v1/notifications/:id
   *
   * Return a single notification. Matches either the store key or the
   * record's own `id` field.
   */
  app.get<{ Params: { id: string } }>('/api/v1/notifications/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const entries = await store.entries<NotificationRecord>('notifications');
    const match = entries.find(([key, record]) => key === id || record.id === id);

    if (!match) {
      return reply.status(404).send({
        error: 'Not Found',
        message: `Notification '${id}' not found`,
      });
    }

    return reply.status(200).send({ data: match[1] });
  });
}

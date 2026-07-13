/**
 * @module @recurrsive/server/routes/webhooks
 *
 * Webhook management and event notification routes.
 *
 * Provides endpoints for registering webhook URLs, listing
 * registered hooks, and testing connectivity. Webhooks are
 * triggered on key platform events (analysis complete, policy
 * violation, new opportunities).
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { createHmac, randomBytes } from 'node:crypto';
import { authMiddleware } from '../middleware/auth.js';
import { assertSafeOutboundUrl, validateOutboundUrl } from '../security/outbound-url.js';
import { store } from '../store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported webhook event types. */
export type WebhookEvent =
  | 'analysis.complete'
  | 'analysis.failed'
  | 'opportunity.created'
  | 'opportunity.updated'
  | 'policy.violation'
  | 'health.degraded'
  | 'snapshot.created';

/** A registered webhook configuration. */
export interface WebhookRegistration {
  /** Unique webhook ID. */
  id: string;
  /** Target URL to POST events to. */
  url: string;
  /** Events this webhook subscribes to. */
  events: WebhookEvent[];
  /** Whether the webhook is active. */
  active: boolean;
  /** Optional secret for HMAC signing. */
  secret?: string;
  /** ISO timestamp of creation. */
  created_at: string;
  /** ISO timestamp of last successful delivery. */
  last_delivery_at?: string;
  /** Total delivery count. */
  delivery_count: number;
  /** Count of failed deliveries. */
  failure_count: number;
}

/** Event payload for webhook delivery. */
export interface WebhookPayload {
  /** Event type that triggered the webhook. */
  event: WebhookEvent;
  /** ISO timestamp of the event. */
  timestamp: string;
  /** Event data payload. */
  data: Record<string, unknown>;
}

/** Result returned by {@link deliverWebhook}. */
export interface DeliveryResult {
  /** Whether the HTTP request succeeded (2xx status). */
  success: boolean;
  /** HTTP status code, or `undefined` when the request never completed. */
  status_code?: number;
  /** Wall-clock duration of the delivery attempt in milliseconds. */
  duration_ms: number;
  /** Error message when the delivery failed. */
  error?: string;
}

/** A single webhook delivery log entry. */
interface DeliveryLogEntry {
  webhook_id: string;
  event: WebhookEvent;
  timestamp: string;
  status: 'success' | 'failure';
  response_code?: number;
  /** Duration of the delivery attempt in milliseconds. */
  duration_ms?: number;
  /** Error message when the delivery failed. */
  error?: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Delivery timeout in milliseconds (configurable via env). */
const rawTimeout = Number(process.env['RECURRSIVE_WEBHOOK_TIMEOUT_MS']);
const WEBHOOK_TIMEOUT_MS = Number.isNaN(rawTimeout) || rawTimeout <= 0 ? 5000 : rawTimeout;

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

async function generateWebhookId(): Promise<string> {
  return `wh_${randomBytes(8).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// HTTP delivery
// ---------------------------------------------------------------------------

/**
 * Deliver a webhook payload via HTTP POST.
 *
 * - Signs the JSON body with HMAC-SHA256 when a `secret` is provided,
 *   adding an `X-Recurrsive-Signature` header (`sha256=<hex>`).
 * - Enforces a configurable timeout (default 5 000 ms) via
 *   `AbortController`.
 *
 * @param url     - Target URL to POST to.
 * @param secret  - Optional HMAC secret for payload signing.
 * @param payload - The webhook payload object.
 * @param timeoutMs - Request timeout in milliseconds.
 * @returns A {@link DeliveryResult} describing the outcome.
 */
export async function deliverWebhook(
  url: string,
  secret: string | undefined,
  payload: WebhookPayload,
  timeoutMs: number = WEBHOOK_TIMEOUT_MS,
): Promise<DeliveryResult> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'Recurrsive-Webhooks/1.0',
  };

  // HMAC-SHA256 signature
  if (secret) {
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-Recurrsive-Signature'] = `sha256=${signature}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = performance.now();

  try {
    await assertSafeOutboundUrl(url);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
      redirect: 'manual',
    });

    const duration_ms = Math.round(performance.now() - start);
    const success = response.status >= 200 && response.status < 300;

    return {
      success,
      status_code: response.status,
      duration_ms,
      ...(!success ? { error: `HTTP ${response.status} ${response.statusText}` } : {}),
    };
  } catch (err: unknown) {
    const duration_ms = Math.round(performance.now() - start);
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? `Request timed out after ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err);

    return { success: false, duration_ms, error: message };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Dispatch a webhook event to all active subscribers.
 *
 * Iterates over every registered webhook, checks if the event type
 * matches, and delivers the payload in parallel. Delivery results
 * are recorded in the `webhook_deliveries` store.
 *
 * @param event - The event type.
 * @param data  - Event-specific payload data.
 */
export async function dispatchWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const hooks = await store.all<WebhookRegistration>('webhooks');
  const active = hooks.filter((h) => h.active && h.events.includes(event));

  if (active.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };

  await Promise.allSettled(
    active.map(async (hook) => {
      const result = await deliverWebhook(hook.url, hook.secret, payload);

      // Update counters
      hook.delivery_count++;
      if (result.success) {
        hook.last_delivery_at = new Date().toISOString();
      } else {
        hook.failure_count++;
      }
      await store.set('webhooks', hook.id, hook);

      // Record delivery log
      const logEntry: DeliveryLogEntry = {
        webhook_id: hook.id,
        event,
        timestamp: new Date().toISOString(),
        status: result.success ? 'success' : 'failure',
        response_code: result.status_code,
        duration_ms: result.duration_ms,
        error: result.error,
      };
      await store.append('webhook_deliveries', logEntry);
    }),
  );
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register webhook management routes.
 *
 * @param app - Fastify instance.
 */
export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/webhooks
   *
   * List all registered webhooks.
   */
  app.get('/api/v1/webhooks', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const hooks = await store.all<WebhookRegistration>('webhooks');

    return reply.status(200).send({
      data: hooks.map((h) => ({
        ...h,
        secret: h.secret ? '***' : undefined, // never expose secrets
      })),
      total: hooks.length,
    });
  });

  /**
   * POST /api/v1/webhooks
   *
   * Register a new webhook.
   *
   * Body:
   * - url: string (required) — Target URL
   * - events: string[] (required) — Event types to subscribe to
   * - secret: string (optional) — HMAC secret for signing payloads
   */
  app.post<{
    Body: {
      url: string;
      events: WebhookEvent[];
      secret?: string;
    };
  }>('/api/v1/webhooks', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { url, events, secret } = request.body ?? {};

    if (!url || typeof url !== 'string') {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'url is required and must be a string.',
      });
    }

    // Validate URL format and block literal/private destinations. DNS is
    // checked again immediately before every delivery.
    try {
      validateOutboundUrl(url);
    } catch (error) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: error instanceof Error ? error.message : 'url is not a safe outbound destination.',
      });
    }

    if (!events || !Array.isArray(events) || events.length === 0) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'events is required and must be a non-empty array.',
      });
    }

    const validEvents: WebhookEvent[] = [
      'analysis.complete',
      'analysis.failed',
      'opportunity.created',
      'opportunity.updated',
      'policy.violation',
      'health.degraded',
      'snapshot.created',
    ];

    const invalidEvents = events.filter((e) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return reply.status(400).send({
        error: 'Invalid events',
        message: `Unknown event types: ${invalidEvents.join(', ')}`,
        valid_events: validEvents,
      });
    }

    const id = await generateWebhookId();
    const hook: WebhookRegistration = {
      id,
      url,
      events,
      active: true,
      secret,
      created_at: new Date().toISOString(),
      delivery_count: 0,
      failure_count: 0,
    };

    await store.set('webhooks', id, hook);

    return reply.status(201).send({
      data: {
        ...hook,
        secret: hook.secret ? '***' : undefined,
      },
    });
  });

  /**
   * DELETE /api/v1/webhooks/:id
   *
   * Remove a registered webhook.
   */
  app.delete<{ Params: { id: string } }>(
    '/api/v1/webhooks/:id',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params;

      if (!await store.has('webhooks', id)) {
        return reply.status(404).send({
          error: 'Not found',
          message: `Webhook ${id} not found.`,
        });
      }

      await store.delete('webhooks', id);

      return reply.status(200).send({
        data: { id, deleted: true },
      });
    },
  );

  /**
   * PATCH /api/v1/webhooks/:id
   *
   * Update a webhook (toggle active, change events, update URL).
   */
  app.patch<{
    Params: { id: string };
    Body: {
      active?: boolean;
      events?: WebhookEvent[];
      url?: string;
    };
  }>('/api/v1/webhooks/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const { id } = request.params;
    const hook = await store.get<WebhookRegistration>('webhooks', id);

    if (!hook) {
      return reply.status(404).send({
        error: 'Not found',
        message: `Webhook ${id} not found.`,
      });
    }

    const { active, events, url } = request.body ?? {};

    if (events) {
      const validEvents: WebhookEvent[] = ['analysis.complete', 'analysis.failed', 'opportunity.created', 'opportunity.updated', 'policy.violation', 'health.degraded', 'snapshot.created'];
      const invalidEvents = events.filter((e: string) => !validEvents.includes(e as WebhookEvent));
      if (invalidEvents.length > 0) {
        return reply.status(400).send({
          error: 'Invalid events',
          message: `Unknown event types: ${invalidEvents.join(', ')}`,
          valid_events: validEvents,
        });
      }
    }

    if (url !== undefined) {
      try {
        validateOutboundUrl(url);
      } catch (error) {
        return reply.status(400).send({
          error: 'Invalid request',
          message: error instanceof Error ? error.message : 'url is not a safe outbound destination.',
        });
      }
    }

    if (active !== undefined) hook.active = active;
    if (events !== undefined) hook.events = events;
    if (url !== undefined) hook.url = url;

    await store.set('webhooks', id, hook);

    return reply.status(200).send({
      data: {
        ...hook,
        secret: hook.secret ? '***' : undefined,
      },
    });
  });

  /**
   * POST /api/v1/webhooks/:id/test
   *
   * Send a test event to a registered webhook.
   */
  app.post<{ Params: { id: string } }>(
    '/api/v1/webhooks/:id/test',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params;
      const hook = await store.get<WebhookRegistration>('webhooks', id);

      if (!hook) {
        return reply.status(404).send({
          error: 'Not found',
          message: `Webhook ${id} not found.`,
        });
      }

      const testPayload: WebhookPayload = {
        event: 'analysis.complete',
        timestamp: new Date().toISOString(),
        data: {
          test: true,
          webhook_id: id,
          message: 'This is a test delivery from Recurrsive.',
        },
      };

      // Actually deliver the payload over HTTP
      const result = await deliverWebhook(hook.url, hook.secret, testPayload);

      // Update webhook counters
      hook.delivery_count++;
      if (result.success) {
        hook.last_delivery_at = new Date().toISOString();
      } else {
        hook.failure_count++;
      }
      await store.set('webhooks', id, hook);

      // Record delivery log
      const logEntry: DeliveryLogEntry = {
        webhook_id: id,
        event: 'analysis.complete',
        timestamp: new Date().toISOString(),
        status: result.success ? 'success' : 'failure',
        response_code: result.status_code,
        duration_ms: result.duration_ms,
        error: result.error,
      };
      await store.append('webhook_deliveries', logEntry);

      return reply.status(200).send({
        data: {
          delivered: result.success,
          webhook_id: id,
          payload: testPayload,
          delivery: result,
        },
      });
    },
  );

  /**
   * GET /api/v1/webhooks/:id/deliveries
   *
   * Get delivery history for a specific webhook.
   */
  app.get<{ Params: { id: string } }>(
    '/api/v1/webhooks/:id/deliveries',
    { preHandler: [authMiddleware] },
    async (request, reply) => {
      const { id } = request.params;

      if (!await store.has('webhooks', id)) {
        return reply.status(404).send({
          error: 'Not found',
          message: `Webhook ${id} not found.`,
        });
      }

      const allDeliveries = await store.all<DeliveryLogEntry>('webhook_deliveries');
      const history = allDeliveries.filter((d) => d.webhook_id === id);

      return reply.status(200).send({
        data: history,
        total: history.length,
      });
    },
  );

  /**
   * GET /api/v1/webhooks/events
   *
   * List all supported webhook event types.
   */
  app.get('/api/v1/webhooks/events', { preHandler: [authMiddleware] }, async (_request, reply) => {
    return reply.status(200).send({
      data: [
        { event: 'analysis.complete', description: 'Triggered when an analysis run completes successfully' },
        { event: 'analysis.failed', description: 'Triggered when an analysis run fails' },
        { event: 'opportunity.created', description: 'Triggered when a new opportunity is identified' },
        { event: 'opportunity.updated', description: 'Triggered when an opportunity status changes' },
        { event: 'policy.violation', description: 'Triggered when a policy check finds a violation' },
        { event: 'health.degraded', description: 'Triggered when the project health score drops below threshold' },
        { event: 'snapshot.created', description: 'Triggered when a new knowledge graph snapshot is saved' },
      ],
    });
  });
}

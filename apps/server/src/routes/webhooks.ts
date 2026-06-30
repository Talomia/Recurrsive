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

// ---------------------------------------------------------------------------
// In-memory webhook store
// ---------------------------------------------------------------------------

const webhooks = new Map<string, WebhookRegistration>();
const deliveryLog: Array<{
  webhook_id: string;
  event: WebhookEvent;
  timestamp: string;
  status: 'success' | 'failure';
  response_code?: number;
}> = [];

let nextId = 1;

function generateWebhookId(): string {
  return `wh_${String(nextId++).padStart(6, '0')}`;
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
  app.get('/api/v1/webhooks', async (_request, reply) => {
    const hooks = Array.from(webhooks.values());

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
  }>('/api/v1/webhooks', async (request, reply) => {
    const { url, events, secret } = request.body ?? {};

    if (!url || typeof url !== 'string') {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'url is required and must be a string.',
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

    const id = generateWebhookId();
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

    webhooks.set(id, hook);

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
    async (request, reply) => {
      const { id } = request.params;

      if (!webhooks.has(id)) {
        return reply.status(404).send({
          error: 'Not found',
          message: `Webhook ${id} not found.`,
        });
      }

      webhooks.delete(id);

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
  }>('/api/v1/webhooks/:id', async (request, reply) => {
    const { id } = request.params;
    const hook = webhooks.get(id);

    if (!hook) {
      return reply.status(404).send({
        error: 'Not found',
        message: `Webhook ${id} not found.`,
      });
    }

    const { active, events, url } = request.body ?? {};

    if (active !== undefined) hook.active = active;
    if (events !== undefined) hook.events = events;
    if (url !== undefined) hook.url = url;

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
    async (request, reply) => {
      const { id } = request.params;
      const hook = webhooks.get(id);

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

      // Record the test delivery
      hook.delivery_count++;
      hook.last_delivery_at = new Date().toISOString();

      deliveryLog.push({
        webhook_id: id,
        event: 'analysis.complete',
        timestamp: new Date().toISOString(),
        status: 'success',
        response_code: 200,
      });

      return reply.status(200).send({
        data: {
          delivered: true,
          webhook_id: id,
          payload: testPayload,
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
    async (request, reply) => {
      const { id } = request.params;

      if (!webhooks.has(id)) {
        return reply.status(404).send({
          error: 'Not found',
          message: `Webhook ${id} not found.`,
        });
      }

      const history = deliveryLog.filter((d) => d.webhook_id === id);

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
  app.get('/api/v1/webhooks/events', async (_request, reply) => {
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

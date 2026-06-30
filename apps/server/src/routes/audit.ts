/**
 * @module @recurrsive/server/routes/audit
 *
 * Audit trail routes for recording and querying system events.
 *
 * Uses in-memory storage — audit events are not persisted across
 * server restarts. Pre-populated with mock events on module load.
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Audit event types. */
export type AuditEventType =
  | 'analysis'
  | 'webhook'
  | 'config'
  | 'notification'
  | 'batch'
  | 'policy';

/** Audit event actions. */
export type AuditAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'executed'
  | 'tested'
  | 'configured';

/** A single audit trail event. */
export interface AuditEvent {
  /** Unique event ID. */
  id: string;
  /** Event category. */
  type: AuditEventType;
  /** What happened. */
  action: AuditAction;
  /** Who performed the action. */
  actor: string;
  /** What was acted upon. */
  target: string;
  /** Additional context. */
  details: string;
  /** ISO timestamp. */
  timestamp: string;
  /** Source IP address. */
  ip: string;
}

// ---------------------------------------------------------------------------
// In-memory audit store
// ---------------------------------------------------------------------------

const MAX_EVENTS = 100;
const auditEvents: AuditEvent[] = [];
let nextId = 1;

function generateAuditId(): string {
  return `audit_${String(nextId++).padStart(6, '0')}`;
}

// ---------------------------------------------------------------------------
// Pre-populate with mock events
// ---------------------------------------------------------------------------

const SEED_EVENTS: Omit<AuditEvent, 'id'>[] = [
  {
    type: 'analysis',
    action: 'executed',
    actor: 'system',
    target: '/home/user/projects/api-gateway',
    details: 'Full analysis run completed with 47 findings and 23 opportunities.',
    timestamp: '2026-06-30T10:02:34Z',
    ip: '127.0.0.1',
  },
  {
    type: 'webhook',
    action: 'created',
    actor: 'admin@example.com',
    target: 'wh_000001',
    details: 'Registered webhook for analysis.complete and policy.violation events.',
    timestamp: '2026-06-30T09:15:00Z',
    ip: '192.168.1.42',
  },
  {
    type: 'config',
    action: 'updated',
    actor: 'admin@example.com',
    target: 'analysis.include_reasoning',
    details: 'Changed include_reasoning from false to true.',
    timestamp: '2026-06-29T16:30:00Z',
    ip: '192.168.1.42',
  },
  {
    type: 'notification',
    action: 'tested',
    actor: 'admin@example.com',
    target: 'slack',
    details: 'Sent test notification to Slack channel #engineering-alerts.',
    timestamp: '2026-06-29T14:00:00Z',
    ip: '192.168.1.42',
  },
  {
    type: 'policy',
    action: 'configured',
    actor: 'admin@example.com',
    target: 'builtin-security',
    details: 'Enabled Security Policies policy set with 2 rules.',
    timestamp: '2026-06-29T11:20:00Z',
    ip: '192.168.1.42',
  },
  {
    type: 'batch',
    action: 'executed',
    actor: 'ci-pipeline',
    target: 'batch_000002',
    details: 'Batch analysis of 3 projects completed. 2 succeeded, 1 failed.',
    timestamp: '2026-06-28T10:08:00Z',
    ip: '10.0.0.5',
  },
  {
    type: 'analysis',
    action: 'executed',
    actor: 'system',
    target: '/home/user/projects/web-client',
    details: 'Analysis run completed with 51 findings and 25 opportunities.',
    timestamp: '2026-06-28T14:32:12Z',
    ip: '127.0.0.1',
  },
  {
    type: 'webhook',
    action: 'deleted',
    actor: 'admin@example.com',
    target: 'wh_000004',
    details: 'Removed inactive webhook endpoint https://old.example.com/hooks.',
    timestamp: '2026-06-27T09:00:00Z',
    ip: '192.168.1.42',
  },
  {
    type: 'config',
    action: 'updated',
    actor: 'admin@example.com',
    target: 'notification.slack_webhook_url',
    details: 'Updated Slack webhook URL configuration.',
    timestamp: '2026-06-26T15:45:00Z',
    ip: '192.168.1.42',
  },
  {
    type: 'policy',
    action: 'created',
    actor: 'admin@example.com',
    target: 'custom-cost-gates',
    details: 'Created custom policy set "Cost Gates" with 3 rules for budget enforcement.',
    timestamp: '2026-06-25T10:30:00Z',
    ip: '192.168.1.42',
  },
];

// Pre-populate on module load
for (const seed of SEED_EVENTS) {
  auditEvents.push({ id: generateAuditId(), ...seed });
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

/**
 * Register audit trail routes.
 *
 * @param app - Fastify instance.
 */
export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  /**
   * GET /api/v1/audit
   *
   * Return audit trail events (in-memory store, last 100).
   *
   * Query params:
   * - limit: number of events to return (default 20)
   * - type: filter by event type (analysis|webhook|config|notification|batch|policy)
   */
  app.get<{
    Querystring: { limit?: string; type?: string };
  }>('/api/v1/audit', async (request, reply) => {
    const limit = Math.min(
      Math.max(parseInt(request.query.limit ?? '20', 10) || 20, 1),
      100,
    );
    const typeFilter = request.query.type as AuditEventType | undefined;

    let filtered = [...auditEvents].reverse();

    if (typeFilter) {
      const validTypes: AuditEventType[] = [
        'analysis', 'webhook', 'config', 'notification', 'batch', 'policy',
      ];
      if (validTypes.includes(typeFilter)) {
        filtered = filtered.filter((e) => e.type === typeFilter);
      }
    }

    const data = filtered.slice(0, limit);

    return reply.status(200).send({
      data,
      total: filtered.length,
    });
  });

  /**
   * POST /api/v1/audit
   *
   * Record a new audit event (internal use).
   *
   * Body:
   * - type: AuditEventType (required)
   * - action: AuditAction (required)
   * - target: string (required)
   * - details: string (optional)
   */
  app.post<{
    Body: {
      type: AuditEventType;
      action: AuditAction;
      target: string;
      details?: string;
    };
  }>('/api/v1/audit', async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'Request body must be a JSON object.',
      });
    }

    const type = body['type'] as string | undefined;
    const action = body['action'] as string | undefined;
    const target = body['target'] as string | undefined;

    if (!type || !action || !target) {
      return reply.status(400).send({
        error: 'Invalid request',
        message: 'type, action, and target are required fields.',
      });
    }

    const validTypes: AuditEventType[] = [
      'analysis', 'webhook', 'config', 'notification', 'batch', 'policy',
    ];
    const validActions: AuditAction[] = [
      'created', 'updated', 'deleted', 'executed', 'tested', 'configured',
    ];

    if (!validTypes.includes(type as AuditEventType)) {
      return reply.status(400).send({
        error: 'Invalid type',
        message: `Unknown type: ${type}. Valid types: ${validTypes.join(', ')}`,
      });
    }

    if (!validActions.includes(action as AuditAction)) {
      return reply.status(400).send({
        error: 'Invalid action',
        message: `Unknown action: ${action}. Valid actions: ${validActions.join(', ')}`,
      });
    }

    const event: AuditEvent = {
      id: generateAuditId(),
      type: type as AuditEventType,
      action: action as AuditAction,
      actor: 'api',
      target,
      details: (body['details'] as string) ?? '',
      timestamp: new Date().toISOString(),
      ip: request.ip,
    };

    auditEvents.push(event);

    // Cap at MAX_EVENTS
    if (auditEvents.length > MAX_EVENTS) {
      auditEvents.splice(0, auditEvents.length - MAX_EVENTS);
    }

    return reply.status(201).send({ data: event });
  });
}

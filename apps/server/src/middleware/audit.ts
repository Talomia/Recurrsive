/**
 * @module @recurrsive/server/middleware/audit
 *
 * Audit logging middleware for the Recurrsive API server.
 *
 * Registers a Fastify `onResponse` hook that captures request metadata,
 * authenticated user info, action classification, and timing for every
 * request. Events are stored through the configured durable application store.
 *
 * @packageDocumentation
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { createLogger, nowISO, generateId } from '@recurrsive/core';
import type { AuthUser } from './auth.js';
import { store } from '../store.js';

const logger = createLogger({ context: { component: 'server:middleware:audit' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Classified action derived from the HTTP method and URL. */
export type AuditAction = 'read' | 'write' | 'delete' | 'auth' | 'admin';

/** A single audit log event. */
export interface AuditEvent {
  /** Unique event identifier. */
  id: string;
  /** ISO-8601 timestamp of when the request completed. */
  timestamp: string;
  /** Authenticated user ID, if present. */
  userId?: string;
  /** Authenticated username (derived from userId), if present. */
  username?: string;
  /** Authenticated user role, if present. */
  role?: string;
  /** HTTP method (GET, POST, PUT, PATCH, DELETE). */
  method: string;
  /** Request URL path. */
  url: string;
  /** HTTP response status code. */
  statusCode: number;
  /** Classified action. */
  action: AuditAction;
  /** Request duration in milliseconds. */
  duration_ms: number;
  /** Client IP address. */
  ip: string;
  /** Client User-Agent header. */
  userAgent: string;
  /** Extracted resource type from the URL, if applicable. */
  resourceType?: string;
  /** Extracted resource ID from the URL, if applicable. */
  resourceId?: string;
}

/** Filter options for querying audit events. */
export interface AuditEventFilter {
  /** Filter by action type. */
  action?: AuditAction;
  /** Filter by user ID. */
  userId?: string;
  /** Filter by HTTP method. */
  method?: string;
  /** Filter by status group ('2xx', '4xx', '5xx'). */
  status?: string;
  /** Filter events after this ISO timestamp (inclusive). */
  from?: string;
  /** Filter events before this ISO timestamp (inclusive). */
  to?: string;
  /** Maximum number of events to return (default 100, max 1000). */
  limit?: number;
  /** Offset for pagination (default 0). */
  offset?: number;
}

/** Aggregated audit statistics. */
export interface AuditStats {
  /** Total number of audit events in the buffer. */
  total: number;
  /** Event count grouped by action. */
  byAction: Record<string, number>;
  /** Event count grouped by user ID. */
  byUser: Record<string, number>;
  /** Event count grouped by status code group. */
  byStatusGroup: Record<string, number>;
  /** Last 10 error events (4xx/5xx). */
  recentErrors: AuditEvent[];
}

// ---------------------------------------------------------------------------
// In-memory circular buffer
// ---------------------------------------------------------------------------

const MAX_EVENTS = 1000;

/** Debounce trim — only run trim every N events instead of on every request. */
const TRIM_INTERVAL = 50;
let _auditEventsSinceLastTrim = 0;
const AUDIT_TABLE = 'audit_events';

// ---------------------------------------------------------------------------
// Action classification
// ---------------------------------------------------------------------------

/**
 * Classify an HTTP request into an audit action category.
 *
 * Classification rules (evaluated in order):
 * 1. Admin URL patterns → `'admin'`
 * 2. Auth URL patterns (`/api/v1/auth/*`) → `'auth'`
 * 3. `DELETE` method → `'delete'`
 * 4. `GET` / `HEAD` / `OPTIONS` methods → `'read'`
 * 5. `POST` / `PUT` / `PATCH` → `'write'`
 * 6. Fallback → `'read'`
 *
 * @param method - HTTP method.
 * @param url - Request URL path.
 * @returns The classified {@link AuditAction}.
 */
export function classifyAction(method: string, url: string): AuditAction {
  const upperMethod = method.toUpperCase();
  const normalizedUrl = url.split('?')[0] ?? url;

  // Admin patterns: URLs containing /admin/ or certain admin-specific endpoints
  if (/\/api\/v1\/admin(\/|$)/i.test(normalizedUrl)) {
    return 'admin';
  }

  // Auth patterns
  if (/\/api\/v1\/auth(\/|$)/i.test(normalizedUrl)) {
    return 'auth';
  }

  // DELETE is always 'delete'
  if (upperMethod === 'DELETE') {
    return 'delete';
  }

  // Read operations
  if (upperMethod === 'GET' || upperMethod === 'HEAD' || upperMethod === 'OPTIONS') {
    return 'read';
  }

  // Write operations
  if (upperMethod === 'POST' || upperMethod === 'PUT' || upperMethod === 'PATCH') {
    return 'write';
  }

  return 'read';
}

// ---------------------------------------------------------------------------
// Resource extraction
// ---------------------------------------------------------------------------

/**
 * Known resource type mappings from URL path segments to friendly names.
 */
const RESOURCE_MAP: Record<string, string> = {
  opportunities: 'opportunity',
  findings: 'finding',
  reports: 'report',
  snapshots: 'snapshot',
  policies: 'policy',
  webhooks: 'webhook',
  experiments: 'experiment',
  'api-keys': 'api-key',
  audit: 'audit',
};

/**
 * Extract the resource type and ID from a URL path.
 *
 * Matches patterns like `/api/v1/<resource>/<id>` and resolves
 * the resource segment to a friendly singular name.
 *
 * @param url - Request URL path.
 * @returns An object with optional `resourceType` and `resourceId`.
 */
export function extractResource(url: string): { resourceType?: string; resourceId?: string } {
  const cleanUrl = url.split('?')[0] ?? url;
  const match = cleanUrl.match(/\/api\/v1\/([\w-]+)(?:\/([\w-]+))?/);

  if (!match) {
    return {};
  }

  const segment = match[1]!;
  const id = match[2];

  const resourceType = RESOURCE_MAP[segment] ?? segment;

  return {
    resourceType,
    resourceId: id,
  };
}

// ---------------------------------------------------------------------------
// Audit middleware (Fastify onResponse hook)
// ---------------------------------------------------------------------------

/**
 * Register the audit logging `onResponse` hook on a Fastify instance.
 *
 * For every completed request, captures method, URL, status code,
 * user info (from auth middleware), timing, IP, User-Agent, and
 * classified action. The event is pushed into a circular buffer
 * (capped at {@link MAX_EVENTS}).
 *
 * @param app - Fastify instance to hook into.
 *
 * @example
 * ```ts
 * import { registerAuditMiddleware } from './middleware/audit.js';
 *
 * const app = Fastify();
 * registerAuditMiddleware(app);
 * ```
 */
export function registerAuditMiddleware(app: FastifyInstance): void {
  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as FastifyRequest & { user?: AuthUser }).user;

    const { resourceType, resourceId } = extractResource(request.url);

    const event: AuditEvent = {
      id: generateId(),
      timestamp: nowISO(),
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      action: classifyAction(request.method, request.url),
      duration_ms: Math.round(reply.elapsedTime),
      ip: request.ip ?? 'unknown',
      userAgent: (request.headers['user-agent'] as string) ?? '',
      resourceType,
      resourceId,
    };

    if (user) {
      event.userId = user.id;
      event.username = user.username ?? user.id;
      event.role = user.role;
    }

    await store.set(AUDIT_TABLE, event.id, event);

    // Debounce trim — only enforce event limit every TRIM_INTERVAL events
    _auditEventsSinceLastTrim++;
    if (_auditEventsSinceLastTrim >= TRIM_INTERVAL) {
      _auditEventsSinceLastTrim = 0;
      await store.trim(AUDIT_TABLE, MAX_EVENTS);
    }

    logger.debug(
      `Audit: ${event.method} ${event.url} → ${event.statusCode} ` +
      `(${event.duration_ms}ms, action=${event.action}` +
      `${event.userId ? `, user=${event.userId}` : ''})`,
    );
  });
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/**
 * Compute the status group string ('2xx', '3xx', '4xx', '5xx') for a
 * given HTTP status code.
 *
 * @param statusCode - HTTP status code.
 * @returns Status group string.
 */
function statusGroup(statusCode: number): string {
  const group = Math.floor(statusCode / 100);
  return `${group}xx`;
}

/**
 * Retrieve audit events, optionally filtered.
 *
 * Events are returned in reverse chronological order (newest first).
 *
 * @param filters - Optional filter criteria.
 * @returns A filtered and paginated array of {@link AuditEvent} objects,
 *          plus the total count of matching events.
 */
export async function getAuditEvents(filters?: AuditEventFilter): Promise<{
  events: AuditEvent[];
  total: number;
}> {
  // Load events from store (newest first via recent)
  let events = await store.recent<AuditEvent>(AUDIT_TABLE, MAX_EVENTS);

  if (filters?.action) {
    events = events.filter((e) => e.action === filters.action);
  }

  if (filters?.userId) {
    events = events.filter((e) => e.userId === filters.userId);
  }

  if (filters?.method) {
    events = events.filter((e) => e.method.toUpperCase() === filters.method!.toUpperCase());
  }

  if (filters?.status) {
    events = events.filter((e) => statusGroup(e.statusCode) === filters.status);
  }

  if (filters?.from) {
    const from = filters.from;
    events = events.filter((e) => e.timestamp >= from);
  }

  if (filters?.to) {
    const to = filters.to;
    events = events.filter((e) => e.timestamp <= to);
  }

  const total = events.length;

  const offset = filters?.offset ?? 0;
  const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 1000);

  events = events.slice(offset, offset + limit);

  return { events, total };
}

/**
 * Compute aggregated audit statistics.
 *
 * @returns An {@link AuditStats} object with totals, breakdowns, and recent errors.
 */
export async function getAuditStats(): Promise<AuditStats> {
  const byAction: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  const byStatusGroup: Record<string, number> = {};
  const errors: AuditEvent[] = [];

  const allEvents = await store.all<AuditEvent>(AUDIT_TABLE);

  for (const event of allEvents) {
    // By action
    byAction[event.action] = (byAction[event.action] ?? 0) + 1;

    // By user
    const userKey = event.userId ?? 'anonymous';
    byUser[userKey] = (byUser[userKey] ?? 0) + 1;

    // By status group
    const group = statusGroup(event.statusCode);
    byStatusGroup[group] = (byStatusGroup[group] ?? 0) + 1;

    // Collect errors
    if (event.statusCode >= 400) {
      errors.push(event);
    }
  }

  return {
    total: allEvents.length,
    byAction,
    byUser,
    byStatusGroup,
    recentErrors: errors.slice(-10).reverse(),
  };
}

/**
 * Clear all audit events from the buffer.
 *
 * Primarily intended for test cleanup.
 */
export async function clearAuditEvents(): Promise<void> {
  await store.clear(AUDIT_TABLE);
}

/**
 * Get a read-only reference to the raw audit buffer.
 *
 * @returns The internal audit buffer array (read-only).
 */
export async function getAuditBuffer(): Promise<readonly AuditEvent[]> {
  return await store.all<AuditEvent>(AUDIT_TABLE);
}

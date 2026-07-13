/**
 * @module Governance API
 *
 * Policies, webhooks, notifications, and audit trail.
 */

import { ApiError, apiFetch } from './client';

// ─── Policy Types ────────────────────────────────────────────────────────────

export interface PolicyRule {
  id: string;
  name: string;
  description?: string;
  scope: string;
  action: string;
  condition: string;
}

export interface PolicySet {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rule_count: number;
  rules: PolicyRule[];
}

export interface ComplianceReport {
  total_opportunities: number;
  compliant: number;
  blocked: number;
  compliance_rate: number;
  policy_sets_active: number;
}

export interface PolicyDetailViolation {
  id: string;
  rule_id: string;
  rule_name: string;
  opportunity_id: string;
  opportunity_title: string;
  detected_at: string;
  status: "active" | "resolved" | "waived";
}

export interface PolicyDetail {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: string;
  category: string;
  scope: string;
  rules: PolicyRule[];
  config: Record<string, unknown>;
  violations: PolicyDetailViolation[];
  created_at: string;
  updated_at: string;
}

// ─── Webhook Types ───────────────────────────────────────────────────────────

export interface WebhookRegistration {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
  delivery_count: number;
  failure_count: number;
}

export interface WebhookEvent {
  type: string;
  description: string;
}

// ─── Notification Types ──────────────────────────────────────────────────────

export interface NotificationChannel {
  type: string;
  name: string;
  enabled: boolean;
  description: string;
}

export interface NotificationEntry {
  id: string;
  channel: string;
  title: string;
  severity: string;
  sent_at: string;
  status: "delivered" | "failed";
}

export interface NotificationRelatedItem {
  type: "finding" | "policy" | "opportunity";
  id: string;
  title: string;
}

export interface NotificationDetail {
  id: string;
  title: string;
  type: "info" | "warning" | "error" | "success";
  severity: string;
  source: string;
  timestamp: string;
  message: string;
  read: boolean;
  dismissed: boolean;
  related_items: NotificationRelatedItem[];
}

// ─── Audit Trail Types ───────────────────────────────────────────────────────

export type AuditEventType =
  | "analysis"
  | "webhook"
  | "config"
  | "notification"
  | "batch"
  | "policy";

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "executed"
  | "tested"
  | "configured";

export interface AuditEvent {
  id: string;
  type: AuditEventType;
  action: AuditAction;
  actor: string;
  target: string;
  details: string;
  timestamp: string;
  ip: string;
}

// ─── Policies API ────────────────────────────────────────────────────────────

export async function getPolicies(): Promise<PolicySet[]> {
  return apiFetch<PolicySet[]>("/api/v1/policies");
}

export async function getComplianceReport(): Promise<ComplianceReport> {
  return apiFetch<ComplianceReport>("/api/v1/policies/compliance");
}

export async function getPolicy(id: string): Promise<PolicyDetail | null> {
  try {
    return await apiFetch<PolicyDetail>(`/api/v1/policies/${encodeURIComponent(id)}`);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return null;
    throw caught;
  }
}

// ─── Webhooks API ────────────────────────────────────────────────────────────

export async function getWebhooks(): Promise<WebhookRegistration[]> {
  return apiFetch<WebhookRegistration[]>("/api/v1/webhooks");
}

export async function getWebhookEvents(): Promise<WebhookEvent[]> {
  return apiFetch<WebhookEvent[]>("/api/v1/webhooks/events");
}

export async function createWebhook(data: { url: string; events: string[]; secret?: string }): Promise<WebhookRegistration> {
  return await apiFetch<WebhookRegistration>("/api/v1/webhooks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteWebhook(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/webhooks/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export async function testWebhook(id: string): Promise<{ delivered: boolean; webhook_id: string }> {
  return await apiFetch<{ delivered: boolean; webhook_id: string }>(`/api/v1/webhooks/${encodeURIComponent(id)}/test`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ─── Notifications API ───────────────────────────────────────────────────────

export async function getNotificationChannels(): Promise<NotificationChannel[]> {
  return apiFetch<NotificationChannel[]>("/api/v1/notifications/channels");
}

export async function getNotificationHistory(): Promise<NotificationEntry[]> {
  return apiFetch<NotificationEntry[]>("/api/v1/notifications/history");
}

export async function getNotification(id: string): Promise<NotificationDetail | null> {
  try {
    return await apiFetch<NotificationDetail>(`/api/v1/notifications/${encodeURIComponent(id)}`);
  } catch (caught) {
    if (caught instanceof ApiError && caught.status === 404) return null;
    throw caught;
  }
}

export async function testNotificationChannel(channel: string): Promise<{ status: string; channel: string; message: string }> {
  return await apiFetch<{ status: string; channel: string; message: string }>('/api/v1/notifications/test', {
    method: 'POST',
    body: JSON.stringify({ channel }),
    unwrap: false,
  });
}

// ─── Audit Trail API ─────────────────────────────────────────────────────────

/** Server-side audit event shape (auto-captured HTTP request logs). */
interface ServerAuditEvent {
  id: string;
  timestamp: string;
  userId?: string;
  username?: string;
  role?: string;
  method: string;
  url: string;
  statusCode: number;
  action: string;        // 'read' | 'write' | 'delete' | 'auth' | 'admin'
  duration_ms: number;
  ip: string;
  userAgent: string;
  resourceType?: string;
  resourceId?: string;
}

/** Map server action values to dashboard AuditEventType. */
const ACTION_TO_TYPE: Record<string, AuditEventType> = {
  read: 'analysis',
  write: 'config',
  delete: 'config',
  auth: 'notification',
  admin: 'policy',
};

/** Map server action values to dashboard AuditAction. */
const ACTION_TO_DASHBOARD: Record<string, AuditAction> = {
  read: 'executed',
  write: 'updated',
  delete: 'deleted',
  auth: 'executed',
  admin: 'configured',
};

export async function getAuditLog(type?: AuditEventType): Promise<AuditEvent[]> {
  const query = new URLSearchParams();
    query.set("limit", "50");
    // Server uses 'action' filter, not 'type'.
    // Map dashboard AuditEventType → server action values.
    if (type) {
      const typeToAction: Record<string, string> = {
        analysis: 'read',
        config: 'write',
        webhook: 'write',
        notification: 'auth',
        batch: 'admin',
        policy: 'admin',
      };
      const action = typeToAction[type];
      if (action) query.set("action", action);
    }

    const res = await apiFetch<{ data: ServerAuditEvent[]; total: number }>(
      `/api/v1/audit?${query.toString()}`,
      { unwrap: false },
    );
    const events = res.data ?? [];
  return events.map((e) => ({
      id: e.id,
      type: (ACTION_TO_TYPE[e.action] ?? 'config') as AuditEventType,
      action: (ACTION_TO_DASHBOARD[e.action] ?? 'executed') as AuditAction,
      actor: e.username ?? e.userId ?? 'system',
      target: e.resourceType
        ? `${e.resourceType}${e.resourceId ? `/${e.resourceId}` : ''}`
        : e.url,
      details: `${e.method} ${e.url} → ${e.statusCode} (${e.duration_ms}ms)`,
      timestamp: e.timestamp,
      ip: e.ip,
  }));
}

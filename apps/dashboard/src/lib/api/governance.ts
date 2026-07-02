/**
 * @module Governance API
 *
 * Policies, webhooks, notifications, and audit trail.
 */

import { apiFetch } from './client';

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

// ─── Policy Mock Data ────────────────────────────────────────────────────────

const MOCK_POLICIES: PolicySet[] = [
  {
    id: "builtin-quality-gates",
    name: "Quality Gates",
    description: "Enforce minimum quality standards for all opportunities before implementation.",
    enabled: true,
    rule_count: 3,
    rules: [
      { id: "qg-min-confidence", name: "Minimum Confidence", scope: "opportunity", action: "block", condition: "confidence >= 60" },
      { id: "qg-min-impact", name: "Minimum Impact", scope: "opportunity", action: "warn", condition: "impact >= 40" },
      { id: "qg-evidence-required", name: "Evidence Required", scope: "opportunity", action: "block", condition: "evidence.length >= 1" },
    ],
  },
  {
    id: "builtin-risk-management",
    name: "Risk Management",
    description: "Prevent high-risk changes from being auto-approved without human review.",
    enabled: true,
    rule_count: 2,
    rules: [
      { id: "rm-high-risk", name: "High Risk Review", scope: "opportunity", action: "require_approval", condition: "risk_level != 'high' OR has_approval" },
      { id: "rm-critical-severity", name: "Critical Severity Gate", scope: "opportunity", action: "require_approval", condition: "severity != 'critical' OR has_approval" },
    ],
  },
  {
    id: "builtin-security",
    name: "Security Policies",
    description: "Ensure security-related findings are prioritized and reviewed by security team.",
    enabled: true,
    rule_count: 2,
    rules: [
      { id: "sec-review", name: "Security Review Required", scope: "opportunity", action: "require_approval", condition: "category != 'Security' OR security_reviewed" },
      { id: "sec-min-score", name: "Security Minimum Score", scope: "opportunity", action: "block", condition: "category != 'Security' OR score >= 70" },
    ],
  },
];

const MOCK_COMPLIANCE: ComplianceReport = {
  total_opportunities: 23,
  compliant: 19,
  blocked: 2,
  compliance_rate: 83,
  policy_sets_active: 3,
};

const MOCK_POLICY_DETAILS: Record<string, PolicyDetail> = {
  "builtin-quality-gates": {
    id: "builtin-quality-gates",
    name: "Quality Gates",
    description: "Enforce minimum quality standards for all opportunities before implementation. Ensures that low-confidence or low-impact opportunities are flagged for review.",
    enabled: true,
    severity: "high",
    category: "Quality",
    scope: "opportunity",
    rules: [
      { id: "qg-min-confidence", name: "Minimum Confidence", scope: "opportunity", action: "block", condition: "confidence >= 60", description: "Block opportunities with confidence below 60%" },
      { id: "qg-min-impact", name: "Minimum Impact", scope: "opportunity", action: "warn", condition: "impact >= 40", description: "Warn on opportunities with impact below 40%" },
      { id: "qg-evidence-required", name: "Evidence Required", scope: "opportunity", action: "block", condition: "evidence.length >= 1", description: "Require at least one piece of evidence" },
    ],
    config: { min_confidence: 60, min_impact: 40, require_evidence: true, auto_suppress_low_confidence: false },
    violations: [
      { id: "viol-001", rule_id: "qg-min-confidence", rule_name: "Minimum Confidence", opportunity_id: "OPP-2850", opportunity_title: "Refactor utility functions", detected_at: "2026-06-30T08:00:00Z", status: "active" },
      { id: "viol-002", rule_id: "qg-evidence-required", rule_name: "Evidence Required", opportunity_id: "OPP-2848", opportunity_title: "Update logging framework", detected_at: "2026-06-29T12:00:00Z", status: "resolved" },
    ],
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-28T10:00:00Z",
  },
  "builtin-risk-management": {
    id: "builtin-risk-management",
    name: "Risk Management",
    description: "Prevent high-risk changes from being auto-approved without human review. Critical for maintaining system stability.",
    enabled: true,
    severity: "critical",
    category: "Governance",
    scope: "opportunity",
    rules: [
      { id: "rm-high-risk", name: "High Risk Review", scope: "opportunity", action: "require_approval", condition: "risk_level != 'high' OR has_approval", description: "Require approval for high-risk changes" },
      { id: "rm-critical-severity", name: "Critical Severity Gate", scope: "opportunity", action: "require_approval", condition: "severity != 'critical' OR has_approval", description: "Require approval for critical severity items" },
    ],
    config: { auto_approve_low_risk: true, approval_timeout_hours: 72, escalation_enabled: true },
    violations: [
      { id: "viol-003", rule_id: "rm-high-risk", rule_name: "High Risk Review", opportunity_id: "OPP-2847", opportunity_title: "Migrate legacy authentication to OAuth 2.1 PKCE flow", detected_at: "2026-06-28T14:30:00Z", status: "active" },
    ],
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-29T16:00:00Z",
  },
  "builtin-security": {
    id: "builtin-security",
    name: "Security Policies",
    description: "Ensure security-related findings are prioritized and reviewed by security team before implementation.",
    enabled: true,
    severity: "critical",
    category: "Security",
    scope: "opportunity",
    rules: [
      { id: "sec-review", name: "Security Review Required", scope: "opportunity", action: "require_approval", condition: "category != 'Security' OR security_reviewed", description: "Security changes require team review" },
      { id: "sec-min-score", name: "Security Minimum Score", scope: "opportunity", action: "block", condition: "category != 'Security' OR score >= 70", description: "Block low-score security changes" },
    ],
    config: { require_security_review: true, min_security_score: 70, alert_on_critical: true },
    violations: [],
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-30T09:00:00Z",
  },
};

// ─── Webhook Mock Data ───────────────────────────────────────────────────────

const MOCK_WEBHOOKS: WebhookRegistration[] = [
  { id: "wh_000001", url: "https://ci.example.com/recurrsive/hooks", events: ["analysis.complete", "policy.violation"], active: true, created_at: "2026-06-15T08:00:00Z", delivery_count: 42, failure_count: 0 },
  { id: "wh_000002", url: "https://slack.example.com/webhooks/recurrsive", events: ["opportunity.created", "health.degraded"], active: true, created_at: "2026-06-20T14:30:00Z", delivery_count: 18, failure_count: 2 },
  { id: "wh_000003", url: "https://pagerduty.example.com/v2/enqueue", events: ["analysis.failed", "health.degraded", "policy.violation"], active: false, created_at: "2026-06-10T10:00:00Z", delivery_count: 7, failure_count: 5 },
];

const MOCK_WEBHOOK_EVENTS: WebhookEvent[] = [
  { type: "analysis.complete", description: "Triggered when an analysis run completes successfully" },
  { type: "analysis.failed", description: "Triggered when an analysis run fails" },
  { type: "opportunity.created", description: "Triggered when a new opportunity is identified" },
  { type: "opportunity.updated", description: "Triggered when an opportunity status changes" },
  { type: "policy.violation", description: "Triggered when a policy check finds a violation" },
  { type: "health.degraded", description: "Triggered when the project health score drops below threshold" },
  { type: "snapshot.created", description: "Triggered when a new knowledge graph snapshot is saved" },
];

// ─── Notification Mock Data ──────────────────────────────────────────────────

const MOCK_NOTIFICATION_CHANNELS: NotificationChannel[] = [
  { type: "console", name: "Console", enabled: true, description: "Log notifications to the server console. Always available — no configuration needed." },
  { type: "slack", name: "Slack", enabled: false, description: "Send notifications to a Slack channel via webhook. Set SLACK_WEBHOOK_URL to enable." },
  { type: "http", name: "HTTP", enabled: false, description: "Send notifications to a custom HTTP endpoint. Provide a URL when sending." },
];

const MOCK_NOTIFICATION_HISTORY: NotificationEntry[] = [
  { id: "notif_000001", channel: "console", title: "Analysis completed successfully", severity: "info", sent_at: "2026-06-30T10:02:34Z", status: "delivered" },
  { id: "notif_000002", channel: "slack", title: "Health score dropped below threshold", severity: "warning", sent_at: "2026-06-29T15:30:00Z", status: "delivered" },
  { id: "notif_000003", channel: "http", title: "Policy violation detected in auth-service", severity: "critical", sent_at: "2026-06-29T09:15:00Z", status: "failed" },
  { id: "notif_000004", channel: "console", title: "New opportunity identified: N+1 query optimization", severity: "info", sent_at: "2026-06-28T14:45:00Z", status: "delivered" },
  { id: "notif_000005", channel: "slack", title: "Circuit breaker tripped for payment gateway", severity: "critical", sent_at: "2026-06-28T11:20:00Z", status: "delivered" },
];

const MOCK_NOTIFICATION_DETAILS: Record<string, NotificationDetail> = {
  notif_000001: {
    id: "notif_000001", title: "Analysis completed successfully", type: "success", severity: "info", source: "Analysis Engine", timestamp: "2026-06-30T10:02:34Z",
    message: "Full analysis run completed successfully. Found 47 findings across 23 opportunities. Overall health score improved from 82 to 87. Key improvements include architecture (+4) and security (+4) dimensions.",
    read: true, dismissed: false,
    related_items: [
      { type: "opportunity", id: "OPP-2847", title: "Migrate legacy authentication to OAuth 2.1 PKCE flow" },
      { type: "opportunity", id: "OPP-2843", title: "Optimize N+1 query pattern in order processing" },
    ],
  },
  notif_000002: {
    id: "notif_000002", title: "Health score dropped below threshold", type: "warning", severity: "warning", source: "Health Monitor", timestamp: "2026-06-29T15:30:00Z",
    message: "The project health score has dropped below the configured threshold of 80. Current score: 76. Primary factors: security dimension declined to 48 (-6 points) and testing coverage dropped to 58%. Immediate review recommended.",
    read: true, dismissed: false,
    related_items: [
      { type: "finding", id: "FND-002", title: "Hardcoded API key in configuration module" },
      { type: "policy", id: "builtin-security", title: "Security Policies" },
    ],
  },
  notif_000003: {
    id: "notif_000003", title: "Policy violation detected in auth-service", type: "error", severity: "critical", source: "Policy Engine", timestamp: "2026-06-29T09:15:00Z",
    message: "Critical policy violation detected: Security Policies rule 'Security Review Required' was triggered for opportunity OPP-2847 (Migrate legacy authentication). This change requires security team review before proceeding. Delivery via HTTP webhook failed — endpoint returned 503.",
    read: false, dismissed: false,
    related_items: [
      { type: "policy", id: "builtin-security", title: "Security Policies" },
      { type: "opportunity", id: "OPP-2847", title: "Migrate legacy authentication to OAuth 2.1 PKCE flow" },
      { type: "finding", id: "FND-001", title: "SQL injection vulnerability in user search endpoint" },
    ],
  },
  notif_000004: {
    id: "notif_000004", title: "New opportunity identified: N+1 query optimization", type: "info", severity: "info", source: "Analysis Engine", timestamp: "2026-06-28T14:45:00Z",
    message: "A new high-impact opportunity has been identified. N+1 query pattern detected in the order processing pipeline causing 340% latency increase under load. Estimated ROI: 94. Recommended fix involves adding eager loading and a composite index.",
    read: true, dismissed: false,
    related_items: [
      { type: "opportunity", id: "OPP-2843", title: "Optimize N+1 query pattern in order processing" },
    ],
  },
  notif_000005: {
    id: "notif_000005", title: "Circuit breaker tripped for payment gateway", type: "error", severity: "critical", source: "Reliability Monitor", timestamp: "2026-06-28T11:20:00Z",
    message: "The circuit breaker for the external payment gateway has tripped due to sustained 5xx errors. Payment processing is currently in fallback mode — failed payments are being queued for retry. This is the 3rd incident in 30 days. The opportunity to implement a proper circuit breaker (OPP-2835) should be prioritized.",
    read: true, dismissed: false,
    related_items: [
      { type: "opportunity", id: "OPP-2835", title: "Implement circuit breaker for payment gateway" },
      { type: "finding", id: "FND-006", title: "Unhandled promise rejection in payment callback" },
    ],
  },
};

// ─── Audit Trail Mock Data ───────────────────────────────────────────────────

const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  { id: "audit_000001", type: "analysis", action: "executed", actor: "system", target: "/home/user/projects/api-gateway", details: "Full analysis run completed with 47 findings and 23 opportunities.", timestamp: "2026-06-30T10:02:34Z", ip: "127.0.0.1" },
  { id: "audit_000002", type: "webhook", action: "created", actor: "admin@example.com", target: "wh_000001", details: "Registered webhook for analysis.complete and policy.violation events.", timestamp: "2026-06-30T09:15:00Z", ip: "192.168.1.42" },
  { id: "audit_000003", type: "config", action: "updated", actor: "admin@example.com", target: "analysis.include_reasoning", details: "Changed include_reasoning from false to true.", timestamp: "2026-06-29T16:30:00Z", ip: "192.168.1.42" },
  { id: "audit_000004", type: "notification", action: "tested", actor: "admin@example.com", target: "slack", details: "Sent test notification to Slack channel #engineering-alerts.", timestamp: "2026-06-29T14:00:00Z", ip: "192.168.1.42" },
  { id: "audit_000005", type: "policy", action: "configured", actor: "admin@example.com", target: "builtin-security", details: "Enabled Security Policies policy set with 2 rules.", timestamp: "2026-06-29T11:20:00Z", ip: "192.168.1.42" },
  { id: "audit_000006", type: "batch", action: "executed", actor: "ci-pipeline", target: "batch_000002", details: "Batch analysis of 3 projects completed. 2 succeeded, 1 failed.", timestamp: "2026-06-28T10:08:00Z", ip: "10.0.0.5" },
  { id: "audit_000007", type: "analysis", action: "executed", actor: "system", target: "/home/user/projects/web-client", details: "Analysis run completed with 51 findings and 25 opportunities.", timestamp: "2026-06-28T14:32:12Z", ip: "127.0.0.1" },
  { id: "audit_000008", type: "webhook", action: "deleted", actor: "admin@example.com", target: "wh_000004", details: "Removed inactive webhook endpoint https://old.example.com/hooks.", timestamp: "2026-06-27T09:00:00Z", ip: "192.168.1.42" },
];

// ─── Policies API ────────────────────────────────────────────────────────────

export async function getPolicies(): Promise<PolicySet[]> {
  try {
    const raw = await apiFetch<{ data: PolicySet[]; total: number } | null>("/api/v1/policies", null);
    if (!raw?.data?.length) return MOCK_POLICIES;
    return raw.data;
  } catch {
    return MOCK_POLICIES;
  }
}

export async function getComplianceReport(): Promise<ComplianceReport> {
  try {
    const raw = await apiFetch<{ data: ComplianceReport } | null>("/api/v1/policies/compliance", null);
    return raw?.data ?? MOCK_COMPLIANCE;
  } catch {
    return MOCK_COMPLIANCE;
  }
}

export async function getPolicy(id: string): Promise<PolicyDetail | null> {
  try {
    const raw = await apiFetch<{ data: PolicyDetail } | null>(
      `/api/v1/policies/${encodeURIComponent(id)}`,
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_POLICY_DETAILS[id] ?? null;
}

// ─── Webhooks API ────────────────────────────────────────────────────────────

export async function getWebhooks(): Promise<WebhookRegistration[]> {
  try {
    const raw = await apiFetch<{ data: WebhookRegistration[]; total: number } | null>("/api/v1/webhooks", null);
    if (!raw?.data?.length) return MOCK_WEBHOOKS;
    return raw.data;
  } catch {
    return MOCK_WEBHOOKS;
  }
}

export async function getWebhookEvents(): Promise<WebhookEvent[]> {
  try {
    const raw = await apiFetch<{ data: Array<{ event: string; description: string }> } | null>("/api/v1/webhooks/events", null);
    if (!raw?.data?.length) return MOCK_WEBHOOK_EVENTS;
    return raw.data.map((e) => ({ type: e.event, description: e.description }));
  } catch {
    return MOCK_WEBHOOK_EVENTS;
  }
}

// ─── Notifications API ───────────────────────────────────────────────────────

export async function getNotificationChannels(): Promise<NotificationChannel[]> {
  try {
    const raw = await apiFetch<{
      data: Array<{ channel: string; description: string; configured: boolean; config_hint: string }>;
      total: number;
    } | null>("/api/v1/notifications/channels", null);

    if (!raw?.data?.length) return MOCK_NOTIFICATION_CHANNELS;

    return raw.data.map((ch) => ({
      type: ch.channel,
      name: ch.channel.charAt(0).toUpperCase() + ch.channel.slice(1),
      enabled: ch.configured,
      description: ch.description,
    }));
  } catch {
    return MOCK_NOTIFICATION_CHANNELS;
  }
}

export async function getNotificationHistory(): Promise<NotificationEntry[]> {
  try {
    const raw = await apiFetch<{
      data: Array<{ id: string; channel: string; message: string; sent_at: string; status: string }>;
      total: number;
    } | null>("/api/v1/notifications/history", null);

    if (!raw?.data?.length) return MOCK_NOTIFICATION_HISTORY;

    return raw.data.map((n) => ({
      id: n.id,
      channel: n.channel,
      title: n.message,
      severity: "info",
      sent_at: n.sent_at,
      status: n.status === "sent" ? ("delivered" as const) : ("failed" as const),
    }));
  } catch {
    return MOCK_NOTIFICATION_HISTORY;
  }
}

export async function getNotification(id: string): Promise<NotificationDetail | null> {
  try {
    const raw = await apiFetch<{ data: NotificationDetail } | null>(
      `/api/v1/notifications/${encodeURIComponent(id)}`,
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_NOTIFICATION_DETAILS[id] ?? null;
}

// ─── Audit Trail API ─────────────────────────────────────────────────────────

export async function getAuditLog(type?: AuditEventType): Promise<AuditEvent[]> {
  try {
    const query = new URLSearchParams();
    query.set("limit", "50");
    if (type) query.set("type", type);

    const raw = await apiFetch<{ data: AuditEvent[]; total: number } | null>(
      `/api/v1/audit?${query.toString()}`,
      null,
    );

    if (!raw?.data?.length) return MOCK_AUDIT_EVENTS;
    return raw.data;
  } catch {
    return MOCK_AUDIT_EVENTS;
  }
}

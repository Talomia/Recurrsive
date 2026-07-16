'use client';
/**
 * Webhook Integrations page.
 *
 * Registered webhooks, event subscriptions, test delivery, and create form.
 */

import { useState, useEffect } from 'react';
import Header from "@/components/header";
import LoadingSkeleton from "@/components/loading-skeleton";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { getWebhooks, getWebhookEvents, createWebhook, deleteWebhook, testWebhook } from "@/lib/api";
import type { WebhookRegistration, WebhookEvent } from "@/lib/api";
import {
  Webhook,
  Activity,
  AlertTriangle,
  PauseCircle,
  Send,
  Trash2,
  Plus,
  Radio,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Event badge styling
// ---------------------------------------------------------------------------

const EVENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "analysis.complete":   { bg: "bg-green-500/10",  text: "text-green-400",  border: "border-green-500/20" },
  "analysis.failed":     { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20" },
  "opportunity.created": { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20" },
  "opportunity.updated": { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/20" },
  "policy.violation":    { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20" },
  "health.degraded":     { bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20" },
  "snapshot.created":    { bg: "bg-purple-500/10",  text: "text-purple-400", border: "border-purple-500/20" },
};

function getEventColor(event: string) {
  return EVENT_COLORS[event] ?? { bg: "bg-white/5", text: "text-text-secondary", border: "border-white/10" };
}

// ---------------------------------------------------------------------------
// Webhook Card
// ---------------------------------------------------------------------------

function WebhookCard({ webhook, onTest, onDelete }: { webhook: WebhookRegistration; onTest: (id: string) => void; onDelete: (webhook: WebhookRegistration) => void }) {

  const createdDate = formatDate(webhook.created_at);

  return (
    <div className="group rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/15 hover:bg-white/[0.04]">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 px-5 py-4">
        {/* Status indicator + URL */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={`flex-none flex items-center justify-center w-10 h-10 rounded-xl ${
              webhook.active ? "bg-green-500/10" : "bg-white/5"
            }`}
          >
            {webhook.active ? (
              <Radio className="h-5 w-5 text-green-400" />
            ) : (
              <PauseCircle className="h-5 w-5 text-text-muted" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p
                className="text-sm font-mono font-medium text-text-primary truncate"
                title={webhook.url}
              >
                {webhook.url}
              </p>
              <span
                className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-medium border ${
                  webhook.active
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : "bg-white/5 text-text-muted border-white/10"
                }`}
              >
                {webhook.active ? "Active" : "Paused"}
              </span>
            </div>

            {/* Event badges */}
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {webhook.events.map((event) => {
                const c = getEventColor(event);
                return (
                  <span
                    key={event}
                    className={`rounded-full px-2 py-0.5 text-[10px] font-medium border ${c.bg} ${c.text} ${c.border}`}
                  >
                    {event}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-none">
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary tabular-nums">
              {webhook.delivery_count}
            </p>
            <p className="text-[10px] text-text-muted">Deliveries</p>
          </div>
          <div className="text-center">
            <p
              className={`text-lg font-bold tabular-nums ${
                webhook.failure_count > 0 ? "text-red-400" : "text-text-secondary"
              }`}
            >
              {webhook.failure_count}
            </p>
            <p className="text-[10px] text-text-muted">Failures</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-text-secondary">{createdDate}</p>
            <p className="text-[10px] text-text-muted">Created</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-none">
          <button
            onClick={() => onTest(webhook.id)}
            className="flex items-center gap-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 text-xs font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
            title="Send test event"
            aria-label={`Send test event to ${webhook.url}`}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Test
          </button>
          <button
            onClick={() => onDelete(webhook)}
            className="flex items-center justify-center rounded-lg bg-white/5 border border-white/10 p-1.5 text-text-muted hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-colors"
            title="Delete webhook"
            aria-label={`Delete webhook ${webhook.url}`}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// All supported events for the create form
// ---------------------------------------------------------------------------

const ALL_EVENTS = [
  'analysis.complete',
  'analysis.failed',
  'opportunity.created',
  'opportunity.updated',
  'policy.violation',
  'health.degraded',
  'snapshot.created',
];

// ---------------------------------------------------------------------------
// Page component (client component)
// ---------------------------------------------------------------------------

export default function WebhooksPage() {
  const { toast } = useToast();
  const [webhooks, setWebhooks] = useState<WebhookRegistration[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [newSecret, setNewSecret] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WebhookRegistration | null>(null);
  const [deleting, setDeleting] = useState(false);

  const reloadData = async () => {
    const [wh, ev] = await Promise.all([getWebhooks(), getWebhookEvents()]);
    setWebhooks(wh);
    setEvents(ev);
  };

  useEffect(() => {
    reloadData()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load webhooks.'))
      .finally(() => setLoading(false));
  }, []);

  const toggleEvent = (event: string) => {
    setNewEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const handleCreate = async () => {
    try {
      setError(null);
      await createWebhook({ url: newUrl, events: newEvents, secret: newSecret || undefined });
      setShowCreate(false);
      setNewUrl('');
      setNewEvents([]);
      setNewSecret('');
      await reloadData();
      toast('Webhook registered.', 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create webhook');
      toast('Failed to register webhook.', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      setError(null);
      await deleteWebhook(deleteTarget.id);
      await reloadData();
      toast('Webhook deleted.', 'info');
      setDeleteTarget(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete webhook');
      toast('Failed to delete webhook.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async (id: string) => {
    try {
      setError(null);
      await testWebhook(id);
      await reloadData();
      toast('Test event sent.', 'success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to test webhook');
      toast('Failed to send test event.', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Webhook Integrations" subtitle="Manage webhook endpoints for real-time event notifications" />
        <LoadingSkeleton variant="list" count={3} />
      </div>
    );
  }

  const activeCount = webhooks.filter((w) => w.active).length;
  const totalDeliveries = webhooks.reduce((sum, w) => sum + w.delivery_count, 0);
  const totalFailures = webhooks.reduce((sum, w) => sum + w.failure_count, 0);
  const failureRate =
    totalDeliveries > 0 ? ((totalFailures / totalDeliveries) * 100).toFixed(1) : "0.0";

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Webhook Integrations"
        subtitle="Manage webhook endpoints for real-time event notifications"
      />

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/30 flex items-center justify-between">
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-red-400 hover:text-red-300">Dismiss</button>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Active Webhooks */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Webhook className="h-5 w-5 text-blue-400" />
          <span className="text-2xl font-bold text-text-primary tabular-nums">
            {activeCount}
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Active Webhooks
          </span>
        </div>

        {/* Total Deliveries */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <Activity className="h-5 w-5 text-green-400" />
          <span className="text-2xl font-bold text-green-400 tabular-nums">
            {totalDeliveries}
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Total Deliveries
          </span>
        </div>

        {/* Failure Rate */}
        <div className="glass-card flex flex-col items-center justify-center p-5 gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <span
            className={`text-2xl font-bold tabular-nums ${
              Number(failureRate) > 5 ? "text-red-400" : "text-text-primary"
            }`}
          >
            {failureRate}%
          </span>
          <span className="text-[11px] text-text-muted font-medium">
            Failure Rate
          </span>
        </div>
      </div>

      {/* Webhook List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              Registered Webhooks
            </h2>
            <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted font-medium">
              {webhooks.length}
            </span>
          </div>
          <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 rounded-xl bg-accent-blue/15 border border-accent-blue/25 px-4 py-2 text-xs font-semibold text-blue-400 hover:bg-accent-blue/25 transition-colors">
            <Plus className="h-3.5 w-3.5" />
            Add Webhook
          </button>
        </div>

        {/* Create Webhook Form */}
        {showCreate && (
          <div className="rounded-2xl p-5 mb-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <h3 className="text-base font-semibold text-text-primary mb-3">Register New Webhook</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input placeholder="Webhook URL (https://...)" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="px-3 py-2 rounded-lg text-sm font-mono" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
              <input placeholder="Secret (optional, for HMAC signing)" value={newSecret} onChange={e => setNewSecret(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={{ background: 'var(--color-base)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }} />
            </div>
            <div className="mb-3">
              <p className="text-xs text-text-tertiary mb-2">Select events to subscribe to:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_EVENTS.map(event => {
                  const selected = newEvents.includes(event);
                  const c = getEventColor(event);
                  return (
                    <button
                      key={event}
                      onClick={() => toggleEvent(event)}
                      className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                        selected
                          ? `${c.bg} ${c.text} ${c.border}`
                          : 'bg-white/5 text-text-muted border-white/10 opacity-50'
                      }`}
                    >
                      {event}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-text-secondary">Cancel</button>
              <button onClick={handleCreate} disabled={!newUrl || newEvents.length === 0} className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all" style={{ background: newUrl && newEvents.length > 0 ? 'var(--color-accent)' : 'var(--color-border)', opacity: newUrl && newEvents.length > 0 ? 1 : 0.5 }}>
                Register
              </button>
            </div>
          </div>
        )}

        {webhooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="rounded-2xl bg-blue-500/10 p-4 mb-4">
              <Webhook className="h-8 w-8 text-blue-400" />
            </div>
            <h3 className="text-sm font-medium text-text-primary mb-1">
              No Webhooks Configured
            </h3>
            <p className="text-xs text-text-muted max-w-xs">
              No webhooks configured. Add one to receive event notifications.
            </p>
          </div>
        ) : (
          <div className="space-y-3 stagger-children">
            {webhooks.map((wh) => (
              <WebhookCard key={wh.id} webhook={wh} onTest={handleTest} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </div>

      {/* Supported Events */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-text-primary">
            Supported Events
          </h2>
          <span className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-text-muted font-medium">
            {events.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 stagger-children">
          {events.map((event) => {
            const c = getEventColor(event.type);
            return (
              <div
                key={event.type}
                className="glass-card flex items-start gap-3 p-4"
              >
                <div
                  className={`flex-none flex items-center justify-center w-8 h-8 rounded-lg ${c.bg}`}
                >
                  <Zap className={`h-4 w-4 ${c.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${c.text}`}>
                    {event.type}
                  </p>
                  <p className="text-[11px] text-text-muted mt-0.5 line-clamp-2">
                    {event.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete webhook"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Delete the webhook for{' '}
            <span className="font-semibold text-text-primary font-mono break-all">{deleteTarget?.url}</span>?
            It will stop receiving event notifications. This action cannot be undone.
          </>
        }
        onConfirm={confirmDelete}
        onCancel={() => { if (!deleting) setDeleteTarget(null); }}
      />
    </div>
  );
}

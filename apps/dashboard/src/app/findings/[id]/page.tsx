'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Loader2,
  ChevronRight,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  EyeOff,
  Code2,
  Lightbulb,
  UserPlus,
  ArrowLeft,
  FileCode2,
  Target,
  RotateCcw,
} from 'lucide-react';
import Header from '@/components/header';
import ErrorBanner from '@/components/error-banner';
import { apiFetch } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Finding {
  id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  category: string;
  assignee: string;
  code_snippet?: string;
  file_path?: string;
  line_start?: number;
  line_end?: number;
  analyzer_id?: string;
  created_at?: string;
  updated_at?: string;
  confidence: number;
  suggested_fix?: string;
  evidence: Array<{
    id: string;
    type: string;
    source: string;
    description: string;
    confidence: number;
    data?: Record<string, unknown>;
  }>;
  locations: Array<{
    file: string;
    start_line?: number;
    end_line?: number;
  }>;
  estimated_impact?: {
    summary?: string;
    metrics?: Array<{ name: string; current_value?: string | number; expected_value?: string | number }>;
  };
  related_opportunities?: Array<{
    id: string;
    title: string;
    severity: string;
    confidence: number;
  }>;
}

// ---------------------------------------------------------------------------
// Styling maps
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400', border: 'border-red-500/20' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400', dot: 'bg-orange-400', border: 'border-orange-500/20' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-400', border: 'border-amber-500/20' },
  low: { bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400', border: 'border-green-500/20' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string; border: string; icon: typeof CheckCircle2 }> = {
  open: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20', icon: AlertCircle },
  resolved: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20', icon: CheckCircle2 },
  suppressed: { bg: 'bg-white/5', text: 'text-text-muted', border: 'border-white/10', icon: EyeOff },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FindingDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const projectId = searchParams.get('projectId');

  const [finding, setFinding] = useState<Finding | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [assignInput, setAssignInput] = useState('');
  const [showAssign, setShowAssign] = useState(false);

  const fetchFinding = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Finding>('/api/v1/findings/' + encodeURIComponent(id));
      setFinding(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load finding');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchFinding();
  }, [fetchFinding]);

  // -- Actions --

  const handleResolve = async () => {
    setActionLoading('resolve');
    try {
      await apiFetch(`/api/v1/findings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
      });
      setFinding((prev) => prev ? { ...prev, status: 'resolved' } : prev);
    } catch {
      setError('Failed to resolve finding.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReopen = async () => {
    setActionLoading('reopen');
    try {
      await apiFetch(`/api/v1/findings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'open' }),
      });
      setFinding((prev) => prev ? { ...prev, status: 'open' } : prev);
    } catch {
      setError('Failed to reopen finding.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSuppress = async () => {
    setActionLoading('suppress');
    try {
      await apiFetch(`/api/v1/findings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'suppressed' }),
      });
      setFinding((prev) => prev ? { ...prev, status: 'suppressed' } : prev);
    } catch {
      setError('Failed to suppress finding.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssign = async () => {
    if (!assignInput.trim()) return;
    setActionLoading('assign');
    try {
      await apiFetch(`/api/v1/findings/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignee: assignInput.trim() }),
      });
      setFinding((prev) => prev ? { ...prev, assignee: assignInput.trim() } : prev);
      setShowAssign(false);
      setAssignInput('');
    } catch {
      setError('Failed to assign finding.');
    } finally {
      setActionLoading(null);
    }
  };

  // -- Loading --

  if (loading) {
    return (
      <div className="flex flex-col h-screen">
        <Header title="Finding Detail" subtitle="Loading…" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      </div>
    );
  }

  // -- Error --

  if (error && !finding) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <Header title="Finding Detail" />
        <ErrorBanner message={error} onRetry={fetchFinding} />
      </div>
    );
  }

  if (!finding) return null;

  const sev = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.medium!;
  const stat = STATUS_STYLES[finding.status] ?? STATUS_STYLES.open!;
  const StatusIcon = stat.icon;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Header
        title="Finding Detail"
        subtitle={finding.title}
      />

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
        <Link
          href={`/findings${projectId ? `?projectId=${encodeURIComponent(projectId)}` : ''}`}
          className="flex items-center gap-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Findings
        </Link>
        <ChevronRight className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
        <span className="text-text-primary font-medium">Finding #{finding.id}</span>
      </nav>

      {/* Error banner (non-fatal) */}
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Main info card */}
      <div className="glass-card p-6 space-y-5">
        {/* Title + Badges */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 border border-white/10">
              <ShieldAlert className="h-5 w-5 text-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-text-primary">{finding.title}</h2>
              <span className="text-xs font-mono text-text-muted">{finding.id}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase ${sev.bg} ${sev.text} border ${sev.border}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
              {finding.severity}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border ${stat.bg} ${stat.text} ${stat.border}`}>
              <StatusIcon className="h-3 w-3" />
              {finding.status}
            </span>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Category</p>
            <p className="text-sm text-text-primary font-medium">{finding.category}</p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Assignee</p>
            <p className="text-sm text-text-primary font-medium">{finding.assignee || 'Unassigned'}</p>
          </div>
          {finding.analyzer_id && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Analyzer</p>
              <p className="text-sm text-text-primary font-medium">{finding.analyzer_id}</p>
            </div>
          )}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Confidence</p>
            <p className="text-sm text-text-primary font-medium">{Math.round(finding.confidence * 100)}%</p>
          </div>
          {finding.file_path && (
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">File</p>
              <p className="text-sm text-text-primary font-mono text-xs truncate">{finding.file_path}
                {finding.line_start != null && `:${finding.line_start}`}
                {finding.line_end != null && `-${finding.line_end}`}
              </p>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-wider mb-2">Description</p>
          <p className="text-sm text-text-secondary leading-relaxed">{finding.description}</p>
        </div>
      </div>

      {/* Evidence and source provenance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-text-primary">Evidence</h3>
            <span className="text-xs text-text-muted ml-auto">{finding.evidence.length}</span>
          </div>
          {finding.evidence.length === 0 ? (
            <p className="text-sm text-text-muted">No supporting evidence was recorded.</p>
          ) : (
            <div className="space-y-3">
              {finding.evidence.map((item) => (
                <div key={item.id} className="rounded-xl bg-white/[0.02] border border-white/5 p-3">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-purple-400">{item.type} · {item.source}</span>
                    <span className="text-[10px] text-text-muted">{Math.round(item.confidence * 100)}%</span>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <FileCode2 className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-text-primary">Source locations</h3>
          </div>
          {finding.locations.length === 0 ? (
            <p className="text-sm text-text-muted">This is a repository-level finding without a single source location.</p>
          ) : (
            <div className="space-y-2">
              {finding.locations.map((location, index) => (
                <div key={`${location.file}-${index}`} className="rounded-xl bg-black/20 border border-white/5 px-3 py-2 font-mono text-xs text-text-secondary break-all">
                  {location.file}{location.start_line != null ? `:${location.start_line}` : ''}{location.end_line != null && location.end_line !== location.start_line ? `-${location.end_line}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {finding.suggested_fix && (
        <div className="glass-card p-5 border border-green-500/10">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-green-400" />
            <h3 className="text-sm font-semibold text-text-primary">Recommended action</h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{finding.suggested_fix}</p>
        </div>
      )}

      {/* Code snippet */}
      {finding.code_snippet && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="h-4 w-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-text-primary">Code Snippet</h3>
            {finding.file_path && (
              <span className="text-xs text-text-muted font-mono ml-auto">{finding.file_path}</span>
            )}
          </div>
          <pre className="rounded-xl bg-black/30 border border-white/5 p-4 overflow-x-auto text-xs text-text-secondary font-mono leading-relaxed">
            <code>{finding.code_snippet}</code>
          </pre>
        </div>
      )}

      {/* Related opportunities */}
      {finding.related_opportunities && finding.related_opportunities.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-text-primary">Related Opportunities</h3>
            <span className="text-xs text-text-muted ml-auto">{finding.related_opportunities.length} found</span>
          </div>
          <div className="space-y-2">
            {finding.related_opportunities.map((opp) => {
              const oppSev = SEVERITY_STYLES[opp.severity] ?? SEVERITY_STYLES.medium!;
              return (
                <div
                  key={opp.id}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/5 p-3 hover:bg-white/[0.05] transition-all"
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${oppSev.dot}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{opp.title}</p>
                  </div>
                  <span className="text-xs text-text-muted tabular-nums">{Math.round(opp.confidence * 100)}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Actions</h3>
        <div className="flex flex-wrap items-center gap-3">
          {finding.status !== 'open' && (
            <button
              onClick={handleReopen}
              disabled={actionLoading === 'reopen'}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'reopen' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Reopen
            </button>
          )}
          {finding.status !== 'resolved' && (
            <button
              onClick={handleResolve}
              disabled={actionLoading === 'resolve'}
              className="inline-flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-2.5 text-sm font-medium text-green-400 hover:bg-green-500/20 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'resolve' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              Resolve
            </button>
          )}
          {finding.status !== 'suppressed' && (
            <button
              onClick={handleSuppress}
              disabled={actionLoading === 'suppress'}
              className="inline-flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm font-medium text-text-secondary hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'suppress' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <EyeOff className="h-4 w-4" />
              )}
              Suppress
            </button>
          )}
          {!showAssign ? (
            <button
              onClick={() => setShowAssign(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-500/10 border border-blue-500/20 px-4 py-2.5 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Assign
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={assignInput}
                onChange={(e) => setAssignInput(e.target.value)}
                placeholder="Username…"
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:border-accent-blue/40 transition-colors"
              />
              <button
                onClick={handleAssign}
                disabled={actionLoading === 'assign' || !assignInput.trim()}
                className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
              >
                {actionLoading === 'assign' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </button>
              <button
                onClick={() => { setShowAssign(false); setAssignInput(''); }}
                className="rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

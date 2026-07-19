/**
 * @module Opportunities API
 *
 * Opportunity CRUD operations.
 *
 * The per-project opportunity routes return RAW core `Opportunity` objects
 * (see `@recurrsive/core` OpportunitySchema): `effort` is a t-shirt-size
 * object, `confidence` is 0–1, risk is `{ level, description, ... }`, the
 * problem statement lives in `problem` and the fix in `recommendation`.
 * This module maps those REAL fields — it must never invent metrics the
 * server did not send.
 */

import { apiFetch, ApiError } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  type: string;
  description: string;
  source: string;
  /** Evidence confidence 0–1 as reported by the analyzer. */
  confidence: number | null;
}

export interface OpportunityEffort {
  /** Rough t-shirt size (xs–xl). */
  tShirt: string;
  estimatedHours: number | null;
  estimatedDays: number | null;
  skillsRequired: string[];
  dependencies: string[];
}

export interface ImpactMetric {
  name: string;
  currentValue: string | number | null;
  expectedValue: string | number | null;
  changePercent: number | null;
  direction: string | null;
  /** True when the metric is a model projection, not a measurement. */
  isEstimate: boolean;
}

export interface OpportunityLocation {
  file: string;
  startLine: number | null;
  endLine: number | null;
}

export interface Opportunity {
  id: string;
  title: string;
  /** Clear statement of the problem (core `problem`). */
  problem: string;
  /** Actionable recommendation (core `recommendation`). */
  recommendation: string;
  categories: string[];
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: string;
  /**
   * Server-computed composite score (0–1). Only the single-opportunity route
   * returns it — null means the server did not provide one, NOT zero.
   */
  score: number | null;
  /** Overall confidence 0–1 as sent by the server. */
  confidence: number | null;
  effort: OpportunityEffort | null;
  /** Risk level from the server's risk assessment (critical…negligible). */
  riskLevel: string | null;
  riskDescription: string | null;
  /** One-line impact summary from `expected_impact.summary`. */
  impactSummary: string | null;
  impactMetrics: ImpactMetric[];
  affectedServices: string[];
  evidence: EvidenceItem[];
  locations: OpportunityLocation[];
  createdAt: string | null;
}

// ─── Internal Types ──────────────────────────────────────────────────────────

/**
 * Raw core Opportunity shape as returned by the server (snake_case).
 * Fields are optional-guarded defensively but no values are invented.
 */
interface ServerOpportunity {
  id: string;
  title: string;
  problem?: string;
  recommendation?: string;
  category?: string;
  severity?: string;
  status?: string;
  confidence?: number;
  effort?: {
    t_shirt?: string;
    estimated_hours?: number;
    estimated_days?: number;
    skills_required?: string[];
    dependencies?: string[];
  };
  risk?: { level?: string; description?: string };
  expected_impact?: {
    summary?: string;
    metrics?: Array<{
      name: string;
      current_value?: string | number;
      expected_value?: string | number;
      change_percent?: number;
      direction?: string;
      is_estimate?: boolean;
    }>;
    affected_services?: string[];
  };
  evidence?: Array<{ type: string; description: string; source: string; confidence?: number }>;
  locations?: Array<{ file: string; start_line?: number; end_line?: number }>;
  created_at?: string;
}

const SEVERITIES = new Set(['critical', 'high', 'medium', 'low', 'info']);

/**
 * Map a raw core opportunity into the dashboard shape.
 *
 * @param raw - The raw server object.
 * @param score - The server-computed composite score (0–1) when the route
 *   provided one (the detail route does; the list route does not).
 */
function transformOpportunity(raw: ServerOpportunity, score: number | null = null): Opportunity {
  return {
    id: raw.id,
    title: raw.title,
    problem: raw.problem ?? '',
    recommendation: raw.recommendation ?? '',
    categories: raw.category ? [raw.category] : [],
    severity: SEVERITIES.has(raw.severity ?? '')
      ? (raw.severity as Opportunity['severity'])
      : 'info',
    status: raw.status ?? 'proposed',
    score,
    confidence: typeof raw.confidence === 'number' ? raw.confidence : null,
    effort: raw.effort?.t_shirt
      ? {
          tShirt: raw.effort.t_shirt,
          estimatedHours: raw.effort.estimated_hours ?? null,
          estimatedDays: raw.effort.estimated_days ?? null,
          skillsRequired: raw.effort.skills_required ?? [],
          dependencies: raw.effort.dependencies ?? [],
        }
      : null,
    riskLevel: raw.risk?.level ?? null,
    riskDescription: raw.risk?.description ?? null,
    impactSummary: raw.expected_impact?.summary ?? null,
    impactMetrics: (raw.expected_impact?.metrics ?? []).map((m) => ({
      name: m.name,
      currentValue: m.current_value ?? null,
      expectedValue: m.expected_value ?? null,
      changePercent: m.change_percent ?? null,
      direction: m.direction ?? null,
      isEstimate: m.is_estimate ?? false,
    })),
    affectedServices: raw.expected_impact?.affected_services ?? [],
    evidence: (raw.evidence ?? []).map((e) => ({
      type: e.type,
      description: e.description,
      source: e.source,
      confidence: typeof e.confidence === 'number' ? e.confidence : null,
    })),
    locations: (raw.locations ?? []).map((l) => ({
      file: l.file,
      startLine: l.start_line ?? null,
      endLine: l.end_line ?? null,
    })),
    createdAt: raw.created_at ?? null,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get opportunities from `GET /api/v1/opportunities`.
 *
 * Server returns: `{ data: Opportunity[], total, limit, offset, has_more }`.
 * The list route does not compute per-item scores, so `score` is null here.
 *
 * Throws on failure so callers can distinguish an error from an empty list.
 */
export async function getOpportunities(): Promise<Opportunity[]> {
  const raw = await apiFetch<ServerOpportunity[]>("/api/v1/opportunities?limit=50");
  return (Array.isArray(raw) ? raw : []).map((o) => transformOpportunity(o));
}

/**
 * Get a single opportunity from `GET /api/v1/opportunities/:id`.
 *
 * The server responds `{ data: Opportunity, score: number | null }` — the
 * envelope is read raw (unwrap:false) so the REAL server-computed score is
 * captured instead of being discarded by the `{ data }` unwrap.
 *
 * Returns undefined only for a genuine 404; other failures throw.
 */
export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  try {
    const res = await apiFetch<{ data: ServerOpportunity; score?: number | null }>(
      `/api/v1/opportunities/${encodeURIComponent(id)}`,
      { unwrap: false },
    );
    if (!res?.data) return undefined;
    return transformOpportunity(res.data, typeof res.score === 'number' ? res.score : null);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return undefined;
    throw err;
  }
}

/** Lifecycle status accepted by the server's opportunity PATCH. */
export type OpportunityStatusUpdate =
  | 'proposed' | 'accepted' | 'rejected' | 'in_progress'
  | 'implemented' | 'validated' | 'archived';

/**
 * Update an opportunity's lifecycle status via `PATCH /api/v1/opportunities/:id`.
 *
 * The active project scope (`?projectId=`) is appended automatically by the API
 * client, so the change targets and persists to the correct project. Throws on
 * failure so the caller can surface an error toast.
 */
export async function updateOpportunityStatus(
  id: string,
  status: OpportunityStatusUpdate,
  reason?: string,
): Promise<void> {
  await apiFetch(`/api/v1/opportunities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status, ...(reason ? { reason } : {}) }),
    headers: { "Content-Type": "application/json" },
    unwrap: false,
  });
}

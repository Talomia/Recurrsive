/**
 * @module Opportunities API
 *
 * Opportunity CRUD operations.
 */

import { apiFetch } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EvidenceItem {
  type: string;
  description: string;
  source: string;
  value: string;
}

export interface SolutionStep {
  step: number;
  title: string;
  description: string;
  effort: string;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  categories: string[];
  severity: "critical" | "high" | "medium" | "low";
  score: number;
  impact: number;
  confidence: number;
  effort: number;
  risk: number;
  roi: number;
  rootCauses: string[];
  evidence: EvidenceItem[];
  affectedComponents: string[];
  solution: SolutionStep[];
  createdAt: string;
}

// ─── Internal Types ──────────────────────────────────────────────────────────

/**
 * Server shape for opportunities (snake_case from the API).
 */
interface ServerOpportunity {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  score?: number;
  impact?: number;
  confidence?: number;
  effort_estimate?: string;
  risk_assessment?: { risk_level?: string };
  root_causes?: string[];
  evidence?: Array<{ type: string; description: string; source: string; value?: string }>;
  affected_entities?: string[];
  recommendations?: Array<{ title: string; description: string; effort?: string }>;
  created_at?: string;
}

/** Transform a server opportunity into the dashboard shape. */
function transformOpportunity(raw: ServerOpportunity, idx: number): Opportunity {
  const severityMap: Record<string, Opportunity["severity"]> = {
    critical: "critical", high: "high", medium: "medium", low: "low",
  };
  return {
    id: raw.id || `OPP-${1000 + idx}`,
    title: raw.title,
    description: raw.description,
    categories: [raw.category].filter(Boolean),
    severity: severityMap[raw.severity] ?? "medium",
    score: raw.score ?? 70,
    impact: raw.impact ?? 70,
    confidence: raw.confidence ?? 80,
    effort: parseInt(raw.effort_estimate ?? "50", 10) || 50,
    risk: raw.risk_assessment?.risk_level === "high" ? 70 : raw.risk_assessment?.risk_level === "medium" ? 40 : 20,
    roi: Math.round(((raw.impact ?? 70) * (raw.confidence ?? 80)) / 100),
    rootCauses: raw.root_causes ?? [],
    evidence: (raw.evidence ?? []).map((e) => ({
      type: e.type,
      description: e.description,
      source: e.source,
      value: e.value ?? "",
    })),
    affectedComponents: raw.affected_entities ?? [],
    solution: (raw.recommendations ?? []).map((r, i) => ({
      step: i + 1,
      title: r.title,
      description: r.description,
      effort: r.effort ?? "TBD",
    })),
    createdAt: raw.created_at ?? new Date().toISOString(),
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get opportunities from `GET /api/v1/opportunities`.
 *
 * Server returns: `{ data: Opportunity[], total, limit, offset, has_more }`
 */
export async function getOpportunities(): Promise<Opportunity[]> {
  try {
    const raw = await apiFetch<ServerOpportunity[]>("/api/v1/opportunities?limit=50");
    return raw.map(transformOpportunity);
  } catch {
    return [];
  }
}

export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  try {
    const raw = await apiFetch<ServerOpportunity>(`/api/v1/opportunities/${encodeURIComponent(id)}`);
    return transformOpportunity(raw, 0);
  } catch {
    return undefined;
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

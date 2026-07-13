/**
 * @module Opportunities API
 *
 * Opportunity CRUD operations.
 */

import { ApiError, apiFetch } from './client';

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
  severity: "critical" | "high" | "medium" | "low" | "info";
  confidence: number;
  effort: string;
  estimatedHours: number | null;
  risk: string;
  status: string;
  impactSummary: string;
  businessValue: string | null;
  recommendation: string;
  assumptions: string[];
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
  problem: string;
  category: string;
  severity: string;
  status: string;
  confidence: number;
  recommendation: string;
  expected_impact: {
    summary: string;
    affected_services: string[];
    business_value?: string;
  };
  effort: {
    t_shirt: string;
    estimated_hours?: number;
  };
  risk: { level: string };
  assumptions?: string[];
  evidence: Array<{
    type: string;
    description: string;
    source: string;
    data?: Record<string, unknown>;
  }>;
  locations: Array<{ file: string }>;
  validation: {
    steps: Array<{ description: string; type: string; duration?: string }>;
  };
  created_at: string;
}

/** Transform a server opportunity into the dashboard shape. */
function transformOpportunity(raw: ServerOpportunity): Opportunity {
  const severityMap: Record<string, Opportunity["severity"]> = {
    critical: "critical", high: "high", medium: "medium", low: "low", info: "info",
  };
  const affectedComponents = Array.from(new Set([
    ...raw.locations.map((location) => location.file),
    ...raw.expected_impact.affected_services,
  ]));
  return {
    id: raw.id,
    title: raw.title,
    description: raw.problem,
    categories: [raw.category].filter(Boolean),
    severity: severityMap[raw.severity] ?? "medium",
    confidence: Math.round(raw.confidence * 100),
    effort: raw.effort.t_shirt,
    estimatedHours: raw.effort.estimated_hours ?? null,
    risk: raw.risk.level,
    status: raw.status,
    impactSummary: raw.expected_impact.summary,
    businessValue: raw.expected_impact.business_value ?? null,
    recommendation: raw.recommendation,
    assumptions: raw.assumptions ?? [],
    evidence: raw.evidence.map((e) => ({
      type: e.type,
      description: e.description,
      source: e.source,
      value: e.data ? JSON.stringify(e.data) : "",
    })),
    affectedComponents,
    solution: [
      {
        step: 1,
        title: "Recommendation",
        description: raw.recommendation,
        effort: raw.effort.t_shirt === 'unknown' ? 'Not estimated' : raw.effort.t_shirt.toUpperCase(),
      },
      ...raw.validation.steps.map((step, i) => ({
        step: i + 2,
        title: step.type.replaceAll('_', ' '),
        description: step.description,
        effort: step.duration ?? "",
      })),
    ],
    createdAt: raw.created_at,
  };
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get opportunities from `GET /api/v1/opportunities`.
 *
 * Server returns: `{ data: Opportunity[], total, limit, offset, has_more }`
 */
export async function getOpportunities(): Promise<Opportunity[]> {
  const raw = await apiFetch<ServerOpportunity[]>("/api/v1/opportunities?limit=50");
  return raw.map(transformOpportunity);
}

export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  try {
    const raw = await apiFetch<ServerOpportunity>(`/api/v1/opportunities/${encodeURIComponent(id)}`);
    return transformOpportunity(raw);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

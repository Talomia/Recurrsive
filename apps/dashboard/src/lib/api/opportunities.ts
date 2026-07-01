/**
 * @module Opportunities API
 *
 * Opportunity fetching and management.
 */

import { apiFetch } from "./client.js";

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

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: "OPP-2847",
    title: "Migrate legacy authentication to OAuth 2.1 PKCE flow",
    description:
      "The current authentication system uses a deprecated OAuth 2.0 implicit grant flow which has known security vulnerabilities. Migrating to OAuth 2.1 with PKCE will improve security posture and align with current best practices.",
    categories: ["Security", "Architecture"],
    severity: "critical",
    score: 96,
    impact: 95,
    confidence: 92,
    effort: 65,
    risk: 30,
    roi: 88,
    rootCauses: [
      "Legacy OAuth 2.0 implicit grant flow in use",
      "No PKCE verification on authorization endpoints",
      "Token storage in localStorage without encryption",
    ],
    evidence: [
      { type: "Static Analysis", description: "Detected implicit grant flow usage", source: "auth-service/oauth.ts", value: "3 instances found" },
      { type: "Security Scan", description: "OWASP A07:2021 flagged", source: "ZAP Scanner", value: "High severity" },
      { type: "Dependency Audit", description: "oauth-lib v2.x end-of-life", source: "npm audit", value: "Critical" },
    ],
    affectedComponents: ["auth-service", "api-gateway", "user-service", "web-client"],
    solution: [
      { step: 1, title: "Update OAuth library", description: "Upgrade oauth-lib to v4.x with PKCE support", effort: "4 hours" },
      { step: 2, title: "Implement PKCE flow", description: "Replace implicit grant with authorization code + PKCE", effort: "8 hours" },
      { step: 3, title: "Migrate token storage", description: "Move from localStorage to httpOnly secure cookies", effort: "4 hours" },
      { step: 4, title: "Update API gateway", description: "Configure token validation for new flow", effort: "6 hours" },
    ],
    createdAt: "2026-06-28T14:30:00Z",
  },
  {
    id: "OPP-2843",
    title: "Optimize N+1 query pattern in order processing pipeline",
    description:
      "Database profiling has identified a severe N+1 query pattern in the order processing service that is causing exponential query growth under load, degrading response times by up to 340%.",
    categories: ["Performance", "Database"],
    severity: "high",
    score: 91,
    impact: 88,
    confidence: 95,
    effort: 40,
    risk: 15,
    roi: 94,
    rootCauses: [
      "Eager loading not configured for order → items relationship",
      "Missing composite index on orders(user_id, status, created_at)",
      "Sequential API calls in order enrichment step",
    ],
    evidence: [
      { type: "APM Trace", description: "340% latency increase under load", source: "Datadog APM", value: "p99: 2.3s → 8.1s" },
      { type: "Query Log", description: "N+1 detected: 1 + N queries per order", source: "pg_stat_statements", value: "Avg N=47" },
      { type: "Load Test", description: "Throughput drops at 200 concurrent", source: "k6 test suite", value: "42 req/s → 12 req/s" },
    ],
    affectedComponents: ["order-service", "inventory-service", "payment-service"],
    solution: [
      { step: 1, title: "Add eager loading", description: "Configure ORM to batch-load order items", effort: "2 hours" },
      { step: 2, title: "Add composite index", description: "Create index on orders(user_id, status, created_at)", effort: "1 hour" },
      { step: 3, title: "Parallelize enrichment", description: "Use Promise.all for concurrent API calls", effort: "3 hours" },
    ],
    createdAt: "2026-06-27T09:15:00Z",
  },
  {
    id: "OPP-2839",
    title: "Reduce Docker image size with multi-stage builds",
    description:
      "Production Docker images are 1.2GB on average due to including build dependencies. Multi-stage builds can reduce this by 70-80%, improving deployment speed and reducing infrastructure costs.",
    categories: ["Cost", "DevOps"],
    severity: "medium",
    score: 78,
    impact: 72,
    confidence: 98,
    effort: 30,
    risk: 10,
    roi: 82,
    rootCauses: [
      "Single-stage Dockerfile includes dev dependencies",
      "No .dockerignore file configured",
      "Base image is full ubuntu instead of alpine",
    ],
    evidence: [
      { type: "Image Scan", description: "Average image size 1.2GB", source: "Docker Hub", value: "12 images affected" },
      { type: "Cost Analysis", description: "ECR storage costs above threshold", source: "AWS Cost Explorer", value: "$340/month" },
      { type: "Deploy Metric", description: "Average deploy time 8.2 minutes", source: "CI/CD Pipeline", value: "Target: < 3 min" },
    ],
    affectedComponents: ["api-gateway", "order-service", "user-service", "notification-service"],
    solution: [
      { step: 1, title: "Create multi-stage Dockerfile", description: "Separate build and runtime stages", effort: "3 hours" },
      { step: 2, title: "Switch to Alpine base", description: "Use node:20-alpine for runtime stage", effort: "1 hour" },
      { step: 3, title: "Add .dockerignore", description: "Exclude node_modules, tests, docs from context", effort: "30 min" },
    ],
    createdAt: "2026-06-26T16:45:00Z",
  },
  {
    id: "OPP-2835",
    title: "Implement circuit breaker for external payment gateway",
    description:
      "The payment service makes direct HTTP calls to the external payment gateway without circuit breaker protection. Gateway outages cause cascading failures across the checkout flow.",
    categories: ["Reliability", "Architecture"],
    severity: "high",
    score: 85,
    impact: 90,
    confidence: 88,
    effort: 45,
    risk: 20,
    roi: 86,
    rootCauses: [
      "No circuit breaker pattern implemented",
      "Missing timeout configuration on HTTP client",
      "No fallback mechanism for payment processing",
    ],
    evidence: [
      { type: "Incident Report", description: "3 outages in last 30 days", source: "PagerDuty", value: "MTTR: 45 min avg" },
      { type: "Error Rate", description: "Payment failures spike during gateway issues", source: "Sentry", value: "Peak: 23% error rate" },
      { type: "Revenue Impact", description: "Estimated lost revenue during outages", source: "Finance Report", value: "$12,400/incident" },
    ],
    affectedComponents: ["payment-service", "checkout-service", "order-service"],
    solution: [
      { step: 1, title: "Add circuit breaker library", description: "Integrate opossum or similar circuit breaker", effort: "2 hours" },
      { step: 2, title: "Configure thresholds", description: "Set failure rate, timeout, and recovery parameters", effort: "2 hours" },
      { step: 3, title: "Implement fallback", description: "Queue failed payments for retry when circuit closes", effort: "6 hours" },
      { step: 4, title: "Add monitoring", description: "Dashboard for circuit breaker state and metrics", effort: "3 hours" },
    ],
    createdAt: "2026-06-25T11:20:00Z",
  },
  {
    id: "OPP-2831",
    title: "Enable tree-shaking and code splitting for frontend bundle",
    description:
      "The frontend JavaScript bundle is 2.4MB (uncompressed) due to importing entire utility libraries. Proper tree-shaking and route-based code splitting can reduce initial load by 60%.",
    categories: ["Performance", "Frontend"],
    severity: "medium",
    score: 74,
    impact: 70,
    confidence: 90,
    effort: 35,
    risk: 12,
    roi: 80,
    rootCauses: [
      "Barrel file imports defeating tree-shaking",
      "No dynamic imports for route-level splitting",
      "Full lodash import instead of individual functions",
    ],
    evidence: [
      { type: "Bundle Analysis", description: "Main bundle 2.4MB uncompressed", source: "webpack-bundle-analyzer", value: "Target: < 800KB" },
      { type: "Lighthouse", description: "LCP affected by large bundle", source: "Chrome DevTools", value: "LCP: 3.8s" },
      { type: "User Analytics", description: "Mobile bounce rate elevated", source: "Google Analytics", value: "62% on 3G" },
    ],
    affectedComponents: ["web-client", "admin-portal"],
    solution: [
      { step: 1, title: "Fix barrel imports", description: "Replace star imports with direct module imports", effort: "4 hours" },
      { step: 2, title: "Add route splitting", description: "Implement React.lazy and Suspense for routes", effort: "6 hours" },
      { step: 3, title: "Optimize lodash", description: "Switch to lodash-es or individual imports", effort: "2 hours" },
    ],
    createdAt: "2026-06-24T08:00:00Z",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Get opportunities from `GET /api/v1/opportunities`.
 *
 * Server returns: `{ data: Opportunity[], total, limit, offset, has_more }`
 */
export async function getOpportunities(): Promise<Opportunity[]> {
  try {
    const raw = await apiFetch<{
      data: ServerOpportunity[];
      total: number;
    } | null>("/api/v1/opportunities?limit=50", null);

    if (!raw?.data?.length) return MOCK_OPPORTUNITIES;

    return raw.data.map(transformOpportunity);
  } catch {
    return MOCK_OPPORTUNITIES;
  }
}

export async function getOpportunity(id: string): Promise<Opportunity | undefined> {
  const opps = await getOpportunities();
  return opps.find((o) => o.id === id);
}

export function getMockOpportunities(): Opportunity[] {
  return MOCK_OPPORTUNITIES;
}

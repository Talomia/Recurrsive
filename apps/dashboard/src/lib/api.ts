/**
 * @module Dashboard API Client
 *
 * Fetches data from the Recurrsive REST API server.
 *
 * Each function attempts a real API call first. If the server is unreachable
 * or hasn't been initialized, it falls back to realistic mock data so the
 * dashboard remains usable during development.
 *
 * API paths use the `/api/v1/` prefix which the Next.js rewrite proxy
 * forwards to the backend server (see next.config.ts).
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HealthMetrics {
  healthScore: number;
  healthTrend: number;
  qualityScore: number;
  qualityTrend: number;
  opportunities: number;
  newOpportunities: number;
  techDebt: number;
  techDebtTrend: number;
  aiQualityScore: number;
  aiQualityTrend: number;
}

export interface TimelinePoint {
  date: string;
  healthScore: number;
  quality: number;
  reliability: number;
  performance: number;
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

export interface PerformanceMetric {
  label: string;
  value: string;
  unit: string;
  trend: number;
  data: { value: number }[];
}

export interface SystemNode {
  id: string;
  name: string;
  type: string;
  health: number;
  connections: string[];
}

export interface FindingEvidence {
  id: string;
  type: string;
  source: string;
  description: string;
  data?: Record<string, unknown>;
  entity_ids: string[];
  collected_at: string;
  confidence: number;
}

export interface FindingLocation {
  file: string;
  start_line?: number;
  end_line?: number;
  start_column?: number;
  end_column?: number;
  repository?: string;
  commit?: string;
}

export interface FindingImpact {
  summary?: string;
  metrics?: Array<{
    name: string;
    current_value?: string | number;
    expected_value?: string | number;
    change_percent?: number;
    direction?: string;
  }>;
  affected_services?: string[];
  affected_users?: string;
}

export interface Finding {
  id: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  analyzer_id: string;
  evidence: FindingEvidence[];
  locations: FindingLocation[];
  suggested_fix?: string;
  estimated_impact?: FindingImpact;
  confidence: number;
  tags: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface FindingsSummary {
  total: number;
  by_severity: Record<string, number>;
  by_category: Record<string, number>;
  by_analyzer: Record<string, number>;
}

export interface GraphStats {
  total_entities: number;
  total_relationships: number;
  entities_by_type: Record<string, number>;
  relationships_by_type: Record<string, number>;
}

export interface GraphEntity {
  id: string;
  name: string;
  type: string;
  qualified_name?: string;
  description?: string;
  properties?: Record<string, unknown>;
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

/** Deterministic pseudo-random — prevents SSR/client hydration mismatches. */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function generateTimeline(): TimelinePoint[] {
  const points: TimelinePoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const day = 29 - i;
    const noise = (s: number) => seededRandom(i * 137 + s) * 6 - 3;
    const monthDay = `${String(6).padStart(2, "0")}/${String(day + 1).padStart(2, "0")}`;
    points.push({
      date: monthDay,
      healthScore: Math.round(78 + day * 0.4 + noise(0)),
      quality: Math.round(82 + day * 0.3 + noise(1)),
      reliability: Math.round(91 + day * 0.15 + noise(2)),
      performance: Math.round(73 + day * 0.35 + noise(3)),
    });
  }
  return points;
}

function miniSparkline(base: number, count = 14, volatility = 5): { value: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    value: Math.round(base + Math.sin(i * 0.7) * volatility + (seededRandom(i * 31 + base) - 0.5) * volatility),
  }));
}

const MOCK_HEALTH: HealthMetrics = {
  healthScore: 87,
  healthTrend: 4.2,
  qualityScore: 91,
  qualityTrend: 2.1,
  opportunities: 23,
  newOpportunities: 7,
  techDebt: 142500,
  techDebtTrend: -8.3,
  aiQualityScore: 94,
  aiQualityTrend: 1.8,
};

const MOCK_TIMELINE = generateTimeline();

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

const MOCK_PERFORMANCE: PerformanceMetric[] = [
  {
    label: "Avg Response Time",
    value: "142",
    unit: "ms",
    trend: -12.5,
    data: miniSparkline(150, 14, 20),
  },
  {
    label: "Total Requests",
    value: "2.4M",
    unit: "req",
    trend: 8.3,
    data: miniSparkline(2200, 14, 300),
  },
  {
    label: "Error Rate",
    value: "0.12",
    unit: "%",
    trend: -23.1,
    data: miniSparkline(0.15, 14, 0.05),
  },
  {
    label: "Availability",
    value: "99.97",
    unit: "%",
    trend: 0.02,
    data: miniSparkline(99.95, 14, 0.03),
  },
];

const MOCK_FINDINGS_SUMMARY: FindingsSummary = {
  total: 47,
  by_severity: { critical: 3, high: 12, medium: 19, low: 13 },
  by_category: { security: 8, performance: 11, architecture: 9, reliability: 7, cost: 5, documentation: 7 },
  by_analyzer: { architecture: 9, security: 8, performance: 11, cost: 5, reliability: 7, documentation: 7 },
};

const MOCK_GRAPH_STATS: GraphStats = {
  total_entities: 234,
  total_relationships: 567,
  entities_by_type: {
    module: 42, function: 89, class: 28, interface: 31, api_endpoint: 16,
    configuration: 8, ai_model: 4, ai_prompt: 6, database_table: 10,
  },
  relationships_by_type: {
    imports: 156, depends_on: 98, exports: 87, calls: 72, implements: 34,
    contains: 45, references: 38, uses_model: 12, queries: 25,
  },
};

// ─── API Client ──────────────────────────────────────────────────────────────

/**
 * Base URL for API requests.
 *
 * In production, the Next.js rewrite proxy (next.config.ts) forwards
 * `/api/v1/*` requests to the server. For direct access or SSR, the
 * full URL is used.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/**
 * Fetch JSON from the API, falling back to a default value if the
 * server is unreachable or returns an error.
 */
async function apiFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } catch {
    // Return mock data when the API server is unreachable
    return fallback;
  }
}

// ─── Health ──────────────────────────────────────────────────────────────────

/**
 * Get health metrics from `GET /api/v1/health-score`.
 *
 * Server returns: `{ overall_health, dimensions, snapshot, finding_count, opportunity_count, analyzed_at }`
 * Dashboard needs: `HealthMetrics` shape with scores and trends.
 */
export async function getHealthMetrics(): Promise<HealthMetrics> {
  try {
    const raw = await apiFetch<{
      overall_health: number;
      dimensions: Record<string, number>;
      health_trend: number;
      tech_debt: number;
      finding_count: number;
      opportunity_count: number;
    } | null>("/api/v1/health-score", null);

    if (!raw) return MOCK_HEALTH;

    const healthTrend = raw.health_trend ?? 0;
    const codeQuality = raw.dimensions?.code_quality ?? raw.dimensions?.documentation ?? 91;
    const aiQuality = raw.dimensions?.ai_readiness ?? raw.dimensions?.security ?? 94;

    return {
      healthScore: raw.overall_health,
      healthTrend,
      qualityScore: codeQuality,
      qualityTrend: healthTrend > 0 ? healthTrend * 0.5 : 0,
      opportunities: raw.opportunity_count,
      newOpportunities: Math.min(7, raw.opportunity_count),
      techDebt: raw.tech_debt ?? raw.finding_count * 3000,
      techDebtTrend: healthTrend > 0 ? -healthTrend * 2 : 0,
      aiQualityScore: aiQuality,
      aiQualityTrend: healthTrend > 0 ? healthTrend * 0.4 : 0,
    };
  } catch {
    return MOCK_HEALTH;
  }
}

// ─── Timeline ────────────────────────────────────────────────────────────────

/**
 * Get timeline data from `GET /api/v1/timeline/trends`.
 *
 * Server returns: `{ data: [{ dimension, data_points: [{ timestamp, value }] }] }`
 * Dashboard needs: `TimelinePoint[]` with date + multiple dimension values.
 */
export async function getTimeline(): Promise<TimelinePoint[]> {
  try {
    const raw = await apiFetch<{
      data: Array<{
        dimension: string;
        data_points: Array<{ timestamp: string; value: number }>;
      }>;
    } | null>("/api/v1/timeline/trends", null);

    if (!raw?.data?.length) return MOCK_TIMELINE;

    // Transpose dimension-keyed data into date-keyed TimelinePoints
    const dateMap = new Map<string, TimelinePoint>();

    for (const dim of raw.data) {
      for (const pt of dim.data_points) {
        const date = pt.timestamp.slice(5, 10).replace("-", "/"); // "2026-06-15" → "06/15"
        if (!dateMap.has(date)) {
          dateMap.set(date, { date, healthScore: 0, quality: 0, reliability: 0, performance: 0 });
        }
        const entry = dateMap.get(date)!;
        // Map dimension names to TimelinePoint fields
        if (dim.dimension.includes("health") || dim.dimension.includes("overall")) entry.healthScore = Math.round(pt.value);
        else if (dim.dimension.includes("quality") || dim.dimension.includes("code")) entry.quality = Math.round(pt.value);
        else if (dim.dimension.includes("reliability") || dim.dimension.includes("sre")) entry.reliability = Math.round(pt.value);
        else if (dim.dimension.includes("performance") || dim.dimension.includes("perf")) entry.performance = Math.round(pt.value);
      }
    }

    const points = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    return points.length > 0 ? points : MOCK_TIMELINE;
  } catch {
    return MOCK_TIMELINE;
  }
}

// ─── Opportunities ───────────────────────────────────────────────────────────

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

// ─── Performance Metrics ─────────────────────────────────────────────────────

/**
 * Get performance metrics from `GET /api/v1/metrics/performance`.
 * Falls back to mock data when the server is unavailable.
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetric[]> {
  const raw = await apiFetch<{ data: PerformanceMetric[] } | null>(
    "/api/v1/metrics/performance",
    null,
  );
  if (raw?.data) return raw.data;
  return MOCK_PERFORMANCE;
}

// ─── Findings ────────────────────────────────────────────────────────────────

/**
 * Get findings summary from `GET /api/v1/findings/summary`.
 */
export async function getFindingsSummary(): Promise<FindingsSummary> {
  return apiFetch("/api/v1/findings/summary", MOCK_FINDINGS_SUMMARY);
}

/**
 * Get paginated findings from `GET /api/v1/findings`.
 */
export async function getFindings(params?: {
  severity?: string;
  category?: string;
  limit?: number;
  offset?: number;
}): Promise<{ findings: Finding[]; total: number }> {
  const query = new URLSearchParams();
  if (params?.severity) query.set("severity", params.severity);
  if (params?.category) query.set("category", params.category);
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.offset) query.set("offset", String(params.offset));

  const qs = query.toString();
  const path = `/api/v1/findings${qs ? `?${qs}` : ""}`;

  return apiFetch(path, { findings: [], total: 0 });
}

/**
 * Get a single finding by ID from `GET /api/v1/findings/:id`.
 */
export async function getFinding(id: string): Promise<Finding | null> {
  try {
    const finding = await apiFetch<Finding | null>(
      `/api/v1/findings/${encodeURIComponent(id)}`,
      null,
    );
    return finding;
  } catch {
    return null;
  }
}

// ─── Graph ───────────────────────────────────────────────────────────────────

/**
 * Get graph statistics from `GET /api/v1/graph/stats`.
 */
export async function getGraphStats(): Promise<GraphStats> {
  try {
    const raw = await apiFetch<{ data: GraphStats } | null>("/api/v1/graph/stats", null);
    return raw?.data ?? MOCK_GRAPH_STATS;
  } catch {
    return MOCK_GRAPH_STATS;
  }
}

/**
 * Get entities by type from `GET /api/v1/graph/entities`.
 */
export async function getGraphEntities(type?: string, search?: string, limit = 50): Promise<GraphEntity[]> {
  const query = new URLSearchParams();
  if (type) query.set("type", type);
  if (search) query.set("search", search);
  query.set("limit", String(limit));

  try {
    const raw = await apiFetch<{ data: GraphEntity[] } | null>(
      `/api/v1/graph/entities?${query.toString()}`,
      null,
    );
    return raw?.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Full-text search for entities via `GET /api/v1/graph/search`.
 *
 * Uses FTS5 with BM25 ranking for fast, relevant results.
 */
export async function searchGraphEntities(
  q: string,
  type?: string,
  limit = 50,
): Promise<GraphEntity[]> {
  const query = new URLSearchParams();
  query.set("q", q);
  if (type) query.set("type", type);
  query.set("limit", String(limit));

  try {
    const raw = await apiFetch<{ data: GraphEntity[] } | null>(
      `/api/v1/graph/search?${query.toString()}`,
      null,
    );
    return raw?.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Get entity with relationships from `GET /api/v1/graph/entities/:id`.
 */
export async function getEntityWithRelationships(id: string): Promise<{
  entity: GraphEntity;
  relationships: Array<{ type: string; source_id: string; target_id: string }>;
} | null> {
  try {
    const raw = await apiFetch<{
      data: {
        entity: GraphEntity;
        relationships: Array<{ type: string; source_id: string; target_id: string }>;
      };
    } | null>(`/api/v1/graph/entities/${encodeURIComponent(id)}`, null);
    return raw?.data ?? null;
  } catch {
    return null;
  }
}

// ─── Reports ─────────────────────────────────────────────────────────────────

/**
 * Trigger a report download from `GET /api/v1/reports/:format`.
 * Returns the download URL. Formats: markdown, html, sarif, json.
 */
export function getReportUrl(format: string): string {
  return `${API_BASE}/api/v1/reports/${encodeURIComponent(format)}`;
}

// ─── Analysis ────────────────────────────────────────────────────────────────

/**
 * Get analysis status from `GET /api/v1/analysis/status`.
 */
export async function getAnalysisStatus(): Promise<{
  phase: string;
  progress: number;
  message: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}> {
  try {
    const raw = await apiFetch<{
      data: {
        phase: string;
        progress: number;
        message: string;
        startedAt: string | null;
        completedAt: string | null;
        error: string | null;
      };
    } | null>("/api/v1/analysis/status", null);

    return raw?.data ?? {
      phase: "idle",
      progress: 0,
      message: "No analysis running",
      startedAt: null,
      completedAt: null,
      error: null,
    };
  } catch {
    return {
      phase: "idle",
      progress: 0,
      message: "No analysis running",
      startedAt: null,
      completedAt: null,
      error: null,
    };
  }
}

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

// ─── Policies ────────────────────────────────────────────────────────────────

/**
 * Get all policy sets from `GET /api/v1/policies`.
 *
 * Server returns: `{ data: PolicySet[], total, builtin_count }`
 */
export async function getPolicies(): Promise<PolicySet[]> {
  try {
    const raw = await apiFetch<{
      data: PolicySet[];
      total: number;
    } | null>("/api/v1/policies", null);

    if (!raw?.data?.length) return MOCK_POLICIES;
    return raw.data;
  } catch {
    return MOCK_POLICIES;
  }
}

/**
 * Get compliance report from `GET /api/v1/policies/compliance`.
 *
 * Server returns: `{ data: ComplianceReport }`
 */
export async function getComplianceReport(): Promise<ComplianceReport> {
  try {
    const raw = await apiFetch<{
      data: ComplianceReport;
    } | null>("/api/v1/policies/compliance", null);

    return raw?.data ?? MOCK_COMPLIANCE;
  } catch {
    return MOCK_COMPLIANCE;
  }
}

// ─── Timeline Types ──────────────────────────────────────────────────────────

export interface AnalysisHistoryEntry {
  id: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  findingCount: number;
  opportunityCount: number;
  includeReasoning: boolean;
  status: "success" | "error";
  error: string | null;
}

export interface MaturityScoreEntry {
  dimension: string;
  level: string;
  score: number;
  trend: "improving" | "stable" | "declining";
  evidence: string[];
  recommendations: string[];
}

export interface SnapshotDelta {
  new_opportunities: number;
  resolved_opportunities: number;
  new_risks: number;
  resolved_risks: number;
  maturity_changes: Array<{
    dimension: string;
    previous_score: number;
    current_score: number;
  }>;
}

export interface EvolutionSnapshot {
  id: string;
  timestamp: string;
  maturity_scores: MaturityScoreEntry[];
  overall_health: number;
  opportunity_count: number;
  debt_count: number;
  risk_count: number;
  top_opportunities: string[];
  changes_since_last: SnapshotDelta;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
}

export interface TrendSeries {
  dimension: string;
  data_points: TrendDataPoint[];
}

export interface TrendData {
  series: TrendSeries[];
  total: number;
}

// ─── Timeline Mock Data ──────────────────────────────────────────────────────

const MOCK_ANALYSIS_HISTORY: AnalysisHistoryEntry[] = [
  {
    id: "run-001",
    startedAt: "2026-06-30T10:00:00Z",
    completedAt: "2026-06-30T10:02:34Z",
    durationMs: 154000,
    findingCount: 47,
    opportunityCount: 23,
    includeReasoning: true,
    status: "success",
    error: null,
  },
  {
    id: "run-002",
    startedAt: "2026-06-29T09:00:00Z",
    completedAt: "2026-06-29T09:01:48Z",
    durationMs: 108000,
    findingCount: 42,
    opportunityCount: 19,
    includeReasoning: false,
    status: "success",
    error: null,
  },
  {
    id: "run-003",
    startedAt: "2026-06-28T14:30:00Z",
    completedAt: "2026-06-28T14:32:12Z",
    durationMs: 132000,
    findingCount: 51,
    opportunityCount: 25,
    includeReasoning: true,
    status: "success",
    error: null,
  },
  {
    id: "run-004",
    startedAt: "2026-06-27T08:15:00Z",
    completedAt: "2026-06-27T08:16:55Z",
    durationMs: 115000,
    findingCount: 38,
    opportunityCount: 17,
    includeReasoning: false,
    status: "success",
    error: null,
  },
  {
    id: "run-005",
    startedAt: "2026-06-25T16:00:00Z",
    completedAt: "2026-06-25T16:02:20Z",
    durationMs: 140000,
    findingCount: 55,
    opportunityCount: 28,
    includeReasoning: true,
    status: "success",
    error: null,
  },
];

const MOCK_SNAPSHOTS: EvolutionSnapshot[] = [
  {
    id: "snap-001",
    timestamp: "2026-06-30T10:02:34Z",
    maturity_scores: [
      { dimension: "architecture", level: "defined", score: 72, trend: "improving", evidence: ["Clean module boundaries"], recommendations: ["Reduce circular deps"] },
      { dimension: "security", level: "developing", score: 58, trend: "improving", evidence: ["OAuth 2.0 in use"], recommendations: ["Migrate to PKCE flow"] },
      { dimension: "reliability", level: "managed", score: 85, trend: "stable", evidence: ["Retry patterns in place"], recommendations: ["Add circuit breakers"] },
      { dimension: "testing", level: "developing", score: 62, trend: "improving", evidence: ["Unit test coverage 68%"], recommendations: ["Add integration tests"] },
    ],
    overall_health: 87,
    opportunity_count: 23,
    debt_count: 8,
    risk_count: 5,
    top_opportunities: ["OPP-2847", "OPP-2843", "OPP-2839"],
    changes_since_last: {
      new_opportunities: 4,
      resolved_opportunities: 2,
      new_risks: 1,
      resolved_risks: 0,
      maturity_changes: [
        { dimension: "architecture", previous_score: 68, current_score: 72 },
        { dimension: "security", previous_score: 54, current_score: 58 },
      ],
    },
  },
  {
    id: "snap-002",
    timestamp: "2026-06-29T09:01:48Z",
    maturity_scores: [
      { dimension: "architecture", level: "defined", score: 68, trend: "stable", evidence: ["Module structure improving"], recommendations: ["Extract shared utils"] },
      { dimension: "security", level: "developing", score: 54, trend: "stable", evidence: ["Basic auth in place"], recommendations: ["Enable MFA"] },
      { dimension: "reliability", level: "managed", score: 84, trend: "stable", evidence: ["Error handling present"], recommendations: ["Add health checks"] },
    ],
    overall_health: 82,
    opportunity_count: 19,
    debt_count: 7,
    risk_count: 4,
    top_opportunities: ["OPP-2843", "OPP-2835"],
    changes_since_last: {
      new_opportunities: 2,
      resolved_opportunities: 3,
      new_risks: 0,
      resolved_risks: 1,
      maturity_changes: [
        { dimension: "architecture", previous_score: 65, current_score: 68 },
      ],
    },
  },
  {
    id: "snap-003",
    timestamp: "2026-06-28T14:32:12Z",
    maturity_scores: [
      { dimension: "architecture", level: "developing", score: 65, trend: "improving", evidence: ["Service boundaries defined"], recommendations: ["Document APIs"] },
      { dimension: "security", level: "initial", score: 48, trend: "declining", evidence: ["Deprecated auth flow"], recommendations: ["Upgrade OAuth library"] },
    ],
    overall_health: 76,
    opportunity_count: 25,
    debt_count: 10,
    risk_count: 6,
    top_opportunities: ["OPP-2847", "OPP-2843", "OPP-2839", "OPP-2835"],
    changes_since_last: {
      new_opportunities: 5,
      resolved_opportunities: 1,
      new_risks: 2,
      resolved_risks: 0,
      maturity_changes: [],
    },
  },
];

const MOCK_TREND_DATA: TrendData = {
  series: [
    {
      dimension: "overall_health",
      data_points: [
        { timestamp: "2026-06-25T16:02:20Z", value: 71 },
        { timestamp: "2026-06-27T08:16:55Z", value: 74 },
        { timestamp: "2026-06-28T14:32:12Z", value: 76 },
        { timestamp: "2026-06-29T09:01:48Z", value: 82 },
        { timestamp: "2026-06-30T10:02:34Z", value: 87 },
      ],
    },
    {
      dimension: "architecture",
      data_points: [
        { timestamp: "2026-06-25T16:02:20Z", value: 60 },
        { timestamp: "2026-06-27T08:16:55Z", value: 63 },
        { timestamp: "2026-06-28T14:32:12Z", value: 65 },
        { timestamp: "2026-06-29T09:01:48Z", value: 68 },
        { timestamp: "2026-06-30T10:02:34Z", value: 72 },
      ],
    },
    {
      dimension: "security",
      data_points: [
        { timestamp: "2026-06-25T16:02:20Z", value: 45 },
        { timestamp: "2026-06-27T08:16:55Z", value: 47 },
        { timestamp: "2026-06-28T14:32:12Z", value: 48 },
        { timestamp: "2026-06-29T09:01:48Z", value: 54 },
        { timestamp: "2026-06-30T10:02:34Z", value: 58 },
      ],
    },
    {
      dimension: "reliability",
      data_points: [
        { timestamp: "2026-06-25T16:02:20Z", value: 80 },
        { timestamp: "2026-06-27T08:16:55Z", value: 82 },
        { timestamp: "2026-06-28T14:32:12Z", value: 83 },
        { timestamp: "2026-06-29T09:01:48Z", value: 84 },
        { timestamp: "2026-06-30T10:02:34Z", value: 85 },
      ],
    },
  ],
  total: 4,
};

// ─── Timeline API ────────────────────────────────────────────────────────────

/**
 * Get analysis history from `GET /api/v1/analysis/history`.
 *
 * Returns the list of past analysis runs with timestamps, durations,
 * finding counts, and opportunity counts.
 */
export async function getTimelineHistory(): Promise<AnalysisHistoryEntry[]> {
  try {
    const raw = await apiFetch<{
      data: AnalysisHistoryEntry[];
    } | null>("/api/v1/analysis/history", null);

    if (!raw?.data?.length) return MOCK_ANALYSIS_HISTORY;
    return raw.data;
  } catch {
    return MOCK_ANALYSIS_HISTORY;
  }
}

/**
 * Get evolution snapshots from `GET /api/v1/timeline/snapshots`.
 *
 * Returns point-in-time snapshots of the project's evolutionary state,
 * ordered newest first.
 */
export async function getTimelineSnapshots(): Promise<EvolutionSnapshot[]> {
  try {
    const raw = await apiFetch<{
      data: EvolutionSnapshot[];
      total: number;
    } | null>("/api/v1/timeline/snapshots", null);

    if (!raw?.data?.length) return MOCK_SNAPSHOTS;
    return raw.data;
  } catch {
    return MOCK_SNAPSHOTS;
  }
}

/**
 * Get trend data from `GET /api/v1/timeline/trends`.
 *
 * Returns trend series for each maturity dimension, suitable for
 * charting the evolution of scores over time.
 */
export async function getTimelineTrends(): Promise<TrendData> {
  try {
    const raw = await apiFetch<{
      data: TrendSeries[];
      total: number;
    } | null>("/api/v1/timeline/trends", null);

    if (!raw?.data?.length) return MOCK_TREND_DATA;
    return { series: raw.data, total: raw.total };
  } catch {
    return MOCK_TREND_DATA;
  }
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

// ─── Webhook Mock Data ───────────────────────────────────────────────────────

const MOCK_WEBHOOKS: WebhookRegistration[] = [
  {
    id: "wh_000001",
    url: "https://ci.example.com/recurrsive/hooks",
    events: ["analysis.complete", "policy.violation"],
    active: true,
    created_at: "2026-06-15T08:00:00Z",
    delivery_count: 42,
    failure_count: 0,
  },
  {
    id: "wh_000002",
    url: "https://slack.example.com/webhooks/recurrsive",
    events: ["opportunity.created", "health.degraded"],
    active: true,
    created_at: "2026-06-20T14:30:00Z",
    delivery_count: 18,
    failure_count: 2,
  },
  {
    id: "wh_000003",
    url: "https://pagerduty.example.com/v2/enqueue",
    events: ["analysis.failed", "health.degraded", "policy.violation"],
    active: false,
    created_at: "2026-06-10T10:00:00Z",
    delivery_count: 7,
    failure_count: 5,
  },
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

// ─── Webhooks ────────────────────────────────────────────────────────────────

/**
 * Get all registered webhooks from `GET /api/v1/webhooks`.
 *
 * Server returns: `{ data: WebhookRegistration[], total }`
 */
export async function getWebhooks(): Promise<WebhookRegistration[]> {
  try {
    const raw = await apiFetch<{
      data: WebhookRegistration[];
      total: number;
    } | null>("/api/v1/webhooks", null);

    if (!raw?.data?.length) return MOCK_WEBHOOKS;
    return raw.data;
  } catch {
    return MOCK_WEBHOOKS;
  }
}

/**
 * Get supported webhook event types from `GET /api/v1/webhooks/events`.
 *
 * Server returns: `{ data: [{ event, description }] }`
 */
export async function getWebhookEvents(): Promise<WebhookEvent[]> {
  try {
    const raw = await apiFetch<{
      data: Array<{ event: string; description: string }>;
    } | null>("/api/v1/webhooks/events", null);

    if (!raw?.data?.length) return MOCK_WEBHOOK_EVENTS;
    return raw.data.map((e) => ({ type: e.event, description: e.description }));
  } catch {
    return MOCK_WEBHOOK_EVENTS;
  }
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

// ─── Notification Mock Data ──────────────────────────────────────────────────

const MOCK_NOTIFICATION_CHANNELS: NotificationChannel[] = [
  {
    type: "console",
    name: "Console",
    enabled: true,
    description: "Log notifications to the server console. Always available — no configuration needed.",
  },
  {
    type: "slack",
    name: "Slack",
    enabled: false,
    description: "Send notifications to a Slack channel via webhook. Set SLACK_WEBHOOK_URL to enable.",
  },
  {
    type: "http",
    name: "HTTP",
    enabled: false,
    description: "Send notifications to a custom HTTP endpoint. Provide a URL when sending.",
  },
];

const MOCK_NOTIFICATION_HISTORY: NotificationEntry[] = [
  {
    id: "notif_000001",
    channel: "console",
    title: "Analysis completed successfully",
    severity: "info",
    sent_at: "2026-06-30T10:02:34Z",
    status: "delivered",
  },
  {
    id: "notif_000002",
    channel: "slack",
    title: "Health score dropped below threshold",
    severity: "warning",
    sent_at: "2026-06-29T15:30:00Z",
    status: "delivered",
  },
  {
    id: "notif_000003",
    channel: "http",
    title: "Policy violation detected in auth-service",
    severity: "critical",
    sent_at: "2026-06-29T09:15:00Z",
    status: "failed",
  },
  {
    id: "notif_000004",
    channel: "console",
    title: "New opportunity identified: N+1 query optimization",
    severity: "info",
    sent_at: "2026-06-28T14:45:00Z",
    status: "delivered",
  },
  {
    id: "notif_000005",
    channel: "slack",
    title: "Circuit breaker tripped for payment gateway",
    severity: "critical",
    sent_at: "2026-06-28T11:20:00Z",
    status: "delivered",
  },
];

// ─── Notifications ───────────────────────────────────────────────────────────

/**
 * Get notification channels from `GET /api/v1/notifications/channels`.
 *
 * Server returns: `{ data: ChannelInfo[], total }`
 * Dashboard needs: `NotificationChannel[]` with type, name, enabled, description.
 */
export async function getNotificationChannels(): Promise<NotificationChannel[]> {
  try {
    const raw = await apiFetch<{
      data: Array<{
        channel: string;
        description: string;
        configured: boolean;
        config_hint: string;
      }>;
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

/**
 * Get notification history from `GET /api/v1/notifications/history`.
 *
 * Server returns: `{ data: NotificationRecord[], total, max_retained }`
 * Dashboard needs: `NotificationEntry[]` with id, channel, title, severity, sent_at, status.
 */
export async function getNotificationHistory(): Promise<NotificationEntry[]> {
  try {
    const raw = await apiFetch<{
      data: Array<{
        id: string;
        channel: string;
        message: string;
        sent_at: string;
        status: string;
      }>;
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

// ─── Batch Types ─────────────────────────────────────────────────────────────

export interface BatchProject {
  path: string;
  status: "pending" | "running" | "completed" | "failed";
  findings_count?: number;
  opportunities_count?: number;
  started_at?: string;
  completed_at?: string;
  error?: string;
}

export interface BatchRun {
  batch_id: string;
  status: "pending" | "running" | "completed" | "partial" | "failed";
  projects: BatchProject[];
  created_at: string;
  completed_at?: string;
}

// ─── Batch Mock Data ─────────────────────────────────────────────────────────

const MOCK_BATCH_RUNS: BatchRun[] = [
  {
    batch_id: "batch_000003",
    status: "running",
    projects: [
      {
        path: "/home/user/projects/api-gateway",
        status: "completed",
        findings_count: 12,
        opportunities_count: 4,
        started_at: "2026-06-30T14:00:00Z",
        completed_at: "2026-06-30T14:02:15Z",
      },
      {
        path: "/home/user/projects/auth-service",
        status: "running",
        findings_count: 0,
        opportunities_count: 0,
        started_at: "2026-06-30T14:02:16Z",
      },
      {
        path: "/home/user/projects/payment-service",
        status: "pending",
      },
    ],
    created_at: "2026-06-30T14:00:00Z",
  },
  {
    batch_id: "batch_000002",
    status: "completed",
    projects: [
      {
        path: "/home/user/projects/web-client",
        status: "completed",
        findings_count: 23,
        opportunities_count: 8,
        started_at: "2026-06-29T10:00:00Z",
        completed_at: "2026-06-29T10:03:45Z",
      },
      {
        path: "/home/user/projects/admin-portal",
        status: "completed",
        findings_count: 15,
        opportunities_count: 5,
        started_at: "2026-06-29T10:03:46Z",
        completed_at: "2026-06-29T10:06:12Z",
      },
      {
        path: "/home/user/projects/notification-service",
        status: "completed",
        findings_count: 8,
        opportunities_count: 3,
        started_at: "2026-06-29T10:06:13Z",
        completed_at: "2026-06-29T10:08:00Z",
      },
    ],
    created_at: "2026-06-29T10:00:00Z",
    completed_at: "2026-06-29T10:08:00Z",
  },
  {
    batch_id: "batch_000001",
    status: "partial",
    projects: [
      {
        path: "/home/user/projects/order-service",
        status: "completed",
        findings_count: 19,
        opportunities_count: 6,
        started_at: "2026-06-28T08:00:00Z",
        completed_at: "2026-06-28T08:02:30Z",
      },
      {
        path: "/home/user/projects/inventory-service",
        status: "failed",
        error: "Analysis failed: unable to parse project configuration",
        started_at: "2026-06-28T08:02:31Z",
        completed_at: "2026-06-28T08:03:10Z",
      },
      {
        path: "/home/user/projects/search-service",
        status: "completed",
        findings_count: 11,
        opportunities_count: 4,
        started_at: "2026-06-28T08:03:11Z",
        completed_at: "2026-06-28T08:05:00Z",
      },
    ],
    created_at: "2026-06-28T08:00:00Z",
    completed_at: "2026-06-28T08:05:00Z",
  },
];

// ─── Batch API ───────────────────────────────────────────────────────────────

/**
 * Get batch analysis history from `GET /api/v1/batch/history`.
 *
 * Server returns: `{ data: BatchRun[], total }`
 */
export async function getBatchHistory(): Promise<BatchRun[]> {
  try {
    const raw = await apiFetch<{
      data: BatchRun[];
      total: number;
    } | null>("/api/v1/batch/history", null);

    if (!raw?.data?.length) return MOCK_BATCH_RUNS;
    return raw.data;
  } catch {
    return MOCK_BATCH_RUNS;
  }
}

/**
 * Get status of a specific batch run from `GET /api/v1/batch/status/:id`.
 *
 * Server returns: `{ data: BatchRun }`
 */
export async function getBatchStatus(id: string): Promise<BatchRun | null> {
  try {
    const raw = await apiFetch<{
      data: BatchRun;
    } | null>(`/api/v1/batch/status/${encodeURIComponent(id)}`, null);

    if (!raw?.data) {
      return MOCK_BATCH_RUNS.find((b) => b.batch_id === id) ?? null;
    }
    return raw.data;
  } catch {
    return MOCK_BATCH_RUNS.find((b) => b.batch_id === id) ?? null;
  }
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

// ─── Audit Trail Mock Data ───────────────────────────────────────────────────

const MOCK_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: "audit_000001",
    type: "analysis",
    action: "executed",
    actor: "system",
    target: "/home/user/projects/api-gateway",
    details: "Full analysis run completed with 47 findings and 23 opportunities.",
    timestamp: "2026-06-30T10:02:34Z",
    ip: "127.0.0.1",
  },
  {
    id: "audit_000002",
    type: "webhook",
    action: "created",
    actor: "admin@example.com",
    target: "wh_000001",
    details: "Registered webhook for analysis.complete and policy.violation events.",
    timestamp: "2026-06-30T09:15:00Z",
    ip: "192.168.1.42",
  },
  {
    id: "audit_000003",
    type: "config",
    action: "updated",
    actor: "admin@example.com",
    target: "analysis.include_reasoning",
    details: "Changed include_reasoning from false to true.",
    timestamp: "2026-06-29T16:30:00Z",
    ip: "192.168.1.42",
  },
  {
    id: "audit_000004",
    type: "notification",
    action: "tested",
    actor: "admin@example.com",
    target: "slack",
    details: "Sent test notification to Slack channel #engineering-alerts.",
    timestamp: "2026-06-29T14:00:00Z",
    ip: "192.168.1.42",
  },
  {
    id: "audit_000005",
    type: "policy",
    action: "configured",
    actor: "admin@example.com",
    target: "builtin-security",
    details: "Enabled Security Policies policy set with 2 rules.",
    timestamp: "2026-06-29T11:20:00Z",
    ip: "192.168.1.42",
  },
  {
    id: "audit_000006",
    type: "batch",
    action: "executed",
    actor: "ci-pipeline",
    target: "batch_000002",
    details: "Batch analysis of 3 projects completed. 2 succeeded, 1 failed.",
    timestamp: "2026-06-28T10:08:00Z",
    ip: "10.0.0.5",
  },
  {
    id: "audit_000007",
    type: "analysis",
    action: "executed",
    actor: "system",
    target: "/home/user/projects/web-client",
    details: "Analysis run completed with 51 findings and 25 opportunities.",
    timestamp: "2026-06-28T14:32:12Z",
    ip: "127.0.0.1",
  },
  {
    id: "audit_000008",
    type: "webhook",
    action: "deleted",
    actor: "admin@example.com",
    target: "wh_000004",
    details: "Removed inactive webhook endpoint https://old.example.com/hooks.",
    timestamp: "2026-06-27T09:00:00Z",
    ip: "192.168.1.42",
  },
];

// ─── Audit Trail API ─────────────────────────────────────────────────────────

/**
 * Get audit trail events from `GET /api/v1/audit`.
 *
 * Server returns: `{ data: AuditEvent[], total }`
 */
export async function getAuditLog(type?: AuditEventType): Promise<AuditEvent[]> {
  try {
    const query = new URLSearchParams();
    query.set("limit", "50");
    if (type) query.set("type", type);

    const raw = await apiFetch<{
      data: AuditEvent[];
      total: number;
    } | null>(`/api/v1/audit?${query.toString()}`, null);

    if (!raw?.data?.length) return MOCK_AUDIT_EVENTS;
    return raw.data;
  } catch {
    return MOCK_AUDIT_EVENTS;
  }
}

// ─── Analytics Types ─────────────────────────────────────────────────────────

export interface AnalyticsTrendPoint {
  date: string;
  findings: number;
  resolved: number;
  health: number;
}

export interface AnalyticsSummary {
  analysis_runs: number;
  total_findings: number;
  findings_resolved: number;
  resolution_rate: number;
  avg_health_score: number;
  trends: AnalyticsTrendPoint[];
}

export interface AnalyticsCategory {
  name: string;
  count: number;
  percentage: number;
}

// ─── Analytics Mock Data ─────────────────────────────────────────────────────

function generateAnalyticsTrends(): AnalyticsTrendPoint[] {
  const points: AnalyticsTrendPoint[] = [];
  const baseDate = new Date("2026-04-06");

  for (let week = 0; week < 12; week++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + week * 7);
    const dateStr = date.toISOString().slice(0, 10);

    const noise = (s: number) => seededRandom(week * 137 + s) * 8 - 4;
    const findings = Math.round(30 + week * 1.5 + noise(0));
    const resolved = Math.round(findings * (0.45 + week * 0.015 + noise(1) * 0.03));
    const health = Math.round(68 + week * 0.8 + noise(2));

    points.push({
      date: dateStr,
      findings: Math.max(findings, 10),
      resolved: Math.max(Math.min(resolved, findings), 0),
      health: Math.max(Math.min(health, 100), 50),
    });
  }

  return points;
}

const MOCK_ANALYTICS_TRENDS = generateAnalyticsTrends();

const MOCK_ANALYTICS_SUMMARY: AnalyticsSummary = (() => {
  const totalFindings = MOCK_ANALYTICS_TRENDS.reduce((s, t) => s + t.findings, 0);
  const totalResolved = MOCK_ANALYTICS_TRENDS.reduce((s, t) => s + t.resolved, 0);
  const avgHealth =
    Math.round(
      (MOCK_ANALYTICS_TRENDS.reduce((s, t) => s + t.health, 0) / MOCK_ANALYTICS_TRENDS.length) * 10,
    ) / 10;

  return {
    analysis_runs: 47,
    total_findings: totalFindings,
    findings_resolved: totalResolved,
    resolution_rate: Math.round((totalResolved / totalFindings) * 1000) / 10,
    avg_health_score: avgHealth,
    trends: MOCK_ANALYTICS_TRENDS,
  };
})();

const MOCK_ANALYTICS_CATEGORIES: AnalyticsCategory[] = [
  { name: "Security", count: 42, percentage: 13.5 },
  { name: "Performance", count: 68, percentage: 21.8 },
  { name: "Architecture", count: 54, percentage: 17.3 },
  { name: "Reliability", count: 39, percentage: 12.5 },
  { name: "Cost", count: 28, percentage: 9.0 },
  { name: "Documentation", count: 35, percentage: 11.2 },
  { name: "Testing", count: 26, percentage: 8.3 },
  { name: "DevOps", count: 20, percentage: 6.4 },
];

// ─── Analytics API ───────────────────────────────────────────────────────────

/**
 * Get analytics summary from `GET /api/v1/analytics/summary`.
 */
export async function getAnalyticsSummary(): Promise<AnalyticsSummary> {
  try {
    const raw = await apiFetch<AnalyticsSummary | null>(
      "/api/v1/analytics/summary",
      null,
    );

    return raw ?? MOCK_ANALYTICS_SUMMARY;
  } catch {
    return MOCK_ANALYTICS_SUMMARY;
  }
}

/**
 * Get analytics categories from `GET /api/v1/analytics/top-categories`.
 */
export async function getAnalyticsCategories(): Promise<AnalyticsCategory[]> {
  try {
    const raw = await apiFetch<{
      categories: AnalyticsCategory[];
    } | null>("/api/v1/analytics/top-categories", null);

    if (!raw?.categories?.length) return MOCK_ANALYTICS_CATEGORIES;
    return raw.categories;
  } catch {
    return MOCK_ANALYTICS_CATEGORIES;
  }
}

// ─── Experiment Types ────────────────────────────────────────────────────────

export interface ExperimentVariant {
  name: string;
  config: Record<string, unknown>;
}

export interface ExperimentMetric {
  name: string;
  variant_a: number;
  variant_b: number;
  improvement: number;
}

export interface DashboardExperiment {
  id: string;
  name: string;
  description: string;
  status: "pending" | "running" | "completed" | "failed";
  hypothesis: string;
  variants: ExperimentVariant[];
  metrics: ExperimentMetric[];
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  conclusion: string | null;
}

// ─── Experiment Mock Data ────────────────────────────────────────────────────

const MOCK_EXPERIMENTS: DashboardExperiment[] = [
  {
    id: "exp_001",
    name: "Strict Import Rules",
    description: "Test whether enforcing strict import rules improves overall codebase health scores by reducing circular dependencies and unused imports.",
    status: "completed",
    hypothesis: "Enforcing strict import rules will improve health scores by reducing circular dependencies.",
    variants: [
      { name: "Control", config: { strict_imports: false } },
      { name: "Strict Mode", config: { strict_imports: true, ban_circular: true } },
    ],
    metrics: [
      { name: "Health Score", variant_a: 78, variant_b: 90, improvement: 12 },
      { name: "Circular Deps", variant_a: 14, variant_b: 3, improvement: -78.6 },
      { name: "Build Time", variant_a: 45, variant_b: 42, improvement: -6.7 },
    ],
    created_at: "2026-06-10T08:00:00Z",
    started_at: "2026-06-10T09:00:00Z",
    completed_at: "2026-06-18T17:00:00Z",
    conclusion: "Positive result: +12% health score improvement. Strict import rules significantly reduced circular dependencies with minimal build time impact.",
  },
  {
    id: "exp_002",
    name: "Auto-Fix Security",
    description: "Evaluate automatic security vulnerability fixing using AI-generated patches compared to manual review.",
    status: "running",
    hypothesis: "Automated security fixes will reduce mean-time-to-remediation by 60% without introducing regressions.",
    variants: [
      { name: "Manual Review", config: { auto_fix: false, review_required: true } },
      { name: "AI Auto-Fix", config: { auto_fix: true, confidence_threshold: 0.85 } },
    ],
    metrics: [
      { name: "MTTR (hours)", variant_a: 48, variant_b: 19.2, improvement: -60 },
      { name: "Fix Rate", variant_a: 72, variant_b: 89, improvement: 23.6 },
      { name: "Regression Rate", variant_a: 2.1, variant_b: 3.4, improvement: 61.9 },
    ],
    created_at: "2026-06-20T10:00:00Z",
    started_at: "2026-06-20T12:00:00Z",
    completed_at: null,
    conclusion: null,
  },
  {
    id: "exp_003",
    name: "Parallel Analyzers",
    description: "Test running code analyzers in parallel vs sequential to measure impact on analysis accuracy and speed.",
    status: "completed",
    hypothesis: "Running analyzers in parallel will reduce total analysis time by 50% without sacrificing accuracy.",
    variants: [
      { name: "Sequential", config: { parallel: false, max_workers: 1 } },
      { name: "Parallel (4x)", config: { parallel: true, max_workers: 4 } },
    ],
    metrics: [
      { name: "Analysis Time (s)", variant_a: 120, variant_b: 58, improvement: -51.7 },
      { name: "Findings Detected", variant_a: 47, variant_b: 46, improvement: -2.1 },
      { name: "Memory Usage (MB)", variant_a: 256, variant_b: 512, improvement: 100 },
    ],
    created_at: "2026-06-05T14:00:00Z",
    started_at: "2026-06-05T15:00:00Z",
    completed_at: "2026-06-12T16:00:00Z",
    conclusion: "Neutral result: 52% speed improvement but doubled memory usage. Findings accuracy was equivalent. Recommend parallel mode only for CI environments.",
  },
  {
    id: "exp_004",
    name: "Batch Scheduling",
    description: "Evaluate different scheduling strategies for batch analysis of multiple repositories.",
    status: "pending",
    hypothesis: "Priority-based scheduling will improve resource utilization by 30% compared to FIFO ordering.",
    variants: [
      { name: "FIFO", config: { scheduler: "fifo" } },
      { name: "Priority Queue", config: { scheduler: "priority", weight_by: "last_analysis_age" } },
    ],
    metrics: [],
    created_at: "2026-06-28T09:00:00Z",
    started_at: null,
    completed_at: null,
    conclusion: null,
  },
  {
    id: "exp_005",
    name: "Custom Policies",
    description: "Test whether team-customizable policy rules improve compliance rates compared to the default built-in policy set.",
    status: "completed",
    hypothesis: "Custom policies tailored to team conventions will increase compliance rates by at least 10%.",
    variants: [
      { name: "Built-in Only", config: { custom_policies: false } },
      { name: "Custom + Built-in", config: { custom_policies: true, team_rules: 12 } },
    ],
    metrics: [
      { name: "Compliance Rate", variant_a: 75, variant_b: 83, improvement: 8 },
      { name: "False Positives", variant_a: 15, variant_b: 8, improvement: -46.7 },
      { name: "Policy Violations", variant_a: 23, variant_b: 12, improvement: -47.8 },
    ],
    created_at: "2026-06-01T10:00:00Z",
    started_at: "2026-06-01T11:00:00Z",
    completed_at: "2026-06-08T18:00:00Z",
    conclusion: "Positive result: +8% compliance improvement with 47% fewer false positives. Custom policies allow teams to encode domain-specific rules.",
  },
];

// ─── Experiments API ─────────────────────────────────────────────────────────

/**
 * Get all experiments from `GET /api/v1/experiments`.
 *
 * Server returns: `{ data: Experiment[], total }`
 */
export async function getExperiments(status?: string): Promise<DashboardExperiment[]> {
  try {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    const raw = await apiFetch<{
      data: DashboardExperiment[];
      total: number;
    } | null>(`/api/v1/experiments${query}`, null);

    if (!raw?.data?.length) return MOCK_EXPERIMENTS;
    return raw.data;
  } catch {
    return MOCK_EXPERIMENTS;
  }
}

/**
 * Get a single experiment by ID from `GET /api/v1/experiments/:id`.
 */
export async function getExperiment(id: string): Promise<DashboardExperiment | null> {
  try {
    const raw = await apiFetch<{
      data: DashboardExperiment;
    } | null>(`/api/v1/experiments/${encodeURIComponent(id)}`, null);

    if (!raw?.data) {
      return MOCK_EXPERIMENTS.find((e) => e.id === id) ?? null;
    }
    return raw.data;
  } catch {
    return MOCK_EXPERIMENTS.find((e) => e.id === id) ?? null;
  }
}

// ─── Analysis Run Comparison Types ───────────────────────────────────────────

export interface AnalysisRunCategory {
  name: string;
  count: number;
}

export interface AnalysisRun {
  id: string;
  label: string;
  date: string;
  health_score: number;
  findings: number;
  resolved: number;
  categories: AnalysisRunCategory[];
}

export interface ComparisonData {
  runA: AnalysisRun;
  runB: AnalysisRun;
  health_delta: number;
  findings_delta: number;
  resolution_rate_a: number;
  resolution_rate_b: number;
  resolution_rate_delta: number;
  new_findings: number;
  findings_resolved: number;
}

// ─── Analysis Run Mock Data ──────────────────────────────────────────────────

const MOCK_ANALYSIS_RUNS: AnalysisRun[] = [
  {
    id: "run_001",
    label: "Run #1",
    date: "2026-06-20T08:00:00Z",
    health_score: 71,
    findings: 55,
    resolved: 18,
    categories: [
      { name: "Security", count: 12 },
      { name: "Performance", count: 16 },
      { name: "Architecture", count: 10 },
      { name: "Reliability", count: 9 },
      { name: "Cost", count: 8 },
    ],
  },
  {
    id: "run_002",
    label: "Run #2",
    date: "2026-06-23T10:30:00Z",
    health_score: 76,
    findings: 48,
    resolved: 22,
    categories: [
      { name: "Security", count: 10 },
      { name: "Performance", count: 14 },
      { name: "Architecture", count: 9 },
      { name: "Reliability", count: 8 },
      { name: "Cost", count: 7 },
    ],
  },
  {
    id: "run_003",
    label: "Run #3",
    date: "2026-06-25T14:15:00Z",
    health_score: 80,
    findings: 42,
    resolved: 28,
    categories: [
      { name: "Security", count: 8 },
      { name: "Performance", count: 12 },
      { name: "Architecture", count: 8 },
      { name: "Reliability", count: 7 },
      { name: "Cost", count: 7 },
    ],
  },
  {
    id: "run_004",
    label: "Run #4",
    date: "2026-06-28T09:00:00Z",
    health_score: 84,
    findings: 38,
    resolved: 31,
    categories: [
      { name: "Security", count: 6 },
      { name: "Performance", count: 11 },
      { name: "Architecture", count: 8 },
      { name: "Reliability", count: 6 },
      { name: "Cost", count: 7 },
    ],
  },
  {
    id: "run_005",
    label: "Run #5",
    date: "2026-06-30T10:00:00Z",
    health_score: 87,
    findings: 34,
    resolved: 29,
    categories: [
      { name: "Security", count: 5 },
      { name: "Performance", count: 9 },
      { name: "Architecture", count: 7 },
      { name: "Reliability", count: 6 },
      { name: "Cost", count: 7 },
    ],
  },
];

// ─── Analysis Run Comparisons API ────────────────────────────────────────────

/**
 * Get all analysis runs for comparison selection.
 */
export async function getAnalysisRuns(): Promise<AnalysisRun[]> {
  try {
    const raw = await apiFetch<{
      data: AnalysisRun[];
    } | null>("/api/v1/analysis/runs", null);

    if (!raw?.data?.length) return MOCK_ANALYSIS_RUNS;
    return raw.data;
  } catch {
    return MOCK_ANALYSIS_RUNS;
  }
}

/**
 * Get comparison data between two analysis runs.
 */
export async function getComparisonData(
  runAId: string,
  runBId: string,
): Promise<ComparisonData | null> {
  try {
    const raw = await apiFetch<{
      data: ComparisonData;
    } | null>(`/api/v1/analysis/compare?run_a=${encodeURIComponent(runAId)}&run_b=${encodeURIComponent(runBId)}`, null);

    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock computation
  }

  // Compute from mock data
  const runA = MOCK_ANALYSIS_RUNS.find((r) => r.id === runAId);
  const runB = MOCK_ANALYSIS_RUNS.find((r) => r.id === runBId);

  if (!runA || !runB) return null;

  const resRateA = runA.findings > 0 ? (runA.resolved / runA.findings) * 100 : 0;
  const resRateB = runB.findings > 0 ? (runB.resolved / runB.findings) * 100 : 0;

  return {
    runA,
    runB,
    health_delta: runB.health_score - runA.health_score,
    findings_delta: runB.findings - runA.findings,
    resolution_rate_a: Math.round(resRateA * 10) / 10,
    resolution_rate_b: Math.round(resRateB * 10) / 10,
    resolution_rate_delta: Math.round((resRateB - resRateA) * 10) / 10,
    new_findings: Math.max(0, runB.findings - runA.resolved),
    findings_resolved: Math.max(0, runA.findings - runB.findings + runB.resolved - runA.resolved),
  };
}

// ─── Search Types ────────────────────────────────────────────────────────────

export interface SearchResult {
  type: string;
  id: string;
  name: string;
  match: string;
  score: number;
}

// ─── Search Mock Data ────────────────────────────────────────────────────────

const MOCK_SEARCH_RESULTS: SearchResult[] = [
  { type: "opportunity", id: "OPP-2847", name: "Migrate legacy authentication to OAuth 2.1 PKCE flow", match: "OAuth 2.1 PKCE migration for improved security", score: 0.97 },
  { type: "finding", id: "FND-0042", name: "N+1 query pattern in order processing", match: "Detected N+1 query pattern causing 340% latency increase", score: 0.93 },
  { type: "entity", id: "ent_auth_service", name: "auth-service", match: "Authentication microservice handling OAuth flows", score: 0.89 },
  { type: "policy", id: "builtin-security", name: "Security Policies", match: "Ensure security-related findings are prioritized", score: 0.85 },
  { type: "experiment", id: "exp_002", name: "Auto-Fix Security", match: "Evaluate automatic security vulnerability fixing", score: 0.82 },
  { type: "entity", id: "ent_payment_gw", name: "payment-gateway", match: "External payment gateway integration module", score: 0.78 },
  { type: "finding", id: "FND-0019", name: "Docker image size exceeds 1.2GB", match: "Production images include build dependencies", score: 0.74 },
  { type: "opportunity", id: "OPP-2835", name: "Implement circuit breaker for payment gateway", match: "Circuit breaker pattern for external service resilience", score: 0.71 },
];

// ─── Search API ──────────────────────────────────────────────────────────────

/**
 * Full-text search across all resource types via `GET /api/v1/search`.
 *
 * Searches opportunities, findings, entities, policies, and experiments.
 * Falls back to mock data when the API server is unreachable.
 *
 * @param query - The search query string.
 * @param scope - Optional scope filter (e.g. "opportunity", "finding", "entity").
 */
export async function searchAll(
  query: string,
  scope?: string,
): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams();
    params.set("q", query);
    if (scope) params.set("scope", scope);

    const raw = await apiFetch<{
      data: SearchResult[];
      total: number;
    } | null>(`/api/v1/search?${params.toString()}`, null);

    if (raw?.data?.length) return raw.data;
  } catch {
    // Fall through to mock filtering
  }

  // Filter mock results by query (case-insensitive substring match)
  const q = query.toLowerCase();
  let results = MOCK_SEARCH_RESULTS.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.match.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q),
  );

  // Apply scope filter if provided
  if (scope) {
    results = results.filter((r) => r.type === scope);
  }

  // Return all mock results if query is too broad (fallback)
  return results.length > 0 ? results : MOCK_SEARCH_RESULTS;
}

// ─── Findings Page Types ─────────────────────────────────────────────────────

export interface FindingsPageItem {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium" | "low";
  category: string;
  status: "open" | "resolved" | "suppressed";
  assignee: string;
  created_at: string;
}

export interface FindingsPageData {
  findings: FindingsPageItem[];
  stats: {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

// ─── Findings Page Mock Data ─────────────────────────────────────────────────

const MOCK_FINDINGS_PAGE: FindingsPageData = {
  findings: [
    { id: "FND-001", title: "SQL injection vulnerability in user search endpoint", severity: "critical", category: "Security", status: "open", assignee: "Alice Chen", created_at: "2026-06-30T08:12:00Z" },
    { id: "FND-002", title: "Hardcoded API key in configuration module", severity: "critical", category: "Security", status: "open", assignee: "Bob Kim", created_at: "2026-06-29T14:30:00Z" },
    { id: "FND-003", title: "Memory leak in WebSocket connection handler", severity: "high", category: "Performance", status: "open", assignee: "Carol Diaz", created_at: "2026-06-29T09:15:00Z" },
    { id: "FND-004", title: "Missing rate limiting on public API endpoints", severity: "high", category: "Security", status: "open", assignee: "Alice Chen", created_at: "2026-06-28T16:45:00Z" },
    { id: "FND-005", title: "Circular dependency between order and inventory modules", severity: "medium", category: "Architecture", status: "resolved", assignee: "Dave Patel", created_at: "2026-06-28T11:20:00Z" },
    { id: "FND-006", title: "Unhandled promise rejection in payment callback", severity: "high", category: "Reliability", status: "open", assignee: "Eve Torres", created_at: "2026-06-27T15:00:00Z" },
    { id: "FND-007", title: "Missing CSRF protection on state-changing endpoints", severity: "medium", category: "Security", status: "suppressed", assignee: "Alice Chen", created_at: "2026-06-27T10:30:00Z" },
    { id: "FND-008", title: "Excessive logging causing disk space issues", severity: "low", category: "Operations", status: "resolved", assignee: "Frank Nguyen", created_at: "2026-06-26T14:15:00Z" },
    { id: "FND-009", title: "Deprecated crypto algorithm in token generation", severity: "medium", category: "Security", status: "open", assignee: "Bob Kim", created_at: "2026-06-26T09:00:00Z" },
    { id: "FND-010", title: "Missing health check endpoint for load balancer", severity: "low", category: "Reliability", status: "open", assignee: "Carol Diaz", created_at: "2026-06-25T17:30:00Z" },
  ],
  stats: { total: 10, critical: 2, high: 3, medium: 3, low: 2 },
};

// ─── Findings Page API ───────────────────────────────────────────────────────

/**
 * Get findings page data with stats and filterable list.
 */
export async function getFindingsPage(): Promise<FindingsPageData> {
  try {
    const raw = await apiFetch<{ data: FindingsPageData } | null>(
      "/api/v1/findings/page",
      null,
    );
    return raw?.data ?? MOCK_FINDINGS_PAGE;
  } catch {
    return MOCK_FINDINGS_PAGE;
  }
}

// ─── Health Dashboard Types ──────────────────────────────────────────────────

export interface ServiceStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency_ms?: number;
  uptime_percent?: number;
  last_check: string;
}

export interface HealthDashboardData {
  overall_score: number;
  api_latency_ms: number;
  memory_usage_percent: number;
  cpu_usage_percent: number;
  uptime_days: number;
  services: ServiceStatus[];
}

// ─── Health Dashboard Mock Data ──────────────────────────────────────────────

const MOCK_HEALTH_DASHBOARD: HealthDashboardData = {
  overall_score: 92,
  api_latency_ms: 142,
  memory_usage_percent: 67,
  cpu_usage_percent: 34,
  uptime_days: 42,
  services: [
    { name: "Database (PostgreSQL)", status: "healthy", latency_ms: 8, uptime_percent: 99.99, last_check: "2026-06-30T20:40:00Z" },
    { name: "Cache (Redis)", status: "healthy", latency_ms: 2, uptime_percent: 99.98, last_check: "2026-06-30T20:40:00Z" },
    { name: "Queue (RabbitMQ)", status: "degraded", latency_ms: 45, uptime_percent: 99.85, last_check: "2026-06-30T20:40:00Z" },
    { name: "Storage (S3)", status: "healthy", latency_ms: 22, uptime_percent: 99.99, last_check: "2026-06-30T20:40:00Z" },
  ],
};

// ─── Health Dashboard API ────────────────────────────────────────────────────

/**
 * Get system health dashboard data.
 */
export async function getHealthDashboard(): Promise<HealthDashboardData> {
  try {
    const raw = await apiFetch<{ data: HealthDashboardData } | null>(
      "/api/v1/health/dashboard",
      null,
    );
    return raw?.data ?? MOCK_HEALTH_DASHBOARD;
  } catch {
    return MOCK_HEALTH_DASHBOARD;
  }
}

// ─── Snapshots Page Types ────────────────────────────────────────────────────

export interface ProjectSnapshot {
  id: string;
  date: string;
  health_score: number;
  findings_count: number;
  opportunities_count: number;
  trigger: "manual" | "scheduled" | "ci";
  summary: string;
  dimensions: Record<string, number>;
}

// ─── Snapshots Mock Data ─────────────────────────────────────────────────────

const MOCK_PROJECT_SNAPSHOTS: ProjectSnapshot[] = [
  { id: "snap-2026-06-30", date: "2026-06-30T10:02:34Z", health_score: 87, findings_count: 47, opportunities_count: 23, trigger: "scheduled", summary: "Steady improvement in architecture and security dimensions. 4 new opportunities identified.", dimensions: { architecture: 72, security: 58, reliability: 85, testing: 62 } },
  { id: "snap-2026-06-29", date: "2026-06-29T09:01:48Z", health_score: 82, findings_count: 42, opportunities_count: 19, trigger: "scheduled", summary: "Moderate progress with 3 opportunities resolved. Queue latency slightly elevated.", dimensions: { architecture: 68, security: 54, reliability: 84, testing: 60 } },
  { id: "snap-2026-06-28", date: "2026-06-28T14:32:12Z", health_score: 76, findings_count: 51, opportunities_count: 25, trigger: "manual", summary: "Spike in findings after new analyzer rules added. Security score dropped due to deprecated auth flow.", dimensions: { architecture: 65, security: 48, reliability: 83, testing: 58 } },
  { id: "snap-2026-06-27", date: "2026-06-27T08:16:55Z", health_score: 74, findings_count: 38, opportunities_count: 17, trigger: "scheduled", summary: "Baseline analysis after infrastructure changes. Reliability improved after circuit breaker addition.", dimensions: { architecture: 63, security: 47, reliability: 82, testing: 55 } },
  { id: "snap-2026-06-25", date: "2026-06-25T16:02:20Z", health_score: 71, findings_count: 55, opportunities_count: 28, trigger: "ci", summary: "CI-triggered analysis after major merge. High number of findings from new code paths.", dimensions: { architecture: 60, security: 45, reliability: 80, testing: 52 } },
  { id: "snap-2026-06-23", date: "2026-06-23T10:30:00Z", health_score: 69, findings_count: 48, opportunities_count: 22, trigger: "manual", summary: "Manual analysis requested by team lead. Focus on performance bottlenecks.", dimensions: { architecture: 58, security: 44, reliability: 78, testing: 50 } },
  { id: "snap-2026-06-20", date: "2026-06-20T08:00:00Z", health_score: 65, findings_count: 52, opportunities_count: 30, trigger: "scheduled", summary: "Weekly scheduled analysis. Architecture score improving after refactoring sprint.", dimensions: { architecture: 55, security: 42, reliability: 76, testing: 48 } },
  { id: "snap-2026-06-15", date: "2026-06-15T14:00:00Z", health_score: 60, findings_count: 58, opportunities_count: 35, trigger: "scheduled", summary: "Initial baseline scan of the codebase. Identified key areas for improvement.", dimensions: { architecture: 50, security: 38, reliability: 72, testing: 45 } },
];

// ─── Snapshots API ───────────────────────────────────────────────────────────

/**
 * Get project snapshots for the timeline page.
 */
export async function getSnapshots(): Promise<ProjectSnapshot[]> {
  try {
    const raw = await apiFetch<{ data: ProjectSnapshot[]; total: number } | null>(
      "/api/v1/snapshots",
      null,
    );
    if (!raw?.data?.length) return MOCK_PROJECT_SNAPSHOTS;
    return raw.data;
  } catch {
    return MOCK_PROJECT_SNAPSHOTS;
  }
}

// ─── Policy Detail Types ─────────────────────────────────────────────────────

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

// ─── Policy Detail Mock Data ─────────────────────────────────────────────────

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

// ─── Policy Detail API ───────────────────────────────────────────────────────

/**
 * Get a single policy detail by ID.
 */
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

// ─── Batch Job Detail Types ──────────────────────────────────────────────────

export interface BatchJobTask {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at?: string;
  completed_at?: string;
  error?: string;
  findings_count?: number;
}

export interface BatchJobDetail {
  batch_id: string;
  name: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_percent: number;
  items_processed: number;
  total_items: number;
  duration_ms: number;
  started_at: string;
  completed_at?: string;
  tasks: BatchJobTask[];
  errors: string[];
}

// ─── Batch Job Detail Mock Data ──────────────────────────────────────────────

const MOCK_BATCH_JOB_DETAILS: Record<string, BatchJobDetail> = {
  batch_000003: {
    batch_id: "batch_000003",
    name: "Multi-Repo Analysis — Sprint 12",
    status: "running",
    progress_percent: 45,
    items_processed: 1,
    total_items: 3,
    duration_ms: 135000,
    started_at: "2026-06-30T14:00:00Z",
    tasks: [
      { id: "task-001", name: "api-gateway analysis", status: "completed", started_at: "2026-06-30T14:00:00Z", completed_at: "2026-06-30T14:02:15Z", findings_count: 12 },
      { id: "task-002", name: "auth-service analysis", status: "running", started_at: "2026-06-30T14:02:16Z" },
      { id: "task-003", name: "payment-service analysis", status: "pending" },
    ],
    errors: [],
  },
  batch_000002: {
    batch_id: "batch_000002",
    name: "Frontend Services Scan",
    status: "completed",
    progress_percent: 100,
    items_processed: 3,
    total_items: 3,
    duration_ms: 480000,
    started_at: "2026-06-29T10:00:00Z",
    completed_at: "2026-06-29T10:08:00Z",
    tasks: [
      { id: "task-004", name: "web-client analysis", status: "completed", started_at: "2026-06-29T10:00:00Z", completed_at: "2026-06-29T10:03:45Z", findings_count: 23 },
      { id: "task-005", name: "admin-portal analysis", status: "completed", started_at: "2026-06-29T10:03:46Z", completed_at: "2026-06-29T10:06:12Z", findings_count: 15 },
      { id: "task-006", name: "notification-service analysis", status: "completed", started_at: "2026-06-29T10:06:13Z", completed_at: "2026-06-29T10:08:00Z", findings_count: 8 },
    ],
    errors: [],
  },
  batch_000001: {
    batch_id: "batch_000001",
    name: "Backend Services Audit",
    status: "failed",
    progress_percent: 67,
    items_processed: 2,
    total_items: 3,
    duration_ms: 300000,
    started_at: "2026-06-28T08:00:00Z",
    completed_at: "2026-06-28T08:05:00Z",
    tasks: [
      { id: "task-007", name: "order-service analysis", status: "completed", started_at: "2026-06-28T08:00:00Z", completed_at: "2026-06-28T08:02:30Z", findings_count: 19 },
      { id: "task-008", name: "inventory-service analysis", status: "failed", started_at: "2026-06-28T08:02:31Z", completed_at: "2026-06-28T08:03:10Z", error: "Analysis failed: unable to parse project configuration" },
      { id: "task-009", name: "search-service analysis", status: "completed", started_at: "2026-06-28T08:03:11Z", completed_at: "2026-06-28T08:05:00Z", findings_count: 11 },
    ],
    errors: ["inventory-service: Analysis failed — unable to parse project configuration. Check .recurrsive.yaml for syntax errors."],
  },
};

// ─── Batch Job Detail API ────────────────────────────────────────────────────

/**
 * Get a single batch job detail by ID.
 */
export async function getBatchJob(id: string): Promise<BatchJobDetail | null> {
  try {
    const raw = await apiFetch<{ data: BatchJobDetail } | null>(
      `/api/v1/batch/${encodeURIComponent(id)}`,
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_BATCH_JOB_DETAILS[id] ?? null;
}

// ─── Notification Detail Types ───────────────────────────────────────────────

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

// ─── Notification Detail Mock Data ───────────────────────────────────────────

const MOCK_NOTIFICATION_DETAILS: Record<string, NotificationDetail> = {
  notif_000001: {
    id: "notif_000001",
    title: "Analysis completed successfully",
    type: "success",
    severity: "info",
    source: "Analysis Engine",
    timestamp: "2026-06-30T10:02:34Z",
    message: "Full analysis run completed successfully. Found 47 findings across 23 opportunities. Overall health score improved from 82 to 87. Key improvements include architecture (+4) and security (+4) dimensions.",
    read: true,
    dismissed: false,
    related_items: [
      { type: "opportunity", id: "OPP-2847", title: "Migrate legacy authentication to OAuth 2.1 PKCE flow" },
      { type: "opportunity", id: "OPP-2843", title: "Optimize N+1 query pattern in order processing" },
    ],
  },
  notif_000002: {
    id: "notif_000002",
    title: "Health score dropped below threshold",
    type: "warning",
    severity: "warning",
    source: "Health Monitor",
    timestamp: "2026-06-29T15:30:00Z",
    message: "The project health score has dropped below the configured threshold of 80. Current score: 76. Primary factors: security dimension declined to 48 (-6 points) and testing coverage dropped to 58%. Immediate review recommended.",
    read: true,
    dismissed: false,
    related_items: [
      { type: "finding", id: "FND-002", title: "Hardcoded API key in configuration module" },
      { type: "policy", id: "builtin-security", title: "Security Policies" },
    ],
  },
  notif_000003: {
    id: "notif_000003",
    title: "Policy violation detected in auth-service",
    type: "error",
    severity: "critical",
    source: "Policy Engine",
    timestamp: "2026-06-29T09:15:00Z",
    message: "Critical policy violation detected: Security Policies rule 'Security Review Required' was triggered for opportunity OPP-2847 (Migrate legacy authentication). This change requires security team review before proceeding. Delivery via HTTP webhook failed — endpoint returned 503.",
    read: false,
    dismissed: false,
    related_items: [
      { type: "policy", id: "builtin-security", title: "Security Policies" },
      { type: "opportunity", id: "OPP-2847", title: "Migrate legacy authentication to OAuth 2.1 PKCE flow" },
      { type: "finding", id: "FND-001", title: "SQL injection vulnerability in user search endpoint" },
    ],
  },
  notif_000004: {
    id: "notif_000004",
    title: "New opportunity identified: N+1 query optimization",
    type: "info",
    severity: "info",
    source: "Analysis Engine",
    timestamp: "2026-06-28T14:45:00Z",
    message: "A new high-impact opportunity has been identified. N+1 query pattern detected in the order processing pipeline causing 340% latency increase under load. Estimated ROI: 94. Recommended fix involves adding eager loading and a composite index.",
    read: true,
    dismissed: false,
    related_items: [
      { type: "opportunity", id: "OPP-2843", title: "Optimize N+1 query pattern in order processing" },
    ],
  },
  notif_000005: {
    id: "notif_000005",
    title: "Circuit breaker tripped for payment gateway",
    type: "error",
    severity: "critical",
    source: "Reliability Monitor",
    timestamp: "2026-06-28T11:20:00Z",
    message: "The circuit breaker for the external payment gateway has tripped due to sustained 5xx errors. Payment processing is currently in fallback mode — failed payments are being queued for retry. This is the 3rd incident in 30 days. The opportunity to implement a proper circuit breaker (OPP-2835) should be prioritized.",
    read: true,
    dismissed: false,
    related_items: [
      { type: "opportunity", id: "OPP-2835", title: "Implement circuit breaker for payment gateway" },
      { type: "finding", id: "FND-006", title: "Unhandled promise rejection in payment callback" },
    ],
  },
};

// ─── Notification Detail API ─────────────────────────────────────────────────

/**
 * Get a single notification detail by ID.
 */
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

// ─── Simulations ─────────────────────────────────────────────────────────────

export interface SimulationScenario {
  id: string;
  name: string;
  type: 'monte-carlo' | 'stress-test' | 'what-if' | 'chaos';
  status: 'completed' | 'running' | 'queued' | 'failed';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  impactScore: number;
  duration: string;
  createdAt: string;
  metrics: { label: string; value: string }[];
  timeline: { time: string; label: string; impact: number }[];
}

const MOCK_SIMULATIONS: SimulationScenario[] = [
  {
    id: 'sim-001', name: 'Dependency Cascade Failure', type: 'chaos',
    status: 'completed', riskLevel: 'critical', impactScore: 92, duration: '4m 12s',
    createdAt: '2026-06-30', metrics: [{ label: 'Affected Services', value: '14' }, { label: 'Recovery Time', value: '38m' }],
    timeline: [{ time: '0:00', label: 'Inject failure', impact: -5 }, { time: '0:45', label: 'Cascade begins', impact: -32 }, { time: '2:10', label: 'Alert triggered', impact: 0 }, { time: '4:12', label: 'Recovery complete', impact: 18 }],
  },
  {
    id: 'sim-002', name: 'Traffic Spike 10x', type: 'stress-test',
    status: 'completed', riskLevel: 'high', impactScore: 74, duration: '8m 03s',
    createdAt: '2026-06-29', metrics: [{ label: 'P99 Latency', value: '2.4s' }, { label: 'Error Rate', value: '3.1%' }],
    timeline: [{ time: '0:00', label: 'Ramp up traffic', impact: -2 }, { time: '3:00', label: 'Peak load', impact: -28 }, { time: '6:00', label: 'Auto-scale kicks in', impact: 12 }, { time: '8:03', label: 'Stabilized', impact: 5 }],
  },
  {
    id: 'sim-003', name: 'Config Drift Projection', type: 'what-if',
    status: 'completed', riskLevel: 'medium', impactScore: 45, duration: '1m 58s',
    createdAt: '2026-06-28', metrics: [{ label: 'Drift Items', value: '7' }, { label: 'Compliance Gap', value: '12%' }],
    timeline: [{ time: '0:00', label: 'Baseline captured', impact: 0 }, { time: '0:30', label: 'Drift injected', impact: -15 }, { time: '1:58', label: 'Report generated', impact: 0 }],
  },
  {
    id: 'sim-004', name: 'Cost Optimization Model', type: 'monte-carlo',
    status: 'running', riskLevel: 'low', impactScore: 28, duration: '—',
    createdAt: '2026-07-01', metrics: [{ label: 'Iterations', value: '4,200 / 10,000' }, { label: 'Est. Savings', value: '$12.4k/mo' }],
    timeline: [{ time: '0:00', label: 'Sampling started', impact: 0 }],
  },
  {
    id: 'sim-005', name: 'Security Posture Breach', type: 'chaos',
    status: 'queued', riskLevel: 'high', impactScore: 0, duration: '—',
    createdAt: '2026-07-01', metrics: [],
    timeline: [],
  },
];

export async function getSimulations(): Promise<SimulationScenario[]> {
  try {
    const res = await apiFetch<{ simulations: SimulationScenario[] } | null>(
      '/api/v1/simulations', null,
    );
    if (res?.simulations) return res.simulations;
  } catch {
    // Fall through to mock
  }
  return MOCK_SIMULATIONS;
}

export async function getSimulation(id: string): Promise<SimulationScenario | null> {
  try {
    const raw = await apiFetch<SimulationScenario | null>(`/api/v1/simulations/${id}`, null);
    if (raw) return raw;
  } catch {
    // Fall through to mock
  }
  return MOCK_SIMULATIONS.find(s => s.id === id) ?? null;
}

export async function createSimulation(params: {
  name: string;
  type: SimulationScenario['type'];
}): Promise<SimulationScenario> {
  const res = await fetch(`${API_BASE}/api/v1/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`Failed to create simulation: ${res.status}`);
  return (await res.json()) as SimulationScenario;
}

// ─── Forecasting Types ───────────────────────────────────────────────────────

export interface ForecastData {
  currentScore: number;
  trend: 'improving' | 'declining' | 'stable';
  trendStrength: number;
  confidence: number;
  history: Array<{ date: string; score: number }>;
  forecast: Array<{ date: string; predicted: number; lowerBound: number; upperBound: number }>;
  targets: Array<{ target: number; daysToReach: number | null; reachable: boolean }>;
  regression: { slope: number; intercept: number; r2: number };
}

export interface EvolutionEvent {
  id: string;
  date: string;
  type: 'decision' | 'milestone' | 'incident' | 'experiment';
  title: string;
  description: string;
  outcome: string;
  healthImpact: number;
  learnings: string[];
}

export interface EvolutionData {
  events: EvolutionEvent[];
  trajectory: Array<{ date: string; score: number; event: string }>;
  currentScore: number;
  totalDecisions: number;
  totalMilestones: number;
  totalIncidents: number;
  totalExperiments: number;
  netHealthImpact: number;
  allLearnings: string[];
}

export interface WhatIfResult {
  currentScore: number;
  projectedScore: number;
  totalImpact: number;
  actions: Array<{
    id: string;
    type: string;
    description: string;
    impact: {
      healthScoreDelta: number;
      confidence: number;
      timeToRealize: string;
      affectedDimensions: string[];
    };
  }>;
  summary: {
    highestImpact: string | null;
    totalActions: number;
    avgConfidence: number;
    recommendation: string;
  };
}

// ─── Forecasting Mock Data ───────────────────────────────────────────────────

const MOCK_FORECAST: ForecastData = {
  currentScore: 84,
  trend: 'improving',
  trendStrength: 0.32,
  confidence: 0.78,
  history: Array.from({ length: 30 }, (_, i) => ({
    date: `2026-06-${String(i + 1).padStart(2, '0')}`,
    score: Math.round((72 + i * 0.4 + (seededRandom(i * 137) * 6 - 3)) * 10) / 10,
  })),
  forecast: Array.from({ length: 30 }, (_, i) => {
    const predicted = Math.min(100, 84 + (i + 1) * 0.32);
    const uncertainty = Math.min(15, (i + 1) * 0.25);
    return {
      date: `2026-07-${String(i + 1).padStart(2, '0')}`,
      predicted: Math.round(predicted * 10) / 10,
      lowerBound: Math.round(Math.max(0, predicted - uncertainty) * 10) / 10,
      upperBound: Math.round(Math.min(100, predicted + uncertainty) * 10) / 10,
    };
  }),
  targets: [
    { target: 90, daysToReach: 19, reachable: true },
    { target: 80, daysToReach: 0, reachable: true },
    { target: 70, daysToReach: 0, reachable: true },
    { target: 60, daysToReach: 0, reachable: true },
  ],
  regression: { slope: 0.32, intercept: 71.5, r2: 0.78 },
};

const MOCK_EVOLUTION: EvolutionData = {
  events: [
    {
      id: 'evo-001', date: '2026-01-15', type: 'decision',
      title: 'Adopt multi-agent reasoning architecture',
      description: 'Replaced single-pass analysis with 19-specialist debate engine.',
      outcome: 'positive', healthImpact: 12,
      learnings: ['Debate protocol significantly improved finding accuracy', 'Specialist diversity matters more than count'],
    },
    {
      id: 'evo-002', date: '2026-02-20', type: 'milestone',
      title: 'Knowledge graph migration to dual-backend',
      description: 'Added SQLite alongside Apache AGE for development workflows.',
      outcome: 'positive', healthImpact: 5,
      learnings: ['SQLite backend eliminates PostgreSQL dependency for dev', 'Query interface abstraction was key to clean migration'],
    },
    {
      id: 'evo-003', date: '2026-03-10', type: 'incident',
      title: 'Dependency vulnerability in oauth-lib v3',
      description: 'OWASP A07:2021 flagged during automated scan.',
      outcome: 'resolved', healthImpact: -8,
      learnings: ['Automated dependency scanning caught this early', 'Need policy for mandatory lockfile updates'],
    },
    {
      id: 'evo-004', date: '2026-04-05', type: 'decision',
      title: 'Add JWT auth + RBAC to REST API',
      description: 'Enterprise-grade authentication with role-based access control.',
      outcome: 'positive', healthImpact: 7,
      learnings: ['API key support essential for CI/CD integration', 'Three-tier RBAC (admin/analyst/viewer) covers most use cases'],
    },
    {
      id: 'evo-005', date: '2026-05-15', type: 'experiment',
      title: 'TypeScript strict mode trial',
      description: 'Enabled strict mode in @recurrsive/core as a pilot.',
      outcome: 'positive', healthImpact: 3,
      learnings: ['Found 12 type-safety issues', 'strictNullChecks was the highest-value flag'],
    },
    {
      id: 'evo-006', date: '2026-06-01', type: 'decision',
      title: 'Expand collectors to GitLab + telemetry',
      description: 'Added GitLab CI/CD and OpenTelemetry data collection.',
      outcome: 'positive', healthImpact: 6,
      learnings: ['Collector interface abstraction makes new integrations fast', 'Governance filtering is critical for enterprise adoption'],
    },
    {
      id: 'evo-007', date: '2026-06-20', type: 'milestone',
      title: 'Dashboard executive intelligence view',
      description: 'Added KPI dashboards, risk assessment, and trend visualization.',
      outcome: 'positive', healthImpact: 4,
      learnings: ['Executive stakeholders need different data than engineers', 'Health score trend is the single most-watched metric'],
    },
  ],
  trajectory: [
    { date: '2026-01-15', score: 67, event: 'Adopt multi-agent reasoning architecture' },
    { date: '2026-02-20', score: 72, event: 'Knowledge graph migration to dual-backend' },
    { date: '2026-03-10', score: 64, event: 'Dependency vulnerability in oauth-lib v3' },
    { date: '2026-04-05', score: 71, event: 'Add JWT auth + RBAC to REST API' },
    { date: '2026-05-15', score: 74, event: 'TypeScript strict mode trial' },
    { date: '2026-06-01', score: 80, event: 'Expand collectors to GitLab + telemetry' },
    { date: '2026-06-20', score: 84, event: 'Dashboard executive intelligence view' },
  ],
  currentScore: 84,
  totalDecisions: 3,
  totalMilestones: 2,
  totalIncidents: 1,
  totalExperiments: 1,
  netHealthImpact: 29,
  allLearnings: [
    'Debate protocol significantly improved finding accuracy',
    'Specialist diversity matters more than count',
    'SQLite backend eliminates PostgreSQL dependency for dev',
    'Query interface abstraction was key to clean migration',
    'Automated dependency scanning caught this early',
    'Need policy for mandatory lockfile updates',
    'API key support essential for CI/CD integration',
    'Three-tier RBAC (admin/analyst/viewer) covers most use cases',
    'Found 12 type-safety issues',
    'strictNullChecks was the highest-value flag',
    'Collector interface abstraction makes new integrations fast',
    'Governance filtering is critical for enterprise adoption',
    'Executive stakeholders need different data than engineers',
    'Health score trend is the single most-watched metric',
  ],
};

const MOCK_WHAT_IF: WhatIfResult = {
  currentScore: 78,
  projectedScore: 89.5,
  totalImpact: 11.5,
  actions: [
    {
      id: 'wia-001', type: 'fix-critical-findings', description: 'Fix Critical Findings',
      impact: { healthScoreDelta: 8.5, confidence: 0.9, timeToRealize: '7 days', affectedDimensions: ['security', 'reliability'] },
    },
    {
      id: 'wia-002', type: 'add-tests', description: 'Add Test Coverage',
      impact: { healthScoreDelta: 4.2, confidence: 0.85, timeToRealize: '14 days', affectedDimensions: ['testing', 'reliability', 'developer_experience'] },
    },
  ],
  summary: {
    highestImpact: 'fix-critical-findings',
    totalActions: 2,
    avgConfidence: 0.88,
    recommendation: 'Strong improvement potential. Prioritize the highest-confidence actions first.',
  },
};

// ─── Forecasting API ─────────────────────────────────────────────────────────

/**
 * Get health forecast data from `GET /api/v1/forecasting/health`.
 *
 * Server returns: `{ data: ForecastData, generatedAt }`
 * Falls back to mock data when the server is unavailable.
 */
export async function getForecast(): Promise<ForecastData> {
  try {
    const raw = await apiFetch<{ data: ForecastData } | null>(
      "/api/v1/forecasting/health",
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_FORECAST;
}

/**
 * Get evolution graph data from `GET /api/v1/forecasting/evolution`.
 *
 * Server returns: `{ data: EvolutionData, generatedAt }`
 * Falls back to mock data when the server is unavailable.
 */
export async function getEvolution(): Promise<EvolutionData> {
  try {
    const raw = await apiFetch<{ data: EvolutionData } | null>(
      "/api/v1/forecasting/evolution",
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_EVOLUTION;
}

/**
 * Simulate what-if impact via `POST /api/v1/forecasting/what-if`.
 *
 * Server returns: `{ data: WhatIfResult, generatedAt }`
 * Falls back to mock data when the server is unavailable.
 */
export async function getWhatIfAnalysis(params: {
  actions: Array<{ type: string; description: string }>;
}): Promise<WhatIfResult> {
  try {
    const res = await fetch(`${API_BASE}/api/v1/forecasting/what-if`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const json = (await res.json()) as { data: WhatIfResult };
    if (json?.data) return json.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_WHAT_IF;
}

// ─── Plugins ─────────────────────────────────────────────────────────────────

export interface InstalledPlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  enabled: boolean;
  health: 'healthy' | 'degraded' | 'error';
  type: 'analyzer' | 'collector' | 'reporter' | 'integration';
  installedAt: string;
}

export interface MarketplacePlugin {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  stars: number;
  downloads: number;
  type: 'analyzer' | 'collector' | 'reporter' | 'integration';
  verified: boolean;
}

const MOCK_INSTALLED_PLUGINS: InstalledPlugin[] = [
  { id: 'p1', name: 'ESLint Analyzer', version: '3.2.1', author: 'Recurrsive', description: 'Static analysis via ESLint rules', enabled: true, health: 'healthy', type: 'analyzer', installedAt: '2026-05-10' },
  { id: 'p2', name: 'Sonar Collector', version: '1.8.0', author: 'Community', description: 'Import findings from SonarQube', enabled: true, health: 'degraded', type: 'collector', installedAt: '2026-04-22' },
  { id: 'p3', name: 'Slack Notifier', version: '2.0.4', author: 'Recurrsive', description: 'Push notifications to Slack channels', enabled: false, health: 'healthy', type: 'integration', installedAt: '2026-06-01' },
  { id: 'p4', name: 'PDF Reporter', version: '1.3.0', author: 'Community', description: 'Generate PDF executive reports', enabled: true, health: 'error', type: 'reporter', installedAt: '2026-03-15' },
];

const MOCK_MARKETPLACE_PLUGINS: MarketplacePlugin[] = [
  { id: 'm1', name: 'Semgrep Analyzer', version: '2.1.0', author: 'r2c', description: 'Lightweight static analysis with custom rules', stars: 482, downloads: 12400, type: 'analyzer', verified: true },
  { id: 'm2', name: 'GitHub Collector', version: '1.5.2', author: 'Recurrsive', description: 'Sync issues and PRs from GitHub repos', stars: 314, downloads: 8900, type: 'collector', verified: true },
  { id: 'm3', name: 'Jira Integration', version: '3.0.1', author: 'Atlassian', description: 'Two-way sync with Jira tickets', stars: 256, downloads: 7200, type: 'integration', verified: true },
  { id: 'm4', name: 'HTML Reporter', version: '1.0.3', author: 'Community', description: 'Interactive HTML dashboards for reports', stars: 89, downloads: 2100, type: 'reporter', verified: false },
  { id: 'm5', name: 'Terraform Scanner', version: '0.9.0', author: 'Community', description: 'IaC security scanning for Terraform files', stars: 134, downloads: 3400, type: 'analyzer', verified: false },
];

export async function getInstalledPlugins(): Promise<InstalledPlugin[]> {
  try {
    const res = await apiFetch<{ plugins: InstalledPlugin[] } | null>('/api/v1/plugins', null);
    if (res?.plugins) return res.plugins;
  } catch { /* fall through */ }
  return MOCK_INSTALLED_PLUGINS;
}

export async function getMarketplacePlugins(): Promise<MarketplacePlugin[]> {
  try {
    const res = await apiFetch<{ plugins: MarketplacePlugin[] } | null>('/api/v1/plugins/marketplace', null);
    if (res?.plugins) return res.plugins;
  } catch { /* fall through */ }
  return MOCK_MARKETPLACE_PLUGINS;
}

// ─── Confidence ──────────────────────────────────────────────────────────────

export interface ConfidenceData {
  brierScore: number;
  brierTrend: number;
  totalPredictions: number;
  accuracy: number;
  calibration: { predicted: string; count: number; actualRate: number; deviation: number }[];
  analyzerAccuracy: { name: string; accuracy: number; predictions: number }[];
  recentPredictions: { id: string; description: string; predicted: number; actual: boolean; date: string; source: string }[];
}

const MOCK_CONFIDENCE: ConfidenceData = {
  brierScore: 0.142,
  brierTrend: -0.018,
  totalPredictions: 2847,
  accuracy: 87.3,
  calibration: [
    { predicted: '0-10%', count: 312, actualRate: 4.2, deviation: -3.8 },
    { predicted: '10-20%', count: 198, actualRate: 14.1, deviation: -0.9 },
    { predicted: '20-30%', count: 245, actualRate: 26.5, deviation: 1.5 },
    { predicted: '30-40%', count: 187, actualRate: 33.2, deviation: -1.8 },
    { predicted: '40-50%', count: 156, actualRate: 46.8, deviation: 1.8 },
    { predicted: '50-60%', count: 289, actualRate: 54.3, deviation: -0.7 },
    { predicted: '60-70%', count: 334, actualRate: 67.1, deviation: 2.1 },
    { predicted: '70-80%', count: 412, actualRate: 73.8, deviation: -1.2 },
    { predicted: '80-90%', count: 398, actualRate: 86.4, deviation: 1.4 },
    { predicted: '90-100%', count: 316, actualRate: 94.6, deviation: 0.6 },
  ],
  analyzerAccuracy: [
    { name: 'DependencyAnalyzer', accuracy: 94.2, predictions: 412 },
    { name: 'SecurityAnalyzer', accuracy: 91.8, predictions: 356 },
    { name: 'PerformanceAnalyzer', accuracy: 88.5, predictions: 289 },
    { name: 'CodeQualityAnalyzer', accuracy: 86.1, predictions: 534 },
    { name: 'AIRuntimeAnalyzer', accuracy: 82.4, predictions: 178 },
  ],
  recentPredictions: [
    { id: 'pred-1', description: 'CVE-2026-1234 exploitable in production', predicted: 0.89, actual: true, date: '2026-06-30', source: 'SecurityAnalyzer' },
    { id: 'pred-2', description: 'Memory leak in auth service', predicted: 0.72, actual: true, date: '2026-06-29', source: 'PerformanceAnalyzer' },
    { id: 'pred-3', description: 'Breaking API change in v3.2', predicted: 0.45, actual: false, date: '2026-06-28', source: 'APIContractAnalyzer' },
  ],
};

export async function getConfidenceData(): Promise<ConfidenceData> {
  try {
    const res = await apiFetch<ConfidenceData | null>('/api/v1/confidence', null);
    if (res) return res;
  } catch { /* fall through */ }
  return MOCK_CONFIDENCE;
}

// ─── Project Types ───────────────────────────────────────────────────────────

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  repository: string;
  language: string;
  framework: string;
  healthScore: number;
  lastAnalysis: string | null;
  createdAt: string;
  updatedAt: string;
  settings: {
    analyzers: string[];
    collectors: string[];
    autoAnalyze: boolean;
    notifyOnCritical: boolean;
  };
}

// ─── Project Mock Data ───────────────────────────────────────────────────────

const MOCK_PROJECTS: Project[] = [
  {
    id: "proj-001",
    name: "Recurrsive Engine",
    slug: "recurrsive-engine",
    description: "Core analysis engine powering recursive code intelligence and opportunity detection.",
    repository: "https://github.com/recurrsive/engine",
    language: "TypeScript",
    framework: "Node.js",
    healthScore: 87,
    lastAnalysis: "2026-06-30T10:02:34Z",
    createdAt: "2026-03-15T08:00:00Z",
    updatedAt: "2026-06-30T10:02:34Z",
    settings: {
      analyzers: ["architecture", "security", "performance", "documentation"],
      collectors: ["git", "npm", "eslint"],
      autoAnalyze: true,
      notifyOnCritical: true,
    },
  },
  {
    id: "proj-002",
    name: "Dashboard UI",
    slug: "dashboard-ui",
    description: "Next.js dashboard for visualizing analysis results and managing projects.",
    repository: "https://github.com/recurrsive/dashboard",
    language: "TypeScript",
    framework: "Next.js",
    healthScore: 92,
    lastAnalysis: "2026-06-29T14:30:00Z",
    createdAt: "2026-04-01T09:00:00Z",
    updatedAt: "2026-06-29T14:30:00Z",
    settings: {
      analyzers: ["architecture", "performance", "documentation"],
      collectors: ["git", "npm"],
      autoAnalyze: true,
      notifyOnCritical: false,
    },
  },
  {
    id: "proj-003",
    name: "API Gateway",
    slug: "api-gateway",
    description: "Central API gateway handling authentication, rate limiting, and request routing.",
    repository: "https://github.com/recurrsive/api-gateway",
    language: "Go",
    framework: "Gin",
    healthScore: 78,
    lastAnalysis: "2026-06-28T09:15:00Z",
    createdAt: "2026-02-20T10:00:00Z",
    updatedAt: "2026-06-28T09:15:00Z",
    settings: {
      analyzers: ["architecture", "security", "reliability"],
      collectors: ["git", "go-vet"],
      autoAnalyze: false,
      notifyOnCritical: true,
    },
  },
  {
    id: "proj-004",
    name: "ML Pipeline",
    slug: "ml-pipeline",
    description: "Machine learning pipeline for code pattern recognition and anomaly detection.",
    repository: "https://github.com/recurrsive/ml-pipeline",
    language: "Python",
    framework: "FastAPI",
    healthScore: 65,
    lastAnalysis: "2026-06-25T11:20:00Z",
    createdAt: "2026-05-10T14:00:00Z",
    updatedAt: "2026-06-25T11:20:00Z",
    settings: {
      analyzers: ["architecture", "performance"],
      collectors: ["git", "pip-audit"],
      autoAnalyze: true,
      notifyOnCritical: true,
    },
  },
];

// ─── Projects ────────────────────────────────────────────────────────────────

/**
 * Get all projects from `GET /api/v1/projects`.
 *
 * Server returns: `{ data: Project[] }`
 */
export async function getProjects(): Promise<Project[]> {
  try {
    const raw = await apiFetch<{ data: Project[] } | null>(
      "/api/v1/projects",
      null,
    );
    if (raw?.data?.length) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_PROJECTS;
}

/**
 * Get a single project by ID from `GET /api/v1/projects/:id`.
 *
 * Server returns: `{ data: Project }`
 */
export async function getProject(id: string): Promise<Project | null> {
  try {
    const raw = await apiFetch<{ data: Project } | null>(
      `/api/v1/projects/${encodeURIComponent(id)}`,
      null,
    );
    if (raw?.data) return raw.data;
  } catch {
    // Fall through to mock
  }
  return MOCK_PROJECTS.find((p) => p.id === id) ?? null;
}

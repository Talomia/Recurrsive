/**
 * @module Projects API
 *
 * Project management and batch operations.
 */

import { apiFetch } from './client';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_PROJECTS: Project[] = [
  {
    id: "proj-001",
    name: "Recurrsive Engine",
    slug: "recurrsive-engine",
    description: "Core analysis engine powering recursive code intelligence and opportunity detection.",
    repository: "https://github.com/recurrsive/engine",
    language: "TypeScript",
    framework: "Node",
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
    framework: "Next",
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

const MOCK_BATCH_RUNS: BatchRun[] = [
  {
    batch_id: "batch_000003",
    status: "running",
    projects: [
      { path: "/home/user/projects/api-gateway", status: "completed", findings_count: 12, opportunities_count: 4, started_at: "2026-06-30T14:00:00Z", completed_at: "2026-06-30T14:02:15Z" },
      { path: "/home/user/projects/auth-service", status: "running", findings_count: 0, opportunities_count: 0, started_at: "2026-06-30T14:02:16Z" },
      { path: "/home/user/projects/payment-service", status: "pending" },
    ],
    created_at: "2026-06-30T14:00:00Z",
  },
  {
    batch_id: "batch_000002",
    status: "completed",
    projects: [
      { path: "/home/user/projects/web-client", status: "completed", findings_count: 23, opportunities_count: 8, started_at: "2026-06-29T10:00:00Z", completed_at: "2026-06-29T10:03:45Z" },
      { path: "/home/user/projects/admin-portal", status: "completed", findings_count: 15, opportunities_count: 5, started_at: "2026-06-29T10:03:46Z", completed_at: "2026-06-29T10:06:12Z" },
      { path: "/home/user/projects/notification-service", status: "completed", findings_count: 8, opportunities_count: 3, started_at: "2026-06-29T10:06:13Z", completed_at: "2026-06-29T10:08:00Z" },
    ],
    created_at: "2026-06-29T10:00:00Z",
    completed_at: "2026-06-29T10:08:00Z",
  },
  {
    batch_id: "batch_000001",
    status: "partial",
    projects: [
      { path: "/home/user/projects/order-service", status: "completed", findings_count: 19, opportunities_count: 6, started_at: "2026-06-28T08:00:00Z", completed_at: "2026-06-28T08:02:30Z" },
      { path: "/home/user/projects/inventory-service", status: "failed", error: "Analysis failed: unable to parse project configuration", started_at: "2026-06-28T08:02:31Z", completed_at: "2026-06-28T08:03:10Z" },
      { path: "/home/user/projects/search-service", status: "completed", findings_count: 11, opportunities_count: 4, started_at: "2026-06-28T08:03:11Z", completed_at: "2026-06-28T08:05:00Z" },
    ],
    created_at: "2026-06-28T08:00:00Z",
    completed_at: "2026-06-28T08:05:00Z",
  },
];

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

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get all projects from `GET /api/v1/projects`.
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

/**
 * Get batch analysis history from `GET /api/v1/batch/history`.
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

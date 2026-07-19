/**
 * @module Projects API
 *
 * Project management and batch operations.
 */

import { apiFetch, ApiError } from './client';

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
  started_at?: string | null;
  completed_at?: string | null;
  error?: string;
}

export interface BatchRun {
  batch_id: string;
  status: "pending" | "running" | "completed" | "partial" | "failed";
  projects: BatchProject[];
  options?: Record<string, unknown>;
  created_at: string;
  completed_at?: string | null;
}

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get all projects from `GET /api/v1/projects`.
 *
 * Throws on failure (network error, 5xx) rather than swallowing to `[]` — a
 * genuinely empty project list and an unreachable server are different states,
 * and callers must be able to tell them apart (a broken server must not render
 * the cheerful "create your first project" screen).
 */
export async function getProjects(): Promise<Project[]> {
  return await apiFetch<Project[]>("/api/v1/projects");
}

/**
 * Get a single project by ID from `GET /api/v1/projects/:id`.
 *
 * Returns null only for a genuine 404; other failures throw so a broken
 * server does not masquerade as "Project Not Found".
 */
export async function getProject(id: string): Promise<Project | null> {
  try {
    return await apiFetch<Project>(`/api/v1/projects/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Get batch analysis history from `GET /api/v1/batch/history`.
 * Throws on failure.
 */
export async function getBatchHistory(): Promise<BatchRun[]> {
  return await apiFetch<BatchRun[]>("/api/v1/batch/history");
}

/**
 * Get status of a specific batch run from `GET /api/v1/batch/status/:id`.
 *
 * Returns null only for a genuine 404; other failures throw.
 */
export async function getBatchStatus(id: string): Promise<BatchRun | null> {
  try {
    return await apiFetch<BatchRun>(`/api/v1/batch/status/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Get a single batch run detail by ID from `GET /api/v1/batch/:id`.
 *
 * Returns the canonical {@link BatchRun} shape (the same model the server
 * persists and returns from `/batch/status/:id`). Returns null only for a
 * genuine 404; other failures throw.
 */
export async function getBatchJob(id: string): Promise<BatchRun | null> {
  try {
    return await apiFetch<BatchRun>(`/api/v1/batch/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

/**
 * Submit a new batch analysis run via `POST /api/v1/batch/analyze`.
 */
export async function createBatchRun(data: {
  // A filesystem path, or a { gitUrl, projectId } target for a server project.
  projects: Array<string | { path?: string; gitUrl?: string; projectId?: string }>;
  options?: Record<string, unknown>;
}): Promise<{ batch_id: string; status: string; projects: { path: string; status: string }[] }> {
  return await apiFetch<{ batch_id: string; status: string; projects: { path: string; status: string }[] }>(
    '/api/v1/batch/analyze',
    {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      unwrap: false,
    },
  );
}

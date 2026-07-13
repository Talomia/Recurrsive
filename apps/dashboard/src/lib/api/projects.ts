/**
 * @module Projects API
 *
 * Project management and batch operations.
 */

import { ApiError, apiFetch } from './client';

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
  };
}

export interface BatchProject {
  projectId: string;
  name: string;
  repository: string;
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

// ─── API ─────────────────────────────────────────────────────────────────────

/**
 * Get all projects from `GET /api/v1/projects`.
 */
export async function getProjects(): Promise<Project[]> {
  return apiFetch<Project[]>("/api/v1/projects");
}

/**
 * Get a single project by ID from `GET /api/v1/projects/:id`.
 */
export async function getProject(id: string): Promise<Project | null> {
  try {
    return await apiFetch<Project>(`/api/v1/projects/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Get batch analysis history from `GET /api/v1/batch/history`.
 */
export async function getBatchHistory(): Promise<BatchRun[]> {
  return apiFetch<BatchRun[]>("/api/v1/batch/history");
}

/**
 * Get status of a specific batch run from `GET /api/v1/batch/status/:id`.
 */
export async function getBatchStatus(id: string): Promise<BatchRun | null> {
  try {
    return await apiFetch<BatchRun>(`/api/v1/batch/status/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Get a single batch job detail by ID.
 */
export async function getBatchJob(id: string): Promise<BatchRun | null> {
  try {
    return await apiFetch<BatchRun>(`/api/v1/batch/status/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Submit a new batch analysis run via `POST /api/v1/batch/analyze`.
 */
export async function createBatchRun(data: {
  projectIds: string[];
  options?: Record<string, unknown>;
}): Promise<{ batch_id: string; status: string; projects: { projectId: string; name: string; status: string }[] }> {
  return await apiFetch<{ batch_id: string; status: string; projects: { projectId: string; name: string; status: string }[] }>(
    '/api/v1/batch/analyze',
    {
      method: 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
      unwrap: false,
    },
  );
}

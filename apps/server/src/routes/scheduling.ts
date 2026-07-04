/**
 * @module @recurrsive/server/routes/scheduling
 *
 * Report scheduling and automated export routes.
 *
 * Provides CRUD for scheduled reports with cron expressions, immediate
 * generation triggers, and format selection (PDF, HTML, Markdown, SARIF, JSON).
 *
 * @packageDocumentation
 */

import type { FastifyInstance } from 'fastify';
import { generateId, nowISO } from '@recurrsive/core';
import { authMiddleware } from '../middleware/auth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportFormat = 'pdf' | 'html' | 'markdown' | 'sarif' | 'json';
type ScheduleStatus = 'active' | 'paused' | 'error';

interface ScheduledReport {
  id: string;
  name: string;
  description: string;
  /** Cron expression for schedule (e.g., '0 9 * * 1' = Monday 9am). */
  schedule: string;
  /** Timezone for schedule evaluation. */
  timezone: string;
  /** Output format(s). */
  formats: ReportFormat[];
  /** Analyzers to include (empty = all). */
  analyzers: string[];
  /** Recipients (email addresses). */
  recipients: string[];
  /** Report sections to include. */
  sections: Array<'summary' | 'findings' | 'opportunities' | 'trends' | 'health' | 'comparison'>;
  /** Whether to include executive summary. */
  includeExecutiveSummary: boolean;
  status: ScheduleStatus;
  lastRunAt: string | null;
  nextRunAt: string;
  totalRuns: number;
  createdAt: string;
  updatedAt: string;
}

interface ReportRun {
  id: string;
  scheduleId: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  format: ReportFormat;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  sizeBytes: number;
  downloadUrl: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

const schedules: Map<string, ScheduledReport> = new Map();
const runs: ReportRun[] = [];

// Seed demo schedule
const demoSchedule: ScheduledReport = {
  id: generateId(),
  name: 'Weekly Engineering Intelligence Report',
  description: 'Comprehensive weekly report covering all analyzers, health trends, and top opportunities.',
  schedule: '0 9 * * 1',
  timezone: 'America/New_York',
  formats: ['html', 'markdown'],
  analyzers: [],
  recipients: ['engineering@talomia.io', 'cto@talomia.io'],
  sections: ['summary', 'findings', 'opportunities', 'trends', 'health'],
  includeExecutiveSummary: true,
  status: 'active',
  lastRunAt: '2026-06-30T13:00:00Z',
  nextRunAt: '2026-07-07T13:00:00Z',
  totalRuns: 12,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: nowISO(),
};
schedules.set(demoSchedule.id, demoSchedule);

// Seed demo runs
for (let i = 0; i < 5; i++) {
  const date = new Date(Date.now() - (i + 1) * 7 * 86400000);
  runs.push({
    id: generateId(),
    scheduleId: demoSchedule.id,
    status: 'completed',
    format: 'html',
    startedAt: date.toISOString(),
    completedAt: new Date(date.getTime() + 45000).toISOString(),
    durationMs: 45000,
    sizeBytes: 128000 + Math.floor(Math.random() * 50000),
    downloadUrl: `/api/v1/reports/export/${generateId()}`,
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextCronRun(_cron: string): string {
  // Simplified: parse weekly cron and return next Monday 9am
  const now = new Date();
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const next = new Date(now.getTime() + daysUntilMonday * 86400000);
  next.setHours(9, 0, 0, 0);
  return next.toISOString();
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSchedulingRoutes(app: FastifyInstance): Promise<void> {
  // List all scheduled reports
  app.get('/api/v1/schedules', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const list = Array.from(schedules.values())
      .sort((a, b) => a.name.localeCompare(b.name));
    return reply.send({ data: list, total: list.length });
  });

  // Get schedule details
  app.get<{ Params: { id: string } }>('/api/v1/schedules/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const schedule = schedules.get(request.params.id);
    if (!schedule) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });
    return reply.send({ data: schedule });
  });

  // Create scheduled report
  app.post('/api/v1/schedules', { preHandler: [authMiddleware] }, async (request, reply) => {
    const body = request.body as Partial<ScheduledReport>;
    if (!body.name || !body.schedule) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and schedule (cron expression) are required' });
    }

    const id = generateId();
    const now = nowISO();
    const schedule: ScheduledReport = {
      id,
      name: body.name,
      description: body.description ?? '',
      schedule: body.schedule,
      timezone: body.timezone ?? 'UTC',
      formats: body.formats ?? ['html'],
      analyzers: body.analyzers ?? [],
      recipients: body.recipients ?? [],
      sections: body.sections ?? ['summary', 'findings', 'opportunities'],
      includeExecutiveSummary: body.includeExecutiveSummary ?? false,
      status: 'active',
      lastRunAt: null,
      nextRunAt: nextCronRun(body.schedule),
      totalRuns: 0,
      createdAt: now,
      updatedAt: now,
    };

    schedules.set(id, schedule);
    return reply.status(201).send({ data: schedule });
  });

  // Update schedule
  app.put<{ Params: { id: string } }>('/api/v1/schedules/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const existing = schedules.get(request.params.id);
    if (!existing) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });

    const body = request.body as Partial<ScheduledReport>;
    const updated: ScheduledReport = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      schedule: body.schedule ?? existing.schedule,
      timezone: body.timezone ?? existing.timezone,
      formats: body.formats ?? existing.formats,
      analyzers: body.analyzers ?? existing.analyzers,
      recipients: body.recipients ?? existing.recipients,
      sections: body.sections ?? existing.sections,
      includeExecutiveSummary: body.includeExecutiveSummary ?? existing.includeExecutiveSummary,
      status: body.status ?? existing.status,
      nextRunAt: body.schedule ? nextCronRun(body.schedule) : existing.nextRunAt,
      updatedAt: nowISO(),
    };

    schedules.set(updated.id, updated);
    return reply.send({ data: updated });
  });

  // Delete schedule
  app.delete<{ Params: { id: string } }>('/api/v1/schedules/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    if (!schedules.has(request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });
    }
    schedules.delete(request.params.id);
    return reply.status(204).send();
  });

  // Trigger immediate run
  app.post<{ Params: { id: string } }>('/api/v1/schedules/:id/run', { preHandler: [authMiddleware] }, async (request, reply) => {
    const schedule = schedules.get(request.params.id);
    if (!schedule) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });

    const now = nowISO();
    const run: ReportRun = {
      id: generateId(),
      scheduleId: schedule.id,
      status: 'completed',
      format: schedule.formats[0] ?? 'html',
      startedAt: now,
      completedAt: new Date(Date.now() + 30000).toISOString(),
      durationMs: 30000,
      sizeBytes: 145000,
      downloadUrl: `/api/v1/reports/export/${generateId()}`,
      error: null,
    };

    runs.unshift(run);
    schedule.lastRunAt = now;
    schedule.totalRuns += 1;
    schedule.updatedAt = now;

    return reply.send({ data: run });
  });

  // Get run history for a schedule
  app.get<{ Params: { id: string } }>('/api/v1/schedules/:id/runs', { preHandler: [authMiddleware] }, async (request, reply) => {
    const scheduleRuns = runs.filter(r => r.scheduleId === request.params.id);
    return reply.send({ data: scheduleRuns, total: scheduleRuns.length });
  });

  // Pause/resume schedule
  app.post<{ Params: { id: string } }>('/api/v1/schedules/:id/toggle', { preHandler: [authMiddleware] }, async (request, reply) => {
    const schedule = schedules.get(request.params.id);
    if (!schedule) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });

    schedule.status = schedule.status === 'active' ? 'paused' : 'active';
    schedule.updatedAt = nowISO();

    return reply.send({ data: schedule });
  });
}

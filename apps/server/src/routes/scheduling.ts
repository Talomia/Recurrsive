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
import { generateId, nowISO, createLogger } from '@recurrsive/core';
import { generateReport } from '@recurrsive/presentation';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { store } from '../store.js';
import { state } from '../state.js';

const logger = createLogger({ context: { component: 'server:routes:scheduling' } });

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

// No seed data — schedules are created by the user via the API.

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Parse a single cron field and return matching values.
 * Supports: *, specific values, ranges (a-b), steps (star/n or a-b/n), and comma-separated lists.
 */
function parseCronField(field: string, min: number, max: number): number[] {
  const values: Set<number> = new Set();

  for (const part of field.split(',')) {
    const trimmed = part.trim();

    if (trimmed === '*') {
      for (let i = min; i <= max; i++) values.add(i);
      continue;
    }

    // Step: */n or a-b/n
    const stepMatch = trimmed.match(/^(\*|(\d+)-(\d+))\/(\d+)$/);
    if (stepMatch) {
      const step = parseInt(stepMatch[4]!, 10);
      const rangeStart = stepMatch[2] ? parseInt(stepMatch[2], 10) : min;
      const rangeEnd = stepMatch[3] ? parseInt(stepMatch[3], 10) : max;
      for (let i = rangeStart; i <= rangeEnd; i += step) values.add(i);
      continue;
    }

    // Range: a-b
    const rangeMatch = trimmed.match(/^(\d+)-(\d+)$/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1]!, 10);
      const end = parseInt(rangeMatch[2]!, 10);
      for (let i = start; i <= end; i++) values.add(i);
      continue;
    }

    // Single value
    const num = parseInt(trimmed, 10);
    if (!isNaN(num) && num >= min && num <= max) {
      values.add(num);
    }
  }

  return [...values].sort((a, b) => a - b);
}

/**
 * Compute the next run time from a standard 5-field cron expression.
 * Fields: minute hour day-of-month month day-of-week
 */
function nextCronRun(cron: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    // Invalid cron — fall back to 1 hour from now
    return new Date(Date.now() + 3600000).toISOString();
  }

  const minutes = parseCronField(parts[0]!, 0, 59);
  const hours = parseCronField(parts[1]!, 0, 23);
  const daysOfMonth = parseCronField(parts[2]!, 1, 31);
  const months = parseCronField(parts[3]!, 1, 12);
  const daysOfWeek = parseCronField(parts[4]!, 0, 6); // 0 = Sunday

  // Search forward from now, checking up to 366 days
  const now = new Date();
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1); // Start from next minute

  for (let dayOffset = 0; dayOffset < 366; dayOffset++) {
    const d = new Date(candidate.getTime() + dayOffset * 86400000);
    const month = d.getMonth() + 1;
    const dom = d.getDate();
    const dow = d.getDay();

    if (!months.includes(month)) continue;
    if (!daysOfMonth.includes(dom) && !daysOfWeek.includes(dow)) continue;

    for (const hour of hours) {
      for (const minute of minutes) {
        const test = new Date(d);
        test.setHours(hour, minute, 0, 0);
        if (test > now) {
          return test.toISOString();
        }
      }
    }
  }

  // Shouldn't happen — fall back to 24h from now
  return new Date(Date.now() + 86400000).toISOString();
}

/**
 * Execute a scheduled report: generate actual report from current analysis data.
 */
async function executeScheduledRun(schedule: ScheduledReport): Promise<ReportRun> {
  const runId = generateId();
  const startedAt = nowISO();
  const format = schedule.formats[0] ?? 'html';

  const run: ReportRun = {
    id: runId,
    scheduleId: schedule.id,
    status: 'generating',
    format: format as ReportFormat,
    startedAt,
    completedAt: null,
    durationMs: 0,
    sizeBytes: 0,
    downloadUrl: null,
    error: null,
  };
  await store.set('schedule_runs', runId, run);

  try {
    // Guard: analysis must have been run before generating reports
    if (!state.isInitialized()) {
      run.status = 'failed';
      run.completedAt = nowISO();
      run.durationMs = 0;
      run.error = 'No analysis data available — run an analysis before scheduling reports.';
      await store.set('schedule_runs', runId, run);
      logger.warn(`Schedule "${schedule.name}" skipped: no analysis data available`);
      return run;
    }

    // Generate the report using real analysis data
    const manager = state.getOpportunities();
    const opportunities = manager.list();
    const healthScore = state.getHealthScore();

    const reportContent = generateReport(
      opportunities,
      format as 'html' | 'markdown' | 'json' | 'sarif',
      {
        healthScore: healthScore.overall ?? undefined,
        title: schedule.name,
        includeActionItems: schedule.includeExecutiveSummary,
      },
    );

    const completedAt = nowISO();
    const durationMs = Date.now() - new Date(startedAt).getTime();

    run.status = 'completed';
    run.completedAt = completedAt;
    run.durationMs = durationMs;
    run.sizeBytes = Buffer.byteLength(reportContent, 'utf-8');
    run.downloadUrl = `/api/v1/reports/export/${runId}`;
    await store.set('schedule_runs', runId, run);

    // Update schedule metadata
    schedule.lastRunAt = completedAt;
    schedule.totalRuns += 1;
    schedule.nextRunAt = nextCronRun(schedule.schedule);
    schedule.updatedAt = completedAt;
    await store.set('schedules', schedule.id, schedule);

    logger.info(`Schedule "${schedule.name}" run ${runId} completed in ${durationMs}ms`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    run.status = 'failed';
    run.completedAt = nowISO();
    run.durationMs = Date.now() - new Date(startedAt).getTime();
    run.error = message;
    await store.set('schedule_runs', runId, run);

    schedule.status = 'error';
    schedule.updatedAt = nowISO();
    await store.set('schedules', schedule.id, schedule);

    logger.error(`Schedule "${schedule.name}" run ${runId} failed: ${message}`);
  }

  return run;
}

/**
 * Periodic scheduler that checks for due schedules every 60 seconds.
 * Compares each active schedule's nextRunAt against the current time.
 */
let schedulerInterval: ReturnType<typeof setInterval> | null = null;

function startScheduler(): void {
  if (schedulerInterval) return; // Already running

  schedulerInterval = setInterval(async () => {
    const schedules = await store.all<ScheduledReport>('schedules');
    const now = new Date();

    for (const schedule of schedules) {
      if (schedule.status !== 'active') continue;

      const nextRun = new Date(schedule.nextRunAt);
      if (nextRun <= now) {
        logger.info(`Schedule "${schedule.name}" is due, executing...`);
        executeScheduledRun(schedule).catch((err) => {
          logger.error(`Scheduler error: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
    }
  }, 60_000); // Check every 60 seconds

  logger.info('Schedule executor started (checking every 60s)');
}

function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    logger.info('Schedule executor stopped');
  }
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerSchedulingRoutes(app: FastifyInstance): Promise<void> {
  // List all scheduled reports
  app.get('/api/v1/schedules', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const list = (await store.all<ScheduledReport>('schedules'))
      .sort((a, b) => a.name.localeCompare(b.name));
    return reply.send({ data: list, total: list.length });
  });

  // Get schedule details
  app.get<{ Params: { id: string } }>('/api/v1/schedules/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const schedule = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!schedule) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });
    return reply.send({ data: schedule });
  });

  // Create scheduled report
  app.post('/api/v1/schedules', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'schedule'],
        properties: {
          name: { type: 'string', minLength: 1 },
          schedule: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          timezone: { type: 'string' },
          formats: { type: 'array', items: { type: 'string' } },
          analyzers: { type: 'array', items: { type: 'string' } },
          recipients: { type: 'array', items: { type: 'string' } },
          sections: { type: 'array', items: { type: 'string' } },
          includeExecutiveSummary: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
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

    await store.set('schedules', id, schedule);
    return reply.status(201).send({ data: schedule });
  });

  // Update schedule
  app.put<{ Params: { id: string } }>('/api/v1/schedules/:id', {
    preHandler: [authMiddleware, requireRole('analyst')],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          schedule: { type: 'string' },
          description: { type: 'string' },
          timezone: { type: 'string' },
          formats: { type: 'array', items: { type: 'string' } },
          analyzers: { type: 'array', items: { type: 'string' } },
          recipients: { type: 'array', items: { type: 'string' } },
          sections: { type: 'array', items: { type: 'string' } },
          includeExecutiveSummary: { type: 'boolean' },
          status: { type: 'string', enum: ['active', 'paused', 'error'] },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const existing = await store.get<ScheduledReport>('schedules', request.params.id);
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

    await store.set('schedules', updated.id, updated);
    return reply.send({ data: updated });
  });

  // Delete schedule
  app.delete<{ Params: { id: string } }>('/api/v1/schedules/:id', { preHandler: [authMiddleware, requireRole('analyst')] }, async (request, reply) => {
    if (!await store.has('schedules', request.params.id)) {
      return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });
    }
    await store.delete('schedules', request.params.id);
    return reply.status(204).send();
  });

  // Trigger immediate run
  app.post<{ Params: { id: string } }>('/api/v1/schedules/:id/run', { preHandler: [authMiddleware, requireRole('analyst')] }, async (request, reply) => {
    const schedule = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!schedule) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });

    // Execute the scheduled report with real data
    const run = await executeScheduledRun(schedule);

    return reply.send({ data: run });
  });

  // Start the periodic scheduler and register cleanup
  startScheduler();
  app.addHook('onClose', async () => {
    stopScheduler();
  });

  // Get run history for a schedule
  app.get<{ Params: { id: string } }>('/api/v1/schedules/:id/runs', { preHandler: [authMiddleware] }, async (request, reply) => {
    const allRuns = await store.all<ReportRun>('schedule_runs');
    const scheduleRuns = allRuns.filter(r => r.scheduleId === request.params.id);
    return reply.send({ data: scheduleRuns, total: scheduleRuns.length });
  });

  // Pause/resume schedule
  app.post<{ Params: { id: string } }>('/api/v1/schedules/:id/toggle', { preHandler: [authMiddleware, requireRole('analyst')] }, async (request, reply) => {
    const schedule = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!schedule) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });

    schedule.status = schedule.status === 'active' ? 'paused' : 'active';
    schedule.updatedAt = nowISO();
    await store.set('schedules', schedule.id, schedule);

    return reply.send({ data: schedule });
  });

  // Global run history (all schedules)
  app.get('/api/v1/schedules/history', { preHandler: [authMiddleware] }, async (_request, reply) => {
    const allRuns = await store.all<ReportRun>('schedule_runs');
    const sorted = allRuns.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );
    return reply.send({ data: sorted, total: sorted.length });
  });
}

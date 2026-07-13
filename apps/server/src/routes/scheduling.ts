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
import { store } from '../store.js';
import type { AnalysisCache } from '../state.js';
import { calculateHealthScore } from '../analysis-metrics.js';
import { requireProjectScope } from '../project-analysis.js';

const logger = createLogger({ context: { component: 'server:routes:scheduling' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReportFormat = 'html' | 'markdown' | 'sarif' | 'json';
type ScheduleStatus = 'active' | 'paused' | 'error';

interface ScheduledReport {
  id: string;
  projectId: string;
  name: string;
  description: string;
  /** Cron expression for schedule (e.g., '0 9 * * 1' = Monday 9am). */
  cron: string;
  /** Timezone for schedule evaluation. */
  timezone: string;
  /** Output format(s). */
  format: ReportFormat;
  /** Include generated action items in the report. */
  includeActionItems: boolean;
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
  projectId: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  format: ReportFormat;
  startedAt: string;
  completedAt: string | null;
  durationMs: number;
  sizeBytes: number;
  downloadUrl: string | null;
  error: string | null;
}

interface ReportArtifact {
  id: string;
  runId: string;
  projectId: string;
  content: string;
  contentType: string;
  filename: string;
  createdAt: string;
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
function timezoneParts(date: Date, timezone: string): {
  minute: number; hour: number; day: number; month: number; weekday: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    minute: '2-digit', hour: '2-digit', hourCycle: 'h23',
    day: '2-digit', month: '2-digit', weekday: 'short',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minute: Number(parts['minute']),
    hour: Number(parts['hour']),
    day: Number(parts['day']),
    month: Number(parts['month']),
    weekday: weekdays[parts['weekday'] ?? ''] ?? -1,
  };
}

function nextCronRun(cron: string, timezone: string): string {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error('Cron expression must contain exactly five fields.');
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
  } catch {
    throw new Error(`Invalid IANA timezone: ${timezone}`);
  }

  const minutes = parseCronField(parts[0]!, 0, 59);
  const hours = parseCronField(parts[1]!, 0, 23);
  const daysOfMonth = parseCronField(parts[2]!, 1, 31);
  const months = parseCronField(parts[3]!, 1, 12);
  const daysOfWeek = parseCronField(parts[4]!, 0, 6); // 0 = Sunday
  const dayOfMonthWildcard = parts[2] === '*';
  const dayOfWeekWildcard = parts[4] === '*';

  if ([minutes, hours, daysOfMonth, months, daysOfWeek].some((values) => values.length === 0)) {
    throw new Error('Cron expression contains an invalid or out-of-range field.');
  }

  // Search real instants minute-by-minute so timezone offsets and DST
  // transitions are evaluated by the platform's IANA timezone database.
  const now = new Date();
  const candidate = new Date(now);
  candidate.setSeconds(0, 0);
  candidate.setMinutes(candidate.getMinutes() + 1);

  for (let offset = 0; offset < 60 * 24 * 366; offset++) {
    const zoned = timezoneParts(candidate, timezone);
    const dayMatches = dayOfMonthWildcard && dayOfWeekWildcard
      ? true
      : dayOfMonthWildcard
        ? daysOfWeek.includes(zoned.weekday)
        : dayOfWeekWildcard
          ? daysOfMonth.includes(zoned.day)
          : daysOfMonth.includes(zoned.day) || daysOfWeek.includes(zoned.weekday);
    if (
      months.includes(zoned.month) && dayMatches &&
      hours.includes(zoned.hour) && minutes.includes(zoned.minute)
    ) {
      return candidate.toISOString();
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }

  throw new Error('Cron expression has no occurrence in the next 366 days.');
}

/**
 * Execute a scheduled report: generate actual report from current analysis data.
 */
async function executeScheduledRun(schedule: ScheduledReport): Promise<ReportRun> {
  if (activeScheduleRuns.has(schedule.id)) {
    throw new Error(`Schedule “${schedule.name}” already has a report run in progress.`);
  }
  activeScheduleRuns.add(schedule.id);
  const runId = generateId();
  const startedAt = nowISO();
  const format = schedule.format;

  const run: ReportRun = {
    id: runId,
    scheduleId: schedule.id,
    projectId: schedule.projectId,
    status: 'generating',
    format: format as ReportFormat,
    startedAt,
    completedAt: null,
    durationMs: 0,
    sizeBytes: 0,
    downloadUrl: null,
    error: null,
  };
  try {
    await store.set('schedule_runs', runId, run);
  } catch (error) {
    activeScheduleRuns.delete(schedule.id);
    throw error;
  }

  try {
    const cache = await store.get<AnalysisCache>('analysis_cache', schedule.projectId);
    if (!cache) {
      run.status = 'failed';
      run.completedAt = nowISO();
      run.durationMs = 0;
      run.error = 'No analysis data available — run an analysis before scheduling reports.';
      await store.set('schedule_runs', runId, run);
      schedule.status = 'error';
      schedule.lastRunAt = run.completedAt;
      schedule.totalRuns += 1;
      schedule.nextRunAt = nextCronRun(schedule.cron, schedule.timezone);
      schedule.updatedAt = run.completedAt;
      await store.set('schedules', schedule.id, schedule);
      logger.warn(`Schedule "${schedule.name}" skipped: no analysis data available`);
      return run;
    }

    // Generate the report using real analysis data
    const opportunities = cache.opportunities;
    const healthScore = calculateHealthScore(cache);

    const reportContent = generateReport(
      opportunities,
      format as 'html' | 'markdown' | 'json' | 'sarif',
      {
        healthScore: healthScore.overall,
        title: schedule.name,
        includeActionItems: schedule.includeActionItems,
      },
    );

    const completedAt = nowISO();
    const durationMs = Date.now() - new Date(startedAt).getTime();

    run.status = 'completed';
    run.completedAt = completedAt;
    run.durationMs = durationMs;
    run.sizeBytes = Buffer.byteLength(reportContent, 'utf-8');
    const artifact: ReportArtifact = {
      id: runId,
      runId,
      projectId: schedule.projectId,
      content: reportContent,
      contentType: format === 'html' ? 'text/html; charset=utf-8'
        : format === 'markdown' ? 'text/markdown; charset=utf-8'
          : 'application/json; charset=utf-8',
      filename: `${schedule.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'report'}.${format === 'markdown' ? 'md' : format === 'sarif' ? 'sarif.json' : format}`,
      createdAt: completedAt,
    };
    await store.set('report_artifacts', artifact.id, artifact);
    run.downloadUrl = `/api/v1/schedules/runs/${runId}/download?projectId=${encodeURIComponent(schedule.projectId)}`;
    await store.set('schedule_runs', runId, run);

    // Update schedule metadata
    schedule.lastRunAt = completedAt;
    schedule.totalRuns += 1;
    schedule.nextRunAt = nextCronRun(schedule.cron, schedule.timezone);
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
    schedule.lastRunAt = run.completedAt;
    schedule.totalRuns += 1;
    schedule.nextRunAt = nextCronRun(schedule.cron, schedule.timezone);
    schedule.updatedAt = nowISO();
    await store.set('schedules', schedule.id, schedule);

    logger.error(`Schedule "${schedule.name}" run ${runId} failed: ${message}`);
  } finally {
    activeScheduleRuns.delete(schedule.id);
  }

  return run;
}

/**
 * Periodic scheduler that checks for due schedules every 60 seconds.
 * Compares each active schedule's nextRunAt against the current time.
 */
let schedulerInterval: ReturnType<typeof setInterval> | null = null;
const activeScheduleRuns = new Set<string>();

export function isScheduleRunActive(scheduleId: string): boolean {
  return activeScheduleRuns.has(scheduleId);
}

function startScheduler(): void {
  if (schedulerInterval) return; // Already running

  schedulerInterval = setInterval(async () => {
    try {
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
    } catch (error) {
      logger.error(`Scheduler polling failed: ${error instanceof Error ? error.message : String(error)}`);
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
  app.get('/api/v1/schedules', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const list = (await store.all<ScheduledReport>('schedules'))
      .filter((schedule) => schedule.projectId === project.id)
      .sort((a, b) => a.name.localeCompare(b.name));
    return reply.send({ data: list, total: list.length });
  });

  app.get<{ Params: { runId: string } }>('/api/v1/schedules/runs/:runId/download', {
    preHandler: [authMiddleware],
  }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const artifact = await store.get<ReportArtifact>('report_artifacts', request.params.runId);
    if (!artifact || artifact.projectId !== project.id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Report artifact not found' });
    }
    return reply
      .header('Content-Type', artifact.contentType)
      .header('Content-Disposition', `attachment; filename="${artifact.filename}"`)
      .send(artifact.content);
  });

  app.get('/api/v1/schedules/history', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const allRuns = await store.all<ReportRun>('schedule_runs');
    const sorted = allRuns
      .filter((run) => run.projectId === project.id)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
    return reply.send({ data: sorted, total: sorted.length });
  });

  // Get schedule details
  app.get<{ Params: { id: string } }>('/api/v1/schedules/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const schedule = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!schedule || schedule.projectId !== project.id) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });
    return reply.send({ data: schedule });
  });

  // Create scheduled report
  app.post('/api/v1/schedules', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        required: ['name', 'cron', 'format'],
        properties: {
          name: { type: 'string', minLength: 1 },
          cron: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          timezone: { type: 'string' },
          format: { type: 'string', enum: ['html', 'markdown', 'sarif', 'json'] },
          includeActionItems: { type: 'boolean' },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const body = request.body as Partial<ScheduledReport>;
    if (!body.name || !body.cron || !body.format) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name, cron, and format are required' });
    }

    const id = generateId();
    const now = nowISO();
    let nextRunAt: string;
    try {
      nextRunAt = nextCronRun(body.cron, body.timezone ?? 'UTC');
    } catch (error) {
      return reply.status(400).send({ error: 'Bad Request', message: error instanceof Error ? error.message : 'Invalid schedule' });
    }
    const schedule: ScheduledReport = {
      id,
      projectId: project.id,
      name: body.name,
      description: body.description ?? '',
      cron: body.cron,
      timezone: body.timezone ?? 'UTC',
      format: body.format,
      includeActionItems: body.includeActionItems ?? true,
      status: 'active',
      lastRunAt: null,
      nextRunAt,
      totalRuns: 0,
      createdAt: now,
      updatedAt: now,
    };

    await store.set('schedules', id, schedule);
    return reply.status(201).send({ data: schedule });
  });

  // Update schedule
  app.put<{ Params: { id: string } }>('/api/v1/schedules/:id', {
    preHandler: [authMiddleware],
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          cron: { type: 'string' },
          description: { type: 'string' },
          timezone: { type: 'string' },
          format: { type: 'string', enum: ['html', 'markdown', 'sarif', 'json'] },
          includeActionItems: { type: 'boolean' },
          status: { type: 'string', enum: ['active', 'paused', 'error'] },
        },
        additionalProperties: false,
      },
    },
  }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const existing = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!existing || existing.projectId !== project.id) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });

    const body = request.body as Partial<ScheduledReport>;
    let nextRunAt = existing.nextRunAt;
    if (body.cron || body.timezone) {
      try {
        nextRunAt = nextCronRun(body.cron ?? existing.cron, body.timezone ?? existing.timezone);
      } catch (error) {
        return reply.status(400).send({ error: 'Bad Request', message: error instanceof Error ? error.message : 'Invalid schedule' });
      }
    }
    const updated: ScheduledReport = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      cron: body.cron ?? existing.cron,
      timezone: body.timezone ?? existing.timezone,
      format: body.format ?? existing.format,
      includeActionItems: body.includeActionItems ?? existing.includeActionItems,
      status: body.status ?? existing.status,
      nextRunAt,
      updatedAt: nowISO(),
    };

    await store.set('schedules', updated.id, updated);
    return reply.send({ data: updated });
  });

  // Delete schedule
  app.delete<{ Params: { id: string } }>('/api/v1/schedules/:id', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const schedule = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!schedule || schedule.projectId !== project.id) {
      return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });
    }
    if (isScheduleRunActive(schedule.id)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Wait for the active report run to finish before deleting this schedule.' });
    }
    const runs = (await store.entries<ReportRun>('schedule_runs'))
      .filter(([, run]) => run.scheduleId === schedule.id && run.projectId === project.id);
    await Promise.all(runs.flatMap(([runId]) => [
      store.delete('schedule_runs', runId),
      store.delete('report_artifacts', runId),
    ]));
    await store.delete('schedules', request.params.id);
    return reply.status(204).send();
  });

  // Trigger immediate run
  app.post<{ Params: { id: string } }>('/api/v1/schedules/:id/run', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const schedule = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!schedule || schedule.projectId !== project.id) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });

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
    const project = await requireProjectScope(request);
    const schedule = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!schedule || schedule.projectId !== project.id) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });
    const allRuns = await store.all<ReportRun>('schedule_runs');
    const scheduleRuns = allRuns.filter(r => r.scheduleId === request.params.id && r.projectId === project.id);
    return reply.send({ data: scheduleRuns, total: scheduleRuns.length });
  });

  // Pause/resume schedule
  app.post<{ Params: { id: string } }>('/api/v1/schedules/:id/toggle', { preHandler: [authMiddleware] }, async (request, reply) => {
    const project = await requireProjectScope(request);
    const schedule = await store.get<ScheduledReport>('schedules', request.params.id);
    if (!schedule || schedule.projectId !== project.id) return reply.status(404).send({ error: 'Not Found', message: 'Schedule not found' });

    schedule.status = schedule.status === 'active' ? 'paused' : 'active';
    schedule.updatedAt = nowISO();
    await store.set('schedules', schedule.id, schedule);

    return reply.send({ data: schedule });
  });

}

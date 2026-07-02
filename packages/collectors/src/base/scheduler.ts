/**
 * @module @recurrsive/collectors/base/scheduler
 *
 * Collector scheduling — periodic runs via `setInterval`, one-shot
 * runs, and file-system watching via chokidar.
 *
 * @packageDocumentation
 */

import type { CollectorResult, CollectorSchedule } from '@recurrsive/core';
import { CollectorError, createLogger } from '@recurrsive/core';
import { watch as chokidarWatch, type FSWatcher } from 'chokidar';
import type { CollectorRegistry } from './registry.js';

const logger = createLogger({ context: { module: 'collector-scheduler' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for scheduling a collector.
 *
 * Extends the core {@link CollectorSchedule} with a callback that
 * receives results after each run.
 */
export interface ScheduleConfig extends CollectorSchedule {
  /** Optional callback invoked after each scheduled run. */
  onResult?: (result: CollectorResult) => void;
  /** Optional callback invoked when a scheduled run fails. */
  onError?: (error: Error) => void;
}

/** Internal bookkeeping for a scheduled collector. */
interface ScheduleEntry {
  collectorId: string;
  config: ScheduleConfig;
  timer?: ReturnType<typeof setInterval>;
  watcher?: FSWatcher;
}

// ---------------------------------------------------------------------------
// CollectorScheduler
// ---------------------------------------------------------------------------

/**
 * Manages periodic, one-shot, and file-watch schedules for collectors
 * registered in a {@link CollectorRegistry}.
 *
 * @example
 * ```ts
 * const registry = new CollectorRegistry();
 * registry.register(gitCollector);
 *
 * const scheduler = new CollectorScheduler(registry, governance);
 *
 * // Run every 5 minutes
 * scheduler.schedule('git', {
 *   type: 'periodic',
 *   interval_ms: 300_000,
 *   onResult: (r) => console.log(`${r.entities.length} entities`),
 * });
 *
 * // Watch for file changes
 * scheduler.watch('git', ['src/**']);
 *
 * // Clean up
 * scheduler.dispose();
 * ```
 */
export class CollectorScheduler {
  private readonly registry: CollectorRegistry;
  private readonly entries: Map<string, ScheduleEntry> = new Map();
  private disposed = false;

  /**
   * @param registry - The collector registry to pull collectors from.
   */
  constructor(registry: CollectorRegistry) {
    this.registry = registry;
  }

  /**
   * Schedule a collector to run periodically or as a one-shot.
   *
   * - `type: 'periodic'` — runs at `interval_ms` intervals.
   * - `type: 'once'` — runs once immediately.
   * - `type: 'watch'` — no-op here; use {@link watch} instead.
   * - `type: 'webhook'` — registered but not auto-triggered.
   *
   * Calling `schedule` for an already-scheduled collector cancels
   * the previous schedule first.
   *
   * @param collectorId - The collector id to schedule.
   * @param config - Schedule configuration.
   * @throws {CollectorError} If the collector is not registered.
   */
  schedule(collectorId: string, config: ScheduleConfig): void {
    this.assertNotDisposed();

    const collector = this.registry.get(collectorId);
    if (!collector) {
      throw new CollectorError(
        `Cannot schedule unknown collector '${collectorId}'`,
        'NOT_FOUND',
        collectorId,
      );
    }

    // Cancel any existing schedule for this collector
    if (this.entries.has(collectorId)) {
      this.cancel(collectorId);
    }

    const entry: ScheduleEntry = { collectorId, config };

    if (config.type === 'periodic' && config.interval_ms && config.interval_ms > 0) {
      logger.info('Scheduling periodic collector', {
        id: collectorId,
        interval_ms: config.interval_ms,
      });

      entry.timer = setInterval(() => {
        void this.executeRun(collectorId, config);
      }, config.interval_ms);

      // Prevent the timer from keeping the process alive
      if (entry.timer && typeof entry.timer === 'object' && 'unref' in entry.timer) {
        entry.timer.unref();
      }
    } else if (config.type === 'once') {
      logger.info('Scheduling one-shot collector', { id: collectorId });
      void this.executeRun(collectorId, config);
    } else if (config.type === 'webhook') {
      logger.info('Registered webhook collector (no auto-trigger)', {
        id: collectorId,
      });
    }

    this.entries.set(collectorId, entry);
  }

  /**
   * Cancel a scheduled collector run.
   *
   * Clears the periodic timer and/or file watcher for the given
   * collector id.
   *
   * @param collectorId - The collector id to cancel.
   */
  cancel(collectorId: string): void {
    const entry = this.entries.get(collectorId);
    if (!entry) {
      logger.warn('Cannot cancel: no schedule found', { id: collectorId });
      return;
    }

    if (entry.timer) {
      clearInterval(entry.timer);
      entry.timer = undefined;
    }

    if (entry.watcher) {
      void entry.watcher.close();
      entry.watcher = undefined;
    }

    this.entries.delete(collectorId);
    logger.info('Cancelled schedule', { id: collectorId });
  }

  /**
   * Run a collector once immediately and return the result.
   *
   * @param collectorId - The collector id to run.
   * @returns The collection result.
   * @throws {CollectorError} If the collector is not registered.
   */
  async runOnce(collectorId: string): Promise<CollectorResult> {
    this.assertNotDisposed();

    const collector = this.registry.get(collectorId);
    if (!collector) {
      throw new CollectorError(
        `Cannot run unknown collector '${collectorId}'`,
        'NOT_FOUND',
        collectorId,
      );
    }

    logger.info('Running collector once', { id: collectorId });
    return collector.collect();
  }

  /**
   * Start file-system watching for a collector. When any watched file
   * changes, the collector is triggered.
   *
   * Uses chokidar under the hood with a configurable debounce.
   *
   * @param collectorId - The collector id to trigger on file changes.
   * @param paths - Glob patterns or directory paths to watch.
   * @throws {CollectorError} If the collector is not registered.
   */
  watch(collectorId: string, paths: string[]): void {
    this.assertNotDisposed();

    const collector = this.registry.get(collectorId);
    if (!collector) {
      throw new CollectorError(
        `Cannot watch for unknown collector '${collectorId}'`,
        'NOT_FOUND',
        collectorId,
      );
    }

    // Cancel existing watcher if present
    const existing = this.entries.get(collectorId);
    if (existing?.watcher) {
      void existing.watcher.close();
      existing.watcher = undefined;
    }

    logger.info('Starting file watcher', { id: collectorId, paths });

    /** Debounce timeout handle. */
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    const DEBOUNCE_MS = 1000;

    const watcher = chokidarWatch(paths, {
      ignoreInitial: true,
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
      persistent: true,
    });

    const triggerCollection = () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        logger.info('File change detected, running collector', { id: collectorId });
        void collector.collect().catch((err: unknown) => {
          logger.error('Watch-triggered collection failed', {
            id: collectorId,
            error: err,
          });
        });
      }, DEBOUNCE_MS);
    };

    watcher.on('add', triggerCollection);
    watcher.on('change', triggerCollection);
    watcher.on('unlink', triggerCollection);
    watcher.on('error', (err) => {
      logger.error('Watcher error', { id: collectorId, error: err });
    });

    const entry: ScheduleEntry = existing ?? {
      collectorId,
      config: { type: 'watch' },
    };
    entry.watcher = watcher;
    this.entries.set(collectorId, entry);
  }

  /**
   * Stop all scheduled runs and file watchers. After disposal,
   * no further operations may be performed on this scheduler.
   */
  dispose(): void {
    logger.info('Disposing scheduler', { entries: this.entries.size });

    for (const [id] of this.entries) {
      this.cancel(id);
    }

    this.disposed = true;
  }

  /**
   * Get the ids of all currently scheduled collectors.
   *
   * @returns Array of scheduled collector ids.
   */
  getScheduledIds(): string[] {
    return [...this.entries.keys()];
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Execute a collection run and invoke the configured callbacks.
   *
   * @param collectorId - Collector id.
   * @param config - Schedule config with callbacks.
   */
  private async executeRun(collectorId: string, config: ScheduleConfig): Promise<void> {
    try {
      const collector = this.registry.get(collectorId);
      if (!collector) {
        throw new CollectorError(
          `Collector '${collectorId}' disappeared from registry`,
          'NOT_FOUND',
          collectorId,
        );
      }

      const result = await collector.collect();
      config.onResult?.(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Scheduled run failed', { id: collectorId, error });
      config.onError?.(error);
    }
  }

  /**
   * Guard that throws if the scheduler has been disposed.
   *
   * @throws {CollectorError} If the scheduler is disposed.
   */
  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new CollectorError(
        'CollectorScheduler has been disposed',
        'DISPOSED',
        '',
      );
    }
  }
}

/**
 * @module @recurrsive/collectors/base/registry
 *
 * Collector registry — manages collector lifecycle, registration,
 * discovery, and orchestrated collection runs.
 *
 * @packageDocumentation
 */

import type {
  Collector,
  CollectorType,
  CollectorResult,
  DataGovernance,
  CollectorConfig,
} from '@recurrsive/core';
import {
  CollectorError,
  createLogger,
  nowISO,
} from '@recurrsive/core';

const logger = createLogger({ context: { module: 'collector-registry' } });

/**
 * Central registry for managing {@link Collector} instances.
 *
 * Provides registration, discovery by id or type, and orchestrated
 * collection runs with governance enforcement.
 *
 * @example
 * ```ts
 * const registry = new CollectorRegistry();
 * registry.register(new GitCollector());
 *
 * const results = await registry.collectAll({
 *   masked_fields: [],
 *   excluded_patterns: ['node_modules/**'],
 *   pii_detection: true,
 *   audit_log: true,
 *   retention_days: 90,
 * });
 * ```
 */
export class CollectorRegistry {
  /** Map of collector id → collector instance. */
  private readonly collectors: Map<string, Collector> = new Map();

  /**
   * Register a collector. If a collector with the same id is already
   * registered, the previous one is replaced (after disposal).
   *
   * @param collector - The collector to register.
   * @throws {CollectorError} If the collector has an empty id.
   */
  register(collector: Collector): void {
    if (!collector.id) {
      throw new CollectorError(
        'Cannot register a collector with an empty id',
        'INVALID_ID',
        '',
      );
    }

    if (this.collectors.has(collector.id)) {
      logger.warn('Replacing existing collector', { id: collector.id });
    }

    this.collectors.set(collector.id, collector);
    logger.info('Collector registered', {
      id: collector.id,
      name: collector.name,
      type: collector.type,
    });
  }

  /**
   * Unregister a collector by id. This does **not** call `dispose()`
   * on the collector — the caller is responsible for lifecycle.
   *
   * @param id - Collector id to remove.
   */
  unregister(id: string): void {
    const deleted = this.collectors.delete(id);
    if (deleted) {
      logger.info('Collector unregistered', { id });
    } else {
      logger.warn('Attempted to unregister unknown collector', { id });
    }
  }

  /**
   * Retrieve a collector by its id.
   *
   * @param id - Collector id.
   * @returns The collector if found, otherwise `undefined`.
   */
  get(id: string): Collector | undefined {
    return this.collectors.get(id);
  }

  /**
   * Get all registered collectors.
   *
   * @returns Array of all registered collectors.
   */
  getAll(): Collector[] {
    return [...this.collectors.values()];
  }

  /**
   * Get all registered collectors of a given type.
   *
   * @param type - The collector type to filter by.
   * @returns Array of matching collectors.
   */
  getByType(type: CollectorType): Collector[] {
    return [...this.collectors.values()].filter((c) => c.type === type);
  }

  /**
   * Run **all** registered collectors and return their results.
   *
   * Each collector is initialized (if needed), validated, and then
   * collected. Failures in one collector do not prevent others from
   * running.
   *
   * @param governance - Data governance rules to apply.
   * @returns Array of results, one per collector (including failures).
   */
  async collectAll(governance: DataGovernance, custom: Record<string, unknown> = {}): Promise<CollectorResult[]> {
    const results: CollectorResult[] = [];

    for (const collector of this.collectors.values()) {
      try {
        const result = await this.runCollector(collector, governance, custom);
        results.push(result);
      } catch (err) {
        logger.error('Collector failed during collectAll', {
          id: collector.id,
          error: err,
        });

        // Push a failure result so callers know which collector errored
        results.push({
          entities: [],
          relationships: [],
          metadata: {
            collector_id: collector.id,
            collected_at: nowISO(),
            duration_ms: 0,
            items_processed: 0,
            errors: [
              {
                message: err instanceof Error ? err.message : String(err),
                details: err instanceof Error ? { stack: err.stack } : undefined,
              },
            ],
          },
        });
      }
    }

    return results;
  }

  /**
   * Run a single collector by id.
   *
   * @param id - Collector id.
   * @param governance - Data governance rules to apply.
   * @returns The collection result.
   * @throws {CollectorError} If the collector is not registered.
   */
  async collect(id: string, governance: DataGovernance, custom: Record<string, unknown> = {}): Promise<CollectorResult> {
    const collector = this.collectors.get(id);
    if (!collector) {
      throw new CollectorError(
        `Collector '${id}' is not registered`,
        'NOT_FOUND',
        id,
      );
    }

    return this.runCollector(collector, governance, custom);
  }

  /**
   * Return the number of registered collectors.
   *
   * @returns Count of registered collectors.
   */
  get size(): number {
    return this.collectors.size;
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  /**
   * Initialize, validate, and run a single collector.
   *
   * @param collector - The collector instance.
   * @param governance - Governance config to inject.
   * @returns The collection result.
   */
  private async runCollector(
    collector: Collector,
    governance: DataGovernance,
    custom: Record<string, unknown> = {},
  ): Promise<CollectorResult> {
    const config: CollectorConfig = {
      governance,
      custom,
    };

    logger.info('Initializing collector', { id: collector.id });
    await collector.initialize(config);

    logger.info('Validating collector', { id: collector.id });
    const validation = await collector.validate();
    if (!validation.valid) {
      throw new CollectorError(
        `Collector '${collector.id}' validation failed: ${validation.errors.join('; ')}`,
        'VALIDATION_FAILED',
        collector.id,
      );
    }

    logger.info('Running collector', { id: collector.id });
    const result = await collector.collect();

    logger.info('Collector complete', {
      id: collector.id,
      entities: result.entities.length,
      relationships: result.relationships.length,
      duration_ms: result.metadata.duration_ms,
    });

    return result;
  }
}

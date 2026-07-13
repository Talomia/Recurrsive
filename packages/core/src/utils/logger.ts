/**
 * Structured logger with JSON output and contextual metadata.
 *
 * This is intentionally a thin wrapper around `console` — it avoids
 * pulling in heavy logging frameworks while providing structured,
 * level-aware output suitable for production JSON log aggregation.
 *
 * @module
 */

/** Supported log levels in ascending severity order. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Numeric weight for each log level used for threshold comparison. */
const LOG_LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Shape of a single structured log entry written to stdout/stderr. */
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context: Record<string, unknown>;
}

/** Options for constructing a {@link Logger}. */
export interface LoggerOptions {
  /** Minimum level to emit (default: `'info'`). */
  level?: LogLevel;
  /** Static context fields attached to every log entry. */
  context?: Record<string, unknown>;
}

/**
 * A structured logger that writes JSON entries to stdout (debug,
 * info, warn) and stderr (error).
 *
 * @example
 * ```ts
 * const log = createLogger({ level: 'debug', context: { service: 'collector' } });
 * log.info('Collection started', { target: 'github' });
 * // {"timestamp":"...","level":"info","message":"Collection started","context":{"service":"collector","target":"github"}}
 * ```
 */
export class Logger {
  private readonly minLevel: number;
  private readonly context: Record<string, unknown>;

  /**
   * Create a new Logger instance.
   *
   * @param options - Logger configuration.
   */
  constructor(options: LoggerOptions = {}) {
    this.minLevel = LOG_LEVEL_WEIGHT[options.level ?? 'info'];
    this.context = options.context ?? {};
  }

  /**
   * Create a child logger that inherits this logger's context and
   * adds additional fields.
   *
   * @param childContext - Additional context fields.
   * @returns A new Logger with merged context.
   */
  child(childContext: Record<string, unknown>): Logger {
    const level = (
      Object.entries(LOG_LEVEL_WEIGHT).find(([, v]) => v === this.minLevel)?.[0] ?? 'info'
    ) as LogLevel;
    return new Logger({
      level,
      context: { ...this.context, ...childContext },
    });
  }

  /**
   * Emit a debug-level log entry.
   *
   * @param message - Log message.
   * @param extra - Optional additional context for this entry.
   */
  debug(message: string, extra?: Record<string, unknown>): void {
    this.log('debug', message, extra);
  }

  /**
   * Emit an info-level log entry.
   *
   * @param message - Log message.
   * @param extra - Optional additional context for this entry.
   */
  info(message: string, extra?: Record<string, unknown>): void {
    this.log('info', message, extra);
  }

  /**
   * Emit a warn-level log entry.
   *
   * @param message - Log message.
   * @param extra - Optional additional context for this entry.
   */
  warn(message: string, extra?: Record<string, unknown>): void {
    this.log('warn', message, extra);
  }

  /**
   * Emit an error-level log entry.
   *
   * @param message - Log message.
   * @param extra - Optional additional context for this entry. If an
   *   `error` key is present and its value is an `Error`, the stack
   *   trace will be included automatically.
   */
  error(message: string, extra?: Record<string, unknown>): void {
    this.log('error', message, extra);
  }

  // -----------------------------------------------------------------------
  // Private
  // -----------------------------------------------------------------------

  private log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
    if (LOG_LEVEL_WEIGHT[level] < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: { ...this.context, ...this.normalizeExtra(extra) },
    };

    const serialized = JSON.stringify(entry);

    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      // eslint-disable-next-line no-console -- structured logs intentionally use stdout for non-error levels
      console.log(serialized);
    }
  }

  private normalizeExtra(extra?: Record<string, unknown>): Record<string, unknown> {
    if (!extra) {
      return {};
    }

    const normalized = { ...extra };

    // Automatically serialize Error objects
    if (normalized['error'] instanceof Error) {
      const err = normalized['error'];
      normalized['error'] = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }

    return normalized;
  }
}

/**
 * Factory function to create a new {@link Logger}.
 *
 * @param options - Logger configuration.
 * @returns A configured Logger instance.
 *
 * @example
 * ```ts
 * const log = createLogger({ level: 'debug', context: { pkg: '@recurrsive/core' } });
 * log.info('Initialized');
 * ```
 */
export function createLogger(options?: LoggerOptions): Logger {
  return new Logger(options);
}

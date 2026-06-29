/**
 * Custom error hierarchy for the Recurrsive runtime.
 *
 * All errors extend {@link RecurrsiveError} so that callers can
 * catch at any granularity — from a specific domain error up to the
 * root class.
 *
 * @module
 */

/**
 * Base error class for all Recurrsive-specific errors.
 *
 * @example
 * ```ts
 * try {
 *   throw new RecurrsiveError('Something failed', 'UNKNOWN');
 * } catch (err) {
 *   if (err instanceof RecurrsiveError) {
 *     console.error(err.code, err.message);
 *   }
 * }
 * ```
 */
export class RecurrsiveError extends Error {
  /** Machine-readable error code. */
  public readonly code: string;

  /**
   * @param message - Human-readable error message.
   * @param code - Machine-readable error code.
   * @param cause - Optional underlying cause.
   */
  constructor(message: string, code: string, cause?: unknown) {
    super(message, { cause });
    this.name = 'RecurrsiveError';
    this.code = code;
    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Serialize the error to a plain object suitable for JSON logging.
   *
   * @returns Plain object with error details.
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      stack: this.stack,
      cause: this.cause instanceof Error
        ? { name: this.cause.name, message: this.cause.message, stack: this.cause.stack }
        : this.cause,
    };
  }
}

/**
 * Error thrown by collectors when data ingestion fails.
 *
 * @example
 * ```ts
 * throw new CollectorError('GitHub API rate-limited', 'RATE_LIMIT', 'github');
 * ```
 */
export class CollectorError extends RecurrsiveError {
  /** ID of the collector that failed. */
  public readonly collectorId: string;

  /**
   * @param message - Human-readable error message.
   * @param code - Machine-readable error code.
   * @param collectorId - ID of the failing collector.
   * @param cause - Optional underlying cause.
   */
  constructor(message: string, code: string, collectorId: string, cause?: unknown) {
    super(message, code, cause);
    this.name = 'CollectorError';
    this.collectorId = collectorId;
  }

  override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), collectorId: this.collectorId };
  }
}

/**
 * Error thrown by analyzers when analysis fails.
 *
 * @example
 * ```ts
 * throw new AnalyzerError('Parse error in AST', 'PARSE_FAILURE', 'security.xss');
 * ```
 */
export class AnalyzerError extends RecurrsiveError {
  /** ID of the analyzer that failed. */
  public readonly analyzerId: string;

  /**
   * @param message - Human-readable error message.
   * @param code - Machine-readable error code.
   * @param analyzerId - ID of the failing analyzer.
   * @param cause - Optional underlying cause.
   */
  constructor(message: string, code: string, analyzerId: string, cause?: unknown) {
    super(message, code, cause);
    this.name = 'AnalyzerError';
    this.analyzerId = analyzerId;
  }

  override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), analyzerId: this.analyzerId };
  }
}

/**
 * Error thrown by the reasoning (debate) engine.
 *
 * @example
 * ```ts
 * throw new ReasoningError('LLM context window exceeded', 'CONTEXT_OVERFLOW');
 * ```
 */
export class ReasoningError extends RecurrsiveError {
  /**
   * @param message - Human-readable error message.
   * @param code - Machine-readable error code.
   * @param cause - Optional underlying cause.
   */
  constructor(message: string, code: string, cause?: unknown) {
    super(message, code, cause);
    this.name = 'ReasoningError';
  }
}

/**
 * Error thrown by the knowledge graph layer.
 *
 * @example
 * ```ts
 * throw new GraphError('Connection to PostgreSQL lost', 'CONNECTION_LOST');
 * ```
 */
export class GraphError extends RecurrsiveError {
  /**
   * @param message - Human-readable error message.
   * @param code - Machine-readable error code.
   * @param cause - Optional underlying cause.
   */
  constructor(message: string, code: string, cause?: unknown) {
    super(message, code, cause);
    this.name = 'GraphError';
  }
}

/**
 * Error thrown when project configuration is invalid or missing.
 *
 * @example
 * ```ts
 * throw new ConfigError('Missing required field: project.name', 'MISSING_FIELD');
 * ```
 */
export class ConfigError extends RecurrsiveError {
  /**
   * @param message - Human-readable error message.
   * @param code - Machine-readable error code.
   * @param cause - Optional underlying cause.
   */
  constructor(message: string, code: string, cause?: unknown) {
    super(message, code, cause);
    this.name = 'ConfigError';
  }
}

/**
 * Error thrown when Zod schema validation fails.
 *
 * Wraps the Zod error as the `cause` for easy inspection.
 *
 * @example
 * ```ts
 * const result = EntitySchema.safeParse(data);
 * if (!result.success) {
 *   throw new ValidationError('Entity validation failed', result.error);
 * }
 * ```
 */
export class ValidationError extends RecurrsiveError {
  /** The structured validation errors. */
  public readonly validationErrors: unknown;

  /**
   * @param message - Human-readable error message.
   * @param validationErrors - The validation error details (e.g. ZodError).
   * @param cause - Optional underlying cause.
   */
  constructor(message: string, validationErrors: unknown, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }

  override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), validationErrors: this.validationErrors };
  }
}

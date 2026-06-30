/**
 * @module @recurrsive/core/utils/retry
 *
 * Retry utility with exponential backoff for transient failures.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for retry behavior. */
export interface RetryConfig {
  /** Maximum number of attempts (including the first). Default: 3 */
  maxAttempts: number;
  /** Base delay between retries in milliseconds. Default: 1000 */
  baseDelayMs: number;
  /** Maximum delay cap in milliseconds. Default: 30_000 */
  maxDelayMs: number;
  /** Jitter factor (0–1). Default: 0.1 */
  jitter: number;
  /** Optional predicate: return true to retry, false to abort immediately. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Callback called before each retry. */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

const DEFAULT_RETRY: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  jitter: 0.1,
};

// ---------------------------------------------------------------------------
// Retry Function
// ---------------------------------------------------------------------------

/**
 * Execute an async function with automatic retries and exponential backoff.
 *
 * ```ts
 * const data = await retry(() => fetchData(url), {
 *   maxAttempts: 5,
 *   baseDelayMs: 500,
 * });
 * ```
 *
 * @param fn - The async function to execute.
 * @param config - Retry configuration.
 * @returns The result of the function.
 * @throws The last error if all attempts fail.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY, ...config };
  let lastError: unknown;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxAttempts) break;

      if (opts.shouldRetry && !opts.shouldRetry(error, attempt)) break;

      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1) *
          (1 + Math.random() * opts.jitter),
        opts.maxDelayMs,
      );

      opts.onRetry?.(error, attempt, delay);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Content Hash
// ---------------------------------------------------------------------------

/**
 * Generate a simple deterministic hash of a string (DJB2 algorithm).
 *
 * This is NOT cryptographic — use for cache keys, dedup, etc.
 *
 * ```ts
 * const hash = contentHash('hello world'); // '5e8b8e12'
 * ```
 */
export function contentHash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xFFFFFFFF;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Batched Processing
// ---------------------------------------------------------------------------

/**
 * Process items in batches with concurrency control.
 *
 * ```ts
 * const results = await batchProcess(items, processItem, { batchSize: 5 });
 * ```
 *
 * @param items - Items to process.
 * @param processor - Async function to apply to each item.
 * @param options - Batch options.
 * @returns Array of results in the same order as input.
 */
export async function batchProcess<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: { batchSize?: number } = {},
): Promise<R[]> {
  const { batchSize = 10 } = options;
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((item, j) => processor(item, i + j)),
    );
    results.push(...batchResults);
  }

  return results;
}

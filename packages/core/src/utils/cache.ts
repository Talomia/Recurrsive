/**
 * @module @recurrsive/core/utils/cache
 *
 * A simple LRU (Least Recently Used) cache with optional TTL eviction.
 *
 * Uses a `Map` for O(1) access. On `get`/`set`, entries are deleted
 * and re-inserted to maintain access order. The oldest entry is evicted
 * when the cache exceeds `maxSize`.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Internal cache entry wrapping the value and its insertion timestamp. */
interface CacheEntry<V> {
  value: V;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// LRUCache
// ---------------------------------------------------------------------------

/**
 * A generic LRU cache with optional time-to-live (TTL) eviction.
 *
 * ```ts
 * const cache = new LRUCache<string, number>(100, 60_000);
 * cache.set('key', 42);
 * cache.get('key'); // 42
 * ```
 *
 * @typeParam K - Key type.
 * @typeParam V - Value type.
 */
export class LRUCache<K, V> {
  private readonly map = new Map<K, CacheEntry<V>>();
  private readonly maxSize: number;
  private readonly ttlMs: number | undefined;

  /**
   * Create a new LRU cache.
   *
   * @param maxSize - Maximum number of entries. Must be ≥ 0.
   * @param ttlMs - Optional time-to-live in milliseconds. Entries older
   *   than this are treated as expired on access.
   */
  constructor(maxSize: number, ttlMs?: number) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  /**
   * Retrieve a value by key.
   *
   * Accessing an entry refreshes its position (most-recently-used).
   * Returns `undefined` if the key is missing or expired.
   */
  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    // TTL check
    if (this.ttlMs !== undefined && Date.now() - entry.timestamp > this.ttlMs) {
      this.map.delete(key);
      return undefined;
    }

    // Refresh position: delete and re-insert
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  /**
   * Insert or update a key-value pair.
   *
   * If the key already exists it is updated in-place (no size growth).
   * When the cache exceeds `maxSize`, the oldest entry is evicted.
   */
  set(key: K, value: V): void {
    // Remove existing entry so re-insert moves it to the end
    if (this.map.has(key)) {
      this.map.delete(key);
    }

    // Evict oldest if at capacity
    if (this.maxSize > 0 && this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }

    // Zero-size cache: never store
    if (this.maxSize <= 0) return;

    this.map.set(key, { value, timestamp: Date.now() });
  }

  /**
   * Check whether a key exists and is not expired.
   */
  has(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;

    if (this.ttlMs !== undefined && Date.now() - entry.timestamp > this.ttlMs) {
      this.map.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Remove a key from the cache.
   *
   * @returns `true` if the key was present, `false` otherwise.
   */
  delete(key: K): boolean {
    return this.map.delete(key);
  }

  /** Remove all entries. */
  clear(): void {
    this.map.clear();
  }

  /** The current number of entries (including potentially expired ones). */
  get size(): number {
    return this.map.size;
  }

  /**
   * Return all non-expired entries as `[key, value]` pairs.
   *
   * Order is from oldest to newest access.
   */
  entries(): [K, V][] {
    const result: [K, V][] = [];
    const now = Date.now();

    for (const [key, entry] of this.map) {
      if (this.ttlMs !== undefined && now - entry.timestamp > this.ttlMs) {
        continue;
      }
      result.push([key, entry.value]);
    }

    return result;
  }
}

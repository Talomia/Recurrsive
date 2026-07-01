/**
 * @module @recurrsive/server/middleware/api-keys
 *
 * In-memory API key management for the Recurrsive API server.
 *
 * Keys are generated with `crypto.randomBytes` and stored hashed
 * (SHA-256) in a `Map`. The raw key is returned only at creation time;
 * subsequent validation compares against the stored hash.
 *
 * @packageDocumentation
 */

import { randomBytes, createHash } from 'node:crypto';
import { createLogger, generateId, nowISO } from '@recurrsive/core';
import type { Role } from './rbac.js';

const logger = createLogger({ context: { component: 'server:middleware:api-keys' } });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Metadata stored alongside a hashed API key. */
export interface ApiKeyInfo {
  /** Unique identifier for this key entry. */
  id: string;
  /** Human-readable name / description. */
  name: string;
  /** The user who owns this key. */
  userId: string;
  /** Role granted when authenticating with this key. */
  role: Role;
  /** ISO-8601 timestamp of when the key was created. */
  createdAt: string;
  /** ISO-8601 timestamp of the most recent successful validation. */
  lastUsedAt: string | null;
  /** Optional ISO-8601 expiry timestamp. `null` means no expiry. */
  expiresAt: string | null;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * In-memory store mapping hashed API keys → metadata.
 *
 * Keys are SHA-256 hex digests of the raw key strings.
 */
const keyStore = new Map<string, ApiKeyInfo>();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute the SHA-256 hex digest of a raw API key string.
 *
 * @param raw - The plaintext API key.
 * @returns Hex-encoded SHA-256 hash.
 */
function hashKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a new API key.
 *
 * The raw key is returned in the result — this is the only time the
 * plaintext is available. Internally, only the SHA-256 hash is stored.
 *
 * @param name - Human-readable label for the key.
 * @param userId - Owner user ID.
 * @param role - Role granted when authenticating with this key.
 * @param expiresAt - Optional ISO-8601 expiry timestamp.
 * @returns An object containing the raw key and its stored metadata.
 */
export function generateApiKey(
  name: string,
  userId: string,
  role: Role,
  expiresAt?: string | null,
): { key: string; info: ApiKeyInfo } {
  const raw = `rk_${randomBytes(32).toString('hex')}`;
  const hashed = hashKey(raw);

  const info: ApiKeyInfo = {
    id: generateId(),
    name,
    userId,
    role,
    createdAt: nowISO(),
    lastUsedAt: null,
    expiresAt: expiresAt ?? null,
  };

  keyStore.set(hashed, info);
  logger.info(`API key '${name}' created for user '${userId}' (role: ${role})`);

  return { key: raw, info };
}

/**
 * Validate a raw API key string.
 *
 * Hashes the input, looks up the hash in the store, and checks expiry.
 * On success, updates `lastUsedAt` and returns the key metadata.
 *
 * @param key - The raw API key to validate.
 * @returns The associated {@link ApiKeyInfo} or `null` if invalid/expired.
 */
export function validateApiKey(key: string): ApiKeyInfo | null {
  const hashed = hashKey(key);
  const info = keyStore.get(hashed);

  if (!info) {
    return null;
  }

  // Check expiry
  if (info.expiresAt) {
    const expiryTime = new Date(info.expiresAt).getTime();
    if (Date.now() >= expiryTime) {
      logger.info(`API key '${info.name}' has expired — removing`);
      keyStore.delete(hashed);
      return null;
    }
  }

  // Update last-used timestamp
  info.lastUsedAt = nowISO();

  return info;
}

/**
 * Revoke an API key by its internal ID.
 *
 * @param id - The `ApiKeyInfo.id` to revoke.
 * @returns `true` if a key was found and removed, `false` otherwise.
 */
export function revokeApiKey(id: string): boolean {
  for (const [hashed, info] of keyStore) {
    if (info.id === id) {
      keyStore.delete(hashed);
      logger.info(`API key '${info.name}' (id: ${id}) revoked`);
      return true;
    }
  }
  return false;
}

/**
 * List API key metadata entries, optionally filtered by user.
 *
 * The returned objects never contain the raw key — only metadata.
 *
 * @param userId - If provided, only return keys owned by this user.
 * @returns Array of {@link ApiKeyInfo} entries.
 */
export function listApiKeys(userId?: string): ApiKeyInfo[] {
  const entries = [...keyStore.values()];
  if (userId) {
    return entries.filter((info) => info.userId === userId);
  }
  return entries;
}

/**
 * Clear all stored API keys.
 *
 * Primarily useful in tests to reset state between runs.
 */
export function clearApiKeys(): void {
  keyStore.clear();
}

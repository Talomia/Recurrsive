/**
 * @module @recurrsive/server/middleware/passwords
 *
 * Password hashing and verification using Node.js built-in `crypto.scrypt`.
 *
 * Uses scrypt (N=16384, r=8, p=1, keylen=64) with a random 32-byte salt
 * for password hashing. Verification uses `crypto.timingSafeEqual` to
 * prevent timing side-channel attacks.
 *
 * Zero external dependencies — uses only `node:crypto`.
 *
 * @packageDocumentation
 */

import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Key length in bytes for scrypt output. */
const KEY_LENGTH = 64;

/** Salt length in bytes. */
const SALT_LENGTH = 32;

/** Scrypt cost parameter (N). Higher = more memory/CPU. */
const SCRYPT_COST = 16384;

/** Scrypt block size parameter (r). */
const SCRYPT_BLOCK_SIZE = 8;

/** Scrypt parallelization parameter (p). */
const SCRYPT_PARALLELIZATION = 1;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Hash a plaintext password using scrypt.
 *
 * Generates a random 32-byte salt and derives a 64-byte hash using
 * scrypt with parameters N=16384, r=8, p=1. Both the hash and salt
 * are returned as hex strings for storage.
 *
 * @param plaintext - The plaintext password to hash.
 * @returns An object containing the hex-encoded `hash` and `salt`.
 *
 * @example
 * ```ts
 * const { hash, salt } = await hashPassword('my-secret-password');
 * // Store hash and salt in the database
 * ```
 */
export async function hashPassword(plaintext: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(SALT_LENGTH);

  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(plaintext, salt, KEY_LENGTH, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
    }, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });

  return {
    hash: hash.toString('hex'),
    salt: salt.toString('hex'),
  };
}

/**
 * Verify a plaintext password against a stored hash and salt.
 *
 * Re-derives the scrypt hash from the plaintext and salt, then
 * compares with the stored hash using `crypto.timingSafeEqual`
 * to prevent timing attacks.
 *
 * @param plaintext - The plaintext password to verify.
 * @param hash - The stored hex-encoded hash to compare against.
 * @param salt - The hex-encoded salt that was used during hashing.
 * @returns `true` if the password matches, `false` otherwise.
 *
 * @example
 * ```ts
 * const isValid = await verifyPassword('my-secret-password', storedHash, storedSalt);
 * if (isValid) {
 *   // Password is correct
 * }
 * ```
 */
export async function verifyPassword(plaintext: string, hash: string, salt: string): Promise<boolean> {
  const saltBuffer = Buffer.from(salt, 'hex');

  const derivedKey = await new Promise<Buffer>((resolve, reject) => {
    scrypt(plaintext, saltBuffer, KEY_LENGTH, {
      N: SCRYPT_COST,
      r: SCRYPT_BLOCK_SIZE,
      p: SCRYPT_PARALLELIZATION,
    }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });

  const storedHash = Buffer.from(hash, 'hex');

  // Ensure buffers are the same length before comparing
  if (derivedKey.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, storedHash);
}

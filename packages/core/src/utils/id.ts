import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

/**
 * Generate a new UUID v4 string.
 *
 * @returns A new random UUID v4.
 *
 * @example
 * ```ts
 * const id = generateId();
 * // '550e8400-e29b-41d4-a716-446655440000'
 * ```
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Validate whether a string is a well-formed UUID (any version).
 *
 * @param id - The string to validate.
 * @returns `true` if the string is a valid UUID, `false` otherwise.
 *
 * @example
 * ```ts
 * isValidId('550e8400-e29b-41d4-a716-446655440000'); // true
 * isValidId('not-a-uuid');                            // false
 * ```
 */
export function isValidId(id: string): boolean {
  return uuidValidate(id);
}

/**
 * Generate a deterministic qualified name by joining segments with
 * a colon separator.
 *
 * @param segments - Ordered name segments (e.g. repo, file, class, method).
 * @returns Colon-separated qualified name.
 * @throws {Error} If no segments are provided.
 *
 * @example
 * ```ts
 * qualifiedName('my-repo', 'src/index.ts', 'MyClass', 'myMethod');
 * // 'my-repo:src/index.ts:MyClass:myMethod'
 * ```
 */
export function qualifiedName(...segments: string[]): string {
  const filtered = segments.filter((s) => s.length > 0);
  if (filtered.length === 0) {
    throw new Error('qualifiedName requires at least one non-empty segment');
  }
  return filtered.join(':');
}

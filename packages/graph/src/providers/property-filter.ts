/**
 * @module providers/property-filter
 *
 * Shared entity-property filtering used by BOTH graph backends.
 *
 * Contract: `getEntities(type, filter)` matches entities whose nested
 * `properties` map contains every filter key with an equal value.
 * Scalars (string / number / boolean / null) are compared by value —
 * never coerced to quoted JSON strings — and objects / arrays are
 * compared structurally. Implementing the predicate once in JS keeps
 * the SQLite and PostgreSQL/Apache AGE providers behaviourally
 * identical for the same call.
 *
 * @packageDocumentation
 */

import { GraphError } from '@recurrsive/core';

/**
 * Validate that every filter key is a safe identifier. Throws a
 * {@link GraphError} with code `INVALID_FILTER` on the first bad key.
 *
 * @param filter - Key-value filter map to validate.
 */
export function assertValidFilterKeys(filter: Record<string, unknown>): void {
  for (const key of Object.keys(filter)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      throw new GraphError(
        `Invalid filter key "${key}" — must be a valid identifier`,
        'INVALID_FILTER',
      );
    }
  }
}

/** Structural equality for JSON-safe values. */
function valueEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => valueEquals(item, b[i]));
  }
  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((k) =>
    valueEquals(
      (a as Record<string, unknown>)[k],
      (b as Record<string, unknown>)[k],
    ),
  );
}

/**
 * Return `true` when the entity `properties` map satisfies every
 * key/value pair in `filter`.
 *
 * @param properties - The entity's nested `properties` map.
 * @param filter - Key-value pairs that must all match.
 */
export function matchesPropertyFilter(
  properties: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  for (const [key, expected] of Object.entries(filter)) {
    if (!valueEquals(properties[key], expected)) return false;
  }
  return true;
}

/**
 * @module __tests__/providers/factory
 *
 * Tests for the providers barrel export (providers/index.ts).
 *
 * Validates that all public symbols from both the AGE and SQLite
 * providers are re-exported correctly through the barrel.
 */

import { describe, it, expect } from 'vitest';
import * as providers from '../../providers/index.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('providers barrel export', () => {
  // ── AGE exports ──────────────────────────────────────────────────────────

  describe('AGE provider exports', () => {
    it('exports AgeGraphClient class', () => {
      expect(providers.AgeGraphClient).toBeDefined();
      expect(typeof providers.AgeGraphClient).toBe('function');
    });

    it('exports createAgeClient factory function', () => {
      expect(providers.createAgeClient).toBeDefined();
      expect(typeof providers.createAgeClient).toBe('function');
    });
  });

  // ── SQLite exports ───────────────────────────────────────────────────────

  describe('SQLite provider exports', () => {
    it('exports SqliteGraphClient class', () => {
      expect(providers.SqliteGraphClient).toBeDefined();
      expect(typeof providers.SqliteGraphClient).toBe('function');
    });

    it('exports createSqliteClient factory function', () => {
      expect(providers.createSqliteClient).toBeDefined();
      expect(typeof providers.createSqliteClient).toBe('function');
    });
  });

  // ── Completeness ─────────────────────────────────────────────────────────

  describe('export completeness', () => {
    it('exports exactly the expected runtime symbols', () => {
      // Only runtime (non-type) exports should appear
      const runtimeKeys = Object.keys(providers).sort();
      expect(runtimeKeys).toEqual([
        'AgeGraphClient',
        'SqliteGraphClient',
        'createAgeClient',
        'createSqliteClient',
      ]);
    });
  });
});

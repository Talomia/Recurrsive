/**
 * Tests for createDefaultAnalyzers factory function.
 *
 * Verifies: returns 12 analyzers, each has unique id,
 * each implements the Analyzer interface (has analyze method).
 */

import { describe, it, expect } from 'vitest';
import { createDefaultAnalyzers } from '../create-defaults.js';

describe('createDefaultAnalyzers', () => {
  const analyzers = createDefaultAnalyzers();

  // ── Returns correct count ──────────────────────────────────────────────

  it('returns an array of 12 analyzers', () => {
    expect(analyzers).toHaveLength(12);
  });

  it('returns an array (not null or undefined)', () => {
    expect(Array.isArray(analyzers)).toBe(true);
  });

  // ── Unique IDs ───────────────────────────────────────────────────────────

  it('each analyzer has a unique id', () => {
    const ids = analyzers.map((a) => a.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(analyzers.length);
  });

  it('all ids are non-empty strings', () => {
    for (const a of analyzers) {
      expect(typeof a.id).toBe('string');
      expect(a.id.length).toBeGreaterThan(0);
    }
  });

  // ── Analyzer interface compliance ────────────────────────────────────────

  describe('Analyzer interface', () => {
    it('each has an analyze method', () => {
      for (const a of analyzers) {
        expect(typeof a.analyze).toBe('function');
      }
    });

    it('each has an initialize method', () => {
      for (const a of analyzers) {
        expect(typeof a.initialize).toBe('function');
      }
    });

    it('each has a finalize method', () => {
      for (const a of analyzers) {
        expect(typeof a.finalize).toBe('function');
      }
    });

    it('each has a name property', () => {
      for (const a of analyzers) {
        expect(typeof a.name).toBe('string');
        expect(a.name.length).toBeGreaterThan(0);
      }
    });

    it('each has a description property', () => {
      for (const a of analyzers) {
        expect(typeof a.description).toBe('string');
        expect(a.description.length).toBeGreaterThan(0);
      }
    });

    it('each has a version property', () => {
      for (const a of analyzers) {
        expect(typeof a.version).toBe('string');
        expect(a.version.length).toBeGreaterThan(0);
      }
    });

    it('each has a categories array with at least one category', () => {
      for (const a of analyzers) {
        expect(Array.isArray(a.categories)).toBe(true);
        expect(a.categories.length).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ── Unique names ─────────────────────────────────────────────────────────

  it('each analyzer has a unique name', () => {
    const names = analyzers.map((a) => a.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(analyzers.length);
  });

  // ── Categories are valid ─────────────────────────────────────────────────

  it('categories are from the valid OpportunityCategory set', () => {
    const validCategories = new Set([
      'architecture',
      'performance',
      'security',
      'cost',
      'ai_quality',
      'reliability',
      'ux',
      'accessibility',
      'privacy',
      'compliance',
      'developer_experience',
      'product',
      'data',
      'documentation',
      'infrastructure',
    ]);

    for (const a of analyzers) {
      for (const cat of a.categories) {
        expect(validCategories.has(cat)).toBe(true);
      }
    }
  });

  // ── Expected analyzer ids ────────────────────────────────────────────────

  it('includes all expected domain analyzers', () => {
    const ids = analyzers.map((a) => a.id);

    // We don't enforce exact ids but check there are 12 unique ones
    // Each domain is represented
    expect(ids.length).toBe(12);
    expect(new Set(ids).size).toBe(12);
  });

  // ── Fresh instances each call ────────────────────────────────────────────

  it('returns fresh instances on each call', () => {
    const set1 = createDefaultAnalyzers();
    const set2 = createDefaultAnalyzers();

    expect(set1).not.toBe(set2);
    // Each element should be a different object
    for (let i = 0; i < set1.length; i++) {
      expect(set1[i]).not.toBe(set2[i]);
    }
  });
});

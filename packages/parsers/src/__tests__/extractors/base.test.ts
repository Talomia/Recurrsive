/**
 * @module __tests__/extractors/base
 *
 * Tests for the ExtractorRegistry and the LanguageExtractor interface
 * contract. Uses mock extractors to verify the registry's registration,
 * lookup, and factory behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ExtractorRegistry,
  createDefaultRegistry,
} from '../../extractors/index.js';
import type {
  LanguageExtractor,
  ExtractedEntity,
  ImportInfo,
} from '../../extractors/base.js';

// ── Mock Extractor ───────────────────────────────────────────────────────────

function createMockExtractor(
  language: string,
  extensions: string[],
): LanguageExtractor {
  return {
    language,
    extensions,
    extract(_source: string, _filePath: string, _tree?: unknown): ExtractedEntity[] {
      return [];
    },
    extractImports(_source: string, _filePath: string): ImportInfo[] {
      return [];
    },
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ExtractorRegistry', () => {
  let registry: ExtractorRegistry;

  beforeEach(() => {
    registry = new ExtractorRegistry();
  });

  // ── register ───────────────────────────────────────────────────────────

  describe('register', () => {
    it('registers an extractor', () => {
      const ext = createMockExtractor('rust', ['rs']);
      registry.register(ext);
      expect(registry.getForLanguage('rust')).toBe(ext);
    });

    it('throws when registering a duplicate language', () => {
      const ext1 = createMockExtractor('rust', ['rs']);
      const ext2 = createMockExtractor('rust', ['rs']);
      registry.register(ext1);
      expect(() => registry.register(ext2)).toThrow(/already registered/);
    });

    it('maps all extensions to the language', () => {
      const ext = createMockExtractor('typescript', ['ts', 'tsx']);
      registry.register(ext);
      expect(registry.getForFile('app.ts')).toBe(ext);
      expect(registry.getForFile('app.tsx')).toBe(ext);
    });
  });

  // ── getForLanguage ─────────────────────────────────────────────────────

  describe('getForLanguage', () => {
    it('returns registered extractor', () => {
      const ext = createMockExtractor('go', ['go']);
      registry.register(ext);
      expect(registry.getForLanguage('go')).toBe(ext);
    });

    it('returns undefined for unknown language', () => {
      expect(registry.getForLanguage('cobol')).toBeUndefined();
    });
  });

  // ── getForFile ─────────────────────────────────────────────────────────

  describe('getForFile', () => {
    beforeEach(() => {
      registry.register(createMockExtractor('typescript', ['ts', 'tsx']));
      registry.register(createMockExtractor('python', ['py']));
    });

    it('looks up extractor by file extension', () => {
      const ext = registry.getForFile('src/app.ts');
      expect(ext).toBeDefined();
      expect(ext!.language).toBe('typescript');
    });

    it('handles file paths with multiple dots', () => {
      const ext = registry.getForFile('src/config.test.ts');
      expect(ext).toBeDefined();
      expect(ext!.language).toBe('typescript');
    });

    it('is case-insensitive for extensions', () => {
      const ext = registry.getForFile('script.PY');
      expect(ext).toBeDefined();
      expect(ext!.language).toBe('python');
    });

    it('returns undefined for unknown extensions', () => {
      expect(registry.getForFile('Makefile')).toBeUndefined();
      expect(registry.getForFile('style.css')).toBeUndefined();
    });

    it('returns undefined for files without extension', () => {
      expect(registry.getForFile('Dockerfile')).toBeUndefined();
    });
  });

  // ── getAll ─────────────────────────────────────────────────────────────

  describe('getAll', () => {
    it('returns empty array when no extractors registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('returns all registered extractors', () => {
      const ext1 = createMockExtractor('rust', ['rs']);
      const ext2 = createMockExtractor('go', ['go']);
      registry.register(ext1);
      registry.register(ext2);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(ext1);
      expect(all).toContain(ext2);
    });
  });

  // ── getLanguages ───────────────────────────────────────────────────────

  describe('getLanguages', () => {
    it('returns empty array when no extractors registered', () => {
      expect(registry.getLanguages()).toEqual([]);
    });

    it('returns all registered language names', () => {
      registry.register(createMockExtractor('typescript', ['ts']));
      registry.register(createMockExtractor('python', ['py']));

      const langs = registry.getLanguages().sort();
      expect(langs).toEqual(['python', 'typescript']);
    });
  });
});

// ── createDefaultRegistry ────────────────────────────────────────────────────

describe('createDefaultRegistry', () => {
  it('returns an ExtractorRegistry', () => {
    const registry = createDefaultRegistry();
    expect(registry).toBeInstanceOf(ExtractorRegistry);
  });

  it('includes TypeScript extractor', () => {
    const registry = createDefaultRegistry();
    const ext = registry.getForLanguage('typescript');
    expect(ext).toBeDefined();
    expect(ext!.language).toBe('typescript');
  });

  it('includes Python extractor', () => {
    const registry = createDefaultRegistry();
    const ext = registry.getForLanguage('python');
    expect(ext).toBeDefined();
    expect(ext!.language).toBe('python');
  });

  it('includes Go extractor', () => {
    const registry = createDefaultRegistry();
    const ext = registry.getForLanguage('go');
    expect(ext).toBeDefined();
    expect(ext!.language).toBe('go');
  });

  it('maps .ts files to the TypeScript extractor', () => {
    const registry = createDefaultRegistry();
    const ext = registry.getForFile('app.ts');
    expect(ext?.language).toBe('typescript');
  });

  it('maps .py files to the Python extractor', () => {
    const registry = createDefaultRegistry();
    const ext = registry.getForFile('main.py');
    expect(ext?.language).toBe('python');
  });

  it('maps .go files to the Go extractor', () => {
    const registry = createDefaultRegistry();
    const ext = registry.getForFile('main.go');
    expect(ext?.language).toBe('go');
  });
});

// ── LanguageExtractor interface contract ─────────────────────────────────────

describe('LanguageExtractor interface contract', () => {
  it('all default extractors have a language string', () => {
    const registry = createDefaultRegistry();
    for (const ext of registry.getAll()) {
      expect(typeof ext.language).toBe('string');
      expect(ext.language.length).toBeGreaterThan(0);
    }
  });

  it('all default extractors have extensions array', () => {
    const registry = createDefaultRegistry();
    for (const ext of registry.getAll()) {
      expect(Array.isArray(ext.extensions)).toBe(true);
      expect(ext.extensions.length).toBeGreaterThan(0);
    }
  });

  it('all default extractors implement extract()', () => {
    const registry = createDefaultRegistry();
    for (const ext of registry.getAll()) {
      expect(typeof ext.extract).toBe('function');
      // Should return an array when given empty source
      const result = ext.extract('', 'test.ts');
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it('all default extractors implement extractImports()', () => {
    const registry = createDefaultRegistry();
    for (const ext of registry.getAll()) {
      expect(typeof ext.extractImports).toBe('function');
      const result = ext.extractImports('', 'test.ts');
      expect(Array.isArray(result)).toBe(true);
    }
  });
});

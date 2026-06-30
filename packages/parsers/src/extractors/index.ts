/**
 * @module @recurrsive/parsers/extractors
 *
 * Extractor registry and barrel export for all language extractors.
 *
 * @packageDocumentation
 */

import { extname } from 'node:path';
import type { LanguageExtractor } from './base.js';
import { TypeScriptExtractor } from './typescript.js';
import { PythonExtractor } from './python.js';
import { GoExtractor } from './go.js';

export type { ExtractedEntity, ExtractedRelationship, ImportInfo, LanguageExtractor, SourceLocation } from './base.js';
export { TypeScriptExtractor } from './typescript.js';
export { PythonExtractor } from './python.js';
export { GoExtractor } from './go.js';

// ─── Extractor Registry ───────────────────────────────────────────────────────

/**
 * A registry of {@link LanguageExtractor} instances keyed by language
 * name and file extension.
 *
 * @example
 * ```ts
 * const registry = createDefaultRegistry();
 * const ext = registry.getForFile('src/app.ts');
 * ```
 */
export class ExtractorRegistry {
  /** Language name → extractor. */
  private extractors: Map<string, LanguageExtractor> = new Map();

  /** File extension (without dot) → language name. */
  private extensionMap: Map<string, string> = new Map();

  /**
   * Register a language extractor.
   *
   * @param extractor - The extractor to register.
   * @throws Error if the language is already registered.
   */
  register(extractor: LanguageExtractor): void {
    if (this.extractors.has(extractor.language)) {
      throw new Error(`Extractor for language "${extractor.language}" is already registered`);
    }
    this.extractors.set(extractor.language, extractor);
    for (const ext of extractor.extensions) {
      this.extensionMap.set(ext.toLowerCase(), extractor.language);
    }
  }

  /**
   * Look up an extractor by canonical language name.
   *
   * @param language - Language name (e.g. `'typescript'`).
   * @returns The extractor, or `undefined` if none is registered.
   */
  getForLanguage(language: string): LanguageExtractor | undefined {
    return this.extractors.get(language);
  }

  /**
   * Look up an extractor by file path (extension-based).
   *
   * @param filePath - A file path or filename.
   * @returns The extractor, or `undefined` if the extension is unknown.
   */
  getForFile(filePath: string): LanguageExtractor | undefined {
    const ext = extname(filePath).replace('.', '').toLowerCase();
    const lang = this.extensionMap.get(ext);
    if (!lang) return undefined;
    return this.extractors.get(lang);
  }

  /**
   * Return all registered extractors.
   *
   * @returns Array of registered extractors.
   */
  getAll(): LanguageExtractor[] {
    return [...this.extractors.values()];
  }

  /**
   * Return all registered language names.
   *
   * @returns Array of language names.
   */
  getLanguages(): string[] {
    return [...this.extractors.keys()];
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create an {@link ExtractorRegistry} pre-populated with all built-in
 * language extractors (TypeScript, Python, Go).
 *
 * @returns A ready-to-use registry.
 */
export function createDefaultRegistry(): ExtractorRegistry {
  const registry = new ExtractorRegistry();
  registry.register(new TypeScriptExtractor());
  registry.register(new PythonExtractor());
  registry.register(new GoExtractor());
  return registry;
}

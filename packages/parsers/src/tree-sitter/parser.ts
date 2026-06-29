/**
 * @module @recurrsive/parsers/tree-sitter/parser
 *
 * Tree-sitter parser manager.  Initialises and caches per-language
 * parsers, providing a graceful fallback when native bindings are
 * unavailable (CI, limited environments, WASM not built, etc.).
 *
 * @packageDocumentation
 */

import { createLogger, type LogLevel } from '@recurrsive/core';

const log = createLogger({ level: 'info' as LogLevel, context: { name: 'TreeSitterParser' } });

/**
 * Tree-sitter tree type placeholder.
 * When tree-sitter bindings are available this becomes the real `Tree`;
 * otherwise callers receive `null`.
 */
export type ParseTree = unknown;

/** Map from canonical language name to its tree-sitter grammar npm package. */
const LANGUAGE_PACKAGES: Record<string, string> = {
  typescript: 'tree-sitter-typescript',
  javascript: 'tree-sitter-javascript',
  python: 'tree-sitter-python',
};

/**
 * Manages Tree-sitter {@link https://tree-sitter.github.io/tree-sitter/ | Parser}
 * instances for multiple languages.
 *
 * If native Tree-sitter bindings cannot be loaded the class degrades
 * silently — {@link parse} returns `null` and callers should fall back
 * to regex-based extraction.
 *
 * @example
 * ```ts
 * const parser = new TreeSitterParser();
 * await parser.initialize(['typescript', 'python']);
 * const tree = parser.parse(source, 'typescript');
 * ```
 */
export class TreeSitterParser {
  /** Per-language parser instances (value is the native Parser object). */
  private parsers: Map<string, unknown> = new Map();

  /** Whether native tree-sitter is available at all. */
  private _available = false;

  /** Cached reference to the `tree-sitter` module. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _treeSitterModule: any = null;

  /** Languages that were requested but could not be loaded. */
  private _failedLanguages: Set<string> = new Set();

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Whether the native tree-sitter runtime is available.
   * Always `false` before {@link initialize} is called.
   */
  get available(): boolean {
    return this._available;
  }

  /**
   * Initialise Tree-sitter parsers for the requested languages.
   *
   * The method attempts a dynamic `import('tree-sitter')`.  If the
   * native addon cannot be loaded the entire subsystem is disabled and
   * every subsequent call to {@link parse} returns `null`.
   *
   * @param languages - Array of canonical language names (e.g. `['typescript', 'python']`).
   */
  async initialize(languages: string[]): Promise<void> {
    try {
      // Attempt to load native tree-sitter
      this._treeSitterModule = await import('tree-sitter');

      // Some builds export as default, others as named
      const ParserConstructor =
        this._treeSitterModule.default ?? this._treeSitterModule.Parser ?? this._treeSitterModule;

      if (typeof ParserConstructor !== 'function') {
        log.warn('tree-sitter module loaded but no Parser constructor found — disabling');
        this._available = false;
        return;
      }

      this._available = true;

      for (const lang of languages) {
        await this._loadLanguage(lang, ParserConstructor);
      }
    } catch (_err: unknown) {
      log.info(
        'tree-sitter native bindings not available — falling back to regex-based extraction',
      );
      this._available = false;
    }
  }

  /**
   * Parse `source` with the parser registered for `language`.
   *
   * @param source   - Full source text.
   * @param language - Canonical language name.
   * @returns The Tree-sitter `Tree`, or `null` if the language is unsupported
   *          or native bindings are unavailable.
   */
  parse(source: string, language: string): ParseTree | null {
    const parser = this.parsers.get(language);
    if (!parser) return null;

    try {
      // The native Parser exposes `.parse(string): Tree`
      return (parser as { parse(src: string): unknown }).parse(source);
    } catch (err: unknown) {
      log.warn(`tree-sitter parse failed for language "${language}": ${String(err)}`);
      return null;
    }
  }

  /**
   * List all languages for which a parser was successfully loaded.
   *
   * @returns Array of canonical language names.
   */
  getSupportedLanguages(): string[] {
    return [...this.parsers.keys()];
  }

  /**
   * Check whether a given language has a loaded parser.
   *
   * @param language - Canonical language name.
   * @returns `true` if the parser is loaded and ready.
   */
  isSupported(language: string): boolean {
    return this.parsers.has(language);
  }

  /**
   * Dispose all parser instances and free native resources.
   */
  dispose(): void {
    for (const [lang, parser] of this.parsers) {
      try {
        if (parser && typeof (parser as { delete?: () => void }).delete === 'function') {
          (parser as { delete: () => void }).delete();
        }
      } catch (_err: unknown) {
        log.warn(`Failed to dispose parser for "${lang}"`);
      }
    }
    this.parsers.clear();
    this._available = false;
    this._treeSitterModule = null;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Attempt to load a single language grammar.
   *
   * @param language         - Canonical language name.
   * @param ParserConstructor - The native `Parser` class.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _loadLanguage(language: string, ParserConstructor: any): Promise<void> {
    const packageName = LANGUAGE_PACKAGES[language];
    if (!packageName) {
      log.warn(`No tree-sitter grammar package configured for language "${language}"`);
      this._failedLanguages.add(language);
      return;
    }

    try {
      const langModule = await import(packageName);
      // tree-sitter-typescript exports { typescript, tsx }
      const grammar =
        language === 'typescript'
          ? langModule.typescript ?? langModule.default?.typescript ?? langModule.default ?? langModule
          : langModule.default ?? langModule;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const parser = new ParserConstructor();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      parser.setLanguage(grammar);
      this.parsers.set(language, parser);
      log.info(`Loaded tree-sitter grammar for "${language}"`);
    } catch (err: unknown) {
      log.warn(`Failed to load tree-sitter grammar for "${language}": ${String(err)}`);
      this._failedLanguages.add(language);
    }
  }
}

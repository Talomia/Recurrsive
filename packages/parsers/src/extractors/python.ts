/**
 * @module @recurrsive/parsers/extractors/python
 *
 * Language extractor for Python source files.
 *
 * Detects functions, classes, imports, and HTTP endpoint definitions
 * from Flask, FastAPI, and Django.  Uses regex-based extraction with
 * optional Tree-sitter AST support.
 *
 * @packageDocumentation
 */

import type { EntityType, RelationType } from '@recurrsive/core';
import type {
  ExtractedEntity,
  ExtractedRelationship,
  ImportInfo,
  LanguageExtractor,
  SourceLocation,
} from './base.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a qualified name from path + segments.
 *
 * @param filePath - Project-relative file path.
 * @param parts    - Symbol name segments.
 * @returns Colon-separated qualified name.
 */
function qname(filePath: string, ...parts: string[]): string {
  return [filePath, ...parts].join(':');
}

/**
 * 1-based line number for a character index.
 *
 * @param source - Full source text.
 * @param index  - Character offset.
 * @returns 1-based line number.
 */
function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

/**
 * 0-based column for a character index.
 *
 * @param source - Full source text.
 * @param index  - Character offset.
 * @returns 0-based column number.
 */
function columnAt(source: string, index: number): number {
  let col = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (source[i] === '\n') break;
    col++;
  }
  return col;
}

/**
 * Build a {@link SourceLocation} from a regex match.
 *
 * @param source   - Full source text.
 * @param match    - Regex match.
 * @param filePath - File path.
 * @returns Source location.
 */
export function locationFromMatch(
  source: string,
  match: RegExpExecArray,
  filePath: string,
): SourceLocation {
  const startIndex = match.index;
  const endIndex = startIndex + match[0].length;
  return {
    file: filePath,
    start_line: lineAt(source, startIndex),
    end_line: lineAt(source, endIndex),
    start_column: columnAt(source, startIndex),
    end_column: columnAt(source, endIndex),
  };
}

/**
 * Find the end of an indented Python block starting after the colon
 * on `startLine`.  The block ends when indentation decreases or the
 * file ends.
 *
 * @param lines     - Source split into lines.
 * @param startLine - 0-based line index of the def/class statement.
 * @returns 0-based index of the last line in the block (inclusive).
 */
function findBlockEnd(lines: string[], startLine: number): number {
  // Determine the indentation of the def/class line
  const defIndent = lines[startLine]!.search(/\S/);
  let lastBodyLine = startLine;

  for (let i = startLine + 1; i < lines.length; i++) {
    const line = lines[i]!;
    // Skip blank lines and comment-only lines
    if (line.trim() === '' || line.trim().startsWith('#')) {
      continue;
    }
    const indent = line.search(/\S/);
    if (indent <= defIndent) break;
    lastBodyLine = i;
  }

  return lastBodyLine;
}

/**
 * Extract the docstring immediately after a def/class line.
 *
 * @param lines     - Source lines.
 * @param startLine - 0-based index of the def/class line.
 * @returns Docstring text or `undefined`.
 */
function extractDocstring(lines: string[], startLine: number): string | undefined {
  // The docstring should be the first statement in the body
  let idx = startLine + 1;
  // Skip blank lines
  while (idx < lines.length && lines[idx]!.trim() === '') idx++;
  if (idx >= lines.length) return undefined;

  const trimmed = lines[idx]!.trim();

  // Triple-quoted string
  const tripleQuotes = ['"""', "'''"];
  for (const q of tripleQuotes) {
    if (trimmed.startsWith(q)) {
      // Single-line docstring
      if (trimmed.endsWith(q) && trimmed.length > q.length * 2) {
        return trimmed.slice(q.length, -q.length).trim();
      }
      if (trimmed.slice(q.length).includes(q)) {
        return trimmed.slice(q.length, trimmed.lastIndexOf(q)).trim();
      }
      // Multi-line docstring
      const docLines = [trimmed.slice(q.length)];
      idx++;
      while (idx < lines.length) {
        const l = lines[idx]!;
        if (l.trim().endsWith(q)) {
          docLines.push(l.trim().slice(0, -q.length));
          break;
        }
        docLines.push(l.trim());
        idx++;
      }
      return docLines.filter((l) => l.length > 0).join('\n');
    }
  }

  return undefined;
}

/**
 * Detect control-flow features (try/except error handling and loops)
 * within a Python function body.
 *
 * Heuristic, regex-based checks over the actual body text. They power
 * analyzer rules reasoning about error handling and iteration.
 *
 * @param bodyText - Function body source text.
 * @returns `has_try_catch` and `has_loop` flags.
 */
export function detectBodyFeatures(bodyText: string): {
  has_try_catch: boolean;
  has_loop: boolean;
  has_validation_call: boolean;
} {
  const has_try_catch =
    /(^|\n)\s*try\s*:/.test(bodyText) && /(^|\n)\s*except\b/.test(bodyText);
  const has_loop =
    /\bfor\b\s+[\w(]/.test(bodyText) || /\bwhile\b\s+[^\n:]+:/.test(bodyText);
  // Schema/validation calls actually present in the body text (pydantic,
  // marshmallow, jsonschema, generic validate*). A real, body-derived flag
  // for analyzers reasoning about output validation.
  const has_validation_call =
    /\bvalidate\w*\s*\(/i.test(bodyText) ||
    /\bmodel_validate\w*\s*\(/.test(bodyText) ||
    /\bparse_obj\w*\s*\(/.test(bodyText) ||
    /\b(?:pydantic|marshmallow|jsonschema|cerberus|voluptuous)\b/i.test(bodyText);
  return { has_try_catch, has_loop, has_validation_call };
}

// ─── Regex Patterns ───────────────────────────────────────────────────────────

/** Python function/method definition. */
const FUNCTION_DEF_RE =
  /^([ \t]*)(?:(async)\s+)?def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:]+))?\s*:/gm;

/** Python class definition. */
const CLASS_DEF_RE =
  /^([ \t]*)class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:/gm;

/** Decorator above a function or class. */
// @ts-expect-error -- Reserved for future decorator extraction
const _DECORATOR_RE = /^([ \t]*)@([\w.]+)(?:\(([^)]*)\))?/gm;

// ─── Import Patterns ──────────────────────────────────────────────────────────

/** `import module` or `import module as alias` */
const IMPORT_MODULE_RE = /^import\s+([\w.]+)(?:\s+as\s+(\w+))?/gm;

/** `from module import name1, name2` or `from module import (name1, name2)` */
const FROM_IMPORT_RE = /^from\s+([\w.]+)\s+import\s+(.+)/gm;

// ─── Endpoint Patterns ───────────────────────────────────────────────────────

/**
 * Flask: `@app.route('/path', methods=['GET', 'POST'])`.
 * Group 3 captures the remaining decorator arguments so the `methods=` kwarg
 * can be honored — previously every `@app.route` was recorded as GET only.
 */
const FLASK_ROUTE_RE =
  /@(?:app|blueprint|bp)\.(route|get|post|put|patch|delete)\s*\(\s*['"](\/[^'"]*)['"]([^)]*)\)/gm;

/** FastAPI: `@app.get('/path')`, `@router.post('/path')` */
const FASTAPI_ROUTE_RE =
  /@(?:app|router)\.(get|post|put|patch|delete|options|head)\s*\(\s*['"](\/[^'"]*)['"]/gm;

/** Django: `path('route', view)` or `url(r'^route', view)` */
const DJANGO_URL_RE =
  /(?:path|re_path|url)\s*\(\s*[r]?['"](\/?\^?[^'"]*)['"]\s*,\s*(\w[\w.]*)/gm;

// ─── Python Extractor ─────────────────────────────────────────────────────────

/**
 * Extracts code entities and relationships from Python source files.
 *
 * @example
 * ```ts
 * const extractor = new PythonExtractor();
 * const entities = extractor.extract(pySource, 'app/views.py');
 * ```
 */
export class PythonExtractor implements LanguageExtractor {
  readonly language = 'python';
  readonly extensions = ['py', 'pyw'];

  /**
   * Extract all entities from a Python source file.
   *
   * @param source   - Full source text.
   * @param filePath - Project-relative path.
   * @param _tree    - Optional Tree-sitter tree (unused in regex path).
   * @returns Extracted entities.
   */
  extract(source: string, filePath: string, _tree?: unknown): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const lines = source.split('\n');

    // Pre-scan decorators so we can attach them to the next def/class
    const decoratorsByLine = this._scanDecorators(source);

    entities.push(...this._extractFunctions(source, lines, filePath, decoratorsByLine));
    entities.push(...this._extractClasses(source, lines, filePath, decoratorsByLine));
    entities.push(...this._extractEndpoints(source, filePath));

    return entities;
  }

  /**
   * Extract import statements from Python source.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Import information.
   */
  extractImports(source: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];
    let match: RegExpExecArray | null;

    // `import module`
    const importModRe = new RegExp(IMPORT_MODULE_RE.source, 'gm');
    while ((match = importModRe.exec(source)) !== null) {
      const module = match[1]!;
      const alias = match[2] ?? module.split('.').pop()!;
      imports.push({
        module,
        names: [alias],
        is_default: true,
        is_namespace: false,
        source_location: { file: filePath, line: lineAt(source, match.index) },
      });
    }

    // `from module import ...`
    const fromRe = new RegExp(FROM_IMPORT_RE.source, 'gm');
    while ((match = fromRe.exec(source)) !== null) {
      const module = match[1]!;
      let namesPart = match[2]!.trim();

      // Handle parenthesised imports spanning multiple lines
      if (namesPart.startsWith('(')) {
        const start = match.index + match[0].indexOf('(');
        let depth = 0;
        let end = start;
        for (let i = start; i < source.length; i++) {
          if (source[i] === '(') depth++;
          else if (source[i] === ')') {
            depth--;
            if (depth === 0) {
              end = i;
              break;
            }
          }
        }
        namesPart = source.substring(start + 1, end);
      }

      // Handle `import *`
      if (namesPart.trim() === '*') {
        imports.push({
          module,
          names: [],
          is_default: false,
          is_namespace: true,
          source_location: { file: filePath, line: lineAt(source, match.index) },
        });
        continue;
      }

      const names = namesPart
        .split(',')
        .map((n) => {
          const parts = n.trim().split(/\s+as\s+/);
          return parts[parts.length - 1]!.trim();
        })
        .filter((n) => n.length > 0 && n !== '\\');

      imports.push({
        module,
        names,
        is_default: false,
        is_namespace: false,
        source_location: { file: filePath, line: lineAt(source, match.index) },
      });
    }

    return imports;
  }

  // ── Private extraction methods ──────────────────────────────────────────

  /**
   * Pre-scan decorators and index them by the 1-based line of the
   * declaration they decorate.
   *
   * @param source - Full source text.
   * @returns Map from 1-based decorated-line to decorator names.
   */
  private _scanDecorators(source: string): Map<number, string[]> {
    const lines = source.split('\n');
    const result = new Map<number, string[]>();

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i]!.trim();
      if (!trimmed.startsWith('@')) continue;

      // Collect all consecutive decorators
      const decorators: string[] = [];
      let j = i;
      while (j < lines.length && lines[j]!.trim().startsWith('@')) {
        const decMatch = /^[ \t]*@([\w.]+)/.exec(lines[j]!);
        if (decMatch) decorators.push(decMatch[1]!);
        j++;
      }

      // `j` now points at the def/class line (1-based: j+1)
      if (j < lines.length) {
        result.set(j + 1, decorators);
      }
    }

    return result;
  }

  /**
   * Extract function definitions.
   *
   * @param source          - Full source text.
   * @param lines           - Source lines.
   * @param filePath        - File path.
   * @param decoratorsByLine - Pre-scanned decorator map.
   * @returns Extracted function entities.
   */
  private _extractFunctions(
    source: string,
    lines: string[],
    filePath: string,
    decoratorsByLine: Map<number, string[]>,
  ): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(FUNCTION_DEF_RE.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const indent = match[1] ?? '';
      const asyncKw = match[2] ?? '';
      const name = match[3]!;
      const rawParams = match[4] ?? '';
      const returnType = match[5]?.trim() ?? null;
      const startLine = lineAt(source, match.index);
      const startLineIdx = startLine - 1; // 0-based
      const endLineIdx = findBlockEnd(lines, startLineIdx);
      const endLine = endLineIdx + 1;
      const isAsync = asyncKw === 'async';
      const docstring = extractDocstring(lines, startLineIdx);
      const decorators = decoratorsByLine.get(startLine) ?? [];
      const { has_try_catch, has_loop, has_validation_call } = detectBodyFeatures(
        lines.slice(startLineIdx, endLineIdx + 1).join('\n'),
      );

      // Determine if this is a top-level function or a method
      const isMethod = indent.length > 0;
      const isPrivate = name.startsWith('_') && !name.startsWith('__');
      const isDunder = name.startsWith('__') && name.endsWith('__');

      const relationships: ExtractedRelationship[] = [];

      entities.push({
        type: 'function' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          parameters: this._parseParameters(rawParams),
          return_type: returnType,
          is_async: isAsync,
          is_method: isMethod,
          is_private: isPrivate,
          is_dunder: isDunder,
          has_try_catch,
          has_loop,
          has_validation_call,
          docstring: docstring ?? null,
          decorators,
          indent_level: indent.length,
        },
        source_location: {
          file: filePath,
          start_line: startLine,
          end_line: endLine,
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships,
      });
    }

    return entities;
  }

  /**
   * Extract class definitions.
   *
   * @param source          - Full source text.
   * @param lines           - Source lines.
   * @param filePath        - File path.
   * @param decoratorsByLine - Pre-scanned decorator map.
   * @returns Extracted class entities.
   */
  private _extractClasses(
    source: string,
    lines: string[],
    filePath: string,
    decoratorsByLine: Map<number, string[]>,
  ): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(CLASS_DEF_RE.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const name = match[2]!;
      const bases = match[3]?.trim() ?? null;
      const startLine = lineAt(source, match.index);
      const startLineIdx = startLine - 1;
      const endLineIdx = findBlockEnd(lines, startLineIdx);
      const endLine = endLineIdx + 1;
      const docstring = extractDocstring(lines, startLineIdx);
      const decorators = decoratorsByLine.get(startLine) ?? [];

      const relationships: ExtractedRelationship[] = [];
      if (bases) {
        const baseNames = bases
          .split(',')
          .map((b) => b.trim())
          .filter((b) => b.length > 0 && b !== 'object');
        for (const base of baseNames) {
          relationships.push({ type: 'extends' as RelationType, target_name: base });
        }
      }

      entities.push({
        type: 'class' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          bases: bases
            ? bases.split(',').map((b) => b.trim()).filter(Boolean)
            : [],
          docstring: docstring ?? null,
          decorators,
        },
        source_location: {
          file: filePath,
          start_line: startLine,
          end_line: endLine,
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships,
      });
    }

    return entities;
  }

  /**
   * Extract HTTP endpoint definitions from Flask, FastAPI, and Django
   * patterns.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted endpoint entities.
   */
  private _extractEndpoints(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const seenEndpoints = new Set<string>();
    let match: RegExpExecArray | null;

    // Flask routes
    const flaskRe = new RegExp(FLASK_ROUTE_RE.source, 'gm');
    while ((match = flaskRe.exec(source)) !== null) {
      const methodOrRoute = match[1]!;
      const path = match[2]!;
      const restArgs = match[3] ?? '';

      // Honor the `methods=[...]` kwarg on @app.route — one endpoint per
      // declared method. Without it, Flask defaults `route` to GET.
      let methods: string[];
      if (methodOrRoute === 'route') {
        const methodsMatch = /methods\s*=\s*[[(]([^\])]*)[\])]/.exec(restArgs);
        if (methodsMatch) {
          methods = methodsMatch[1]!
            .split(',')
            .map((m) => m.trim().replace(/^['"]|['"]$/g, '').toUpperCase())
            .filter((m) => m.length > 0);
          if (methods.length === 0) methods = ['GET'];
        } else {
          methods = ['GET'];
        }
      } else {
        methods = [methodOrRoute.toUpperCase()];
      }

      for (const method of methods) {
        const name = `${method} ${path}`;
        const qn = qname(filePath, name);
        if (seenEndpoints.has(qn)) continue;
        seenEndpoints.add(qn);

        entities.push({
          type: 'endpoint' as EntityType,
          name,
          qualified_name: qn,
          properties: {
            http_method: method,
            path,
            framework: 'flask',
          },
          source_location: {
            file: filePath,
            start_line: lineAt(source, match.index),
            end_line: lineAt(source, match.index),
            start_column: columnAt(source, match.index),
            end_column: 0,
          },
          relationships: [],
        });
      }
    }

    // FastAPI routes
    const fastapiRe = new RegExp(FASTAPI_ROUTE_RE.source, 'gm');
    while ((match = fastapiRe.exec(source)) !== null) {
      const method = match[1]!.toUpperCase();
      const path = match[2]!;
      const name = `${method} ${path}`;
      const qn = qname(filePath, name);
      if (seenEndpoints.has(qn)) continue;
      seenEndpoints.add(qn);

      entities.push({
        type: 'endpoint' as EntityType,
        name,
        qualified_name: qn,
        properties: {
          http_method: method,
          path,
          framework: 'fastapi',
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, match.index),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships: [],
      });
    }

    // Django URL patterns
    const djangoRe = new RegExp(DJANGO_URL_RE.source, 'gm');
    while ((match = djangoRe.exec(source)) !== null) {
      const pattern = match[1]!;
      const viewName = match[2]!;
      const name = `URL ${pattern} → ${viewName}`;
      const qn = qname(filePath, name);
      if (seenEndpoints.has(qn)) continue;
      seenEndpoints.add(qn);

      entities.push({
        type: 'endpoint' as EntityType,
        name,
        qualified_name: qn,
        properties: {
          url_pattern: pattern,
          view: viewName,
          framework: 'django',
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, match.index),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships: [
          { type: 'routes_to' as RelationType, target_name: viewName },
        ],
      });
    }

    return entities;
  }

  /**
   * Parse a Python parameter list into structured records.
   *
   * @param raw - Raw parameter string.
   * @returns Array of `{ name, type, default_value }` records.
   */
  private _parseParameters(
    raw: string,
  ): Array<{ name: string; type: string | null; default_value: string | null }> {
    if (!raw.trim()) return [];

    return raw
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => {
        // Handle default values
        let defaultValue: string | null = null;
        let rest = p;
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1) {
          defaultValue = p.substring(eqIdx + 1).trim();
          rest = p.substring(0, eqIdx).trim();
        }

        // Handle type annotations
        const colonIdx = rest.indexOf(':');
        if (colonIdx !== -1) {
          return {
            name: rest.substring(0, colonIdx).trim(),
            type: rest.substring(colonIdx + 1).trim(),
            default_value: defaultValue,
          };
        }

        return {
          name: rest.trim(),
          type: null,
          default_value: defaultValue,
        };
      })
      .filter((p) => p.name !== 'self' && p.name !== 'cls');
  }
}

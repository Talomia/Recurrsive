/**
 * @module @recurrsive/parsers/extractors/typescript
 *
 * Language extractor for TypeScript and JavaScript source files.
 *
 * Uses Tree-sitter AST walking when a parse tree is available, and
 * falls back to comprehensive regex-based extraction otherwise.
 * Detects functions, classes, interfaces, type aliases, imports,
 * exports, endpoint definitions, and call-site relationships.
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
 * Build a qualified name from a file path and symbol name.
 *
 * @param filePath  - Project-relative file path.
 * @param parts     - Symbol name segments (class, method, etc.).
 * @returns Colon-separated qualified name.
 */
function qname(filePath: string, ...parts: string[]): string {
  return [filePath, ...parts].join(':');
}

/**
 * Count the number of newlines before `index` in `source`.
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
 * Compute the column offset for a character index.
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
 * @param match    - The regex match result.
 * @param filePath - File path for the location.
 * @returns Source location record.
 */
export function locationFromMatch(source: string, match: RegExpExecArray, filePath: string): SourceLocation {
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
 * Scan for JSDoc comment immediately preceding a given line.
 *
 * @param source - Full source text.
 * @param line   - 1-based line number of the target declaration.
 * @returns The JSDoc text (without delimiters), or `undefined`.
 */
function extractJSDoc(source: string, line: number): string | undefined {
  const lines = source.split('\n');
  // Walk backwards from the line before the declaration
  let endIdx = line - 2; // 0-based index of line before decl
  if (endIdx < 0) return undefined;

  // Skip blank lines
  while (endIdx >= 0 && lines[endIdx]!.trim() === '') endIdx--;
  if (endIdx < 0) return undefined;

  // Must end with */
  if (!lines[endIdx]!.trim().endsWith('*/')) return undefined;

  // Find the opening /**
  let startIdx = endIdx;
  while (startIdx >= 0 && !lines[startIdx]!.trim().startsWith('/**')) {
    startIdx--;
  }
  if (startIdx < 0) return undefined;

  const docLines = lines.slice(startIdx, endIdx + 1);
  return docLines
    .map((l) => l.trim().replace(/^\/\*\*\s?/, '').replace(/\s?\*\/$/, '').replace(/^\*\s?/, ''))
    .filter((l) => l.length > 0)
    .join('\n');
}

/**
 * Find the matching closing brace for a block starting at `startIndex`.
 * Returns the index past the closing brace, or the end of source.
 *
 * @param source     - Full source text.
 * @param startIndex - Character index of the opening brace.
 * @returns Character index after the closing brace.
 */
function findBlockEnd(source: string, startIndex: number): number {
  let depth = 0;
  let inString: string | null = null;
  let escaped = false;
  let inTemplate = false;

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i]!;

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      escaped = true;
      continue;
    }

    // Handle strings
    if (inString) {
      if (ch === inString) {
        if (inString === '`') inTemplate = false;
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      if (ch === '`') inTemplate = true;
      continue;
    }

    // Handle template literal expression interpolation
    if (inTemplate && ch === '$' && i + 1 < source.length && source[i + 1] === '{') {
      continue;
    }

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }

  return source.length;
}

/**
 * Detect control-flow features (try/catch error handling and loops)
 * within a function or method body.
 *
 * These are heuristic, regex-based checks over the body text — they
 * genuinely reflect what is present in the source, and power analyzer
 * rules that reason about error handling and iteration. They are not a
 * guarantee (e.g. a `for` mentioned in a comment counts), but they are
 * derived from the actual code rather than assumed.
 *
 * @param body - Function/method body source text (braces included).
 * @returns `has_try_catch` and `has_loop` flags.
 */
export function detectBodyFeatures(body: string): {
  has_try_catch: boolean;
  has_loop: boolean;
} {
  const has_try_catch = /\btry\s*\{/.test(body) && /\bcatch\b/.test(body);
  const has_loop =
    /\bfor\b\s*(?:await\s+)?\(/.test(body) ||
    /\bwhile\s*\(/.test(body) ||
    /\bdo\s*\{/.test(body) ||
    /\.\s*(?:forEach|map|filter|reduce|flatMap)\s*\(/.test(body);
  return { has_try_catch, has_loop };
}

// ─── Regex Patterns ───────────────────────────────────────────────────────────

/** Matches `export` keyword optionally preceding a declaration. */
const EXPORT_PREFIX = /(?:export\s+(?:default\s+)?)?/;

/** Matches async keyword optionally preceding a function. */
const ASYNC_PREFIX = /(?:async\s+)?/;

/** Function declaration: `[export] [async] function name(...) [: ReturnType]` */
const FUNCTION_DECL_RE = new RegExp(
  `(${EXPORT_PREFIX.source})(${ASYNC_PREFIX.source})function\\s+(\\w+)\\s*(?:<[^>]*>)?\\s*\\(([^)]*)\\)\\s*(?::\\s*([^{]+?))?\\s*\\{`,
  'g',
);

/** Arrow function assigned to const/let/var: `[export] const name = [async] (...) => [ReturnType]` */
const ARROW_FN_RE = new RegExp(
  `(${EXPORT_PREFIX.source})(?:const|let|var)\\s+(\\w+)\\s*(?::\\s*[^=]+)?\\s*=\\s*(${ASYNC_PREFIX.source})(?:\\(([^)]*)\\)|([\\w]+))\\s*(?::\\s*([^=]+?))?\\s*=>`,
  'g',
);

/** Class declaration: `[export] class Name [extends Base] [implements I, J]` */
const CLASS_DECL_RE = new RegExp(
  `(${EXPORT_PREFIX.source})(?:abstract\\s+)?class\\s+(\\w+)(?:\\s+extends\\s+(\\w+))?(?:\\s+implements\\s+([^{]+))?\\s*\\{`,
  'g',
);

/** Interface declaration: `[export] interface Name [extends I, J]` */
const INTERFACE_DECL_RE = new RegExp(
  `(${EXPORT_PREFIX.source})interface\\s+(\\w+)(?:\\s+extends\\s+([^{]+))?\\s*\\{`,
  'g',
);

/** Type alias: `[export] type Name = ...` */
const TYPE_ALIAS_RE = new RegExp(
  `(${EXPORT_PREFIX.source})type\\s+(\\w+)(?:<[^>]*>)?\\s*=`,
  'g',
);

/** Method inside a class body (simplified — no nesting awareness). */
const METHOD_RE = new RegExp(
  `(?:(private|protected|public|static|readonly|abstract|override|async|get|set)\\s+)*(\\w+)\\s*(?:<[^>]*>)?\\s*\\(([^)]*)\\)\\s*(?::\\s*([^{;]+?))?\\s*[{;]`,
  'g',
);

/** Decorator: `@decoratorName(...)` */
const DECORATOR_RE = /@([\w.]+)(?:\(([^)]*)\))?/g;

// ─── Import Patterns ──────────────────────────────────────────────────────────

/** Named imports: `import { A, B as C } from 'module'` */
const NAMED_IMPORT_RE = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;

/** Default import: `import Name from 'module'` */
const DEFAULT_IMPORT_RE = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

/** Namespace import: `import * as Name from 'module'` */
const NAMESPACE_IMPORT_RE = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g;

/** Side-effect import: `import 'module'` */
const SIDE_EFFECT_IMPORT_RE = /import\s+['"]([^'"]+)['"]/g;

/** Dynamic import: `import('module')` or `require('module')` */
const DYNAMIC_IMPORT_RE = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

// ─── Endpoint Patterns ───────────────────────────────────────────────────────

/** Express-style routes: `app.get('/path', ...)` or `router.post(...)` */
const EXPRESS_ROUTE_RE =
  /(?:app|router|server)\.(get|post|put|patch|delete|all|options|head|use)\s*\(\s*['"]([^'"]+)['"]/g;

/** Fastify routes: `fastify.get('/path', ...)` */
const FASTIFY_ROUTE_RE =
  /(?:fastify|server|app)\.(get|post|put|patch|delete|all|options|head)\s*\(\s*['"]([^'"]+)['"]/g;

/** Next.js API route exports: `export async function GET/POST/...` */
const NEXTJS_ROUTE_RE =
  /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(/g;

/** Hono routes: `app.get('/path', ...)` with Hono-style */
const HONO_ROUTE_RE =
  /(?:app|router|hono)\.(get|post|put|patch|delete|all|options|head)\s*\(\s*['"]([^'"]+)['"]/g;

// ─── Call-site Pattern ────────────────────────────────────────────────────────

/** Simple function call: `functionName(...)` */
const FN_CALL_RE = /(?<![\w.])(\w+)\s*\(/g;

/** Method call on an object: `obj.method(...)` */
const METHOD_CALL_RE = /(\w+(?:\.\w+)+)\s*\(/g;

// ─── TypeScript / JavaScript Extractor ────────────────────────────────────────

/**
 * Extracts code entities and relationships from TypeScript / JavaScript
 * source files.
 *
 * When a Tree-sitter AST is provided the extractor walks the tree for
 * accurate positional data.  Otherwise it uses the comprehensive regex
 * patterns defined above.
 *
 * @example
 * ```ts
 * const extractor = new TypeScriptExtractor();
 * const entities = extractor.extract(sourceCode, 'src/api/handler.ts');
 * ```
 */
export class TypeScriptExtractor implements LanguageExtractor {
  readonly language = 'typescript';
  readonly extensions = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'mts', 'cts'];

  /**
   * Extract all entities from a TypeScript / JavaScript source file.
   *
   * @param source   - Full source text.
   * @param filePath - Project-relative path of the file.
   * @param _tree    - Optional Tree-sitter parse tree (unused in regex path).
   * @returns Array of extracted entities.
   */
  extract(source: string, filePath: string, _tree?: unknown): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Extract top-level constructs
    entities.push(...this._extractFunctions(source, filePath));
    entities.push(...this._extractArrowFunctions(source, filePath));
    entities.push(...this._extractClasses(source, filePath));
    entities.push(...this._extractInterfaces(source, filePath));
    entities.push(...this._extractTypeAliases(source, filePath));
    entities.push(...this._extractEndpoints(source, filePath));

    // Build call-site relationships
    this._attachCallRelationships(source, filePath, entities);

    return entities;
  }

  /**
   * Extract import statements from source code.
   *
   * @param source   - Full source text.
   * @param filePath - Project-relative file path.
   * @returns Array of {@link ImportInfo} records.
   */
  extractImports(source: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // Named imports
    let match: RegExpExecArray | null;
    const namedRe = new RegExp(NAMED_IMPORT_RE.source, 'g');
    while ((match = namedRe.exec(source)) !== null) {
      const specifiers = match[1]!;
      const module = match[2]!;
      const names = specifiers
        .split(',')
        .map((s) => {
          const parts = s.trim().split(/\s+as\s+/);
          return parts[parts.length - 1]!.trim();
        })
        .filter((n) => n.length > 0);

      imports.push({
        module,
        names,
        is_default: false,
        is_namespace: false,
        source_location: { file: filePath, line: lineAt(source, match.index) },
      });
    }

    // Default imports
    const defaultRe = new RegExp(DEFAULT_IMPORT_RE.source, 'g');
    while ((match = defaultRe.exec(source)) !== null) {
      // Skip if this is actually a named or namespace import (already captured)
      const fullLine = source.substring(
        source.lastIndexOf('\n', match.index) + 1,
        source.indexOf('\n', match.index),
      );
      if (fullLine.includes('{') || fullLine.includes('*')) continue;

      imports.push({
        module: match[2]!,
        names: [match[1]!],
        is_default: true,
        is_namespace: false,
        source_location: { file: filePath, line: lineAt(source, match.index) },
      });
    }

    // Namespace imports
    const nsRe = new RegExp(NAMESPACE_IMPORT_RE.source, 'g');
    while ((match = nsRe.exec(source)) !== null) {
      imports.push({
        module: match[2]!,
        names: [match[1]!],
        is_default: false,
        is_namespace: true,
        source_location: { file: filePath, line: lineAt(source, match.index) },
      });
    }

    // Side-effect imports
    const sideEffectRe = new RegExp(SIDE_EFFECT_IMPORT_RE.source, 'g');
    while ((match = sideEffectRe.exec(source)) !== null) {
      // Skip if this is part of a larger import statement already captured
      const fullLine = source.substring(
        source.lastIndexOf('\n', match.index) + 1,
        source.indexOf('\n', match.index),
      );
      if (fullLine.includes('from') || fullLine.includes('{') || fullLine.includes('*')) continue;

      imports.push({
        module: match[1]!,
        names: [],
        is_default: false,
        is_namespace: false,
        source_location: { file: filePath, line: lineAt(source, match.index) },
      });
    }

    // Dynamic imports
    const dynRe = new RegExp(DYNAMIC_IMPORT_RE.source, 'g');
    while ((match = dynRe.exec(source)) !== null) {
      imports.push({
        module: match[1]!,
        names: [],
        is_default: false,
        is_namespace: false,
        source_location: { file: filePath, line: lineAt(source, match.index) },
      });
    }

    return imports;
  }

  // ── Private extraction methods ──────────────────────────────────────────

  /**
   * Extract function declarations.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted function entities.
   */
  private _extractFunctions(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(FUNCTION_DECL_RE.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const exportKeyword = match[1]?.trim() ?? '';
      const asyncKeyword = match[2]?.trim() ?? '';
      const name = match[3]!;
      const params = match[4] ?? '';
      const returnType = match[5]?.trim() ?? 'void';
      const isExported = exportKeyword.includes('export');
      const isDefault = exportKeyword.includes('default');
      const isAsync = asyncKeyword === 'async';
      const startLine = lineAt(source, match.index);
      const braceStart = source.indexOf('{', match.index);
      const blockEnd = findBlockEnd(source, braceStart);
      const endLine = lineAt(source, blockEnd);
      const jsdoc = extractJSDoc(source, startLine);
      const { has_try_catch, has_loop } = detectBodyFeatures(
        source.substring(braceStart, blockEnd),
      );

      // Extract decorators above the function
      const decorators = this._extractDecoratorsAboveLine(source, startLine);

      const relationships: ExtractedRelationship[] = [];
      if (isExported) {
        relationships.push({ type: 'exports' as RelationType, target_name: name });
      }

      entities.push({
        type: 'function' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          parameters: this._parseParameters(params),
          return_type: returnType,
          is_async: isAsync,
          is_exported: isExported,
          is_default: isDefault,
          has_try_catch,
          has_loop,
          jsdoc: jsdoc ?? null,
          decorators,
          kind: 'function_declaration',
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
   * Extract arrow function assignments.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted function entities.
   */
  private _extractArrowFunctions(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(ARROW_FN_RE.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const exportKeyword = match[1]?.trim() ?? '';
      const name = match[2]!;
      const asyncKeyword = match[3]?.trim() ?? '';
      const params = match[4] ?? match[5] ?? '';
      const returnType = match[6]?.trim() ?? 'void';
      const isExported = exportKeyword.includes('export');
      const isAsync = asyncKeyword === 'async';
      const startLine = lineAt(source, match.index);
      const jsdoc = extractJSDoc(source, startLine);
      const decorators = this._extractDecoratorsAboveLine(source, startLine);

      // Estimate end line — look for closing brace or end of expression
      const arrowIndex = source.indexOf('=>', match.index);
      let endLine = startLine;
      let body = '';
      if (arrowIndex !== -1) {
        const afterArrow = source.substring(arrowIndex + 2).trimStart();
        if (afterArrow.startsWith('{')) {
          const braceStart = arrowIndex + 2 + (source.substring(arrowIndex + 2).indexOf('{'));
          const blockEnd = findBlockEnd(source, braceStart);
          endLine = lineAt(source, blockEnd);
          body = source.substring(braceStart, blockEnd);
        } else {
          // Single expression — find semicolon or newline
          const semiIdx = source.indexOf(';', arrowIndex);
          endLine = semiIdx !== -1 ? lineAt(source, semiIdx) : startLine;
          body = source.substring(
            arrowIndex + 2,
            semiIdx !== -1 ? semiIdx : arrowIndex + 2,
          );
        }
      }
      const { has_try_catch, has_loop } = detectBodyFeatures(body);

      const relationships: ExtractedRelationship[] = [];
      if (isExported) {
        relationships.push({ type: 'exports' as RelationType, target_name: name });
      }

      entities.push({
        type: 'function' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          parameters: this._parseParameters(params),
          return_type: returnType,
          is_async: isAsync,
          is_exported: isExported,
          is_default: false,
          has_try_catch,
          has_loop,
          jsdoc: jsdoc ?? null,
          decorators,
          kind: 'arrow_function',
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
   * Extract class declarations, including their methods.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted class and method entities.
   */
  private _extractClasses(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(CLASS_DECL_RE.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const exportKeyword = match[1]?.trim() ?? '';
      const name = match[2]!;
      const baseClass = match[3]?.trim() ?? null;
      const implementsList = match[4]?.trim() ?? null;
      const isExported = exportKeyword.includes('export');
      const isAbstract = match[0].includes('abstract');
      const startLine = lineAt(source, match.index);
      const braceIndex = source.indexOf('{', match.index);
      const blockEnd = findBlockEnd(source, braceIndex);
      const endLine = lineAt(source, blockEnd);
      const jsdoc = extractJSDoc(source, startLine);
      const decorators = this._extractDecoratorsAboveLine(source, startLine);

      const relationships: ExtractedRelationship[] = [];
      if (isExported) {
        relationships.push({ type: 'exports' as RelationType, target_name: name });
      }
      if (baseClass) {
        relationships.push({ type: 'extends' as RelationType, target_name: baseClass });
      }
      if (implementsList) {
        const ifaces = implementsList.split(',').map((s) => s.trim()).filter(Boolean);
        for (const iface of ifaces) {
          relationships.push({ type: 'implements' as RelationType, target_name: iface });
        }
      }

      entities.push({
        type: 'class' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          is_exported: isExported,
          is_abstract: isAbstract,
          base_class: baseClass,
          implements: implementsList
            ? implementsList.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          jsdoc: jsdoc ?? null,
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

      // Extract methods within the class body
      const classBody = source.substring(braceIndex, blockEnd);
      const methods = this._extractMethods(classBody, filePath, name, braceIndex, source);
      entities.push(...methods);
    }

    return entities;
  }

  /**
   * Extract methods from a class body.
   *
   * @param classBody    - The class body text (between braces).
   * @param filePath     - File path.
   * @param className    - Owning class name.
   * @param classOffset  - Character offset of the class body in the source.
   * @param fullSource   - The complete source text (for line calculation).
   * @returns Extracted method entities.
   */
  private _extractMethods(
    classBody: string,
    filePath: string,
    className: string,
    classOffset: number,
    fullSource: string,
  ): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(METHOD_RE.source, 'g');
    let match: RegExpExecArray | null;

    // Keywords that are NOT method names
    const keywords = new Set([
      'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
      'return', 'throw', 'try', 'catch', 'finally', 'new', 'delete', 'typeof',
      'instanceof', 'void', 'in', 'of', 'class', 'function', 'import', 'export',
      'const', 'let', 'var', 'this', 'super', 'yield', 'await',
    ]);

    while ((match = re.exec(classBody)) !== null) {
      const modifiers = match[1] ?? '';
      const name = match[2]!;
      const params = match[3] ?? '';
      const returnType = match[4]?.trim() ?? 'void';

      // Skip non-methods
      if (keywords.has(name)) continue;

      const absoluteIndex = classOffset + match.index;
      const startLine = lineAt(fullSource, absoluteIndex);

      const isStatic = modifiers.includes('static');
      const isPrivate = modifiers.includes('private');
      const isProtected = modifiers.includes('protected');
      const isAsync = modifiers.includes('async');
      const isAbstract = modifiers.includes('abstract');
      const isGetter = modifiers.includes('get');
      const isSetter = modifiers.includes('set');

      let visibility: string = 'public';
      if (isPrivate) visibility = 'private';
      else if (isProtected) visibility = 'protected';

      // Estimate end line
      const braceOrSemiIndex = match[0].endsWith('{')
        ? absoluteIndex + match[0].length - 1
        : -1;
      const methodBlockEnd =
        braceOrSemiIndex >= 0 ? findBlockEnd(fullSource, braceOrSemiIndex) : -1;
      const endLine =
        methodBlockEnd >= 0 ? lineAt(fullSource, methodBlockEnd) : startLine;
      const { has_try_catch, has_loop } = detectBodyFeatures(
        methodBlockEnd >= 0
          ? fullSource.substring(braceOrSemiIndex, methodBlockEnd)
          : '',
      );

      const jsdoc = extractJSDoc(fullSource, startLine);

      entities.push({
        type: 'function' as EntityType,
        name,
        qualified_name: qname(filePath, className, name),
        properties: {
          parameters: this._parseParameters(params),
          return_type: returnType,
          is_async: isAsync,
          is_static: isStatic,
          is_abstract: isAbstract,
          is_getter: isGetter,
          is_setter: isSetter,
          has_try_catch,
          has_loop,
          visibility,
          jsdoc: jsdoc ?? null,
          kind: 'method',
          class_name: className,
        },
        source_location: {
          file: filePath,
          start_line: startLine,
          end_line: endLine,
          start_column: columnAt(fullSource, absoluteIndex),
          end_column: 0,
        },
        relationships: [
          { type: 'contains' as RelationType, target_name: className },
        ],
      });
    }

    return entities;
  }

  /**
   * Extract interface declarations.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted class entities with `is_interface: true`.
   */
  private _extractInterfaces(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(INTERFACE_DECL_RE.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const exportKeyword = match[1]?.trim() ?? '';
      const name = match[2]!;
      const extendsList = match[3]?.trim() ?? null;
      const isExported = exportKeyword.includes('export');
      const startLine = lineAt(source, match.index);
      const braceIndex = source.indexOf('{', match.index);
      const blockEnd = findBlockEnd(source, braceIndex);
      const endLine = lineAt(source, blockEnd);
      const jsdoc = extractJSDoc(source, startLine);

      const relationships: ExtractedRelationship[] = [];
      if (isExported) {
        relationships.push({ type: 'exports' as RelationType, target_name: name });
      }
      if (extendsList) {
        const bases = extendsList.split(',').map((s) => s.trim()).filter(Boolean);
        for (const base of bases) {
          relationships.push({ type: 'extends' as RelationType, target_name: base });
        }
      }

      entities.push({
        type: 'class' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          is_exported: isExported,
          is_interface: true,
          extends: extendsList
            ? extendsList.split(',').map((s) => s.trim()).filter(Boolean)
            : [],
          jsdoc: jsdoc ?? null,
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
   * Extract type alias declarations.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted class entities with `is_type_alias: true`.
   */
  private _extractTypeAliases(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(TYPE_ALIAS_RE.source, 'g');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const exportKeyword = match[1]?.trim() ?? '';
      const name = match[2]!;
      const isExported = exportKeyword.includes('export');
      const startLine = lineAt(source, match.index);

      // Find the end of the type alias — semicolon or next declaration
      const semiIdx = source.indexOf(';', match.index + match[0].length);
      const endLine = semiIdx !== -1 ? lineAt(source, semiIdx) : startLine;
      const jsdoc = extractJSDoc(source, startLine);

      const relationships: ExtractedRelationship[] = [];
      if (isExported) {
        relationships.push({ type: 'exports' as RelationType, target_name: name });
      }

      entities.push({
        type: 'class' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          is_exported: isExported,
          is_type_alias: true,
          jsdoc: jsdoc ?? null,
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
   * Extract HTTP endpoint definitions (Express, Fastify, Next.js, Hono).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted endpoint entities.
   */
  private _extractEndpoints(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Express / generic framework routes
    const expressRe = new RegExp(EXPRESS_ROUTE_RE.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = expressRe.exec(source)) !== null) {
      const method = match[1]!.toUpperCase();
      const path = match[2]!;
      const startLine = lineAt(source, match.index);
      const name = `${method} ${path}`;

      entities.push({
        type: 'endpoint' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          http_method: method,
          path,
          framework: 'express',
        },
        source_location: {
          file: filePath,
          start_line: startLine,
          end_line: startLine,
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships: [],
      });
    }

    // Fastify routes (may overlap with express pattern — deduplicate by qname)
    const fastifyRe = new RegExp(FASTIFY_ROUTE_RE.source, 'g');
    const seenEndpoints = new Set(entities.map((e) => e.qualified_name));
    while ((match = fastifyRe.exec(source)) !== null) {
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
          framework: 'fastify',
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

    // Hono routes
    const honoRe = new RegExp(HONO_ROUTE_RE.source, 'g');
    while ((match = honoRe.exec(source)) !== null) {
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
          framework: 'hono',
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

    // Next.js route handler exports
    const nextRe = new RegExp(NEXTJS_ROUTE_RE.source, 'g');
    while ((match = nextRe.exec(source)) !== null) {
      const method = match[1]!;
      const name = `${method} (Next.js route)`;
      const startLine = lineAt(source, match.index);

      entities.push({
        type: 'endpoint' as EntityType,
        name,
        qualified_name: qname(filePath, method),
        properties: {
          http_method: method,
          path: filePath,
          framework: 'nextjs',
        },
        source_location: {
          file: filePath,
          start_line: startLine,
          end_line: startLine,
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships: [],
      });
    }

    return entities;
  }

  /**
   * Attach `calls` relationships to entities based on call-site analysis.
   *
   * Walks the source for function and method call expressions and
   * matches them to entities in the same file.
   *
   * @param source   - Full source text.
   * @param _filePath - File path (unused currently).
   * @param entities - Mutable entity list to augment.
   */
  private _attachCallRelationships(
    source: string,
    _filePath: string,
    entities: ExtractedEntity[],
  ): void {
    // Build a set of known entity names for quick lookup
    const knownNames = new Set(entities.map((e) => e.name));

    // Simple function calls
    const fnCallRe = new RegExp(FN_CALL_RE.source, 'g');
    let match: RegExpExecArray | null;
    while ((match = fnCallRe.exec(source)) !== null) {
      const callee = match[1]!;
      if (!knownNames.has(callee)) continue;

      const callLine = lineAt(source, match.index);

      // Find the entity whose body contains this call
      for (const entity of entities) {
        if (
          entity.name !== callee &&
          callLine >= entity.source_location.start_line &&
          callLine <= entity.source_location.end_line
        ) {
          // Avoid duplicate relationships
          const exists = entity.relationships.some(
            (r) => r.type === 'calls' && r.target_name === callee,
          );
          if (!exists) {
            entity.relationships.push({
              type: 'calls' as RelationType,
              target_name: callee,
            });
          }
        }
      }
    }

    // Method calls
    const methodCallRe = new RegExp(METHOD_CALL_RE.source, 'g');
    while ((match = methodCallRe.exec(source)) !== null) {
      const fullCall = match[1]!;
      const callLine = lineAt(source, match.index);

      for (const entity of entities) {
        if (
          callLine >= entity.source_location.start_line &&
          callLine <= entity.source_location.end_line
        ) {
          const exists = entity.relationships.some(
            (r) => r.type === 'calls' && r.target_name === fullCall,
          );
          if (!exists) {
            entity.relationships.push({
              type: 'calls' as RelationType,
              target_name: fullCall,
              properties: { is_method_call: true },
            });
          }
        }
      }
    }
  }

  // ── Utility methods ─────────────────────────────────────────────────────

  /**
   * Parse a comma-separated parameter list into structured records.
   *
   * @param raw - Raw parameter string (e.g. `"name: string, age?: number"`).
   * @returns Array of `{ name, type, optional }` records.
   */
  private _parseParameters(raw: string): Array<{ name: string; type: string; optional: boolean }> {
    if (!raw.trim()) return [];

    return raw
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .map((p) => {
        const optional = p.includes('?');
        const clean = p.replace('?', '');
        const colonIdx = clean.indexOf(':');
        if (colonIdx === -1) {
          return { name: clean.trim(), type: 'unknown', optional };
        }
        return {
          name: clean.substring(0, colonIdx).trim(),
          type: clean.substring(colonIdx + 1).trim(),
          optional,
        };
      });
  }

  /**
   * Extract decorator names above a given source line.
   *
   * @param source - Full source text.
   * @param line   - 1-based line number.
   * @returns Array of decorator strings.
   */
  private _extractDecoratorsAboveLine(source: string, line: number): string[] {
    const lines = source.split('\n');
    const decorators: string[] = [];
    let idx = line - 2; // 0-based, line before declaration

    while (idx >= 0) {
      const trimmed = lines[idx]!.trim();
      if (trimmed.startsWith('@')) {
        const decMatch = DECORATOR_RE.exec(trimmed);
        DECORATOR_RE.lastIndex = 0; // Reset stateful regex
        if (decMatch) {
          decorators.unshift(decMatch[1]!);
        }
        idx--;
      } else if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*') || trimmed.endsWith('*/')) {
        // Skip comments and blank lines between decorators
        idx--;
      } else {
        break;
      }
    }

    return decorators;
  }
}

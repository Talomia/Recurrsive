/**
 * @module @recurrsive/parsers/extractors/go
 *
 * Language extractor for Go source files.
 *
 * Detects packages, functions, methods (with receivers), structs,
 * interfaces, constants, variables, type aliases, and imports.
 * Uses regex-based extraction with optional Tree-sitter AST support.
 *
 * @packageDocumentation
 */

import type { EntityType, RelationType } from '@recurrsive/core';
import type {
  ExtractedEntity,
  ExtractedRelationship,
  ImportInfo,
  LanguageExtractor,
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
 * Check whether a Go identifier is exported (starts with an
 * uppercase ASCII letter).
 *
 * @param name - Go identifier.
 * @returns `true` if the identifier is exported.
 */
function isExported(name: string): boolean {
  if (name.length === 0) return false;
  const ch = name.charCodeAt(0);
  return ch >= 65 && ch <= 90; // A-Z
}

/**
 * Find the matching closing brace for an opening brace in Go source.
 * Returns the character index of the closing `}`.
 *
 * @param source     - Full source text.
 * @param openIndex  - Character index of the opening `{`.
 * @returns Index of the matching `}`, or end of source.
 */
function findMatchingBrace(source: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return source.length - 1;
}

/**
 * Detect whether a Go function/method body contains a loop.
 *
 * Go has a single loop construct (`for`, which also covers `for range`
 * and infinite `for {}`), so this is a straightforward heuristic check
 * over the actual body text. Go has no try/catch, so `has_try_catch`
 * is intentionally not reported for Go entities.
 *
 * @param body - Function/method body source text.
 * @returns `has_loop` flag.
 */
export function detectBodyFeatures(body: string): { has_loop: boolean } {
  return { has_loop: /\bfor\b[\s{]/.test(body) };
}

// ─── Regex Patterns ───────────────────────────────────────────────────────────

/** Go package declaration. */
const PACKAGE_RE = /^package\s+(\w+)/m;

/**
 * Go function declaration (top-level, no receiver).
 *
 * Groups: 1=name, 2=params, 3=return type(s) (optional)
 */
const FUNC_RE =
  /^func\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:(\([^)]*\)|[^\s{][^{]*)?)?\s*\{/gm;

/**
 * Go method declaration (with receiver).
 *
 * Groups: 1=receiver (e.g. `u *User`), 2=name, 3=params, 4=return type(s)
 */
const METHOD_RE =
  /^func\s+\(([^)]+)\)\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*(?:(\([^)]*\)|[^\s{][^{]*)?)?\s*\{/gm;

/**
 * Go struct type definition.
 *
 * Groups: 1=name
 */
const STRUCT_RE = /^type\s+([A-Za-z_]\w*)\s+struct\s*\{/gm;

/**
 * Go interface type definition.
 *
 * Groups: 1=name
 */
const INTERFACE_RE = /^type\s+([A-Za-z_]\w*)\s+interface\s*\{/gm;

/**
 * Go type alias / type definition (non-struct, non-interface).
 *
 * Groups: 1=name, 2=underlying type
 */
const TYPE_ALIAS_RE =
  /^type\s+([A-Za-z_]\w*)\s+(?!struct\b|interface\b)(\S[^\n{]*)/gm;

/**
 * Go single constant: `const Name = value` or `const Name Type = value`.
 *
 * Groups: 1=name, 2=type (optional), 3=value
 */
const CONST_SINGLE_RE =
  /^const\s+([A-Za-z_]\w*)(?:\s+(\S+))?\s*=\s*(.+)/gm;

/**
 * Go single variable: `var Name Type` or `var Name = value`.
 *
 * Groups: 1=name, 2=type or value expression
 */
const VAR_SINGLE_RE =
  /^var\s+([A-Za-z_]\w*)\s+(.+)/gm;

/**
 * Go grouped const block: `const ( ... )`
 */
const CONST_BLOCK_RE = /^const\s*\(/gm;

/**
 * Go grouped var block: `var ( ... )`
 */
const VAR_BLOCK_RE = /^var\s*\(/gm;

// ─── Import Patterns ──────────────────────────────────────────────────────────

/** Single-line import: `import "fmt"`, `import alias "path"`, `import . "path"`, `import _ "path"`. */
const IMPORT_SINGLE_RE =
  /^import\s+(?:([A-Za-z_]\w*|\.)\s+)?["']([^"']+)["']/gm;

/** Grouped import block: `import ( ... )` */
const IMPORT_BLOCK_RE = /^import\s*\(/gm;

// ─── Go Extractor ─────────────────────────────────────────────────────────────

/**
 * Extracts code entities and relationships from Go source files.
 *
 * @example
 * ```ts
 * const extractor = new GoExtractor();
 * const entities = extractor.extract(goSource, 'cmd/server/main.go');
 * ```
 */
export class GoExtractor implements LanguageExtractor {
  readonly language = 'go';
  readonly extensions = ['go'];

  /**
   * Extract all entities from a Go source file.
   *
   * @param source   - Full source text.
   * @param filePath - Project-relative path.
   * @param _tree    - Optional Tree-sitter tree (unused in regex path).
   * @returns Extracted entities.
   */
  extract(source: string, filePath: string, _tree?: unknown): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    entities.push(...this._extractPackage(source, filePath));
    entities.push(...this._extractFunctions(source, filePath));
    entities.push(...this._extractMethods(source, filePath));
    entities.push(...this._extractStructs(source, filePath));
    entities.push(...this._extractInterfaces(source, filePath));
    entities.push(...this._extractTypeAliases(source, filePath));
    entities.push(...this._extractConstants(source, filePath));
    entities.push(...this._extractVariables(source, filePath));

    return entities;
  }

  /**
   * Extract import statements from Go source.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Import information.
   */
  extractImports(source: string, filePath: string): ImportInfo[] {
    const imports: ImportInfo[] = [];

    // Single-line imports
    const singleRe = new RegExp(IMPORT_SINGLE_RE.source, 'gm');
    let match: RegExpExecArray | null;
    while ((match = singleRe.exec(source)) !== null) {
      const alias = match[1] ?? null;
      const modulePath = match[2]!;
      const shortName = alias ?? modulePath.split('/').pop()!;

      imports.push({
        module: modulePath,
        names: [shortName],
        is_default: true,
        is_namespace: alias === '.',
        source_location: { file: filePath, line: lineAt(source, match.index) },
      });
    }

    // Grouped import blocks
    const blockRe = new RegExp(IMPORT_BLOCK_RE.source, 'gm');
    while ((match = blockRe.exec(source)) !== null) {
      const blockStart = match.index + match[0].length;
      // Find the closing paren
      let parenEnd = blockStart;
      for (let i = blockStart; i < source.length; i++) {
        if (source[i] === ')') {
          parenEnd = i;
          break;
        }
      }

      const block = source.substring(blockStart, parenEnd);
      const importLineRe = /(?:([A-Za-z_]\w*|\.)\s+)?["']([^"']+)["']/g;
      let lineMatch: RegExpExecArray | null;
      while ((lineMatch = importLineRe.exec(block)) !== null) {
        const alias = lineMatch[1] ?? null;
        const modulePath = lineMatch[2]!;
        const shortName = alias ?? modulePath.split('/').pop()!;

        imports.push({
          module: modulePath,
          names: [shortName],
          is_default: true,
          is_namespace: alias === '.',
          source_location: {
            file: filePath,
            line: lineAt(source, blockStart + lineMatch.index),
          },
        });
      }
    }

    return imports;
  }

  // ── Private extraction methods ──────────────────────────────────────────

  /**
   * Extract the package declaration.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Array with zero or one package entity.
   */
  private _extractPackage(source: string, filePath: string): ExtractedEntity[] {
    const match = PACKAGE_RE.exec(source);
    if (!match) return [];

    const name = match[1]!;
    return [
      {
        type: 'module' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          language: 'go',
          declaration: 'package',
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, match.index + match[0].length),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships: [],
      },
    ];
  }

  /**
   * Extract top-level function declarations (no receiver).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted function entities.
   */
  private _extractFunctions(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(FUNC_RE.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const name = match[1]!;
      const params = match[2] ?? '';
      const returnType = (match[3] ?? '').trim() || null;

      const braceIndex = source.indexOf('{', match.index + match[0].length - 1);
      const endBrace = findMatchingBrace(source, braceIndex);

      const isInit = name === 'init';

      const relationships: ExtractedRelationship[] = [];
      // Package contains this function
      const pkgMatch = PACKAGE_RE.exec(source);
      if (pkgMatch) {
        relationships.push({
          type: 'contains' as RelationType,
          target_name: pkgMatch[1]!,
          properties: { container: 'package' },
        });
      }

      entities.push({
        type: 'function' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          language: 'go',
          parameters: params,
          return_type: returnType,
          exported: isExported(name),
          is_method: false,
          is_init: isInit,
          has_loop: detectBodyFeatures(source.substring(braceIndex, endBrace + 1)).has_loop,
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, endBrace),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships,
      });
    }

    return entities;
  }

  /**
   * Extract method declarations (functions with receivers).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted method entities.
   */
  private _extractMethods(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(METHOD_RE.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const receiver = match[1]!.trim();
      const name = match[2]!;
      const params = match[3] ?? '';
      const returnType = (match[4] ?? '').trim() || null;

      const braceIndex = source.indexOf('{', match.index + match[0].length - 1);
      const endBrace = findMatchingBrace(source, braceIndex);

      // Extract the receiver type name (strip pointer `*` and variable name)
      const receiverType = receiver.replace(/^\w+\s+/, '').replace(/^\*/, '');

      const relationships: ExtractedRelationship[] = [
        {
          type: 'implements' as RelationType,
          target_name: receiverType,
          properties: { kind: 'method_of' },
        },
      ];

      entities.push({
        type: 'function' as EntityType,
        name,
        qualified_name: qname(filePath, `${receiverType}.${name}`),
        properties: {
          language: 'go',
          parameters: params,
          return_type: returnType,
          exported: isExported(name),
          is_method: true,
          is_init: false,
          receiver,
          receiver_type: receiverType,
          has_loop: detectBodyFeatures(source.substring(braceIndex, endBrace + 1)).has_loop,
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, endBrace),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships,
      });
    }

    return entities;
  }

  /**
   * Extract struct type definitions.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted struct entities.
   */
  private _extractStructs(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(STRUCT_RE.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const name = match[1]!;
      const braceIndex = source.indexOf('{', match.index);
      const endBrace = findMatchingBrace(source, braceIndex);
      const body = source.substring(braceIndex + 1, endBrace).trim();

      // Count fields (non-empty, non-comment lines inside the struct body)
      const fields = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*'));
      const fieldCount = fields.length;

      const relationships: ExtractedRelationship[] = [];
      // Check for embedded types (fields with no explicit name — just a type)
      for (const field of fields) {
        const embeddedMatch = /^(\*?)([A-Z]\w*(?:\.\w+)?)$/.exec(field);
        if (embeddedMatch) {
          relationships.push({
            type: 'extends' as RelationType,
            target_name: embeddedMatch[2]!,
            properties: { embedded: true },
          });
        }
      }

      entities.push({
        type: 'class' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          language: 'go',
          kind: 'struct',
          exported: isExported(name),
          field_count: fieldCount,
          fields: fields.map((f) => f.replace(/\s+\/\/.*/, '').trim()),
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, endBrace),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships,
      });
    }

    return entities;
  }

  /**
   * Extract interface type definitions.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted interface entities.
   */
  private _extractInterfaces(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(INTERFACE_RE.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const name = match[1]!;
      const braceIndex = source.indexOf('{', match.index);
      const endBrace = findMatchingBrace(source, braceIndex);
      const body = source.substring(braceIndex + 1, endBrace).trim();

      // Extract method signatures and embedded interfaces
      const methods = body
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('//') && !l.startsWith('/*'));

      const relationships: ExtractedRelationship[] = [];
      // Check for embedded interfaces (lines that are just a type name)
      for (const method of methods) {
        const embeddedMatch = /^([A-Z]\w*(?:\.\w+)?)$/.exec(method);
        if (embeddedMatch) {
          relationships.push({
            type: 'extends' as RelationType,
            target_name: embeddedMatch[1]!,
            properties: { embedded: true },
          });
        }
      }

      entities.push({
        type: 'class' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          language: 'go',
          kind: 'interface',
          exported: isExported(name),
          method_signatures: methods,
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, endBrace),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships,
      });
    }

    return entities;
  }

  /**
   * Extract type alias / type definitions (non-struct, non-interface).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted type alias entities.
   */
  private _extractTypeAliases(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    const re = new RegExp(TYPE_ALIAS_RE.source, 'gm');
    let match: RegExpExecArray | null;

    while ((match = re.exec(source)) !== null) {
      const name = match[1]!;
      const underlyingType = match[2]!.trim();

      entities.push({
        type: 'class' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          language: 'go',
          kind: 'type_alias',
          exported: isExported(name),
          underlying_type: underlyingType,
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, match.index + match[0].length),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships: [],
      });
    }

    return entities;
  }

  /**
   * Extract constant declarations (single and grouped).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted constant entities.
   */
  private _extractConstants(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Single constants
    const singleRe = new RegExp(CONST_SINGLE_RE.source, 'gm');
    let match: RegExpExecArray | null;
    while ((match = singleRe.exec(source)) !== null) {
      const name = match[1]!;
      const constType = match[2] ?? null;
      const value = match[3]!.trim();

      entities.push({
        type: 'variable' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          language: 'go',
          kind: 'constant',
          exported: isExported(name),
          const_type: constType,
          value,
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, match.index + match[0].length),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships: [],
      });
    }

    // Grouped const blocks
    const blockRe = new RegExp(CONST_BLOCK_RE.source, 'gm');
    while ((match = blockRe.exec(source)) !== null) {
      const blockStart = match.index + match[0].length;
      let parenEnd = blockStart;
      let depth = 1;
      for (let i = blockStart; i < source.length; i++) {
        if (source[i] === '(') depth++;
        else if (source[i] === ')') {
          depth--;
          if (depth === 0) {
            parenEnd = i;
            break;
          }
        }
      }

      const block = source.substring(blockStart, parenEnd);
      const constLineRe = /^\s*([A-Za-z_]\w*)(?:\s+(\S+))?\s*=\s*(.+)/gm;
      let lineMatch: RegExpExecArray | null;
      while ((lineMatch = constLineRe.exec(block)) !== null) {
        const name = lineMatch[1]!;
        const constType = lineMatch[2] ?? null;
        const value = lineMatch[3]!.trim();

        entities.push({
          type: 'variable' as EntityType,
          name,
          qualified_name: qname(filePath, name),
          properties: {
            language: 'go',
            kind: 'constant',
            exported: isExported(name),
            const_type: constType,
            value,
          },
          source_location: {
            file: filePath,
            start_line: lineAt(source, blockStart + lineMatch.index),
            end_line: lineAt(source, blockStart + lineMatch.index + lineMatch[0].length),
            start_column: 0,
            end_column: 0,
          },
          relationships: [],
        });
      }
    }

    return entities;
  }

  /**
   * Extract variable declarations (single and grouped).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @returns Extracted variable entities.
   */
  private _extractVariables(source: string, filePath: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];

    // Single variables
    const singleRe = new RegExp(VAR_SINGLE_RE.source, 'gm');
    let match: RegExpExecArray | null;
    while ((match = singleRe.exec(source)) !== null) {
      const name = match[1]!;
      const rest = match[2]!.trim();

      entities.push({
        type: 'variable' as EntityType,
        name,
        qualified_name: qname(filePath, name),
        properties: {
          language: 'go',
          kind: 'variable',
          exported: isExported(name),
          var_type: rest.includes('=') ? null : rest,
          value: rest.includes('=') ? rest.split('=').slice(1).join('=').trim() : null,
        },
        source_location: {
          file: filePath,
          start_line: lineAt(source, match.index),
          end_line: lineAt(source, match.index + match[0].length),
          start_column: columnAt(source, match.index),
          end_column: 0,
        },
        relationships: [],
      });
    }

    // Grouped var blocks
    const blockRe = new RegExp(VAR_BLOCK_RE.source, 'gm');
    while ((match = blockRe.exec(source)) !== null) {
      const blockStart = match.index + match[0].length;
      let parenEnd = blockStart;
      let depth = 1;
      for (let i = blockStart; i < source.length; i++) {
        if (source[i] === '(') depth++;
        else if (source[i] === ')') {
          depth--;
          if (depth === 0) {
            parenEnd = i;
            break;
          }
        }
      }

      const block = source.substring(blockStart, parenEnd);
      const varLineRe = /^\s*([A-Za-z_]\w*)\s+(.+)/gm;
      let lineMatch: RegExpExecArray | null;
      while ((lineMatch = varLineRe.exec(block)) !== null) {
        const name = lineMatch[1]!;
        const rest = lineMatch[2]!.trim();

        entities.push({
          type: 'variable' as EntityType,
          name,
          qualified_name: qname(filePath, name),
          properties: {
            language: 'go',
            kind: 'variable',
            exported: isExported(name),
            var_type: rest.includes('=') ? null : rest,
            value: rest.includes('=') ? rest.split('=').slice(1).join('=').trim() : null,
          },
          source_location: {
            file: filePath,
            start_line: lineAt(source, blockStart + lineMatch.index),
            end_line: lineAt(source, blockStart + lineMatch.index + lineMatch[0].length),
            start_column: 0,
            end_column: 0,
          },
          relationships: [],
        });
      }
    }

    return entities;
  }
}

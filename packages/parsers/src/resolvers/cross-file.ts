/**
 * @module @recurrsive/parsers/resolvers/cross-file
 *
 * Cross-file reference resolution.  Takes the per-file extraction
 * results and resolves symbolic import references to concrete entity
 * qualified names so that the knowledge graph can link nodes across
 * files.
 *
 * @packageDocumentation
 */

import type { RelationType } from '@recurrsive/core';
import type { ExtractedEntity, ImportInfo } from '../extractors/base.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * A fully resolved cross-file reference linking a source entity in one
 * file to a target entity in another.
 */
export interface ResolvedReference {
  /** File that contains the import / reference. */
  source_file: string;
  /** Qualified name of the referencing entity. */
  source_entity: string;
  /** File that contains the imported / referenced entity. */
  target_file: string;
  /** Qualified name of the referenced entity. */
  target_entity: string;
  /** The relationship type connecting the two. */
  relationship_type: RelationType;
}

// ─── Resolver ─────────────────────────────────────────────────────────────────

/**
 * Resolves symbolic import references across files.
 *
 * Given a map of extracted entities per file and a map of import
 * statements per file, the resolver:
 *
 * 1. Builds an index of all exported symbols by name.
 * 2. Walks every import statement and tries to match the imported
 *    names to exported entities.
 * 3. Returns {@link ResolvedReference} records for each match.
 *
 * @example
 * ```ts
 * const resolver = new CrossFileResolver();
 * const refs = resolver.resolve(entitiesByFile, importsByFile);
 * ```
 */
export class CrossFileResolver {
  /**
   * Resolve import references to actual entity qualified names.
   *
   * @param entities - Map from file path to the entities extracted from that file.
   * @param imports  - Map from file path to the import statements in that file.
   * @returns Array of resolved cross-file references.
   */
  resolve(
    entities: Map<string, ExtractedEntity[]>,
    imports: Map<string, ImportInfo[]>,
  ): ResolvedReference[] {
    const resolved: ResolvedReference[] = [];

    // ── Step 1: Build export index ───────────────────────────────────────
    // Map symbol name → array of { file, qualified_name } for exported entities
    const exportIndex = this._buildExportIndex(entities);

    // ── Step 2: Build a module-path → file-path lookup ──────────────────
    const moduleToFile = this._buildModuleIndex([...entities.keys()]);

    // ── Step 3: Walk imports and resolve ─────────────────────────────────
    for (const [sourceFile, fileImports] of imports) {
      for (const imp of fileImports) {
        // Try to find the target file from the module specifier
        const candidateFiles = this._resolveModulePath(imp.module, sourceFile, moduleToFile);

        for (const importedName of imp.names) {
          // Check the export index for this symbol
          const candidates = exportIndex.get(importedName);
          if (!candidates || candidates.length === 0) continue;

          // Prefer candidates from the resolved module path
          let bestMatch = candidates[0]!;
          for (const candidate of candidates) {
            if (candidateFiles.includes(candidate.file)) {
              bestMatch = candidate;
              break;
            }
          }

          // Find the source entity that uses this import (if any)
          const sourceEntities = entities.get(sourceFile) ?? [];
          const sourceEntityNames = this._findEntitiesUsingSymbol(
            sourceEntities,
            importedName,
          );

          if (sourceEntityNames.length === 0) {
            // Create a file-level import relationship
            resolved.push({
              source_file: sourceFile,
              source_entity: sourceFile,
              target_file: bestMatch.file,
              target_entity: bestMatch.qualified_name,
              relationship_type: 'imports' as RelationType,
            });
          } else {
            for (const srcEntity of sourceEntityNames) {
              resolved.push({
                source_file: sourceFile,
                source_entity: srcEntity,
                target_file: bestMatch.file,
                target_entity: bestMatch.qualified_name,
                relationship_type: 'imports' as RelationType,
              });
            }
          }
        }
      }
    }

    return resolved;
  }

  // ── Private helpers ─────────────────────────────────────────────────────

  /**
   * Build an index of exported symbol names.
   *
   * @param entities - Per-file entity map.
   * @returns Map from symbol name to file + qualified_name entries.
   */
  private _buildExportIndex(
    entities: Map<string, ExtractedEntity[]>,
  ): Map<string, Array<{ file: string; qualified_name: string }>> {
    const index = new Map<string, Array<{ file: string; qualified_name: string }>>();

    for (const [file, fileEntities] of entities) {
      for (const entity of fileEntities) {
        // Check if the entity is exported
        const isExported =
          entity.properties['is_exported'] === true ||
          entity.relationships.some((r) => r.type === 'exports');

        if (!isExported) continue;

        const existing = index.get(entity.name);
        const entry = { file, qualified_name: entity.qualified_name };
        if (existing) {
          existing.push(entry);
        } else {
          index.set(entity.name, [entry]);
        }
      }
    }

    return index;
  }

  /**
   * Build a mapping from module-like paths to actual file paths in the
   * project.  This handles the common convention where `'./utils'`
   * refers to `./utils.ts`, `./utils/index.ts`, etc.
   *
   * @param filePaths - All known file paths.
   * @returns Map from module-like key to file path.
   */
  private _buildModuleIndex(filePaths: string[]): Map<string, string> {
    const index = new Map<string, string>();

    for (const fp of filePaths) {
      // Store the exact path
      index.set(fp, fp);

      // Strip extensions (.ts, .tsx, .js, .jsx, .py, etc.)
      const withoutExt = fp.replace(/\.[^/.]+$/, '');
      if (!index.has(withoutExt)) {
        index.set(withoutExt, fp);
      }

      // Strip /index from the end (for barrel imports)
      const withoutIndex = withoutExt.replace(/\/index$/, '');
      if (withoutIndex !== withoutExt && !index.has(withoutIndex)) {
        index.set(withoutIndex, fp);
      }
    }

    return index;
  }

  /**
   * Resolve a module specifier to candidate file paths.
   *
   * @param module     - The import module specifier (e.g. `'./utils'`).
   * @param sourceFile - The file containing the import.
   * @param moduleIndex - Module path → file path map.
   * @returns Array of candidate file paths.
   */
  private _resolveModulePath(
    module: string,
    sourceFile: string,
    moduleIndex: Map<string, string>,
  ): string[] {
    const candidates: string[] = [];

    // For relative imports, resolve relative to the source file
    if (module.startsWith('.')) {
      const sourceDir = sourceFile.substring(0, sourceFile.lastIndexOf('/'));
      const resolved = this._resolvePath(sourceDir, module);

      const direct = moduleIndex.get(resolved);
      if (direct) candidates.push(direct);

      // Try with common extensions
      for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.py']) {
        const withExt = moduleIndex.get(resolved + ext);
        if (withExt) candidates.push(withExt);
      }

      // Try as directory with index
      const asIndex = moduleIndex.get(resolved + '/index');
      if (asIndex) candidates.push(asIndex);
    } else {
      // Non-relative import — check if it matches any file path suffix
      for (const [key, value] of moduleIndex) {
        if (key.endsWith('/' + module) || key === module) {
          candidates.push(value);
        }
      }
    }

    return candidates;
  }

  /**
   * Simple path resolution for relative imports.
   *
   * @param base     - Base directory path.
   * @param relative - Relative path to resolve.
   * @returns Resolved path.
   */
  private _resolvePath(base: string, relative: string): string {
    const parts = base.split('/').filter(Boolean);
    const relParts = relative.split('/').filter(Boolean);

    for (const part of relParts) {
      if (part === '.') continue;
      if (part === '..') {
        parts.pop();
      } else {
        parts.push(part);
      }
    }

    return parts.join('/');
  }

  /**
   * Find entities that reference a given symbol name in their call
   * relationships or body.
   *
   * @param entities   - Entities in the current file.
   * @param symbolName - The imported symbol name to look for.
   * @returns Qualified names of entities that use this symbol.
   */
  private _findEntitiesUsingSymbol(
    entities: ExtractedEntity[],
    symbolName: string,
  ): string[] {
    const users: string[] = [];

    for (const entity of entities) {
      // Check if any of the entity's relationships reference this symbol
      const references = entity.relationships.some(
        (r) =>
          r.target_name === symbolName ||
          r.target_name.endsWith('.' + symbolName),
      );

      if (references) {
        users.push(entity.qualified_name);
      }
    }

    return users;
  }
}

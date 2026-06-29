/**
 * @module @recurrsive/parsers/extractors/base
 *
 * Base interfaces and types for language-specific code extractors.
 * Every extractor produces {@link ExtractedEntity} values that are
 * later converted into core {@link Entity} nodes in the knowledge graph.
 *
 * @packageDocumentation
 */

import type { EntityType, RelationType } from '@recurrsive/core';

// ─── Source Location ──────────────────────────────────────────────────────────

/**
 * Precise location of a code construct within a source file.
 * All indices are 1-based to match editor conventions.
 */
export interface SourceLocation {
  /** Absolute or project-relative file path. */
  file: string;
  /** 1-based starting line. */
  start_line: number;
  /** 1-based ending line (inclusive). */
  end_line: number;
  /** 0-based starting column. */
  start_column: number;
  /** 0-based ending column. */
  end_column: number;
}

// ─── Extracted Entity ─────────────────────────────────────────────────────────

/**
 * A code entity discovered during source analysis, before it has been
 * assigned an ID or connected into the knowledge graph.
 *
 * Extractors emit these; the {@link ParsingPipeline} converts them into
 * core `Entity` objects.
 */
export interface ExtractedEntity {
  /** The kind of entity (function, class, endpoint, etc.). */
  type: EntityType;
  /** Short human-readable name (e.g. `handleRequest`). */
  name: string;
  /** Fully qualified name (e.g. `src/api/handler.ts:handleRequest`). */
  qualified_name: string;
  /** Entity-type-specific properties (parameters, return types, etc.). */
  properties: Record<string, unknown>;
  /** Where this entity lives in the source tree. */
  source_location: SourceLocation;
  /** Relationships discovered during extraction (targets resolved later). */
  relationships: ExtractedRelationship[];
}

/**
 * A not-yet-resolved relationship discovered during extraction.
 * The `target_name` is a symbolic reference that gets resolved to an
 * actual entity ID by the {@link CrossFileResolver}.
 */
export interface ExtractedRelationship {
  /** Semantic type of this relationship. */
  type: RelationType;
  /** Symbolic name of the target entity (e.g. import path, class name). */
  target_name: string;
  /** Optional relationship-specific properties. */
  properties?: Record<string, unknown>;
}

// ─── Import Information ───────────────────────────────────────────────────────

/**
 * Information about a single import statement extracted from source code.
 */
export interface ImportInfo {
  /** The module specifier (e.g. `'express'`, `'./utils'`). */
  module: string;
  /** Named imports (e.g. `['Router', 'Request']`). Empty for side-effect imports. */
  names: string[];
  /** Whether this is a default import. */
  is_default: boolean;
  /** Whether this is a namespace import (import * as). */
  is_namespace: boolean;
  /** Where the import statement is located. */
  source_location: { file: string; line: number };
}

// ─── Language Extractor ───────────────────────────────────────────────────────

/**
 * Contract for a language-specific code extractor.
 *
 * Each implementation handles one programming language and knows how to
 * pull entities and import information out of source code — either by
 * walking a Tree-sitter AST or via regex fallback.
 */
export interface LanguageExtractor {
  /** Canonical language name (e.g. `'typescript'`). */
  readonly language: string;
  /** File extensions this extractor handles (without leading dot). */
  readonly extensions: string[];

  /**
   * Extract entities from source code.
   *
   * @param source   - Full source text.
   * @param filePath - Absolute or project-relative path of the file.
   * @param tree     - Optional Tree-sitter parse tree for AST-based extraction.
   * @returns Array of extracted entities with unresolved relationships.
   */
  extract(source: string, filePath: string, tree?: unknown): ExtractedEntity[];

  /**
   * Extract import statements from source code.
   *
   * @param source   - Full source text.
   * @param filePath - Absolute or project-relative path of the file.
   * @returns Array of import information records.
   */
  extractImports(source: string, filePath: string): ImportInfo[];
}

/**
 * @module @recurrsive/parsers
 *
 * Code analysis and AI pattern detection for Recurrsive.
 *
 * This package provides the full parsing pipeline: tree-sitter
 * parsing, language-specific entity extraction, AI-specific pattern
 * detection, and cross-file reference resolution.
 *
 * @packageDocumentation
 */

// ─── Tree-sitter ──────────────────────────────────────────────────────────────

export { TreeSitterParser, type ParseTree } from './tree-sitter/index.js';

// ─── Extractors ───────────────────────────────────────────────────────────────

export { ExtractorRegistry, createDefaultRegistry } from './extractors/index.js';
export type { LanguageExtractor, ExtractedEntity, ImportInfo } from './extractors/base.js';
export { TypeScriptExtractor } from './extractors/typescript.js';
export { PythonExtractor } from './extractors/python.js';

// ─── AI Pattern Detection ─────────────────────────────────────────────────────

export { AIPatternDetector } from './ai-patterns/index.js';
export type { AIPattern, AIPatternType } from './ai-patterns/detector.js';

// ─── Resolvers ────────────────────────────────────────────────────────────────

export { CrossFileResolver } from './resolvers/index.js';
export type { ResolvedReference } from './resolvers/cross-file.js';

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export { ParsingPipeline } from './pipeline.js';
export type { ParsedFile } from './pipeline.js';

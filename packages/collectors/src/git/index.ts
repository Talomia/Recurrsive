/**
 * @module @recurrsive/collectors/git
 *
 * Barrel export for the Git repository collector and its utilities.
 *
 * @packageDocumentation
 */

export {
  GitCollector,
  type GitCommitInfo,
  type ProjectTypeInfo,
} from './collector.js';

export {
  detectLanguage,
  isSourceFile,
  isBinaryFile,
  parsePackageJson,
  parsePyprojectToml,
  parseGoMod,
  detectFrameworks,
  detectAIProviders,
  type DependencyInfo,
  type FileInfo,
} from './utils.js';

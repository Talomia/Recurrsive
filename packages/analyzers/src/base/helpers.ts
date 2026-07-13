/**
 * @module @recurrsive/analyzers/base/helpers
 *
 * Shared helper utilities for building analyzers. Provides a
 * convenience factory for constructing well-formed {@link Finding}
 * objects, reducing boilerplate across all built-in analyzers.
 *
 * @packageDocumentation
 */

import {
  generateId,
  nowISO,
  type Finding,
  type Evidence,
  type SourceLocation,
  type OpportunityCategory,
  type Severity,
  type Entity,
} from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Finding Builder
// ---------------------------------------------------------------------------

/**
 * Options for constructing a {@link Finding} via {@link createFinding}.
 */
export interface CreateFindingOptions {
  /** Identifier of the analyzer producing the finding. */
  analyzer_id: string;
  /** Human-readable title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Severity level. */
  severity: Severity;
  /** Opportunity category. */
  category: OpportunityCategory;
  /** Supporting evidence items. */
  evidence: Evidence[];
  /** Relevant source locations. */
  locations: SourceLocation[];
  /** Optional fix suggestion. */
  suggested_fix?: string;
  /** Confidence score (0–1). */
  confidence: number;
  /** Grouping tags. */
  tags: string[];
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

/**
 * Create a well-formed {@link Finding} with auto-generated ID and timestamp.
 *
 * @param opts - Finding construction options.
 * @returns A complete Finding object.
 */
export function createFinding(opts: CreateFindingOptions): Finding {
  return {
    id: generateId(),
    analyzer_id: opts.analyzer_id,
    title: opts.title,
    description: opts.description,
    severity: opts.severity,
    category: opts.category,
    evidence: opts.evidence,
    locations: opts.locations,
    suggested_fix: opts.suggested_fix,
    confidence: opts.confidence,
    tags: opts.tags,
    metadata: opts.metadata,
    created_at: nowISO(),
  };
}

// ---------------------------------------------------------------------------
// Evidence Builder
// ---------------------------------------------------------------------------

/**
 * Options for constructing an {@link Evidence} via {@link createEvidence}.
 */
export interface CreateEvidenceOptions {
  /** Kind of evidence. */
  type: Evidence['type'];
  /** Source label. */
  source: string;
  /** Natural-language description. */
  description: string;
  /** IDs of related entities. */
  entity_ids: string[];
  /** Confidence (0–1). */
  confidence: number;
  /** Arbitrary payload. */
  data?: Record<string, unknown>;
}

/**
 * Create a well-formed {@link Evidence} with auto-generated ID and timestamp.
 *
 * @param opts - Evidence construction options.
 * @returns A complete Evidence object.
 */
export function createEvidence(opts: CreateEvidenceOptions): Evidence {
  return {
    id: generateId(),
    type: opts.type,
    source: opts.source,
    description: opts.description,
    data: opts.data,
    entity_ids: opts.entity_ids,
    collected_at: nowISO(),
    confidence: opts.confidence,
  };
}

// ---------------------------------------------------------------------------
// Location Helper
// ---------------------------------------------------------------------------

/**
 * Build a {@link SourceLocation} from an entity's source location ref.
 *
 * @param entity - The entity to extract location from.
 * @returns A SourceLocation, or `undefined` if no location info is available.
 */
export function locationFromEntity(entity: Entity): SourceLocation | undefined {
  const loc = entity.source_location;
  if (!loc?.file) return undefined;
  return {
    file: loc.file,
    start_line: loc.start_line,
    end_line: loc.end_line,
    start_column: loc.start_column,
    end_column: loc.end_column,
    repository: loc.repository,
    commit: loc.commit,
  };
}

// ---------------------------------------------------------------------------
// Source Classification
// ---------------------------------------------------------------------------

/**
 * Return true when an entity originates from a test, mock, snapshot, or
 * fixture. Runtime-risk analyzers use this to avoid reporting deliberately
 * unsafe sample code as production behavior while test-quality analyzers can
 * still inspect the same entities.
 */
export function isTestOrFixtureEntity(entity: Entity): boolean {
  const candidate = (
    entity.source_location?.file ??
    (typeof entity.properties['path'] === 'string' ? entity.properties['path'] : '')
  ).replaceAll('\\', '/').toLowerCase();

  if (!candidate) return false;

  const segments = candidate.split('/');
  if (segments.some((segment) => [
    '__tests__',
    '__mocks__',
    '__snapshots__',
    'test',
    'tests',
    'spec',
    'specs',
    'fixture',
    'fixtures',
  ].includes(segment))) {
    return true;
  }

  const filename = segments.at(-1) ?? '';
  return (
    /\.(test|spec)\.[^.]+$/.test(filename) ||
    /_test\.[^.]+$/.test(filename) ||
    /^test_.+\.[^.]+$/.test(filename)
  );
}

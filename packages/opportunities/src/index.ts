/**
 * @module @recurrsive/opportunities
 *
 * Barrel export for the opportunities package.
 *
 * @packageDocumentation
 */

// Manager
export { OpportunityManager } from './manager.js';
export type { OpportunityFilters, ExportFormat } from './manager.js';

// Ranking
export { computeScore, rankOpportunities, groupByDependency } from './ranking.js';
export type { DependencyGroup } from './ranking.js';

// SARIF export
export { exportToSarif } from './sarif.js';

// Markdown export
export { exportToMarkdown } from './markdown.js';

// Roadmap
export { generateRoadmap, renderRoadmapMarkdown } from './roadmap.js';
export type { PhaseName, RoadmapEntry, RoadmapPhase, Roadmap } from './roadmap.js';

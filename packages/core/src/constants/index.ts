/**
 * @module @recurrsive/core/constants
 *
 * Compile-time constants and default values used throughout the
 * Recurrsive runtime.
 *
 * @packageDocumentation
 */

/** Current version of the @recurrsive/core package. */
export const VERSION = '0.6.0';

/** Current config schema version. */
export const CONFIG_VERSION = '1';

/** Default output directory (relative to project root). */
export const DEFAULT_OUTPUT_DIRECTORY = '.recurrsive';

/** Default output format for reports. */
export const DEFAULT_OUTPUT_FORMAT = 'markdown' as const;

/** Default graph provider. */
export const DEFAULT_GRAPH_PROVIDER = 'sqlite' as const;

/** Default LLM provider. */
export const DEFAULT_LLM_PROVIDER = 'openai';

/** Default LLM model. */
export const DEFAULT_LLM_MODEL = 'gpt-4.1-mini';

/** Default LLM sampling temperature. */
export const DEFAULT_LLM_TEMPERATURE = 0.3;

/** Default maximum debate rounds for the reasoning engine. */
export const DEFAULT_MAX_DEBATE_ROUNDS = 3;

/** Default minimum consensus score for promoting a hypothesis. */
export const DEFAULT_MIN_CONSENSUS_SCORE = 0.6;

/** Default data retention period in days. */
export const DEFAULT_RETENTION_DAYS = 90;

/** Default config file names to search for (in priority order). */
export const CONFIG_FILE_NAMES = [
  'recurrsive.config.json',
  'recurrsive.config.yaml',
  'recurrsive.config.yml',
  '.recurrsiverc.json',
  '.recurrsiverc.yaml',
  '.recurrsiverc.yml',
] as const;

/**
 * Numeric weight assigned to each severity level for sorting and
 * comparison.  Higher weight = more severe.
 */
export const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
} as const;

/**
 * Numeric weight assigned to each maturity level for scoring.
 * Higher weight = more mature.
 */
export const MATURITY_LEVEL_WEIGHTS: Record<string, number> = {
  initial: 1,
  developing: 2,
  defined: 3,
  managed: 4,
  optimizing: 5,
} as const;

/**
 * Numeric weight assigned to each t-shirt size for effort comparison.
 * Higher weight = more effort.
 */
export const EFFORT_WEIGHTS: Record<string, number> = {
  xs: 1,
  s: 2,
  m: 3,
  l: 4,
  xl: 5,
} as const;

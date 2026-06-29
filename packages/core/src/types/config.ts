import { z } from 'zod';

/**
 * Top-level configuration schema for a Recurrsive project.
 *
 * Typically stored as `recurrsive.config.json` or `recurrsive.yaml`
 * at the project root.
 */
export const RecurrsiveConfigSchema = z.object({
  /** Config schema version. */
  version: z.string().default('1'),

  /** Project-level metadata. */
  project: z.object({
    /** Project display name. */
    name: z.string(),
    /** Optional description. */
    description: z.string().optional(),
    /** Remote repository URL. */
    repository: z.string().optional(),
  }),

  /** Knowledge graph storage configuration. */
  graph: z.object({
    /** Graph provider backend. */
    provider: z.enum(['postgresql_age', 'sqlite']).default('sqlite'),
    /** Connection string (provider-specific). */
    connection_string: z.string().optional(),
  }),

  /** Reasoning (multi-agent debate) engine configuration. */
  reasoning: z
    .object({
      /** LLM provider name. */
      provider: z.string().default('openai'),
      /** Model identifier. */
      model: z.string().default('gpt-4.1-mini'),
      /** API key (prefer env var `RECURRSIVE_LLM_API_KEY`). */
      api_key: z.string().optional(),
      /** Custom base URL for the LLM API. */
      base_url: z.string().optional(),
      /** Maximum debate rounds. */
      max_debate_rounds: z.number().default(3),
      /** Minimum average confidence for consensus (0–1). */
      min_consensus_score: z.number().min(0).max(1).default(0.6),
      /** Which specialist roles participate (empty = all). */
      specialists: z.array(z.string()).default([]),
      /** Sampling temperature. */
      temperature: z.number().default(0.3),
    })
    .optional(),

  /** Collectors to run. */
  collectors: z
    .array(
      z.object({
        /** Collector type identifier. */
        type: z.string(),
        /** Whether this collector is enabled. */
        enabled: z.boolean().default(true),
        /** Collector-specific configuration. */
        config: z.record(z.unknown()),
      }),
    )
    .default([]),

  /** Analyzer configuration. */
  analyzers: z
    .object({
      /** Glob patterns of analyzer IDs to enable (`['*']` = all). */
      enabled: z.array(z.string()).default(['*']),
      /** Glob patterns of analyzer IDs to disable. */
      disabled: z.array(z.string()).default([]),
      /** Per-analyzer configuration overrides keyed by analyzer ID. */
      config: z.record(z.record(z.unknown())).default({}),
    })
    .default({}),

  /** Data governance settings. */
  governance: z
    .object({
      /** Enable automatic PII detection. */
      pii_detection: z.boolean().default(true),
      /** Property keys to mask in output. */
      masked_fields: z.array(z.string()).default([]),
      /** Glob patterns of files to exclude from collection. */
      excluded_patterns: z.array(z.string()).default([]),
      /** Write an audit log of all data access. */
      audit_log: z.boolean().default(true),
      /** Maximum data retention in days. */
      retention_days: z.number().default(90),
    })
    .default({}),

  /** Paths to policy definition files. */
  policies: z.array(z.string()).default([]),

  /** Output configuration. */
  output: z
    .object({
      /** Output format. */
      format: z.enum(['json', 'markdown', 'sarif', 'html']).default('markdown'),
      /** Output directory (relative to project root). */
      directory: z.string().default('.recurrsive'),
    })
    .default({}),
});

/** Inferred TypeScript type for {@link RecurrsiveConfigSchema}. */
export type RecurrsiveConfig = z.infer<typeof RecurrsiveConfigSchema>;

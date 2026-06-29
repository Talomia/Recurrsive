import { describe, it, expect } from 'vitest';
import { RecurrsiveConfigSchema } from '../../types/config.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid config — only the required fields. */
const minimalConfig = {
  project: { name: 'test-project' },
  graph: {},
};

/** Full config with all optional sections filled in. */
const fullConfig = {
  version: '2',
  project: {
    name: 'my-project',
    description: 'A great project',
    repository: 'https://github.com/org/repo',
  },
  graph: {
    provider: 'postgresql_age' as const,
    connection_string: 'postgresql://localhost/recurrsive',
  },
  reasoning: {
    provider: 'anthropic',
    model: 'claude-3',
    api_key: 'sk-test',
    base_url: 'https://api.example.com',
    max_debate_rounds: 5,
    temperature: 0.7,
  },
  collectors: [
    {
      type: 'github',
      enabled: true,
      config: { org: 'my-org' },
    },
    {
      type: 'static',
      enabled: false,
      config: {},
    },
  ],
  analyzers: {
    enabled: ['security.*', 'complexity.*'],
    disabled: ['complexity.halstead'],
    config: {
      'security.xss': { strict: true },
    },
  },
  governance: {
    pii_detection: false,
    masked_fields: ['ssn', 'api_key'],
    excluded_patterns: ['**/node_modules/**'],
    audit_log: false,
    retention_days: 30,
  },
  policies: ['policies/security.yaml', 'policies/quality.yaml'],
  output: {
    format: 'json' as const,
    directory: 'output',
  },
};

// ---------------------------------------------------------------------------
// Valid configs
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – valid configs', () => {
  it('accepts minimal config (only required fields)', () => {
    const result = RecurrsiveConfigSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
  });

  it('accepts full config with all optional sections', () => {
    const result = RecurrsiveConfigSchema.safeParse(fullConfig);
    expect(result.success).toBe(true);
  });

  it('parsed minimal config has expected structure', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.project.name).toBe('test-project');
  });
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – default values', () => {
  it('defaults version to "1"', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.version).toBe('1');
  });

  it('defaults graph.provider to "sqlite"', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.graph.provider).toBe('sqlite');
  });

  it('defaults collectors to empty array', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.collectors).toEqual([]);
  });

  it('defaults analyzers.enabled to ["*"]', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.analyzers.enabled).toEqual(['*']);
  });

  it('defaults analyzers.disabled to []', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.analyzers.disabled).toEqual([]);
  });

  it('defaults analyzers.config to {}', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.analyzers.config).toEqual({});
  });

  it('defaults governance.pii_detection to true', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.governance.pii_detection).toBe(true);
  });

  it('defaults governance.masked_fields to []', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.governance.masked_fields).toEqual([]);
  });

  it('defaults governance.excluded_patterns to []', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.governance.excluded_patterns).toEqual([]);
  });

  it('defaults governance.audit_log to true', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.governance.audit_log).toBe(true);
  });

  it('defaults governance.retention_days to 90', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.governance.retention_days).toBe(90);
  });

  it('defaults policies to []', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.policies).toEqual([]);
  });

  it('defaults output.format to "markdown"', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.output.format).toBe('markdown');
  });

  it('defaults output.directory to ".recurrsive"', () => {
    const result = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(result.output.directory).toBe('.recurrsive');
  });

  it('defaults reasoning section reasoning fields when provided', () => {
    const config = {
      ...minimalConfig,
      reasoning: {},
    };
    const result = RecurrsiveConfigSchema.parse(config);
    expect(result.reasoning!.provider).toBe('openai');
    expect(result.reasoning!.model).toBe('gpt-4.1-mini');
    expect(result.reasoning!.max_debate_rounds).toBe(3);
    expect(result.reasoning!.temperature).toBe(0.3);
  });

  it('defaults collector enabled to true', () => {
    const config = {
      ...minimalConfig,
      collectors: [{ type: 'github', config: {} }],
    };
    const result = RecurrsiveConfigSchema.parse(config);
    expect(result.collectors[0]!.enabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Missing required fields
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – missing required fields', () => {
  it('fails when project is missing', () => {
    const result = RecurrsiveConfigSchema.safeParse({ graph: {} });
    expect(result.success).toBe(false);
  });

  it('fails when graph is missing', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      project: { name: 'test' },
    });
    expect(result.success).toBe(false);
  });

  it('fails when project.name is missing', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      project: {},
      graph: {},
    });
    expect(result.success).toBe(false);
  });

  it('fails when entire config is empty object', () => {
    const result = RecurrsiveConfigSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('fails when config is null', () => {
    const result = RecurrsiveConfigSchema.safeParse(null);
    expect(result.success).toBe(false);
  });

  it('fails when config is undefined', () => {
    const result = RecurrsiveConfigSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  it('fails when config is a string', () => {
    const result = RecurrsiveConfigSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Nested config validation – graph
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – graph validation', () => {
  it('accepts "sqlite" provider', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      graph: { provider: 'sqlite' },
    });
    expect(result.success).toBe(true);
  });

  it('accepts "postgresql_age" provider', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      graph: { provider: 'postgresql_age' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown graph provider', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      graph: { provider: 'mysql' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts graph with connection_string', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      graph: {
        provider: 'postgresql_age',
        connection_string: 'postgresql://localhost/db',
      },
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Nested config validation – reasoning
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – reasoning validation', () => {
  it('reasoning section is optional', () => {
    const result = RecurrsiveConfigSchema.safeParse(minimalConfig);
    expect(result.success).toBe(true);
    const parsed = RecurrsiveConfigSchema.parse(minimalConfig);
    expect(parsed.reasoning).toBeUndefined();
  });

  it('accepts custom reasoning settings', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      reasoning: {
        provider: 'anthropic',
        model: 'claude-3',
        max_debate_rounds: 10,
        temperature: 0.9,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-numeric max_debate_rounds', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      reasoning: { max_debate_rounds: 'three' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-numeric temperature', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      reasoning: { temperature: 'hot' },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Nested config validation – collectors
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – collectors validation', () => {
  it('accepts valid collectors array', () => {
    const config = {
      ...minimalConfig,
      collectors: [
        { type: 'github', enabled: true, config: { org: 'test' } },
      ],
    };
    const result = RecurrsiveConfigSchema.safeParse(config);
    expect(result.success).toBe(true);
  });

  it('rejects collector without type', () => {
    const config = {
      ...minimalConfig,
      collectors: [{ enabled: true, config: {} }],
    };
    const result = RecurrsiveConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('rejects collector without config', () => {
    const config = {
      ...minimalConfig,
      collectors: [{ type: 'github', enabled: true }],
    };
    const result = RecurrsiveConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it('rejects collectors that is not an array', () => {
    const config = {
      ...minimalConfig,
      collectors: 'not-an-array',
    };
    const result = RecurrsiveConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Nested config validation – output
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – output validation', () => {
  it('accepts valid output formats', () => {
    for (const format of ['json', 'markdown', 'sarif', 'html'] as const) {
      const result = RecurrsiveConfigSchema.safeParse({
        ...minimalConfig,
        output: { format },
      });
      expect(result.success, `Format "${format}" should be valid`).toBe(true);
    }
  });

  it('rejects invalid output format', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      output: { format: 'pdf' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts custom output directory', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      output: { directory: 'reports' },
    });
    expect(result.success).toBe(true);
    const parsed = RecurrsiveConfigSchema.parse({
      ...minimalConfig,
      output: { directory: 'reports' },
    });
    expect(parsed.output.directory).toBe('reports');
  });
});

// ---------------------------------------------------------------------------
// Nested config validation – governance
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – governance validation', () => {
  it('accepts custom governance settings', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      governance: {
        pii_detection: false,
        masked_fields: ['ssn'],
        excluded_patterns: ['**/*.secret'],
        audit_log: false,
        retention_days: 365,
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-boolean pii_detection', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      governance: { pii_detection: 'yes' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects non-number retention_days', () => {
    const result = RecurrsiveConfigSchema.safeParse({
      ...minimalConfig,
      governance: { retention_days: '90' },
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full round-trip: parse + access
// ---------------------------------------------------------------------------
describe('RecurrsiveConfigSchema – full round-trip', () => {
  it('parsed full config matches expected values', () => {
    const parsed = RecurrsiveConfigSchema.parse(fullConfig);

    expect(parsed.version).toBe('2');
    expect(parsed.project.name).toBe('my-project');
    expect(parsed.project.description).toBe('A great project');
    expect(parsed.project.repository).toBe('https://github.com/org/repo');
    expect(parsed.graph.provider).toBe('postgresql_age');
    expect(parsed.graph.connection_string).toBe('postgresql://localhost/recurrsive');
    expect(parsed.reasoning?.provider).toBe('anthropic');
    expect(parsed.reasoning?.model).toBe('claude-3');
    expect(parsed.reasoning?.max_debate_rounds).toBe(5);
    expect(parsed.reasoning?.temperature).toBe(0.7);
    expect(parsed.collectors).toHaveLength(2);
    expect(parsed.collectors[0]!.type).toBe('github');
    expect(parsed.collectors[1]!.enabled).toBe(false);
    expect(parsed.analyzers.enabled).toEqual(['security.*', 'complexity.*']);
    expect(parsed.governance.pii_detection).toBe(false);
    expect(parsed.governance.retention_days).toBe(30);
    expect(parsed.policies).toEqual(['policies/security.yaml', 'policies/quality.yaml']);
    expect(parsed.output.format).toBe('json');
    expect(parsed.output.directory).toBe('output');
  });
});

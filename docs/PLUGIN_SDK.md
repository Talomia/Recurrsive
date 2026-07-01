# Recurrsive Plugin SDK Guide

Build custom collectors and analyzers that integrate seamlessly with the Recurrsive engineering intelligence platform.

---

## Overview

Recurrsive has a plugin-based architecture. Every collector and analyzer implements a standard interface, registers with a central registry, and operates within the platform's lifecycle.

| Extension Point | Interface | Registry | Purpose |
|-----------------|-----------|----------|---------|
| Collector | `Collector` | `CollectorRegistry` | Ingest data from external systems |
| Analyzer | `Analyzer` | `AnalyzerRegistry` | Analyze entities and produce findings |

---

## Building a Custom Collector

### Step 1: Create the Directory

```bash
mkdir -p packages/collectors/src/my-source/
```

### Step 2: Implement the Collector Interface

```typescript
// packages/collectors/src/my-source/collector.ts

import type {
  Collector,
  CollectorConfig,
  CollectorResult,
  CollectorType,
  DataGovernance,
  Entity,
  Relationship,
} from '@recurrsive/core';
import {
  generateId,
  qualifiedName,
  nowISO,
  createLogger,
  CollectorError,
} from '@recurrsive/core';
import { GovernanceFilter } from '../base/governance.js';

const logger = createLogger({ context: { module: 'my-source-collector' } });

export class MySourceCollector implements Collector {
  // Required identity fields
  readonly id = 'my-source';
  readonly name = 'My Source Collector';
  readonly description = 'Collects data from My Source';
  readonly type: CollectorType = 'code'; // Use an appropriate CollectorType
  readonly version = '0.1.0';

  private governance!: DataGovernance;
  private governanceFilter!: GovernanceFilter;
  private initialized = false;

  // Lifecycle: 1. Initialize
  async initialize(config: CollectorConfig): Promise<void> {
    this.governance = config.governance;
    this.governanceFilter = new GovernanceFilter(config.governance);
    this.initialized = true;
    logger.info('MySourceCollector initialized');
  }

  // Lifecycle: 2. Validate
  async validate(): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!this.initialized) {
      errors.push('Collector not initialized');
    }
    return { valid: errors.length === 0, errors };
  }

  // Lifecycle: 3. Collect
  async collect(): Promise<CollectorResult> {
    const start = Date.now();
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];

    // --- Your collection logic here ---
    // Create entities using the Entity shape:
    entities.push({
      id: generateId(),
      type: 'file',
      name: 'example.ts',
      qualified_name: qualifiedName('my-source', 'example.ts'),
      properties: { language: 'typescript' },
      source: this.id,
      confidence: 1.0,
      tags: [],
      created_at: nowISO(),
      updated_at: nowISO(),
    });

    return {
      entities: this.governanceFilter.filterEntities(entities),
      relationships: this.governanceFilter.filterRelationships(relationships),
      metadata: {
        collector_id: this.id,
        collected_at: nowISO(),
        duration_ms: Date.now() - start,
        items_processed: entities.length,
        errors: [],
      },
    };
  }

  // Lifecycle: 4. Dispose
  async dispose(): Promise<void> {
    this.initialized = false;
    logger.info('MySourceCollector disposed');
  }
}
```

### Step 3: Create the Barrel Export

```typescript
// packages/collectors/src/my-source/index.ts
export { MySourceCollector } from './collector.js';
```

### Step 4: Register the Collector

Add your collector to `packages/collectors/src/index.ts`:

```typescript
export { MySourceCollector } from './my-source/index.js';
```

### Step 5: Write Tests

```typescript
// packages/collectors/src/my-source/__tests__/collector.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { MySourceCollector } from '../collector.js';
import type { CollectorConfig, DataGovernance } from '@recurrsive/core';

const governance: DataGovernance = {
  masked_fields: [],
  excluded_patterns: [],
  pii_detection: false,
  audit_log: false,
  retention_days: 90,
};

const config: CollectorConfig = { governance, custom: {} };

describe('MySourceCollector', () => {
  let collector: MySourceCollector;

  beforeEach(() => {
    collector = new MySourceCollector();
  });

  it('implements the Collector interface', () => {
    expect(collector.id).toBe('my-source');
    expect(collector.name).toBeTruthy();
    expect(collector.type).toBeTruthy();
    expect(collector.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('initializes successfully', async () => {
    await expect(collector.initialize(config)).resolves.not.toThrow();
  });

  it('validates after initialization', async () => {
    await collector.initialize(config);
    const result = await collector.validate();
    expect(result.valid).toBe(true);
  });

  it('collects entities', async () => {
    await collector.initialize(config);
    const result = await collector.collect();
    expect(result.entities.length).toBeGreaterThan(0);
    expect(result.metadata.collector_id).toBe('my-source');
  });

  it('disposes cleanly', async () => {
    await collector.initialize(config);
    await expect(collector.dispose()).resolves.not.toThrow();
  });
});
```

---

## Building a Custom Analyzer

### Step 1: Create the Directory

```bash
mkdir -p packages/analyzers/src/my-analyzer/
```

### Step 2: Implement the Analyzer Interface

```typescript
// packages/analyzers/src/my-analyzer/analyzer.ts

import type {
  Analyzer,
  AnalysisContext,
  Finding,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

export class MyAnalyzer implements Analyzer {
  readonly id = 'my-analyzer.quality';
  readonly name = 'My Custom Analyzer';
  readonly description = 'Detects custom quality issues';
  readonly version = '0.1.0';
  readonly categories = ['quality' as const];

  async initialize(_ctx: AnalysisContext): Promise<void> {
    // Optional setup — cache config, precompute values, etc.
  }

  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Get entities from the knowledge graph
    const files = await ctx.graph.getEntities('file');

    for (const file of files) {
      // Your analysis logic here
      const hasIssue = /* your detection logic */ false;

      if (hasIssue) {
        findings.push(
          createFinding({
            title: 'Issue detected in file',
            description: `Detected a quality issue in ${file.name}.`,
            severity: 'medium',
            category: 'quality',
            analyzer_id: this.id,
            location: locationFromEntity(file),
            evidence: [
              createEvidence('File has issue', 0.9, this.id, {
                file: file.name,
              }),
            ],
          }),
        );
      }
    }

    return findings;
  }

  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    // Optional cross-cutting analysis after all analyzers have run
    return [];
  }
}
```

### Step 3: Register the Analyzer

Add to `packages/analyzers/src/create-defaults.ts`:

```typescript
import { MyAnalyzer } from './my-analyzer/index.js';

export function createDefaultAnalyzers(): Analyzer[] {
  return [
    // ... existing analyzers
    new MyAnalyzer(),
  ];
}
```

### Step 4: Write Tests

Follow the same pattern as collector tests. Create a mock `AnalysisContext` with a mock `graph` that returns test entities.

---

## Available Types

### Entity Types (43)

All entity types are defined in `packages/core/src/types/entities.ts`:

```
repository, file, function, class, module, endpoint, prompt, agent,
tool, model, dataset, table, collection, query, index, dependency,
config, secret, mcp_server, mcp_tool, mcp_resource, workflow,
pipeline, job, step, user, team, organization, incident, alert,
cost_metric, business_metric, performance_metric,
infrastructure_resource, deployment, environment, experiment,
feature_flag, evaluation, document, adr, rfc, api_contract
```

### Relationship Types (43)

All relationship types are defined in `packages/core/src/types/relationships.ts`:

```
contains, imports, exports, calls, implements, extends, overrides,
references, instantiates, uses_model, uses_tool, has_prompt,
invokes_agent, retrieves_from, embeds_with, evaluates_with,
queries_table, writes_to, reads_from, migrates, depends_on,
deploys_to, routes_to, caches, load_balances, scales_with,
owns, maintains, reviews, triggers, produces, consumes,
transforms, monitors, alerts_on, supersedes, conflicts_with,
enables, blocks, tests, validates, authenticates, rate_limits
```

### Collector Types (16)

```
code, git, github, gitlab, bitbucket, database, telemetry, cloud,
ci_cd, documentation, ai_provider, product_analytics,
customer_signals, business_metrics, infrastructure, observability
```

### Finding Severities

```
critical, high, medium, low, info
```

---

## Governance

All collectors receive a `DataGovernance` config via `CollectorConfig.governance`:

| Field | Type | Purpose |
|-------|------|---------|
| `masked_fields` | `string[]` | Fields to mask/redact in entity properties |
| `excluded_patterns` | `string[]` | Glob patterns for files/paths to exclude |
| `pii_detection` | `boolean` | Whether to scan for PII |
| `audit_log` | `boolean` | Whether to log data access events |
| `retention_days` | `number` | Data retention period |

Use the `GovernanceFilter` from `packages/collectors/src/base/governance.ts` to apply these rules automatically.

---

## Testing

All packages use **Vitest** for testing:

```bash
# Run tests for a specific package
pnpm --filter @recurrsive/collectors test

# Run tests with watch mode
pnpm --filter @recurrsive/collectors test:watch

# Run all tests
pnpm test
```

---

## Best Practices

1. **Use `generateId()`** for all entity and relationship IDs (UUID v4)
2. **Use `qualifiedName()`** for entity `qualified_name` fields
3. **Use `nowISO()`** for all timestamps
4. **Use `createLogger()`** for structured logging
5. **Apply governance** — always filter entities through `GovernanceFilter`
6. **Handle errors gracefully** — wrap external calls in try/catch
7. **Set confidence scores** — use 0.0–1.0 to indicate detection certainty
8. **Write comprehensive tests** — test lifecycle, entity shapes, and edge cases

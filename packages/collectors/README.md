# @recurrsive/collectors

Data collection framework with built-in privacy governance. Collects source code, git history, documentation, and project metadata while detecting and masking PII.

## Installation

```bash
pnpm add @recurrsive/collectors
```

## Usage

```typescript
import { GitCollector, CollectorRegistry } from '@recurrsive/collectors';

const collector = new GitCollector('/path/to/repo');
await collector.initialize({
  governance: {
    masked_fields: ['password', 'api_key'],
    excluded_patterns: ['**/node_modules/**'],
    pii_detection: true,
  },
});

const result = await collector.collect();
// result.entities: Entity[] — files, functions, classes, etc.
// result.relationships: Relationship[] — imports, calls, etc.
```

## Collectors

| Collector | Description |
|-----------|-------------|
| `GitCollector` | File tree walking, language detection (20+), git history, framework/AI provider detection |
| `DocumentationCollector` | README, ADRs, RFCs, API contracts |
| `EnvironmentCollector` | Runtime config, secrets detection |
| `CICDCollector` | CI/CD pipelines, build history |
| `DatabaseCollector` | SQL schemas, Prisma, Drizzle |
| `GitHubCollector` | Issues, PRs, workflows, releases |
| `GitLabCollector` | Merge requests, pipelines, CI configs |
| `OpenTelemetryCollector` | Traces, spans, service maps |
| `CloudCostCollector` | Cloud spend, resource utilization |
| `ErrorTrackingCollector` | Error rates, crash reports |
| `APMCollector` | Application performance metrics |
| `LangfuseCollector` | LLM observability via Langfuse |
| `ArizeCollector` | ML monitoring via Arize |
| `HeliconeCollector` | LLM cost tracking via Helicone |

## Governance

| Feature | Description |
|---------|-------------|
| PII Detection | Email, phone, SSN, API keys, JWT tokens |
| Field Masking | Configurable field redaction |
| Path Exclusion | Glob-based directory filtering |
| Audit Logging | Records all governance actions |

## License

[Apache-2.0](../../LICENSE)

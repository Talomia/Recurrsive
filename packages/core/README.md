# @recurrsive/core

Foundation type system, schemas, and utilities for the Recurrsive platform. All other packages depend on `@recurrsive/core` for shared types and interfaces.

## Installation

```bash
pnpm add @recurrsive/core
```

## API

### Types

| Export | Description |
|--------|-------------|
| `Entity` | Knowledge graph entity (43 types: file, function, class, agent, prompt, tool, model, etc.) |
| `Relationship` | Graph edge (43 types: calls, imports, defines, uses, extends, etc.) |
| `Finding` | Analysis result from an analyzer |
| `Opportunity` | Improvement suggestion with impact, effort, and validation plan |
| `Analyzer` | Interface for analysis plugins |
| `Collector` | Interface for data collection plugins |
| `EvolutionSnapshot` | Point-in-time system health snapshot |
| `MaturityScore` | Per-dimension maturity assessment |
| `RecurrsiveConfig` | Full platform configuration schema |

### Schemas (Zod)

| Export | Description |
|--------|-------------|
| `EntityTypeSchema` | Entity type literals (43 types) |
| `EntitySchema` | Complete entity validation |
| `RelationTypeSchema` | Relationship type literals (43 types) |
| `RelationshipSchema` | Complete relationship validation |
| `OpportunitySchema` | Full opportunity with impact/effort/risk |
| `FindingSchema` | Analysis finding validation |
| `SeveritySchema` | Severity levels (critical, high, medium, low, info) |
| `AnalyzerMetadataSchema` | Analyzer configuration metadata |
| `CollectorMetadataSchema` | Collector configuration metadata |
| `SpecialistRoleSchema` | Reasoning specialist role validation |
| `PolicyActionSchema` | Policy action literals |
| `RecurrsiveConfigSchema` | Full platform configuration |

### Utilities

| Export | Description |
|--------|-------------|
| `createLogger()` | Structured JSON logger with level filtering |
| `generateId()` | UUID v4 generator |
| `nowISO()` | Current time as ISO-8601 string |
| `isValidId(id)` | Validate ID format |
| `qualifiedName(parts)` | Build qualified entity names |
| `toISO(date)` / `fromISO(str)` | ISO-8601 date conversion helpers |
| `durationMs(start, end)` | Calculate duration in milliseconds |
| `formatDuration(ms)` | Human-readable duration (e.g., "2m 30s") |
| `isOlderThan(date, ms)` | Check if date exceeds age threshold |
| `contentHash(content)` | Deterministic DJB2 content fingerprint |
| `sanitizeInput(str)` | Strip dangerous characters |
| `validateEmail(str)` | Email format validation |
| `validateUrl(str)` | URL format validation |
| `truncate(str, len)` | Truncate with ellipsis |
| `slugify(str)` | URL-safe slug conversion |
| `deepMerge(a, b)` | Deep merge two objects |
| `debounce(fn, ms)` | Debounce function calls |
| `retry(fn, opts)` | Retry with exponential backoff |
| `batchProcess(items, fn)` | Process items in configurable batches |
| `LRUCache` | Least-recently-used cache implementation |

### Error Classes

| Export | Description |
|--------|-------------|
| `RecurrsiveError` | Base error with `code` and `cause` chaining |
| `CollectorError` | Data collection failures |
| `AnalyzerError` | Analysis pipeline errors |
| `GraphError` | Knowledge graph operations |
| `ReasoningError` | Reasoning engine failures |
| `ConfigError` | Configuration parsing errors |
| `ValidationError` | Schema/data validation failures |

### Constants

| Export | Description |
|--------|-------------|
| `VERSION` | Current package version (`0.5.6`) |
| `CONFIG_VERSION` | Configuration schema version |
| `DEFAULT_GRAPH_PROVIDER` | Default graph backend |
| `DEFAULT_LLM_PROVIDER` | Default LLM provider |
| `DEFAULT_LLM_MODEL` | Default LLM model |
| `SEVERITY_WEIGHTS` | Numeric weights per severity level |
| `CONFIG_FILE_NAMES` | Supported config file names |

## Development

```bash
# Run tests
pnpm test --filter @recurrsive/core

# Build
pnpm build --filter @recurrsive/core

# Lint
pnpm lint --filter @recurrsive/core
```

## License

[Apache-2.0](../../LICENSE)

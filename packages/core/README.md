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

### Utilities

| Export | Description |
|--------|-------------|
| `createLogger()` | Structured JSON logger with level filtering |
| `generateId()` | UUID v4 generator |
| `nowISO()` | Current time as ISO-8601 string |
| `RecurrsiveError` | Base error class with code and cause chaining |
| `CollectorError`, `AnalyzerError`, `GraphError`, etc. | Domain-specific error classes |

### Schemas

| Export | Description |
|--------|-------------|
| `RecurrsiveConfigSchema` | Zod schema for validating configuration |
| `EntityTypeSchema` | Zod schema for entity type literals |

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

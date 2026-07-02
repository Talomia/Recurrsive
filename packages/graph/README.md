# @recurrsive/graph

Dual-backend knowledge graph engine for the Recurrsive platform. Provides a unified `GraphClient` interface with PostgreSQL + Apache AGE (production) and SQLite (local) backends.

## Installation

```bash
pnpm add @recurrsive/graph
```

## Usage

```typescript
import { createGraphClient } from '@recurrsive/graph';

// SQLite (local, zero-config)
const client = await createGraphClient({
  provider: 'sqlite',
  sqlitePath: '.recurrsive/graph.db',
  autoMigrate: true,
});

// Add entities and relationships
await client.upsertEntity({ id: 'fn-1', type: 'function', name: 'processData', ... });
await client.upsertRelationship({ source: 'fn-1', target: 'fn-2', type: 'calls', ... });

// Query
const neighbors = await client.getNeighbors('fn-1', { depth: 2 });
const stats = await client.getStats();
```

## Query Builders

| Function | Description |
|----------|-------------|
| `findDependencyTree()` | Recursive dependency traversal |
| `findCircularDeps()` | Cycle detection in the graph |
| `findDeadCode()` | Find unreferenced entities |
| `findCallChain()` | Trace function call paths |
| `findAIWorkflow()` | Discover agent-tool-prompt workflows |
| `findEntitiesByPattern()` | Name/pattern matching |

## Development

```bash
# Run tests
pnpm test --filter @recurrsive/graph

# Build
pnpm build --filter @recurrsive/graph

# Lint
pnpm lint --filter @recurrsive/graph
```

## License

[Apache-2.0](../../LICENSE)

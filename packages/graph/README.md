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

// PostgreSQL + Apache AGE (production)
const client = await createGraphClient({
  provider: 'postgresql_age',
  connectionString: process.env.DATABASE_URL,
  autoMigrate: true,
});

// Add entities and relationships
await client.upsertEntity({ id: 'fn-1', type: 'function', name: 'processData', ... });
await client.upsertRelationship({ source: 'fn-1', target: 'fn-2', type: 'calls', ... });

// Query
const neighbors = await client.getNeighbors('fn-1', { depth: 2 });
const stats = await client.getStats();
```

## API

### Client Factory

| Export | Description |
|--------|-------------|
| `createGraphClient(config)` | Create a read-write graph client (AGE or SQLite) |
| `createReadOnlyGraphClient(config)` | Create a read-only client |

### Query Builders

| Function | Description |
|----------|-------------|
| `findDependencyTree()` | Recursive dependency traversal |
| `findCircularDeps()` | Cycle detection in the graph |
| `findDeadCode()` | Find unreferenced entities |
| `findCallChain()` | Trace function call paths |
| `findAIWorkflow()` | Discover agent-tool-prompt workflows |
| `findEntitiesByPattern()` | Name/pattern matching |
| `findAllPromptsForAgent()` | Get all prompts used by an agent |
| `findModelUsage()` | Analyze LLM model usage across the graph |

### Providers

| Export | Description |
|--------|-------------|
| `AgeGraphClient` | PostgreSQL + Apache AGE provider |
| `createAgeClient(config)` | AGE client factory |
| `SqliteGraphClient` | SQLite provider |
| `createSqliteClient(config)` | SQLite client factory |

### Migrations

| Export | Description |
|--------|-------------|
| `migrate(client)` | Run pending migrations |
| `getMigrationStatements()` | Get SQL migration statements |
| `MIGRATION_NAME` | Current migration version identifier |

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

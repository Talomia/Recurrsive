# Development Guide

## Prerequisites

- **Node.js** ≥ 20.x
- **pnpm** ≥ 9.x (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker** (optional, for PostgreSQL + Apache AGE)

## Quick Start

```bash
# Clone the repository
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start the API server in development mode
pnpm dev --filter @recurrsive/server

# Start the dashboard in development mode
pnpm dev --filter @recurrsive/dashboard
```

## Project Structure

```
Recurrsive/
├── apps/
│   ├── cli/                    # CLI application
│   ├── dashboard/              # Next.js web dashboard
│   ├── mcp/                    # MCP server for AI assistants
│   └── server/                 # REST + WebSocket API server
├── packages/
│   ├── core/                   # Shared types, schemas, utilities
│   ├── graph/                  # Knowledge graph (SQLite/AGE)
│   ├── collectors/             # Data collectors (git, docs)
│   ├── parsers/                # Language parsers (TypeScript, Python)
│   ├── analyzers/              # 10 analysis engines
│   ├── reasoning/              # Multi-agent reasoning engine
│   ├── opportunities/          # Opportunity management & export
│   ├── policy/                 # Governance policy engine
│   └── presentation/           # Reports & notifications
├── docker/                     # Docker configuration
├── docs/                       # Documentation
└── examples/                   # Example configurations
```

## Monorepo Tooling

This project uses:
- **pnpm workspaces** for package management
- **Turborepo** for build orchestration
- **TypeScript** strict mode across all packages

### Common Commands

```bash
# Build everything
pnpm build

# Build a specific package
pnpm build --filter @recurrsive/core

# Run all tests
pnpm test

# Run tests for a specific package
pnpm test --filter @recurrsive/reasoning

# Type check
pnpm typecheck

# Lint
pnpm lint

# Format code
pnpm format

# Start dev servers (all apps)
pnpm dev
```

## Package Dependency Graph

```
core
 ├─> graph
 ├─> collectors
 ├─> parsers
 ├─> analyzers
 ├─> reasoning
 ├─> opportunities
 ├─> policy
 └─> presentation

graph ──> collectors, analyzers, server, mcp
```

All packages depend on `core` for shared types.

## Graph Backend

Recurrsive supports two graph backends:

1. **SQLite** (default, zero-config) — Stores entities and relationships in a local SQLite database with recursive CTEs for graph traversal. Perfect for development and single-project use.

2. **PostgreSQL + Apache AGE** — Full Cypher graph database for production. Requires Docker or a managed PostgreSQL instance with the AGE extension.

Set the backend via environment variable:
```bash
GRAPH_PROVIDER=sqlite           # Default
GRAPH_PROVIDER=postgresql_age   # Production
DATABASE_URL=postgresql://...   # Required for AGE
```

## LLM Configuration

The reasoning engine requires an LLM provider for the debate protocol and synthesis:

```bash
RECURRSIVE_LLM_PROVIDER=openai      # or: anthropic, ollama, google, etc.
RECURRSIVE_LLM_MODEL=gpt-4.1-mini   # Model name
RECURRSIVE_LLM_API_KEY=sk-...       # API key
```

Supported providers: OpenAI, Anthropic (native), Azure, Ollama, vLLM, LiteLLM, OpenRouter, Google Gemini.

## Adding a New Analyzer

1. Create a directory under `packages/analyzers/src/`:
   ```
   packages/analyzers/src/my-analyzer/
   ├── analyzer.ts
   └── index.ts
   ```

2. Extend the `BaseAnalyzer` class:
   ```typescript
   import { BaseAnalyzer } from '../base/index.js';
   
   export class MyAnalyzer extends BaseAnalyzer {
     readonly id = 'my_analyzer';
     readonly name = 'My Analyzer';
     readonly description = 'Analyzes something specific';
     readonly categories = ['architecture'] as const;
   
     async analyze(context) {
       // Implementation
       return [];
     }
   }
   ```

3. Register in `packages/analyzers/src/create-defaults.ts`

4. Export from `packages/analyzers/src/index.ts`

## Adding a New Collector

1. Create a directory under `packages/collectors/src/`:
   ```
   packages/collectors/src/my-collector/
   ├── collector.ts
   └── index.ts
   ```

2. Implement the `Collector` interface from `@recurrsive/core`

3. Register with the `CollectorRegistry`

## Testing

Tests use **Vitest** with the following patterns:
- Unit tests: `src/__tests__/*.test.ts`
- Integration tests: `src/__tests__/integration/*.test.ts`
- **Expected**: 2,203+ tests passing across all 13 packages (9 core + 4 apps)

```bash
# Run with coverage
pnpm test -- --coverage

# Run in watch mode
pnpm test -- --watch

# Run a specific test file
pnpm test -- src/__tests__/engine.test.ts
```

## Docker Development

```bash
# Start PostgreSQL + API server
docker compose -f docker/docker-compose.yml up --build

# Start everything including dashboard
docker compose -f docker/docker-compose.yml up --build

# Development mode (with hot reload)
docker compose -f docker/docker-compose.dev.yml up --build
```

## Code Style

- **TypeScript** with strict mode
- **ESLint** for linting
- **Prettier** for formatting
- **JSDoc** comments on all public APIs
- **Conventional Commits** for git messages

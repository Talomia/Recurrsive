# Contributing to Recurrsive

Thank you for your interest in contributing to Recurrsive! This guide will help you get started with the Engineering Intelligence Platform.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Structure](#project-structure)
- [Architecture Overview](#architecture-overview)
- [Code Style](#code-style)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)

---

## Getting Started

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | ≥ 20.0.0 | Required for ESM support |
| **pnpm** | ≥ 9.0.0 | Workspace-aware package manager |
| **Git** | ≥ 2.30 | For the Git collector |
| **Docker** | (optional) | For PostgreSQL + Apache AGE |

### Setup

```bash
# Clone the repository
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive

# Enable corepack for pnpm (if not already installed)
corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies
pnpm install

# Build all packages (respects Turborepo dependency graph)
pnpm build

# Run all tests
pnpm test

# Type-check the entire monorepo
pnpm typecheck
```

### Environment Variables (Optional)

```bash
# Graph backend (default: sqlite)
GRAPH_PROVIDER=sqlite

# LLM for the reasoning engine
RECURRSIVE_LLM_PROVIDER=openai
RECURRSIVE_LLM_MODEL=gpt-4.1-mini
RECURRSIVE_LLM_API_KEY=sk-...

# PostgreSQL (if using Apache AGE)
DATABASE_URL=postgresql://user:pass@localhost:5432/recurrsive
```

---

## Development Workflow

### Daily Development

```bash
# Install dependencies (after pulling new changes)
pnpm install

# Build all packages
pnpm build

# Build a specific package
pnpm build --filter @recurrsive/core

# Run all tests
pnpm test

# Run tests for a specific package
pnpm test --filter @recurrsive/analyzers

# Type check everything
pnpm typecheck

# Watch mode — rebuild on changes
pnpm dev

# Start the API server in dev mode
pnpm dev --filter @recurrsive/server

# Start the dashboard in dev mode
pnpm dev --filter @recurrsive/dashboard

# Format code
pnpm format

# Lint
pnpm lint
```

### Build Order

Turborepo handles build ordering automatically. The dependency graph is:

```
core → graph → collectors → parsers → analyzers → reasoning
                                          ↓
                               opportunities → policy → presentation
                                          ↓
                               cli / server / mcp / dashboard
```

Always build from the root with `pnpm build` — Turborepo will parallelize and cache correctly.

---

## Project Structure

```
Recurrsive/
├── packages/                    # Core libraries (9 packages)
│   ├── core/                    # Type system — 43 entity types, 43 relationship types,
│   │                            #   Zod schemas, structured logger, 7 error classes
│   ├── graph/                   # Knowledge graph — dual-backend (SQLite + Apache AGE)
│   ├── collectors/              # Data ingestion — 14 collectors with PII detection
│   │                            #   (Git, Docs, Environment, CICD, Database, GitHub, GitLab, OpenTelemetry, CloudCost, ErrorTracking, APM, Langfuse, Arize, Helicone)
│   ├── parsers/                 # Code analysis — Tree-sitter + AI pattern detection
│   ├── analyzers/               # 12 built-in analyzers, 50+ rules
│   ├── reasoning/               # Multi-agent reasoning — 19 specialists, debate protocol
│   ├── opportunities/           # Opportunity lifecycle — SARIF export, roadmap generation
│   ├── policy/                  # Policy engine — 5 built-in policy sets (16 rules)
│   └── presentation/            # Reports — Markdown, HTML, JSON, SARIF + notifications
├── apps/                        # Applications (5 apps)
│   ├── cli/                     # Commander.js CLI — 29 commands
│   ├── server/                  # Fastify REST API — 160+ endpoints + WebSocket + GraphQL
│   ├── mcp/                     # MCP server — 42 tools, 16 resources, 21 prompts
│   ├── dashboard/               # Next.js dashboard — 45 pages
│   └── website/                 # Marketing website — 21 pages + SEO
├── docker/                      # Dockerfiles + docker-compose (4 services)
├── docs/                        # Documentation
│   ├── PRD.md                   # Product Requirements
│   ├── ARCHITECTURE.md          # Technical Architecture
│   ├── STRATEGY.md              # Product Strategy & Business Model
│   ├── ROADMAP.md               # Phased Roadmap
│   ├── API.md                   # API Reference (REST, MCP, CLI)
│   ├── DEVELOPMENT.md           # Developer Setup Guide
│   └── GETTING_STARTED.md       # Step-by-step tutorial
├── examples/                    # Configuration examples (basic, AI, enterprise, CI)
├── turbo.json                   # Turborepo build orchestration
├── CHANGELOG.md                 # Version history
└── CONTRIBUTING.md              # ← You are here
```

### Package Overview

| Package | Purpose | Key Exports |
|---------|---------|-------------|
| `@recurrsive/core` | Foundation types and utilities | `Entity`, `Relationship`, schemas, logger |
| `@recurrsive/graph` | Knowledge graph engine | `createGraphClient`, `SqliteGraphClient` |
| `@recurrsive/collectors` | Data ingestion | `GitCollector`, `DocumentationCollector`, etc. |
| `@recurrsive/parsers` | Code parsing | `ParsingPipeline`, `TypeScriptExtractor` |
| `@recurrsive/analyzers` | Analysis rules | `AnalyzerRegistry`, `AnalyzerRunner` |
| `@recurrsive/reasoning` | AI reasoning | `ReasoningEngine`, specialists |
| `@recurrsive/opportunities` | Lifecycle management | `OpportunityManager`, SARIF export |
| `@recurrsive/policy` | Governance rules | `PolicyEngine`, built-in policy sets |
| `@recurrsive/presentation` | Reports and output | Report generators, terminal formatter |

---

## Architecture Overview

Recurrsive follows a four-phase pipeline where the LLM is **never the source of truth** — it reasons only over structured evidence in the knowledge graph.

```
   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
   │   COLLECT     │────▶│  UNDERSTAND   │────▶│    REASON     │────▶│    EVOLVE     │
   │              │     │              │     │              │     │              │
   │ 14 Collectors│     │ Graph Engine │     │ 19 Specialists│     │ CLI · Server │
   │ Governance   │     │ 12 Analyzers │     │ Debate Proto. │     │ MCP · Dash   │
   │ PII Detection│     │ 50+ Rules    │     │ Judge · Memory│     │ Reports      │
   └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
```

**Key Design Principles:**
1. **Evidence-first** — Every recommendation traces back to graph entities
2. **No `eval()`** — Policy expressions use a recursive descent parser
3. **Dual graph backends** — SQLite for dev, PostgreSQL + Apache AGE for production
4. **Zero external runtime deps** for core analysis — YAML, rate limiter, validation all built in-house

---

## Code Style

### TypeScript

- **Strict mode** — All packages use `strict: true` in `tsconfig.json`
- **ESM modules** — All packages use `"type": "module"` with `.js` extensions in imports
- **No `any`** — Use `unknown` and narrow with type guards
- **No unused variables** — `noUnusedLocals: true`, `noUnusedParameters: true`

### JSDoc

All exported functions, classes, interfaces, and type aliases **must** have JSDoc comments:

```typescript
/**
 * Run the analysis pipeline on a project directory.
 *
 * @param projectPath - Absolute path to the project root.
 * @param options - Analysis configuration options.
 * @returns The analysis results with findings and opportunities.
 * @throws {ProjectNotFoundError} If the path does not exist.
 */
export async function analyze(
  projectPath: string,
  options: AnalysisOptions,
): Promise<AnalysisResult> {
  // ...
}
```

### Module Pattern

- Source files use named exports
- Each package has a barrel `index.ts` that re-exports public API
- Internal utilities stay unexported
- Use `@packageDocumentation` in the top-level module JSDoc

### Formatting

- **Prettier** for auto-formatting
- **ESLint** for linting
- **Conventional Commits** for git messages (`feat:`, `fix:`, `docs:`, etc.)

---

## Testing Requirements

### All tests must pass before submitting a PR

```bash
# Run the full test suite
pnpm test

# Run with coverage report
pnpm test -- --coverage

# Run tests in watch mode during development
pnpm test -- --watch

# Run a single test file
pnpm test -- src/__tests__/engine.test.ts
```

### Test Conventions

- **Framework**: Vitest
- **Location**: `src/__tests__/*.test.ts` (unit), `src/__tests__/integration/*.test.ts` (integration)
- **Mocking**: Use `vi.mock()` for external dependencies
- **Coverage target**: ≥ 80% per package
- **No flaky tests**: Tests must be deterministic — no `Math.random()`, no real network calls

### Writing Good Tests

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('MyAnalyzer', () => {
  it('should detect circular dependencies', async () => {
    // Arrange
    const graph = createMockGraph();

    // Act
    const findings = await analyzer.analyze(context);

    // Assert
    expect(findings).toHaveLength(1);
    expect(findings[0]!.severity).toBe('high');
  });
});
```

---

## Pull Request Process

### Before Submitting

1. **Fork** the repository and create a branch from `main`
   - `feature/your-feature` for new features
   - `fix/your-fix` for bug fixes
   - `docs/your-update` for documentation
2. **Make changes** following the code style guidelines
3. **Add tests** for all new functionality
4. **Run the full check suite**:
   ```bash
   pnpm typecheck && pnpm test && pnpm build
   ```
5. **Update documentation** if you changed public APIs

### PR Checklist

- [ ] Code compiles: `pnpm typecheck`
- [ ] All tests pass: `pnpm test`
- [ ] Build succeeds: `pnpm build`
- [ ] JSDoc comments added for new exports
- [ ] No new `any` types introduced
- [ ] No `TODO` or `FIXME` comments left in
- [ ] CHANGELOG.md updated (for user-facing changes)
- [ ] Tests added for new code paths

### Review Process

1. Open a PR with a clear title and description
2. Maintainers will review within 48 hours
3. Address review feedback with additional commits
4. Once approved, a maintainer will merge

### Adding New Analyzers

1. Create `packages/analyzers/src/your-analyzer/analyzer.ts`
2. Extend `BaseAnalyzer` and implement `analyze()`
3. Register in `packages/analyzers/src/create-defaults.ts`
4. Export from `packages/analyzers/src/index.ts`
5. Write comprehensive tests in `packages/analyzers/src/__tests__/`

### Adding New Collectors

1. Create `packages/collectors/src/your-collector/collector.ts`
2. Implement the `Collector` interface from `@recurrsive/core`
3. Support `DataGovernance` configuration for PII and field masking
4. Register in all three pipelines (CLI, Server, MCP)
5. Write tests

### Adding New Server Routes

1. Create `apps/server/src/routes/your-route.ts`
2. Follow the pattern in existing route files (JSDoc, Fastify handler)
3. Register in `apps/server/src/routes/index.ts`
4. Add tests in `apps/server/src/__tests__/`
5. Update `docs/API.md` with the new endpoints

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache-2.0 License](LICENSE).

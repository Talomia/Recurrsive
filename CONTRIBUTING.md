# Contributing to Recurrsive

Thank you for your interest in contributing to Recurrsive! This guide will help you get started.

## Development Setup

### Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0
- **Git**

### Getting Started

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

# Type checking
pnpm typecheck
```

### Development Workflow

```bash
# Watch mode (rebuilds on changes)
pnpm dev

# Run tests for a specific package
cd packages/core
pnpm test

# Typecheck a specific package
cd packages/analyzers
pnpm typecheck
```

## Project Structure

```
recurrsive/
├── packages/           # Core libraries
│   ├── core/           # Type system, schemas, utilities
│   ├── graph/          # Knowledge graph engine
│   ├── collectors/     # Data ingestion
│   ├── parsers/        # Code analysis
│   ├── analyzers/      # Built-in analyzers
│   ├── reasoning/      # Multi-agent reasoning
│   ├── opportunities/  # Opportunity lifecycle
│   ├── policy/         # Policy engine
│   └── presentation/   # Reports and output
├── apps/               # Applications
│   ├── cli/            # CLI interface
│   ├── mcp/            # MCP server
│   └── server/         # REST API
├── docker/             # Docker configuration
├── docs/               # Documentation
└── examples/           # Example configurations
```

## Package Dependencies

Packages follow a strict dependency hierarchy:

```
core ─┬─→ graph ─┬─→ collectors → parsers
      │          └─→ analyzers
      ├─→ reasoning (depends on: core, graph)
      ├─→ opportunities (depends on: core)
      ├─→ policy (depends on: core)
      └─→ presentation (depends on: core, opportunities)
```

When modifying a package, ensure you don't introduce circular dependencies.

## Writing Code

### Style Guidelines

- **TypeScript strict mode** — All code must compile with `strict: true`
- **No unused variables** — `noUnusedLocals: true` and `noUnusedParameters: true`
- **JSDoc comments** — All exported functions, classes, and interfaces must have JSDoc
- **Module exports** — Use `export` in source files, barrel exports in `index.ts`
- **Error handling** — Use the error classes from `@recurrsive/core`

### Adding an Analyzer

1. Create a new directory under `packages/analyzers/src/your-analyzer/`
2. Implement the `Analyzer` interface from `@recurrsive/core`
3. Create an `index.ts` barrel export
4. Register in `packages/analyzers/src/create-defaults.ts`
5. Add to the main barrel export in `packages/analyzers/src/index.ts`
6. Write tests in `packages/analyzers/src/__tests__/`

### Adding a Collector

1. Create a new directory under `packages/collectors/src/your-collector/`
2. Implement the `Collector` interface from `@recurrsive/core`
3. Support the `DataGovernance` configuration
4. Write tests

## Testing

### Writing Tests

- Use **Vitest** for all tests
- Place tests in `src/__tests__/` directories
- Name test files `*.test.ts`
- Mock external dependencies with `vi.mock()`
- Aim for ≥80% coverage

### Running Tests

```bash
# All tests
pnpm test

# Single package
cd packages/core && pnpm test

# Watch mode
cd packages/core && npx vitest --watch

# With coverage
cd packages/core && npx vitest --coverage
```

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** from `main` (`feature/your-feature` or `fix/your-fix`)
3. **Make changes** following the style guidelines
4. **Add tests** for new functionality
5. **Ensure CI passes** — `pnpm typecheck && pnpm test`
6. **Submit a PR** with a clear description

### PR Checklist

- [ ] Code compiles with `pnpm typecheck`
- [ ] Tests pass with `pnpm test`
- [ ] JSDoc comments added for new exports
- [ ] No new `any` types
- [ ] No `TODO` or `FIXME` comments
- [ ] Changelog entry (for user-facing changes)

## License

By contributing, you agree that your contributions will be licensed under the [Apache-2.0 License](LICENSE).

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-06-29

### Added

#### Core Platform
- **`@recurrsive/core`** — Foundation type system with 43 entity types, 40 relationship types, Zod schemas, structured logger, and 7 error classes
- **`@recurrsive/graph`** — Dual-backend knowledge graph engine (PostgreSQL + Apache AGE for production, SQLite for local use) with 8 query builders
- **`@recurrsive/collectors`** — Data collection framework with Git and Documentation collectors, PII detection, field masking, and governance audit logging
- **`@recurrsive/parsers`** — Multi-language code analysis with Tree-sitter support, TypeScript and Python extractors, and AI Pattern Detector (13 pattern types)

#### Analysis & Reasoning
- **`@recurrsive/analyzers`** — 10 built-in analyzers (Architecture, AI, Performance, Cost, Reliability, Security, Data, Documentation, UX, Product) with 66+ analysis rules
- **`@recurrsive/reasoning`** — Multi-agent reasoning engine with 8 specialist agents, debate protocol, synthesizer, judge, and file-based memory store
- **`@recurrsive/opportunities`** — Complete opportunity lifecycle management with SARIF v2.1.0 export, markdown reports, and roadmap generation

#### Governance & Output
- **`@recurrsive/policy`** — Policy evaluation engine with recursive descent expression parser (no `eval()`) and 5 built-in policy sets (15 rules)
- **`@recurrsive/presentation`** — Markdown and HTML report generation, console and webhook notifications, terminal formatter with progress bars

#### Applications
- **`apps/cli`** — Commander.js CLI with 6 commands: `init`, `analyze`, `opportunities`, `graph`, `timeline`, `health`
- **`apps/mcp`** — MCP server with 5 tools, 4 resources, and 3 prompts for AI assistant integration
- **`apps/server`** — Fastify REST API with 16 endpoints plus WebSocket for real-time analysis updates

#### Infrastructure
- Monorepo setup with pnpm workspaces and Turborepo
- Multi-stage Docker build with Apache AGE PostgreSQL
- GitHub Actions CI pipeline (typecheck, test, build, Docker)
- Comprehensive documentation (PRD: 2,096 lines, Architecture: 2,304 lines)
- 1,095+ unit tests across all packages

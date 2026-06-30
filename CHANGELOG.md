# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-06-30

### Added

#### New Collectors
- **Environment Collector** — Docker, Docker Compose, and Kubernetes infrastructure discovery. Parses Dockerfiles (base images, multi-stage, ports), Compose files (services, dependencies, networks), and K8s manifests (deployments, configmaps, replicas).
- **CI/CD Collector** — GitHub Actions workflow and GitLab CI pipeline discovery. Parses workflow triggers, jobs, steps, and job dependency chains (`needs`).

#### Testing
- **Server API integration tests** — 19 new route tests covering analysis status, timeline, findings, reports, opportunities, and CORS endpoints (36 total).
- **Environment Collector tests** — Dockerfile, Docker Compose, Kubernetes manifest parsing, validation, and metadata (7 tests).
- **CI/CD Collector tests** — GitHub Actions parsing, GitLab CI detection, validation, and metadata (7 tests).

### Fixed
- Dashboard API client: corrected analysis status endpoint path (`/api/v1/analysis/status` not `/api/v1/analyze`) and added proper response unwrapping from `data` wrapper.
- Server route tests: fixed endpoint paths, response shapes, and pre-initialization status codes to match actual behavior.
- **ARCHITECTURE.md reconciliation** — Fixed 8 discrepancies between documentation and code:
  - Collector interface: actual `collect() → Promise<CollectorResult>` not `AsyncIterable<CollectedArtifact>`
  - Severity levels: 5-level (`info|low|medium|high|critical`) not 4-level
  - Analyzer interface: `categories: OpportunityCategory[]` not `category: AnalyzerCategory`
  - Specialist count: 19 not 12
  - Built-in analyzers: 10 not 14
  - BullMQ: marked as Phase 2 (current impl uses direct async)

## [0.1.0] - 2026-06-29

### Added

#### Core Platform
- **`@recurrsive/core`** — Foundation type system with 43 entity types, 43 relationship types, Zod schemas, structured logger, and 7 error classes
- **`@recurrsive/graph`** — Dual-backend knowledge graph engine (PostgreSQL + Apache AGE for production, SQLite for local use) with 8 query builders
- **`@recurrsive/collectors`** — Data collection framework with 5 collectors (Git, Documentation, Environment, CI/CD, Database), PII detection, field masking, and governance audit logging
- **`@recurrsive/parsers`** — Multi-language code analysis with Tree-sitter support, TypeScript and Python extractors, and AI Pattern Detector (13 pattern types)

#### Analysis & Reasoning
- **`@recurrsive/analyzers`** — 10 built-in analyzers (Architecture, AI, Performance, Cost, Reliability, Security, Data, Documentation, UX, Product) with 66+ analysis rules
- **`@recurrsive/reasoning`** — Multi-agent reasoning engine with 19 specialist agents, debate protocol, synthesizer, judge, and file-based memory store
- **`@recurrsive/opportunities`** — Complete opportunity lifecycle management with SARIF v2.1.0 export, markdown reports, and roadmap generation

#### Governance & Output
- **`@recurrsive/policy`** — Policy evaluation engine with recursive descent expression parser (no `eval()`) and 5 built-in policy sets (15 rules)
- **`@recurrsive/presentation`** — Markdown and HTML report generation, console and webhook notifications, terminal formatter with progress bars

#### Applications
- **`apps/cli`** — Commander.js CLI with 8 commands: `init`, `analyze`, `opportunities`, `graph`, `timeline`, `health`, `report`, `config`
- **`apps/mcp`** — MCP server with 10 tools, 4 resources, and 6 prompts for AI assistant integration
- **`apps/server`** — Fastify REST API with 16 endpoints plus WebSocket for real-time analysis updates

#### Infrastructure
- Monorepo setup with pnpm workspaces and Turborepo
- Multi-stage Docker build with Apache AGE PostgreSQL
- GitHub Actions CI pipeline (typecheck, test, build, Docker)
- Comprehensive documentation (PRD: 2,096 lines, Architecture: 2,304 lines)
- 1,186 unit tests across all packages

### Changed

- **`@recurrsive/reasoning`** — Added 4 new specialist agents (Anthropic Adapter, Evolution Strategist, Integration Analyst, Dependency Auditor) bringing total to 12
- **`@recurrsive/reasoning`** — Added 7 final specialist agents (Backend, Frontend, ML, Prompt, Database, Documentation, Release Manager) completing all 19 SpecialistRoleSchema roles
- **`apps/dashboard`** — Connected all 6 pages to live server API (was 100% mock data)
  - Rewrote API client with correct paths (`/api/v1/health-score`, `/api/v1/timeline/trends`, etc.)
  - Added response transformers for server→dashboard shape conversion
  - System Map: now uses graph stats API with entity type topology
  - Reports: functional download links to `/api/v1/reports/:format` (4 formats)
  - Insights: data-driven insights from findings summary API
  - Opportunities: client-side API fetch on mount with mock fallback
  - Settings: functional React state management with localStorage persistence
- **`apps/cli`** — Added `report` and `config` commands (8 commands total)
- **`apps/mcp`** — Added 5 intelligence tools (`list_findings`, `get_entity`, `trace_dependency`, `explain_entity`, `analyze_impact`) and 3 assessment prompts (10 tools, 6 prompts total)
- **`apps/server`** — Added REST endpoints for findings and reports
- **`@recurrsive/reasoning`** — Added Anthropic adapter for Claude model support
- **Product positioning** — Repositioned from "Software Evolution Platform" to **Engineering Intelligence Platform**
- **`@recurrsive/core`** — Added `assumptions`, `tags` to OpportunitySchema and `cost_of_inaction` to RiskAssessmentSchema (trust model enhancement)

### Added

#### Dashboard
- **`apps/dashboard`** — Next.js 16 dashboard with 6 pages (Overview, Opportunities, Insights, System Map, Reports, Settings)
- 8+ shared components: Sidebar, Header, MetricCard, ScoreGauge, TrendChart, HealthChart, CategoryBadge, Loading skeleton
- Glassmorphism design system, micro-animations, responsive layout with mobile hamburger menu
- Full accessibility: skip-nav, ARIA labels, `prefers-reduced-motion`, `focus-visible`, semantic HTML
- SEO: `next/font/google`, OpenGraph metadata, viewport configuration

#### Strategy Documents
- **`docs/STRATEGY.md`** — Product positioning, trust model, business model (OSS + Enterprise + Cloud), go-to-market, competitive landscape, feasibility assessment
- **`docs/ROADMAP.md`** — Four-phase roadmap with current status and explicit deferrals

### Fixed

- SVG gradient IDs containing `#` character breaking `url()` references in TrendChart
- Stagger animation only covering 6 children (7th+ invisible) — extended to 12
- Health trend always showing green regardless of actual value
- PERF_ICONS array bounds crash with >4 metrics
- `getMockOpportunities()` defeating `useMemo` by creating new array on every render
- No null guard for empty opportunities data causing crash
- `Math.random()` in mock data causing SSR/client hydration mismatches — replaced with seeded PRNG
- Score gauge SVG ID collisions across multiple instances — fixed with `useId()`
- Zero trend incorrectly treated as positive in MetricCard
- Health chart Y-axis hardcoded to [50, 100] clipping data — now dynamic
- Relationship type count corrected from 40 to 43 across all documentation
- Race condition in `POST /api/v1/analyze` — concurrent requests could bypass the running-state guard
- Resource leak when changing project path — `dispose()` not called before re-initialization
- `NaN` limit parameter in graph entities route causing query failure
- Negative `limit`/`offset` values in findings route producing unexpected slice behavior
- API.md rewritten — 14 inaccuracies corrected (wrong MCP tool names, resource URIs, body fields, endpoint paths)
- CONTRIBUTING.md project structure missing dashboard entry
- README.md docs listing missing API.md and DEVELOPMENT.md
- Specialist role mapping comments clarified for `AIQualityEngineer`, `ReliabilityEngineer`, `DeveloperExperienceEngineer`


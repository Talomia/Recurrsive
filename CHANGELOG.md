# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.7] - 2026-07-05

### Changed

#### Complete Real Implementation — Zero Synthetic Data
All mock, synthetic, and seed data has been replaced with real implementations across the entire platform. No `Math.random()` remains in production routes.

**Server Routes:**
- **SSO/SAML**: Real base64 XML parsing, SAMLAuthnRequest generation, timestamp/issuer validation (replaces hardcoded demo users)
- **Forecasting**: `buildTimeline()` reads `state.getAnalysisHistory()` for real data; evolution events auto-generated from run history
- **Simulation**: Real analysis-based impact scoring from state; findings sourced from actual analysis cache
- **Cloud Benchmarking**: Store-backed patterns/partners; removed fake benchmark seeds
- **GraphQL**: Removed `buildSeedData()` (~160 lines) and all `SEED_DATA` fallbacks; resolvers return empty data when uninitialized
- **Scheduling**: Real cron expression parser (replaces simplified "next Monday 9am" logic); supports `*`, ranges, steps, comma-separated lists
- **CLI `simulate run`**: Now calls `POST /api/v1/simulations` via server API (was local-only with `Math.random()`)

**Collectors (9 rewritten):**
- GitHub, GitLab: Real API calls via native `fetch` with pagination and rate-limit awareness
- Langfuse, Helicone, Arize: Real API clients with credential auth
- OpenTelemetry: Local JSON file reader
- Cloud Cost: CSV/AWS API import
- Error Tracking: Sentry API client
- APM: Datadog/New Relic/Grafana API clients

#### Documentation Alignment
- **README.md**: Removed "seeds realistic initial data" language; updated test count to 3,293
- **ROADMAP.md**: Removed all "scaffolded", "synthetic", "demo data" annotations across 8 sections
- **ARCHITECTURE.md**: Updated GraphQL data source description (returns empty when uninitialized)
- **openapi.yaml**: Fixed branding to "Engineering Intelligence Platform"
- **Core README**: Fixed `contentHash()` description (DJB2, not SHA-256)
- **Auth docstrings**: Clarified demo users are disabled in production unless `ALLOW_DEMO_USERS=true`
- **SSO docstrings**: Updated from "synthetic" to real SAML parsing
- **MCP api.ts**: Removed "demo data" reference

#### Configuration
- **.env.example**: Added all collector credential env vars (GitHub, GitLab, Sentry, Datadog, New Relic, Grafana, Langfuse, Arize, Helicone, AWS, Slack), `RECURRSIVE_LLM_API_KEY`, and `RECURRSIVE_WEBHOOK_TIMEOUT_MS`
- **easypanel.json**: Fixed `GRAPH_PROVIDER=sqlite` → `postgresql_age` to match PostgreSQL `DATABASE_URL`

### Fixed
- Stale "mock data" / "demo data" comments in MCP governance resource, dashboard opportunities page, and auth module
- Stale "Scaffolded" labels in ROADMAP.md Phase 4 section header

#### Deep Audit — Seed Data Removal
All `seedIfEmpty()` functions and seed data arrays removed from server routes:
- **marketplace.ts**: Removed built-in analyzer/collector/extension seed data (~126 lines)
- **partners.ts**: Removed seed partners and certification tracks (~170 lines)
- **secrets.ts**: Removed seed secret entries (~27 lines)
- **experiments.ts**: Removed seed experiments (~112 lines)
- **sso.ts**: Removed seed Okta SSO config (~35 lines)
- **projects.ts**: Removed seed projects (~93 lines)
- **plugins.ts**: Removed seed Snyk plugin install
- **simulation.ts**: Removed seed intelligence packs

#### MCP Resources — Hardcoded Mock → Live API
Five MCP resource files rewritten from hardcoded arrays to live server API calls:
- **analytics.ts**: `apiRequest('/api/v1/analytics/summary')` + `apiRequest('/api/v1/health-score')`
- **projects.ts**: `apiGet('/api/v1/projects')` + `apiGet('/api/v1/comparisons')` + `apiRequest('/api/v1/timeline')`
- **platform.ts**: `apiRequest('/api/v1/health')` + `apiGet('/api/v1/plugins')` + `apiGet('/api/v1/multi-tenant/tenants')` + `apiGet('/api/v1/cloud/benchmarks')`
- **experiments.ts**: `apiGet('/api/v1/experiments')` with status filtering
- **governance.ts**: `apiGet('/api/v1/webhooks')`

#### Notification Senders — Mock → Real Fetch
- **SlackNotifier**: Default HTTP sender changed from no-op mock to real `fetch` API
- **HttpNotifier**: Default HTTP sender changed from no-op mock to real `fetch` API
- Tests updated to inject mock senders for isolation

#### Infrastructure
- **turbo.json**: Fixed test task outputs (removed stale `coverage/**` output)
- **docker/.env.example**: Synced with root — added CORS, API_KEY, ALLOW_DEMO_USERS, New Relic, Grafana, AWS costs, webhook timeout
- **.gitignore**: Added `*.db`/`*.sqlite`/`data/`/`tmp/` patterns; removed `.github/` exclusion to track CI/CD workflows
- **Makefile**: Added `test-mcp` and `test-cli` targets; updated release version example
- **sso.ts**: Fixed `@module` path (was `middleware/sso`, now `routes/sso`)
- **secrets.ts**: Fixed typo ("usenstration" → real description)
- **OpenAPI spec**: Added note that static spec is a subset of auto-generated spec at `/api/v1/openapi.json`

### Tests
- All tests passing across 14 packages — 14/14 build successful
- 15 server tests updated to not rely on seed data
- 2 MCP tests updated with API mocks for new `apiGet`/`apiRequest` calls
- 2 presentation tests updated for real fetch-based senders

### Added

#### OSS ↔ Ecosystem Tier Separation
Clear runtime boundary between the downloadable OSS platform and the ecosystem services (website, marketplace, cloud, partners).

**Server Routes:**
- **Tier-gated registration**: `ENABLE_ENTERPRISE` env var gates SSO, multi-tenant, secrets, data masking routes. `ENABLE_ECOSYSTEM` gates cloud, marketplace, partner routes. Default: both enabled.
- **Intelligence packs extraction**: Moved 4 endpoints from `simulation.ts` to new `intelligence-packs.ts` route file
- **Cloud/partner deduplication**: Removed duplicate `/api/v1/cloud/partners/*` routes from `cloud.ts` (use `/api/v1/partners/*` instead)
- **Plugin catalog migration**: 10 hardcoded marketplace entries moved to store-backed seeding at startup (only when store is empty)

**Dashboard:**
- **Sidebar grouping**: 32 flat nav items reorganized into 7 labelled sections (Intelligence, Analysis, Operations, Integrations, Administration, Enterprise, Cloud) with tier badges
- **Marketplace page**: New dashboard page for browsing extensions, categories, and stats (wired to marketplace API)
- **Partners page**: New dashboard page for partner directory, certifications, and stats (wired to partners API)

**Documentation:**
- **STRATEGY.md**: New "Runtime Tier Boundaries" section with codebase boundary map and env var table
- **ARCHITECTURE.md**: Added `ENABLE_ENTERPRISE`, `ENABLE_ECOSYSTEM`, `ALLOW_DEMO_USERS` to env var appendix; ADR-009 for tier-gated registration
- **ROADMAP.md**: Added "Tier Separation (v0.5.7)" subsection with 8 completed items

---

## [0.5.6] - 2026-07-04

### Added

#### Missing Dashboard Endpoints
- `GET /api/v1/findings/page` — returns real findings mapped to dashboard FindingsPageItem shape with severity stats
- `GET /api/v1/health/dashboard` — returns real health score, process memory/CPU, uptime, and service statuses
- Export route now uses real analysis data instead of hardcoded mock findings

#### Server State Hardening
- `dispose()` now resets `_analysisStatus` to idle and clears `_evolutionTimeline`
- Analysis history capped at 100 entries to prevent unbounded growth
- Collector disposal moved to `finally` block — always cleaned up even on error
- `markAnalysisError()` method for proper status reset on pre-analysis failures

#### Production Hardening
- CORS origin configurable via `CORS_ORIGIN` env var (comma-separated allowlist)
- Added `CORS_ORIGIN` and `JWT_SECRET` to `.env.example` with documentation

#### Git URL Analysis Support
- `POST /api/v1/analyze` now accepts `gitUrl` to clone and analyze remote repositories
- `ServerState.cloneRepo()` — shallow clone (depth=50) with 120s timeout to `/tmp/recurrsive-repos/`
- `ServerState.cleanupClone()` — automatic cleanup after analysis completes
- `Dockerfile` updated: `git` installed in runtime stage, `/tmp/recurrsive-repos/` created for non-root user
- Tested successfully against WordPress (4,532 entities), Directus (4,230 entities), and Recurrsive (292 entities)

#### Deep Codebase Review
- Added `repository` field to all 14 `package.json` files (9 packages + 5 apps)
- Updated route `index.ts` JSDoc to list all 34 route groups (was 21)

### Fixed

#### Graph Provider Bug Fixes
- **`null` vs `undefined` in AGE provider** — `entityToAgeProps()` used strict `!== null` for optional fields that produce `undefined` via Zod. Changed to loose `!= null` to prevent `"undefined"` strings being persisted (age.ts L221, L224)
- **`null` vs `undefined` in SQLite provider** — Same fix for `source_location` serialization (sqlite.ts L417)
- **`query()` named params in SQLite** — Was using `Object.values()` for positional binding (order-dependent). Now properly converts to SQLite `$`-prefixed named parameters
- **Relationship upsert resilience** — FK constraint violations during analysis now logged as warnings instead of crashing the entire pipeline. Enables analysis of large repos (3,000+ files)

#### Parser Pipeline Resilience
- Wrapped `parseFile()` in try-catch within `parseProject()` loop. A single file parse failure no longer crashes the entire project parse — logs a warning and continues to the next file
- Parser relationship upserts now have try-catch (matching collector pattern)

### Security

#### Critical Vulnerability Fixes
- **Command injection via `gitUrl`** — replaced `exec()` shell string interpolation with `execFile()` array arguments. Added URL validation: only HTTP(S) URLs allowed, control characters rejected
- **Path traversal via `path` param** — added allowlist validation. Only `/app`, `/tmp/recurrsive-repos/`, and `/home/` prefixes permitted. Returns 403 for disallowed paths
- **TOCTOU race condition** — moved `markAnalysisStarting()` before `cloneRepo()` to prevent concurrent analysis launches. Added `markAnalysisError()` for proper status reset
- **Demo credentials in production** — disabled unless `ALLOW_DEMO_USERS=true`. Prevents trivial `admin/admin` login on production deployments
- **JWT secret production warning** — logs CRITICAL error when using insecure default in production. Added `JWT_SECRET` to `.env.example`

#### Documentation Alignment
- Added missing `license` and `private` fields to `apps/server/package.json`
- All package.json files now include `repository` pointing to GitHub monorepo

## [0.5.5] - 2026-07-03

### Added

#### EasyPanel Deployment
- `easypanel.json` — Create from Schema config for one-click EasyPanel deploy
- `.dockerignore` — Reduces Docker build context from ~3.4MB to ~1MB
- EasyPanel section in `DEPLOYMENT.md` with step-by-step instructions
- Database connection retry with exponential backoff in `state.ts` (5 retries: 1s–16s)
- Warning log when `GRAPH_PROVIDER=postgresql_age` but `DATABASE_URL` missing

#### Missing App READMEs
- `apps/cli/README.md` — 25 CLI commands with usage examples
- `apps/mcp/README.md` — 42 tools, 21 prompts, 16 resources
- `apps/server/README.md` — 150 REST endpoints, WebSocket, Swagger UI
- `apps/website/README.md` — 23 pages, SEO, Next.js 16 standalone

### Fixed

#### Documentation Alignment (30+ discrepancies resolved)
- **README.md**: Updated tree diagram to list all 10 docs/ files (was missing 3), added Deployment Guide and Plugin SDK to docs table, removed stale route comment
- **Website deployment page**: Removed non-existent Redis and JWT_SECRET references, fixed `GRAPH_PROVIDER` value (`age` → `postgresql_age`), fixed dashboard port (3001 → 3100), fixed env var name (`API_URL` → `NEXT_PUBLIC_API_URL`), updated docker-compose snippet to match actual 4-service config
- **Website docs pages**: Updated endpoint count from 138 to 150 across 9 occurrences (getting-started, api-reference, architecture, docs index)
- **openapi.yaml**: Fixed version (0.1.0 → 0.5.4) and license (MIT → Apache-2.0)
- **packages/core/README.md**: Fixed relationship type count (40 → 43)
- **packages/parsers/README.md**: Added missing `GoExtractor` to extractor table
- **packages/presentation/README.md**: Added missing JSON and SARIF report formats, Slack and HTTP notification channels
- **packages/policy/README.md**: Fixed `getBuiltinPolicySets` → `getBuiltinPolicySet` (singular)
- **packages/reasoning/src/index.ts**: Fixed stale JSDoc "Eight" → "Nineteen" specialist agents
- **Dashboard WebSocket**: Derived URL from `NEXT_PUBLIC_API_URL` instead of hardcoding `ws://localhost:3000/ws`
- **docker-compose.yml**: Passed `NEXT_PUBLIC_API_URL` as build arg (Next.js bakes at build time)
- **OpenAPI route**: Made server URL dynamic based on `PORT` env var
- **dashboard/website package.json**: Added missing `description` and `license` fields

## [0.5.4] - 2026-07-02

### Added

#### GraphQL Live Data
- Wired all 7 GraphQL resolvers to read from `state.getAnalysisCache()` when analysis data is available
- Resolvers fall back to built-in demo data when no analysis has been run
- Projects resolver extracts unique project references from analysis findings
- Analyzers resolver reads from `analyzers_run` in the analysis result
- Health score resolver reads live dimensions from the analysis cache

#### CLI Registration
- Registered all 25 CLI commands in `commands/index.ts` (was only 12)
- Added barrel exports for: analytics, audit, batch, cloud, comparisons, experiments, export, forecasting, notifications, plugins, projects, secrets, simulation

#### SEO Metadata
- Homepage (`/`): Added title, description, OpenGraph, and Twitter Card metadata
- Added `layout.tsx` with metadata for client-component pages: contact, marketplace, cloud/dashboard

#### Server Route → State Wiring
- `analytics.ts`: Summary and top-categories routes now read from `state.getAnalysisCache()` when live data exists
- `search.ts`: Search route now queries live findings and opportunities from analysis cache
- `health.ts`: Version now imported from `@recurrsive/core` VERSION constant

### Fixed

#### Security
- **SQL injection in `graph.ts`** (CRITICAL): Replaced raw SQL string interpolation in graph search endpoint with safe `getStats()` + `getEntities()` based filtering

#### Dashboard
- Confidence page KPI row now renders from API data (`getConfidenceData()`) instead of hardcoded inline constants
- Brier score, total predictions, correct rate, and analyzer count all derived from live API response
- `apiFetch` now logs `console.warn()` in development when using fallback (mock) data

#### Documentation
- **ROADMAP.md**: Updated test count to 140 files / 3,395 tests
- **ARCHITECTURE.md**: Updated GraphQL schema to match actual implementation (flat schema, not aspirational Connection types)
- **DEVELOPMENT.md**, **README.md**: Updated test count references to 3,395

#### Version Consistency
- Core `VERSION` constant: 0.4.0 → 0.5.4
- `SDK_VERSION`: 0.1.0 → 0.5.4
- `SNAPSHOT_VERSION`: 0.2.0 → 0.5.4
- Server snapshot route version: 0.2.0 → 0.5.4
- Updated all test assertions for version changes

## [0.5.3] - 2026-07-02

### Added

#### Website Test Suite
- 69 new tests across 7 test files (Navbar, Footer, Landing, Pricing, Product, Sitemap, Robots)
- Vitest + React Testing Library infrastructure for `@recurrsive/website`
- SEO tests: sitemap validates all 23 routes, robots validates disallow patterns

#### CI/CD Improvements
- Website build verification in CI pipeline
- Docker build for all 3 images (server, dashboard, website) in CI
- Website Docker image build/push in release workflow
- Updated CI summary stats (14 packages, 150 endpoints, 504+ tests)

### Fixed

#### Documentation Alignment (18 discrepancies resolved)
- **ARCHITECTURE.md**: 16 fixes including Docker compose rewrite, RBAC correction (4→3 roles), infrastructure diagram cleanup (removed non-existent Redis/S3/SMTP), dependency table fixes (removed Drizzle/BullMQ/graphql-yoga), and 40-route dashboard table
- **DEPLOYMENT.md**: Added website service (port 3200), updated to 4-service docker-compose
- **DEVELOPMENT.md**: Added website dev section, updated project structure
- **GETTING_STARTED.md**: Added Swagger UI, website port, updated stats
- **API.md**: Added OpenAPI, Marketplace, Partner endpoint documentation
- **STRATEGY.md**: Fixed analyzer rule count (66+ → 89+)

### Stats
- Total automated tests: 573 (423 server + 81 dashboard + 69 website)
- Build: 14/14 packages passing
- Documentation: 8 files updated, all 18 audit discrepancies resolved

## [0.5.2] - 2026-07-02

### Added

#### OpenAPI 3.1 Specification
- `GET /api/v1/openapi.json` — Full OpenAPI 3.1 spec (27 tags, 17+ documented paths, 4 schemas)
- `GET /api/docs` — Swagger UI documentation page
- 3 new route tests for OpenAPI endpoints

#### Website SEO & Polish
- `sitemap.ts` — 23 routes with priorities and change frequencies
- `robots.ts` — Search engine directives (allow all, disallow /api/)
- `not-found.tsx` — Beautiful 404 page with gradient + glow effects
- `loading.tsx` — Pulsing logo loading state
- `error.tsx` — Error boundary with retry + home buttons

#### Dashboard Marketplace & Partner API Wiring
- `platform.ts` — 6 new API functions (marketplace extensions/stats/categories, partners/certs/stats)
- `intelligence-packs/page.tsx` — Wired to marketplace API with metadata (stars, downloads, verified badge)
- `plugins/page.tsx` — Wired to marketplace API with deduplication

### Changed

#### Navigation Enhancement
- Navbar: Expanded to 5 dropdown menus (Product, Pricing, Partners, Docs, Community) with 17+ quick-access links
- Footer: Updated to 4 columns (Product, Resources, Partners, Company) with 25+ links to all sub-pages

#### Dashboard API Completion
- `reports/page.tsx` — Replaced inline `fetch()` with centralized `getReportsAnalysisHistory()`
- `opportunities/page.tsx` — Replaced `getMockOpportunities()` with `getOpportunities()`

#### Documentation Updates
- Updated STRATEGY.md feasibility table with website/marketplace/cloud/partner achievements
- Updated ROADMAP.md to v0.5.2 current state
- Updated README: 150 endpoints

### Stats
- REST endpoints: 150 (was 148)
- Server tests: 423 (was 420, +3 OpenAPI)
- Dashboard tests: 81 (unchanged)
- Total: 504 automated tests
- Website pages: 23 (unchanged) + 5 utility pages (sitemap, robots, 404, loading, error)

## [0.5.1] - 2026-07-02

### Added

#### Server Routes
- **Marketplace API** — 5 new endpoints: list/search/filter extensions, submit extension, categories, stats (`/api/v1/marketplace/*`)
- **Partner API** — 5 new endpoints: list/filter partners, partner detail, apply, certifications, stats (`/api/v1/partners/*`)
- Seeded with 27 built-in + 6 community marketplace extensions
- Seeded with 8 partners and 3 certification tracks

#### Website Sub-Pages (12 new pages → 23 total)
- `/docs/getting-started` — 5-minute quickstart guide with code blocks
- `/docs/api-reference` — 148 REST endpoints documentation
- `/docs/cli-reference` — 25 CLI commands reference
- `/docs/plugin-sdk` — Custom analyzer and collector development guide
- `/docs/deployment` — Docker, Kubernetes, and cloud deployment guides
- `/docs/architecture` — System design and pipeline overview
- `/cloud/dashboard` — Mock cloud management console
- `/cloud/billing` — Billing, usage breakdown, and invoice history
- `/partners/directory` — 8-partner directory with tier filtering
- `/partners/apply` — Partner application form
- `/partners/certification` — 3 certification tracks (Analyst, Architect, Administrator)
- `/marketplace/submit` — Extension submission form with guidelines

#### Tests
- 20 new route tests (10 marketplace + 10 partner)
- Total: 420 server tests + 81 dashboard tests = 501 automated tests

### Changed
- Updated README: 148 endpoints, 23 website pages, 3,000+ tests
- Bumped version to 0.5.1

## [0.5.0] - 2026-07-02

### Added

#### Marketing Website (`apps/website`)
- **11 pages**: Landing, Product, Pricing, Marketplace, Cloud, Partners, Docs, About, Blog, Contact, Changelog
- **Design system**: Dark theme with glassmorphism, gradient accents, micro-animations, and responsive layout
- **Shared components**: Navbar with dropdown menus, Footer with multi-column links
- **SEO**: Proper meta tags, Open Graph, semantic HTML, descriptive titles

#### Marketplace (`/marketplace`)
- Browse page with filter tabs (All, Analyzers, Collectors, Policies, Intelligence Packs)
- 16+ extension cards including 13 built-in analyzers and 3 community extensions
- Extension detail cards with download counts, ratings, and install status

#### Managed Cloud (`/cloud`)
- Cloud product page with benefits grid (6 managed features)
- Three pricing tiers: Starter ($199/mo), Growth ($599/mo), Enterprise (custom)
- Region availability and feature comparison vs self-hosted

#### Partner Portal (`/partners`)
- Partner program overview with Platinum/Gold/Silver tiers
- Partner directory with 5 certified partner cards
- Certification tracks: Analyst, Architect, Administrator

#### Documentation Hub (`/docs`)
- Documentation landing page with quick-start cards
- Links to Getting Started, API Reference, CLI Reference, Plugin SDK, MCP Server, Architecture

#### Infrastructure
- `docker/Dockerfile.website` — Multi-stage production build
- Website service added to `docker/docker-compose.yml`
- `apps/website/public/.gitkeep` for Docker compatibility

### Changed
- Updated README with website links and updated package count (14 packages, 5 apps)
- Bumped version to 0.5.0

## [0.4.1] - 2026-07-02

### Changed

#### API Modularization
- Split 4,041-line `api.ts` monolith into 13 domain-specific modules under `lib/api/`
- New modules: client, health, analysis, opportunities, graph, projects, intelligence, platform, governance, experiments, reports, settings
- Barrel re-export preserves all existing imports — zero breaking changes

#### Docker Improvements
- Fixed double-build bug in `Dockerfile.dashboard` (runner stage was rebuilding unnecessarily)
- Pinned pnpm to v9 in server Dockerfile to match lockfile

#### Dashboard Hardening
- Enhanced `next.config.ts` with security headers, lucide-react tree-shaking, static asset caching
- Disabled `X-Powered-By` header
- Updated `ARCHITECTURE.md` to reflect modular API structure

### Removed
- Dead components: `shared.tsx` (256 lines), `activity-log.tsx` (140 lines) — not imported
- Dead middleware: `middleware.ts` (200 lines) — superseded by `middleware/` directory
- Legacy `rate-limit.test.ts` — tested deleted middleware

### Added

#### Test Coverage
- 7 new component test files: AuthGuard, Header, HealthChart, LiveIndicator, OpportunitiesList, Providers, TrendChart
- Dashboard: 13 test files, 81 tests (100% component coverage)

#### Developer Experience
- Root `.env.example` documenting all environment variables

## [0.4.0] - 2026-07-01

### Added

#### Enterprise Collectors (8 new → 14 total)
- **GitHub collector**: Issues, PRs, workflows, releases via GitHub API
- **GitLab collector**: Merge requests, pipelines, CI configs via GitLab API
- **OpenTelemetry collector**: Traces, spans, service maps from OTLP endpoints
- **Cloud Cost collector**: Cloud spend analysis across AWS/GCP/Azure
- **Error Tracking collector**: Error rates, crash reports, Sentry/Bugsnag integration
- **APM collector**: Application performance metrics (latency, throughput, errors)
- **Langfuse collector**: LLM observability — traces, generations, prompt analytics
- **Arize collector**: ML model monitoring — drift, performance, explanations
- **Helicone collector**: LLM cost tracking — usage, latency, token consumption

#### Enterprise Analyzers (3 new → 13 total)
- **Dependency analyzer**: Dependency health, version staleness, license compliance
- **API Contract analyzer**: API versioning, breaking changes, OpenAPI compliance
- **AI Runtime analyzer**: Model monitoring, prompt injection detection, LLM cost optimization

#### Reasoning Engine Expansion (19 specialists)
- **Custom Specialist Agent SDK**: Factory, registry, lifecycle management for custom specialist creation
- **11 new specialist agents**: Backend, Frontend, ML, Prompt, Database, Documentation, Release Manager, Accessibility, Privacy, Compliance, UX Research

#### Server (138 endpoints across 30 route files)
- **GraphQL API**: Hand-rolled parser with field selection, variables, introspection
- **Multi-tenant routes**: Tenant CRUD, tier management, quota tracking
- **Plugin routes**: Marketplace, install/uninstall, plugin health, SDK info
- **Secrets routes**: Secret CRUD, rotation, audit log, rotation health
- **Simulation routes**: Simulation CRUD, intelligence packs, results
- **Cloud routes**: Benchmarks, patterns, partners, service tiers
- **Confidence routes**: Calibration overview, predictions, outcome recording
- **SSO routes**: Provider management, session management, SAML/OIDC
- **Scheduling routes**: Schedule CRUD, cron, run history, trigger
- **Forecasting routes**: Health prediction, what-if analysis, evolution graph
- **Auth routes**: Login, register, token refresh, SSO callback
- **Data masking routes**: Masking rules, preview, scanning

#### CLI (6 new → 25 total)
- **`recurrsive projects`**: Multi-project management (list, show, health-compare)
- **`recurrsive forecast`**: Health forecasting (health, what-if)
- **`recurrsive plugins`**: Plugin management (list, marketplace, install, uninstall, info)
- **`recurrsive secrets`**: Secret management (list, rotate, audit-log)
- **`recurrsive simulate`**: Simulation engine (list, run, show)
- **`recurrsive cloud`**: Cloud platform (benchmarks, patterns, partners, status)

#### Dashboard (22 new → 40 total pages)
- **Plugins page**: Installed plugins, marketplace, install/uninstall
- **Secrets page**: Secret management with rotation status
- **SSO page**: Provider configuration and session management
- **Tenants page**: Multi-tenant management with tier comparison
- **Scheduling page**: Schedule management with run history
- **Simulation page**: Simulation engine with results visualization
- **Cloud page**: Cloud benchmarks and industry comparisons
- **Confidence page**: Confidence calibration with Brier scores
- **Intelligence Packs page**: Domain intelligence pack management
- **Data Masking page**: PII masking rules and scanning
- **Findings, Projects, Forecasting pages**: Core intelligence features
- Plus: auth pages, settings, comparisons, and more

#### MCP (14 new → 42 total tools)
- **Project tools**: `list_projects`, `get_project`, `compare_project_health`
- **Forecast tools**: `forecast_health`, `what_if_analysis`, `get_evolution`
- **Intelligence tools**: `list_simulations`, `run_simulation`, `get_confidence`, `list_intelligence_packs`
- **Platform tools**: `list_plugins`, `list_tenants`, `get_benchmarks`, `list_secrets`

#### Testing
- **84 new server route integration tests**: Comprehensive coverage for all v0.4.0 routes
- **66+ specialist agent tests**: Custom SDK test coverage
- **Collector test suites**: GitHub, GitLab, OpenTelemetry, CloudCost, ErrorTracking, APM, Langfuse, Arize, Helicone

### Changed
- Server endpoints expanded from 52+ to **138** across 30 route files
- CLI commands expanded from 19 to **25**
- MCP tools expanded from 28 to **42**, prompts to 15, resources to 9
- Dashboard pages expanded from 18 to **40**
- Test suite expanded from 2,095+ to **2,881+** individual tests
- Analyzers expanded from 10 to **13** with 89+ rules
- Collectors expanded from 5 to **14** with enterprise integrations
- Specialist agents expanded from 8 to **19** with Custom SDK
- Source codebase grew to **125K+ lines** across 275 source files

## [0.3.0] - 2026-06-30

### Added

#### Full Stack Features
- **Notification system**: Server endpoints, CLI command, dashboard page, Slack/HTTP channels
- **Batch analysis**: Multi-project analysis (server + CLI + dashboard + MCP)
- **Audit trail**: Server audit routes (GET/POST /api/v1/audit), CLI `audit` command, dashboard `/audit` page
- **Analytics & trends**: Server analytics routes (summary + top-categories), CLI `analytics` command, dashboard `/analytics` page
- **Experiments / A-B testing**: Server experiment routes (CRUD + status), dashboard `/experiments` page, MCP experiment tools

#### Server
- **Rate limiter middleware**: Token-bucket rate limiting with X-RateLimit headers
- **Request logger middleware**: Circular buffer logging for last 500 requests
- **API key auth middleware**: Header-based validation with path exclusions
- **Integration tests**: 20+ multi-endpoint flow tests (analysis, webhook, batch, config)
- **Server config tests**: Full coverage for config routes

#### CLI
- **CLI config subcommands**: `get`, `set`, `reset` for dot-notation config management
- **CLI experiments command**: `list`, `create`, `status` subcommands
- **CLI analytics command**: `summary`, `categories` subcommands

#### Dashboard
- **Webhook dashboard page**: Management UI with stats and event configuration
- **Notifications dashboard page**: Channel management and delivery history
- **Batch dashboard page**: Stats, active batches, expandable history
- **Analytics dashboard page**: 12-week trend charts, category breakdown
- **Audit dashboard page**: Filterable event list with type icons and expandable details
- **Experiments dashboard page**: Stats, active experiment progress, completed grid
- **Shared UI components**: StatusBadge, EmptyState, Collapsible, DataTable, ProgressBar, StatCard
- **Activity log component**: Timestamped event feed with relative time

#### MCP
- **MCP batch tools**: `start_batch_analysis` and `get_batch_status`
- **MCP experiment tools**: `list_experiments` and `create_experiment`
- **MCP operations prompts**: `configure_notifications`, `batch_analysis_plan`, `audit_review`
- **MCP analytics resource**: `recurrsive://analytics/summary`
- **MCP governance resources**: `policies/active` and `webhooks/status`

#### Core
- **retry()**: Exponential backoff with configurable jitter and shouldRetry predicate
- **contentHash()**: Deterministic DJB2 hash for cache keys
- **batchProcess()**: Concurrent batch processing with configurable batch size

### Changed
- Server endpoints expanded from 38 to 52+
- CLI commands expanded from 12 to 19
- MCP tools expanded from 18 to 28, prompts from 9 to 15, resources from 4 to 9
- Dashboard pages expanded from 12 to 18
- Test suite expanded from 1,948 to 2,095+
- README overhauled with platform overview, notification channels, webhook events
- API documentation updated with all new endpoints and tools

## [0.2.1] - 2026-06-30

### Added

#### Webhook Management
- **Webhook CRUD** — `POST /api/v1/webhooks`, `GET /api/v1/webhooks`, `GET /api/v1/webhooks/:id`, `PATCH /api/v1/webhooks/:id`, `DELETE /api/v1/webhooks/:id` server endpoints for managing webhook subscriptions.
- **Webhook events** — `POST /api/v1/webhooks/:id/test` for sending test events and `GET /api/v1/webhooks/events` for listing available event types.
- **7 webhook event types** — `analysis:started`, `analysis:progress`, `analysis:finding`, `analysis:complete`, `analysis:error`, `opportunity:created`, `opportunity:updated`.
- **`recurrsive webhooks` CLI command** — Manage webhooks from the command line (list, create, delete, test).

#### Dashboard
- **Timeline page** — Intelligence timeline dashboard page with trend visualization and historical analysis data.

#### Policy & Governance
- **Policy governance prompts (MCP)** — MCP prompts for policy evaluation and compliance checking via AI assistants.

#### OpenAPI Specification
- **OpenAPI spec** — Machine-readable API specification for all REST endpoints.

#### Configuration Management
- **`GET /api/v1/config`** — Server endpoint returning current configuration (project root, graph provider, analysis settings, report output, feature flags).
- **`PATCH /api/v1/config`** — Runtime configuration updates (in-memory only, no persistence).
- **`GET /api/v1/config/features`** — Feature inventory with enabled status for all 10 analyzers, 5 collectors, and 5 policy sets.

#### Snapshot Export/Import
- **Snapshot export** — `GET /api/v1/snapshots/export` server endpoint and `recurrsive snapshot export` CLI command for exporting the knowledge graph as portable JSON.
- **Snapshot import** — `POST /api/v1/snapshots/import` server endpoint and `recurrsive snapshot import` CLI command for restoring from snapshot files.
- **`search` CLI command** — `recurrsive search` for full-text search directly from the command line.

#### Analysis
- **`GET /api/v1/analysis/compare?baseline=N`** — Compare current analysis run against a previous baseline run.

#### Dashboard (continued)
- **Search page** — Dashboard search page for querying the knowledge graph.
- **Opportunity detail page** — Deep-dive view for individual opportunities.
- **Entity detail page** — Deep-dive view for individual entities.

### Changed
- Server endpoints: 28 → **35** (added webhook management, config management, OpenAPI).
- CLI commands: 10 → **12** (added `webhooks`, `snapshot`).
- Dashboard pages: 11 → **12** (added timeline page).
- Server test expansion: 64 → **100** tests.
- MCP test expansion: 29 → **41** tests.
- CLI test expansion: 167 → **193** tests.
- Total tests across all packages: **1,935+**.
- API.md updated with webhook endpoints, config endpoints, analysis compare endpoint, and 12 CLI commands.
- README updated with new CLI commands, endpoint count, and test count.


## [0.2.0] - 2026-06-30

### Added

#### Full-Text Search (FTS5)
- **FTS5 Virtual Table** — SQLite FTS5 with Porter stemming and unicode61 tokenizer for ranked entity search across name, qualified_name, and description fields.
- **Auto-sync Triggers** — INSERT/UPDATE/DELETE triggers keep the FTS index perfectly synchronized with the entities table.
- **`searchEntities()` method** — New method on `SqliteGraphClient` for BM25-ranked full-text search with optional type filtering and configurable limits.
- **`GET /api/v1/graph/search`** — New server endpoint for full-text search with `q`, `type`, and `limit` query parameters.
- **`search_graph` MCP tool** — 11th MCP tool for AI assistant full-text search with formatted markdown results.
- 11 new FTS5 unit tests covering search, type filtering, limit, update sync, and delete sync.

#### CLI Test Completion (all 8/8 commands tested)
- **`analyze.test.ts`** — 18 tests: full pipeline, `--analyzers` filtering, error handling, graph lifecycle.
- **`opportunities.test.ts`** — 22 tests: listing, `--filter`, `--top N`, detail view, accept/reject, export.
- **`report.test.ts`** — 20 tests: markdown/json/sarif/html, `--output`, `--title`, no results handling.

### Changed
- All 13 packages bumped from 0.1.0 → **0.2.0** to reflect significant new capabilities.
- MCP tools: 10 → **11** (added `search_graph`).
- Total tests: 1,722 → **1,793** (+71 tests).
- README updated with 11 MCP tools, search endpoint, and Getting Started guide.

## [0.1.4] - 2026-06-30

### Added

#### Server Security Hardening
- **Rate Limiter** — In-memory sliding-window rate limiter (100 req/min default, configurable). Sets `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers. Returns 429 with `Retry-After`. Excludes `/health` endpoint. Zero external dependencies.
- **Global Error Handler** — Consistent JSON error responses with request ID tracking. Safe error serialization (no internal details leaked). Custom 404 handler for unmatched routes.
- **Request Body Validation** — Validation middleware for POST endpoints with type checking, required fields, and structured 400 error responses with field-level issues.
- Server factory now accepts `rateLimitMax` option (set 0 to disable).

#### Documentation
- **Getting Started Guide** (`docs/GETTING_STARTED.md`) — Step-by-step tutorial covering CLI setup, project initialization, analysis, reporting, server, dashboard, and MCP integration.
- **Examples Directory** (`examples/`) — Configuration examples:
  - `basic-config.yaml` — Minimal TypeScript project
  - `ai-project-config.yaml` — AI/ML project with reasoning and cost tracking
  - `enterprise-config.yaml` — Enterprise config with PostgreSQL, strict governance, and 5 custom policies
  - `ci-pipeline.yaml` — GitHub Actions workflow with SARIF upload

#### Test Coverage Expansion
- **Analyzer tests**: All 10/10 analyzers now have dedicated test suites (+174 tests)
  - Cost: 6 rules + finalize (30+ tests)
  - Docs: 6 rules + finalize (30+ tests)
  - Data: 6 rules + finalize (30+ tests)
  - Product: 5 rules + finalize (41 tests)
  - UX: 5 rules + finalize (44 tests)
- **CLI command tests**: config (14), graph (18), timeline (14) — all 6/8 commands now tested
- **Server middleware tests**: rate limiter, error handler, validation (13 tests)
- **Docs collector tests**: README, ADR, API contract, docs dir scanning (9 tests)
- Total: **1,722 tests** across 57+ test files (up from 1,480)

### Changed
- API docs updated with `/api/v1/metrics/performance` endpoint
- README documentation table expanded with Getting Started guide and Examples

## [0.1.3] - 2026-06-30

### Added

#### Report Formats
- **JSON Report Generator** — Structured JSON report with severity/category distributions, health scores, maturity dimensions, and detailed opportunities for CI/CD and monitoring integrations.
- **SARIF v2.1.0 Report Generator** — Static Analysis Results Interchange Format output compatible with GitHub Advanced Security, Azure DevOps, and VS Code SARIF Viewer.
- Report factory now supports 4 formats: `markdown`, `html`, `json`, `sarif`.

#### Analyzer Cross-Cutting Logic
- **AI Analyzer `finalize()`** — Detects projects using AI without evaluations; checks AI-to-function modularity ratio.
- **Performance Analyzer `finalize()`** — Detects low function extraction in endpoint-heavy codebases.
- **Reliability Analyzer `finalize()`** — Detects external dependencies without resilience configuration (retry, circuit-breaker, timeout).
- **Cost Analyzer `finalize()`** — Detects multiple AI models without cost tracking.
- **Docs Analyzer `finalize()`** — Detects low documentation coverage for public functions and undocumented API endpoints.
- **Data Analyzer `finalize()`** — Detects databases without migration management.
- **Product Analyzer `finalize()`** — Detects API endpoints without test coverage.
- **UX Analyzer `finalize()`** — Detects missing internationalization in multi-endpoint apps.
- All 10 analyzers now have real cross-cutting `finalize()` logic (previously only 2/10).

#### Config
- **YAML config file support** — Lightweight zero-dependency parser handles key:value pairs, nested objects, arrays, booleans, numbers, and comments.

#### Testing
- **Performance Analyzer tests** — 37 tests covering 7 rules (sequential LLM calls, N+1 queries, missing caching, large context windows, synchronous blocking, missing pagination, unbounded loops).
- **Reliability Analyzer tests** — 35 tests covering 7 rules (SPOF, missing retries, missing timeouts, no circuit breaker, missing health checks, no graceful shutdown, error swallowing).
- **Pipeline integration tests** — 6 end-to-end tests using real SQLite graph + real analyzers.
- **Go language extractor tests** — 34 tests covering all entity types.
- Total: 1,442+ tests across 52 test files.

#### Dashboard
- Settings page now hydrates from localStorage on mount (round-trip persistence).

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

## [0.1.2] - 2026-06-30

### Added

#### New Collectors
- **Database Schema Collector** — SQL `CREATE TABLE`, Prisma model, and Drizzle ORM schema discovery with foreign key relationship extraction and path deduplication.

#### Pipeline Parity
- **All 3 application pipelines (CLI, Server, MCP)** now use all 5 collectors (Git, Documentation, Environment, CI/CD, Database).
- **Server pipeline** — Added ParsingPipeline integration, project info enrichment (languages, frameworks, AI providers), cost_optimizer specialist, and collector disposal.
- **MCP pipeline** — Added all 4 new collectors and project info enrichment.

#### Dashboard
- **Error boundary** (`error.tsx`) — Styled retry UI matching dark glassmorphism theme.
- **404 page** (`not-found.tsx`) — Custom not-found page with return link.
- **Dynamic sidebar badge** — Opportunity count fetched from API instead of hardcoded.
- **Functional filters** — Opportunities page category and severity filtering now works.
- **Functional search** — Header search navigates to opportunities with search param.

#### Server API
- **`GET /api/v1/metrics/performance`** — New endpoint returning derived analysis metrics (analysis time, entity density, issue density, graph coverage) from the knowledge graph.
- **Enriched health-score response** — `/api/v1/health-score` now includes `health_trend`, `tech_debt`, and per-dimension scores as a flat record.

#### Testing
- **Database Collector tests** — SQL, Prisma, Drizzle ORM parsing, validation, and metadata (6 tests).
- Full monorepo: 42 test files, 1,226+ individual tests.

### Fixed
- Dashboard API client: `getPerformanceMetrics()` now calls real server endpoint with mock fallback.
- Dashboard API client: `getHealthMetrics()` now uses computed trend data from server instead of hardcoded values.
- ROADMAP.md: updated collector status to ✅ Complete, fixed test counts, marked completed items.

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


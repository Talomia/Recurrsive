# Recurrsive — Product Roadmap

## Current State (v0.5.7)

| Component | Status | Evidence |
|---|---|---|
| Core type system | ✅ Complete | 12 type files, Zod schemas with runtime validation |
| Knowledge graph | ✅ Complete | Dual-backend (AGE/SQLite), 43 entity types, 43 relationship types |
| Collectors | ✅ Complete | 14 collectors: Git, Doc, Environment, CI/CD, Database, GitHub, GitLab, OpenTelemetry, Cloud Cost, Error Tracking, APM, Langfuse, Arize, Helicone |
| Parsers | ✅ Complete | Tree-sitter, TS/Python/Go extractors, AI pattern detection (13 patterns) |
| Analyzers | ✅ Complete | 13 analyzers, 89+ rules (66 base + 8 dependency + 7 API contract + 8 AI runtime), all 13 with cross-cutting finalize() logic |
| Reasoning | ✅ Complete | 19 specialist agents, multi-agent debate, synthesis, ranking |
| Opportunities | ✅ Complete | Full lifecycle, SARIF export, markdown/HTML reports |
| Policy engine | ✅ Complete | Recursive descent expression parser, 5 policy sets (16 rules) |
| Presentation | ✅ Complete | Markdown/HTML/JSON/SARIF reports, console/webhook notifications |
| CLI | ✅ Complete | 28 commands (analyze, opportunities, health, graph, timeline, report, config, init, search, snapshot, policy, webhooks, notifications, batch, audit, analytics, experiments, comparisons, export, projects, forecast, plugins, secrets, simulate, cloud, login, logout, whoami) |
| MCP Server | ✅ Complete | 42 tools, 16 resources, 21 prompts |
| REST API | ✅ Complete | 160+ endpoints, OpenAPI 3.1 spec, WebSocket streaming, JWT/API key auth, RBAC |
| Dashboard | ✅ Complete | Next.js, 42 pages (incl. marketplace + partners), grouped sidebar navigation, real-time WebSocket |
| Website | ✅ Complete | 23 pages, SEO (sitemap, robots), glassmorphism design, marketplace, cloud, partners, docs |
| Auth & Security | ✅ Complete | JWT auth (HMAC-SHA256), scrypt password hashing, setup wizard, user CRUD, SSO auto-provisioning, API key management, RBAC (admin/analyst/viewer) |
| Tests | ✅ Complete | 140 test files, 3,293+ tests across 14 packages, integration tests for full pipeline |
| Tier Separation | ✅ Complete | 3-tier model (OSS/Enterprise/Ecosystem) enforced at runtime via `ENABLE_ENTERPRISE` and `ENABLE_ECOSYSTEM` env vars |

> [!NOTE]
> All platform routes have real implementations. Enterprise features (SSO, secrets,
> multi-tenant, simulation, cloud) use real data processing logic — SSO parses real
> SAML XML, collectors call real APIs via native `fetch`, and all routes read from
> actual analysis state. No mock or synthetic data remains in production code.
>
> The 3-tier model (OSS → Enterprise → Ecosystem) is enforced at runtime:
> - **Tier 1 (OSS)**: 27 route modules, always enabled
> - **Tier 2 (Enterprise)**: SSO, multi-tenant, secrets, data masking — gated by `ENABLE_ENTERPRISE`
> - **Tier 3 (Ecosystem)**: Cloud, marketplace, partners — gated by `ENABLE_ECOSYSTEM`

---

## Phase 1: Foundation (Current → v0.2.0)

### Objective
Make Recurrsive useful for a single AI engineering team analyzing a single repository. Deliver immediate value from `recurrsive analyze .`

### Collectors
- [x] **GitHub App collector** — PRs, issues, reviews, actions, deployments
- [x] **GitLab collector** — MRs, issues, pipelines
- [x] **OpenTelemetry collector** — ingest OTLP traces and metrics
- [x] **Database schema collector** — SQL, Prisma, Drizzle ORM parsing
- [x] **Dockerfile/Compose collector** — container topology
- [x] **Kubernetes collector** — manifests, deployments, services
- [x] **CI/CD collector** — GitHub Actions, GitLab CI pipelines

### Analyzers
- [x] **AI Runtime analyzer** — prompt quality, token usage, model selection (8 rules)
- [x] **Dependency vulnerability analyzer** — CVE scanning (8 rules)
- [x] **API contract analyzer** — OpenAPI/GraphQL schema analysis (7 rules)

### Dashboard
- [x] Connect dashboard to live API (all pages use server API)
- [x] Add dashboard detail pages (batch/[id], experiments/[id], notifications/[id], opportunities/[id], policies/[id], insights/[id], system-map/[id])
- [x] Add real-time WebSocket updates (LiveIndicator, useWebSocket hook)
- [x] Implement settings persistence

### Quality
- [x] Reconcile ARCHITECTURE.md with actual code (8 discrepancies fixed)
- [x] Add integration tests for full pipeline (collect → analyze → reason)
- [x] TypeScript strict mode across all packages

### Documentation
- [x] Contributor guide (CONTRIBUTING.md)
- [x] Plugin/SDK development guide (PLUGIN_SDK.md)
- [x] Deployment guide (DEPLOYMENT.md)

---

## Phase 2: Enterprise (v0.3.0)

### Objective
Make Recurrsive deployable in enterprise environments with governance, security, and compliance.

### Enterprise Features
- [x] Authentication (JWT + API keys)
- [x] SSO/SAML integration *(real XML parsing, SAMLAuthnRequest generation, timestamp validation)*
- [x] Fine-grained RBAC (role-based access control)
- [x] Audit logging (who accessed what, when)
- [x] Data masking and PII controls
- [x] Secret management integration *(in-memory store with encrypted-at-rest support)*
- [x] Multi-tenant deployment model *(API-driven tenant CRUD, no seed data)*

### Collectors (Enterprise)
- [x] **Cloud cost collector** — AWS Cost Explorer, GCP Billing, Azure Cost Management
- [x] **APM collector** — Datadog, New Relic, Grafana Tempo
- [x] **Error tracking collector** — Sentry, Bugsnag, Rollbar
- [x] **CI/CD collector** — GitHub Actions, GitLab CI (now in Phase 1)

### AI Integrations
- [x] **Langfuse collector** — LLM traces, prompt analytics
- [x] **Arize collector** — model monitoring, drift detection
- [x] **Helicone collector** — LLM cost and usage

### Reasoning
- [x] Custom specialist agent SDK (bring your own specialists)
- [x] Confidence calibration (track prediction accuracy over time)
- [x] Cross-domain evidence fusion improvements

### Dashboard
- [x] User authentication and sessions
- [x] Multi-project support
- [x] Executive intelligence views
- [x] Report scheduling and export

---

## Phase 3: Ecosystem (v0.4.0+)

### Objective
Build a platform that others can extend. Open the SDK, enable third-party analyzers, and explore managed services.

### Platform
- [x] **Plugin SDK** — documented, versioned API for custom collectors and analyzers
- [x] **Analyzer marketplace** — *(plugin store with CRUD API)*
- [x] **Domain intelligence packs** — *(JSON definitions with install/uninstall)*
- [x] **GraphQL API** — hand-rolled engine *(wired to live analysis data, returns empty when uninitialized)*

### Execution Engine (Controlled)
- [x] **Experiment framework** — *(in-memory experiments with API CRUD)*
- [x] **PR generation** — *(generates PRs from real analysis findings)*
- [x] **Simulation engine** — *(analysis-based impact scoring from real state data)*
- [x] **A/B test integration** — *(in-memory experiment tracking with status management)*

### Advanced Intelligence
- [x] **Evolution Graph** — record decisions, outcomes, and learning over time
- [x] **Forecasting** — predict maturity trajectory based on current trends
- [x] **What-if analysis** — simulate impact of proposed changes

---

## Phase 4: Scale (v1.0.0+)

### Objective
Build organizational engineering memory and explore network effects.

### Long-Term (Requires scale for full implementation)
- [x] Anonymized benchmarking *(store-backed patterns with real analysis data)*
- [x] Cross-organization pattern learning *(store-backed pattern library)*
- [ ] Managed optimization services
- [x] Partner certification program *(v0.5.0 — partner portal with 3 certification tracks)*
- [x] Recurrsive Cloud *(v0.5.0 — marketing site with managed cloud pages, pricing, and regions)*

### Marketing & Ecosystem (v0.5.0)
- [x] **Marketing website** — 23-page Next.js site with 5 areas:
  - Core: landing, product, pricing, about, blog, contact, changelog
  - Marketplace: browse + submit extensions
  - Cloud: overview + dashboard + billing
  - Partners: overview + directory + apply + certification
  - Docs: getting-started, API reference, CLI, plugin SDK, deployment, architecture
- [x] **Marketplace API** — 5 server endpoints (extensions CRUD, categories, stats)
- [x] **Partner API** — 5 server endpoints (directory, apply, certifications, stats)
- [x] **OpenAPI 3.1 spec** — Auto-generated spec at /api/v1/openapi.json + Swagger UI at /api/docs
- [x] **SEO** — sitemap.xml, robots.txt, not-found, loading, error pages
- [x] **Dashboard wiring** — 9 dashboard pages wired to server APIs with mock fallback
- [x] **Navigation** — 5 dropdown menus with 17+ quick-access links

### Tier Separation (v0.5.7)
- [x] **3-tier route gating** — `ENABLE_ENTERPRISE` and `ENABLE_ECOSYSTEM` env vars for runtime control
- [x] **Intelligence packs extraction** — moved from simulation.ts to own route file
- [x] **Cloud/partner deduplication** — removed duplicate partner routes from cloud.ts
- [x] **Plugin catalog migration** — hardcoded marketplace data moved to store
- [x] **Dashboard sidebar grouping** — 4 collapsible sections (Intelligence, Analysis, Operations, Administration) with localStorage persistence
- [x] **Dashboard marketplace page** — new page wired to marketplace API
- [x] **Dashboard partners page** — new page wired to partners API
- [x] **Documentation** — STRATEGY.md, ARCHITECTURE.md, ROADMAP.md updated with tier boundary specs

---

## Explicitly Deferred

These are valid ideas that are premature to build now:

| Idea | Why Deferred | Revisit When |
|---|---|---|
| Cross-org learning | Privacy/trust barrier too high | 1000+ customers |
| Network effects | Need single-tenant value first | Product-market fit |
| Marketplace backend | Needs liquidity — UI is built | 50+ analyzers exist |
| Full autonomous execution | Trust must be earned | Experiment framework proven |
| Benchmarking-as-a-service | Needs statistical scale | 100+ organizations |

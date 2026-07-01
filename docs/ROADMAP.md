# Recurrsive — Product Roadmap

## Current State (v0.3.0)

| Component | Status | Evidence |
|---|---|---|
| Core type system | ✅ Complete | 12 type files, Zod schemas with runtime validation |
| Knowledge graph | ✅ Complete | Dual-backend (AGE/SQLite), 43 entity types, 43 relationship types |
| Collectors | ✅ Complete | 12 collectors: Git, Doc, Environment, CI/CD, Database, GitHub, GitLab, OpenTelemetry, Cloud Cost, Error Tracking, APM, Langfuse |
| Parsers | ✅ Complete | Tree-sitter, TS/Python/Go extractors, AI pattern detection (13 patterns) |
| Analyzers | ✅ Complete | 13 analyzers, 89+ rules (66 base + 8 dependency + 7 API contract + 8 AI runtime), all 13 with cross-cutting finalize() logic |
| Reasoning | ✅ Complete | 19 specialist agents, multi-agent debate, synthesis, ranking |
| Opportunities | ✅ Complete | Full lifecycle, SARIF export, markdown/HTML reports |
| Policy engine | ✅ Complete | Recursive descent expression parser, 5 policy sets (16 rules) |
| Presentation | ✅ Complete | Markdown/HTML/JSON/SARIF reports, console/webhook notifications |
| CLI | ✅ Complete | 19 commands (analyze, opportunities, health, graph, timeline, report, config, init, search, snapshot, policy, webhooks, notifications, batch, audit, analytics, experiments, comparisons, export) |
| MCP Server | ✅ Complete | 28 tools, 9 resources, 15 prompts |
| REST API | ✅ Complete | 62+ endpoints, WebSocket streaming, JWT/API key auth, RBAC |
| Dashboard | ✅ Complete | Next.js, 26 pages (incl. detail pages), 8+ components, real-time WebSocket |
| Auth & Security | ✅ Complete | JWT auth, API key management, RBAC (admin/analyst/viewer) |
| Tests | ✅ Complete | 80+ test files, integration tests for full pipeline |

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
- [x] Connect dashboard to live API (replace mock data)
- [x] Add dashboard detail pages (batch/[id], experiments/[id], notifications/[id], opportunities/[id], policies/[id], insights/[id], system-map/[id])
- [x] Add real-time WebSocket updates (LiveIndicator, useWebSocket hook)
- [x] Implement settings persistence

### Quality
- [x] Reconcile ARCHITECTURE.md with actual code (8 discrepancies fixed)
- [x] Add integration tests for full pipeline (collect → analyze → reason)
- [ ] TypeScript strict mode across all packages

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
- [x] SSO/SAML integration
- [x] Fine-grained RBAC (role-based access control)
- [x] Audit logging (who accessed what, when)
- [x] Data masking and PII controls
- [ ] Secret management integration (Vault, AWS Secrets Manager)
- [ ] Multi-tenant deployment model

### Collectors (Enterprise)
- [x] **Cloud cost collector** — AWS Cost Explorer, GCP Billing, Azure Cost Management
- [x] **APM collector** — Datadog, New Relic, Grafana Tempo
- [x] **Error tracking collector** — Sentry, Bugsnag, Rollbar
- [x] **CI/CD collector** — GitHub Actions, GitLab CI (now in Phase 1)

### AI Integrations
- [x] **Langfuse collector** — LLM traces, prompt analytics
- [ ] **Arize collector** — model monitoring, drift detection
- [ ] **Helicone collector** — LLM cost and usage

### Reasoning
- [ ] Custom specialist agent SDK (bring your own specialists)
- [ ] Confidence calibration (track prediction accuracy over time)
- [ ] Cross-domain evidence fusion improvements

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
- [x] **Analyzer marketplace** — discover and install community analyzers
- [ ] **Domain intelligence packs** — Healthcare, Finance, Kubernetes, AI Safety
- [ ] **GraphQL API** — flexible querying for advanced integrations

### Execution Engine (Controlled)
- [x] **Experiment framework** — connect to feature flag systems (LaunchDarkly, Unleash)
- [ ] **PR generation** — produce pull requests from recommendations (opt-in)
- [ ] **Simulation engine** — traffic replay for impact prediction
- [x] **A/B test integration** — validate recommendation impact with experiments

### Advanced Intelligence
- [x] **Evolution Graph** — record decisions, outcomes, and learning over time
- [x] **Forecasting** — predict maturity trajectory based on current trends
- [x] **What-if analysis** — simulate impact of proposed changes

---

## Phase 4: Scale (v1.0.0+)

### Objective
Build organizational engineering memory and explore network effects.

### Long-Term (Deferred — requires scale)
- [ ] Anonymized benchmarking (opt-in, aggregated)
- [ ] Cross-organization pattern learning (privacy-preserved)
- [ ] Managed optimization services
- [ ] Partner certification program
- [ ] Recurrsive Cloud (fully managed SaaS)

---

## Explicitly Deferred

These are valid ideas that are premature to build now:

| Idea | Why Deferred | Revisit When |
|---|---|---|
| Cross-org learning | Privacy/trust barrier too high | 1000+ customers |
| Network effects | Need single-tenant value first | Product-market fit |
| Marketplace | Needs liquidity | 50+ analyzers exist |
| Full autonomous execution | Trust must be earned | Experiment framework proven |
| Benchmarking-as-a-service | Needs statistical scale | 100+ organizations |
| Education/certification | Premature | Active partner ecosystem |

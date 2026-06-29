# Recurrsive — Product Roadmap

## Current State (v0.1.0)

| Component | Status | Evidence |
|---|---|---|
| Core type system | ✅ Complete | 12 type files, Zod schemas with runtime validation |
| Knowledge graph | ✅ Complete | Dual-backend (AGE/SQLite), 43 entity types, 40 relationship types |
| Collectors | ⚠️ Partial | Git + Doc collectors built. 60+ planned integrations pending |
| Parsers | ✅ Complete | Tree-sitter, TS/Python extractors, AI pattern detection (13 patterns) |
| Analyzers | ✅ Complete | 10 analyzers, 66+ rules |
| Reasoning | ✅ Complete | 12 specialist agents, multi-agent debate, synthesis, ranking |
| Opportunities | ✅ Complete | Full lifecycle, SARIF export, markdown/HTML reports |
| Policy engine | ✅ Complete | Recursive descent expression parser, 5 policy sets (15 rules) |
| Presentation | ✅ Complete | Markdown/HTML reports, console/webhook notifications |
| CLI | ✅ Complete | 8 commands (analyze, opportunities, health, graph, timeline, report, config, init) |
| MCP Server | ✅ Complete | 10 tools, 4 resources, 6 prompts |
| REST API | ✅ Complete | ~21 endpoints, WebSocket streaming |
| Dashboard | ✅ Complete | Next.js, 6 pages, 8+ components, mock data |
| Tests | ✅ Complete | 38 test files, 1,186 individual tests |

---

## Phase 1: Foundation (Current → v0.2.0)

### Objective
Make Recurrsive useful for a single AI engineering team analyzing a single repository. Deliver immediate value from `recurrsive analyze .`

### Collectors
- [ ] **GitHub App collector** — PRs, issues, reviews, actions, deployments
- [ ] **GitLab collector** — MRs, issues, pipelines
- [ ] **OpenTelemetry collector** — ingest OTLP traces and metrics
- [ ] **Database schema collector** — PostgreSQL, MySQL schema introspection
- [ ] **Dockerfile/Compose collector** — container topology
- [ ] **Kubernetes collector** — manifests, deployments, services

### Analyzers
- [ ] **AI Runtime analyzer** — prompt quality, token usage, model selection
- [ ] **Dependency vulnerability analyzer** — CVE scanning
- [ ] **API contract analyzer** — OpenAPI/GraphQL schema analysis

### Dashboard
- [ ] Connect dashboard to live API (replace mock data)
- [ ] Add real-time WebSocket updates
- [ ] Implement settings persistence

### Quality
- [ ] Reconcile ARCHITECTURE.md with actual code (fix 13 documented gaps)
- [ ] Add integration tests for full pipeline (collect → analyze → reason)
- [ ] TypeScript strict mode across all packages

### Documentation
- [ ] Contributor guide (CONTRIBUTING.md)
- [ ] Plugin/SDK development guide
- [ ] Deployment guide (DEPLOYMENT.md)

---

## Phase 2: Enterprise (v0.3.0)

### Objective
Make Recurrsive deployable in enterprise environments with governance, security, and compliance.

### Enterprise Features
- [ ] Authentication (JWT + API keys)
- [ ] SSO/SAML integration
- [ ] Fine-grained RBAC (role-based access control)
- [ ] Audit logging (who accessed what, when)
- [ ] Data masking and PII controls
- [ ] Secret management integration (Vault, AWS Secrets Manager)
- [ ] Multi-tenant deployment model

### Collectors (Enterprise)
- [ ] **Cloud cost collector** — AWS Cost Explorer, GCP Billing, Azure Cost Management
- [ ] **APM collector** — Datadog, New Relic, Grafana Tempo
- [ ] **Error tracking collector** — Sentry, Bugsnag
- [ ] **CI/CD collector** — GitHub Actions, GitLab CI, Jenkins

### AI Integrations
- [ ] **Langfuse collector** — LLM traces, prompt analytics
- [ ] **Arize collector** — model monitoring, drift detection
- [ ] **Helicone collector** — LLM cost and usage

### Reasoning
- [ ] Custom specialist agent SDK (bring your own specialists)
- [ ] Confidence calibration (track prediction accuracy over time)
- [ ] Cross-domain evidence fusion improvements

### Dashboard
- [ ] User authentication and sessions
- [ ] Multi-project support
- [ ] Executive intelligence views
- [ ] Report scheduling and export

---

## Phase 3: Ecosystem (v0.4.0+)

### Objective
Build a platform that others can extend. Open the SDK, enable third-party analyzers, and explore managed services.

### Platform
- [ ] **Plugin SDK** — documented, versioned API for custom collectors and analyzers
- [ ] **Analyzer marketplace** — discover and install community analyzers
- [ ] **Domain intelligence packs** — Healthcare, Finance, Kubernetes, AI Safety
- [ ] **GraphQL API** — flexible querying for advanced integrations

### Execution Engine (Controlled)
- [ ] **Experiment framework** — connect to feature flag systems (LaunchDarkly, Unleash)
- [ ] **PR generation** — produce pull requests from recommendations (opt-in)
- [ ] **Simulation engine** — traffic replay for impact prediction
- [ ] **A/B test integration** — validate recommendation impact with experiments

### Advanced Intelligence
- [ ] **Evolution Graph** — record decisions, outcomes, and learning over time
- [ ] **Forecasting** — predict maturity trajectory based on current trends
- [ ] **What-if analysis** — simulate impact of proposed changes

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

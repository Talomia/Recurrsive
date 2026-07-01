# Recurrsive — Product Strategy

## Positioning

**Recurrsive** is an **Engineering Intelligence Platform**.

It continuously builds a knowledge graph of an entire software system — source code, architecture, AI components, infrastructure, costs, reliability, security, and documentation — and delivers evidence-backed recommendations ranked by expected business impact.

### What We Sell

**Decision Confidence.**

Not dashboards, not reports, not code analysis. Engineering leaders buy the confidence to make better decisions faster.

### Who We Serve

| Persona | Role | What They Get |
|---|---|---|
| **Primary** | CTO, VP Engineering, Head of Platform | Portfolio-level intelligence, investment prioritization |
| **Secondary** | Staff Engineers, Principal Engineers | Cross-cutting insights, architecture guidance |
| **Tertiary** | Engineering Managers, Tech Leads | Team-level health, opportunity backlogs |

### What We Are Not

- ❌ Not a coding assistant (we don't write code)
- ❌ Not an observability platform (we don't collect metrics)
- ❌ Not a static analyzer (we go far beyond syntax)
- ❌ Not an autonomous agent (we recommend, humans decide)

---

## Architecture Philosophy

### Knowledge-Centric, Not AI-Centric

The LLM is never the source of truth. It reasons over structured evidence.

```
Evidence → Collectors → Knowledge Graph → Deterministic Analysis → Specialized AI Reasoners → Evidence Fusion → Recommendations
```

### The Knowledge Graph Is the Core Asset

The graph contains 43 entity types and 43 relationship types spanning:
- **Code**: repositories, files, functions, classes, modules, endpoints
- **AI**: prompts, agents, tools, models, MCP servers, evaluations
- **Data**: tables, collections, indexes, queries, datasets
- **Infrastructure**: deployments, environments, configs, secrets, cost metrics
- **Organization**: users, teams, incidents, alerts, ADRs, RFCs

This graph, continuously updated, IS the digital twin.

### Pipeline: Collect → Understand → Reason → Evolve

| Phase | Package | Status |
|---|---|---|
| **Collect** | `@recurrsive/collectors`, `@recurrsive/graph` | ✅ Built (14 collectors: Git, Docs, Environment, CICD, Database, GitHub, GitLab, OpenTelemetry, CloudCost, ErrorTracking, APM, Langfuse, Arize, Helicone) |
| **Understand** | `@recurrsive/parsers`, `@recurrsive/analyzers` | ✅ Built (13 analyzers, 66+ rules) |
| **Reason** | `@recurrsive/reasoning` | ✅ Built (19 specialists, debate protocol) |
| **Evolve** | `@recurrsive/opportunities` | ✅ Built (lifecycle, SARIF, reports) |

---

## Trust Model

Every recommendation must answer seven questions:

| Question | Implementation |
|---|---|
| What is the problem? | `opportunity.problem` |
| What evidence supports it? | `opportunity.evidence[]` with type, source, confidence |
| How confident are we? | `opportunity.confidence` + `reasoning.consensus_score` |
| What assumptions were made? | `opportunity.assumptions[]` |
| What is the expected impact? | `opportunity.expected_impact` with metrics |
| What if we do nothing? | `opportunity.risk.cost_of_inaction` |
| How do we verify it? | `opportunity.validation` plan |

Recommendations without evidence are not recommendations — they are guesses.

---

## Business Model

### Tier 1: Recurrsive OSS (Open Source — Apache 2.0)

The foundation. Free forever.

- Collectors (Git, docs, AI patterns)
- Knowledge graph (Apache AGE / SQLite)
- 13 built-in analyzers
- Multi-agent reasoning engine
- Opportunity management + SARIF export
- Policy engine
- CLI (25 commands)
- MCP Server (42 tools, 21 prompts, 16 resources)
- REST + WebSocket API
- Plugin SDK for custom analyzers/collectors

### Tier 2: Recurrsive Enterprise (Commercial License)

For organizations that need governance.

- SSO / SAML integration
- Fine-grained RBAC
- Audit logging
- Compliance reporting
- Policy-as-code governance
- Multi-tenant deployments
- Air-gapped support
- Enterprise support SLA
- Advanced reasoning (custom specialist agents)

### Tier 3: Recurrsive Cloud (Managed SaaS)

Lower adoption friction.

- Managed infrastructure
- Continuous synchronization
- Automatic upgrades
- Secure storage
- Collaboration features
- Cloud reasoning (GPU-backed)
- Executive intelligence dashboards

### Future: Premium Analyzers (Domain Intelligence Packs)

Organizations buy what they need:
- Healthcare Analyzer
- Financial Services Analyzer
- Kubernetes Analyzer
- AI Safety Analyzer
- FinOps Analyzer

### Future: Marketplace

Third parties publish analyzers, collectors, policies, and reports. Recurrsive takes a marketplace commission.

**Note**: Marketplace requires ecosystem liquidity. Sequencing: Phase 1 (own all analyzers) → Phase 2 (open SDK) → Phase 3 (marketplace).

---

## Pricing Philosophy

- **No per-seat pricing** — encourages adoption
- **No per-repository pricing** — encourages connecting more systems
- Price by **Decision Scope**: organizational scale, history depth, reasoning depth

| Tier | Target | Scope |
|---|---|---|
| Starter | Small teams | One organization, limited history |
| Growth | Mid-market | Multiple teams, historical evolution, forecasting |
| Enterprise | Large organizations | Organization-wide graph, governance, private AI |

---

## Go-to-Market Strategy

### Phase 1: Open Source Community
**Target**: AI engineers, platform engineers, staff engineers, OSS maintainers
**Goal**: Build trust and contributors
**Channel**: GitHub, developer conferences, technical blog posts

### Phase 2: Technology Companies
**Target**: AI startups, SaaS companies, developer tooling companies
**Goal**: Rapid feedback, case studies, product-led growth
**Channel**: Product Hunt, Hacker News, direct outreach

### Phase 3: Enterprises
**Target**: Banks, healthcare, manufacturing, telcos, government
**Goal**: Enterprise revenue, compliance validation
**Channel**: Direct sales, partner channel, analyst relations

### Phase 4: Ecosystem
**Target**: Analyzer developers, consulting firms, cloud providers, SI partners
**Goal**: Marketplace revenue, network effects
**Channel**: Partner program, certification, marketplace

---

## Competitive Landscape

| Tool | Scope | Intelligence | Gap |
|---|---|---|---|
| GitHub Copilot | Code | Generative | Doesn't understand the system |
| Datadog | Runtime | Monitoring | Doesn't reason about architecture |
| SonarQube | Code | Static rules | Doesn't see runtime or business impact |
| Snyk | Dependencies | Security only | Single dimension |
| Langfuse | AI traces | Observability | Doesn't connect to code or business |
| Recurrsive | **Full system** | **Evidence-backed reasoning** | — |

### Competitive Whitespace

No tool today answers: *"What are the highest-value improvements across my entire AI platform?"*

That synthesis — connecting code, architecture, runtime, AI behavior, cost, and business outcomes into prioritized decisions — is the opportunity.

---

## Feasibility Assessment

| Area | Feasibility | Status |
|---|---|---|
| Repository analysis | Very High | ✅ Built |
| Architecture understanding | High | ✅ Built |
| AI application understanding | High | ✅ Built (Langfuse, Arize, Helicone collectors) |
| Production telemetry | Very High | ✅ Built (OpenTelemetry, APM, ErrorTracking collectors) |
| Database/schema analysis | Very High | ✅ Built (Database collector) |
| Cost optimization | High | ⚠️ Analyzer exists, billing integration needed |
| Performance recommendations | High | ✅ Built |
| Security recommendations | High | ✅ Built |
| Automatic experiments | High | ⚠️ Types ready, execution engine needed |
| Digital twin | Medium-High | ✅ Knowledge graph IS the twin |
| Business reasoning | Medium | 🔶 Deferred — requires business data collectors |
| Fully autonomous evolution | Low today | 🔶 Deferred — execution is Phase 3+ |

---

## What We Explicitly Do Not Do (Yet)

1. **Cross-organization learning** — Valid at scale but raises privacy/trust concerns. Deferred.
2. **Full lifecycle execution** (auto-PRs, auto-deploys) — Types ready, but trust must be earned before automation.
3. **Marketplace** — Needs liquidity. Own all analyzers first.
4. **Network effects** — Premature. Build single-tenant value first.
5. **Benchmarking** — Needs scale. Interesting at 1000+ customers.

---

## Long-Term Moat

The strongest moat is the **Evolution Graph** — a continuously growing record of:
- How systems changed
- Why changes were proposed
- Which recommendations were accepted or rejected
- What experiments were run
- Their outcomes
- How outcomes influenced future recommendations

Over time, this becomes an organization's **engineering memory** — impossible for competitors to replicate because it encodes years of institutional decision-making.

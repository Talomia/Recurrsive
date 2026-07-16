# Recurrsive — Product Requirements Document

> **Engineering Intelligence Platform**

| Field | Value |
|---|---|
| **Document Version** | 1.2.0 |
| **Product Version** | 0.5.7 |
| **Status** | APPROVED — Single Source of Truth |
| **Created** | 2026-06-29 |
| **Last Updated** | 2026-07-05 |
| **Classification** | Internal / Confidential |

---

## Table of Contents

1. [Vision & Positioning](#1-vision--positioning)
2. [Core Principles](#2-core-principles)
3. [The Digital Twin](#3-the-digital-twin)
4. [The Five Layers](#4-the-five-layers)
5. [The Opportunity Format](#5-the-opportunity-format)
6. [The Recommendation Pipeline](#6-the-recommendation-pipeline)
7. [Evidence Sources — Complete Collector List](#7-evidence-sources--complete-collector-list)
8. [Privacy & Governance](#8-privacy--governance)
9. [Plugin & Extensibility Architecture](#9-plugin--extensibility-architecture)
10. [Domain Intelligence Packs](#10-domain-intelligence-packs)
11. [Deployment Models](#11-deployment-models)
12. [Explainability](#12-explainability)
13. [Open Standards](#13-open-standards)
14. [Governance & Policy Engine](#14-governance--policy-engine)
15. [Benchmarking](#15-benchmarking)
16. [Automatic Experiments](#16-automatic-experiments)
17. [Continuous Learning](#17-continuous-learning)

---

## 1. Vision & Positioning

### 1.1 Category Definition — Engineering Intelligence Platform

Recurrsive creates a new product category: **Engineering Intelligence Platform**.

An Engineering Intelligence Platform builds a continuously updated **digital twin** of an entire software system — spanning code, data, infrastructure, runtime, and product context — then reasons across every dimension to deliver **evidence-based, measurable opportunities** to improve quality, performance, reliability, security, cost, and business outcomes.

This is fundamentally different from every existing tool category:

| Existing Category | What It Does | What It Misses |
|---|---|---|
| **Static Analyzers** (SonarQube, Semgrep) | Scans code for patterns and vulnerabilities | Runtime behavior, business impact, AI-specific concerns, cross-system reasoning |
| **Coding Assistants** (Copilot, Cursor) | Generates code from prompts | System-wide understanding, production data, architectural consequences, outcome measurement |
| **Observability** (Datadog, New Relic) | Monitors production telemetry | Code context, design intent, improvement recommendations, cost optimization |
| **AI Evaluators** (Braintrust, PromptFoo) | Tests prompt/model quality | Architecture, infrastructure, full-system impact, business outcome correlation |
| **APM** (Dynatrace, AppDynamics) | Tracks application performance | Code evolution, AI agent behavior, business outcome correlation, design debt |
| **SAST/DAST** (Snyk, Checkmarx) | Finds security vulnerabilities | Performance, cost, UX, AI quality, architectural fitness |
| **Cost Analyzers** (Infracost, Kubecost) | Tracks infrastructure spend | Code efficiency, AI token waste, business value per dollar |
| **DevEx Platforms** (Backstage, Port) | Catalogs services and ownership | Deep reasoning, outcome measurement, evolution tracking |

**No existing tool reasons across all of these dimensions simultaneously.** Each tool sees one facet; Recurrsive sees the entire system as a living, evolving organism and reasons about its health holistically.

### 1.2 Why This Category Doesn't Exist Today

Three converging forces make the Engineering Intelligence Platform both possible and necessary now:

1. **AI software is qualitatively different.** Systems with LLMs, agents, RAG pipelines, and tool-calling chains exhibit non-deterministic behavior, stochastic costs, evolving quality, and emergent failure modes that traditional tools cannot model or reason about.

2. **System complexity has crossed a threshold.** Modern applications span dozens of services, multiple AI providers, polyglot data stores, multi-cloud infrastructure, and CI/CD pipelines — no single team holds the full picture. The "system of record" for the system itself does not exist.

3. **AI reasoning is finally capable enough.** Multi-agent reasoning, large context windows, structured output, and tool-calling enable an AI system to ingest, model, and reason about the full complexity of another AI system — the first time this has been tractable.

### 1.3 Competitive Landscape & Whitespace

```
                        Scope of Understanding
                  Narrow ◄──────────────────────► Holistic

            ┌─────────────────────────────────────────────┐
  Reactive  │  SAST/DAST    Observability    APM          │
  (alerts)  │  Linters      Log Analyzers    Error Track  │
            │                                             │
            ├─────────────────────────────────────────────┤
  Descriptive│ Code Assist  DevEx Portals   AI Evals     │
  (what is)  │ Doc Gen      Catalog Tools   Cost Dashbd  │
            ├─────────────────────────────────────────────┤
  Prescriptive│                                           │
  (what to   │                          ┌───────────────┐│
   do next)  │                          │  RECURRSIVE   ││
            │                          │  Engineering     ││
            │                          │  Intelligence    ││
            │                          │  Platform     ││
            │                          └───────────────┘│
            └─────────────────────────────────────────────┘
```

**The whitespace**: No product occupies the intersection of holistic understanding and prescriptive, evidence-based evolution guidance. Recurrsive fills this gap.

### 1.4 Positioning Statement

> **For engineering teams building modern software**, Recurrsive is an **Engineering Intelligence Platform** that continuously models your entire system and delivers evidence-based opportunities to improve quality, performance, reliability, security, cost, and business outcomes. **Unlike** coding assistants that only see code, observability tools that only see runtime, or AI evaluators that only see prompts, Recurrsive **reasons across every dimension of your software system** to surface what matters most and prove that changes worked.

### 1.5 How Recurrsive Relates to Existing Tools

Recurrsive **orchestrates, not replaces** existing tools. Every tool in a team's stack becomes an evidence source:

```
┌──────────────────────────────────────────────────────────────────┐
│                        RECURRSIVE                                │
│                  Engineering Intelligence Platform                │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                    DIGITAL TWIN                            │  │
│  │         (Unified semantic model of the system)             │  │
│  └──────────────────────┬─────────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────┐  ┌────────┴───────┐  ┌──────────────────────────┐ │
│  │ Reasoning│  │ Evolution      │  │ Execution                │ │
│  │ Engines  │  │ Prioritization │  │ (optional, approved)     │ │
│  └──────────┘  └────────────────┘  └──────────────────────────┘ │
│                                                                  │
│  ┌──────────────── Evidence Sources ──────────────────────────┐  │
│  │ GitHub  Datadog  OpenAI  Postgres  PostHog  Sentry  K8s   │  │
│  │ GitLab  Grafana  Anthropic  Redis  Mixpanel  Jira  Docker │  │
│  │ CI/CD   Prometheus  LangFuse  Mongo  LaunchDarkly  Slack  │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

- **Source control** (GitHub, GitLab) → evidence about code, PRs, history, velocity
- **Observability** (Datadog, Prometheus) → evidence about runtime behavior
- **AI platforms** (OpenAI, Anthropic, LangFuse) → evidence about AI quality and cost
- **Databases** (Postgres, MongoDB) → evidence about data model health
- **Product analytics** (PostHog, Mixpanel) → evidence about user outcomes
- **CI/CD** (GitHub Actions, ArgoCD) → evidence about build and deploy health

Recurrsive ingests their data, correlates it in the Digital Twin, reasons across it, and produces opportunities that reference the original tools for implementation.

---

## 2. Core Principles

These are non-negotiable architectural and product principles. Every design decision must be evaluated against them.

### 2.1 Evidence-Driven

Every recommendation, score, and ranking MUST be supported by traceable evidence. No opinion. No heuristic without citation. Every opportunity links to the specific data points, code locations, metrics, and observations that produced it.

- **Evidence chain**: raw data → normalized fact → correlated insight → hypothesis → scored opportunity
- **Confidence scoring**: every recommendation carries a confidence score (0.0–1.0) with explicit factors
- **Counter-evidence**: the system actively seeks evidence that contradicts its hypotheses
- **Falsifiability**: every recommendation includes a validation plan that can prove it wrong

### 2.2 Optimize Outcomes, Not Code

The goal is not prettier code, higher coverage numbers, or fewer linter warnings. The goal is measurably better **outcomes**: lower latency, higher conversion, reduced cost, fewer incidents, better AI quality, improved user satisfaction.

- Recommendations are ranked by **expected outcome impact**, not code aesthetics
- A "messy" function that works perfectly in production is not an opportunity
- A "clean" function causing silent data corruption in a critical path is a critical opportunity

### 2.3 Framework / Model / Runtime / Cloud / Language Agnostic

Recurrsive works with any stack through an **adapter-based architecture**:

- **Languages**: TypeScript, Python, Go, Rust, Java, C#, Ruby, PHP, Swift, Kotlin — and any new language via adapter
- **AI Models**: OpenAI, Anthropic, Google, Mistral, xAI, DeepSeek, local models, any provider via adapter
- **Frameworks**: LangGraph, CrewAI, LlamaIndex, AutoGen, Mastra, Semantic Kernel, Haystack, DSPy, custom — via adapter
- **Clouds**: AWS, Azure, GCP, DigitalOcean, Railway, Render, Fly, Vercel, Cloudflare — via adapter
- **Databases**: SQL, NoSQL, graph, time-series, search — via adapter
- **Runtimes**: Node.js, Python, JVM, .NET, Go, Rust, WASM — via adapter

No first-class / second-class distinction. The adapter interface is the same for all.

### 2.4 Production as First-Class Citizen

Production runtime data is not an afterthought bolted onto static analysis. It is a **primary evidence source** with equal weight to code:

- Runtime behavior can override static analysis conclusions
- Production performance data contextualizes code-level findings
- Real user behavior outweighs hypothetical usage patterns
- Incident history informs risk scoring

### 2.5 Continuously Improving (Not Snapshots)

Recurrsive is not a one-time audit. It is a **continuous runtime** that evolves its understanding:

- The Digital Twin updates incrementally as changes occur
- Recommendations are re-evaluated as new evidence arrives
- Confidence scores adjust based on outcome tracking
- The system learns from accepted and rejected recommendations

### 2.6 Plugin Everything

Every major subsystem is implemented as a plugin with a defined interface:

- No hardcoded integrations in the core
- Third parties can extend every layer
- Community plugins are first-class
- Plugin discovery, versioning, and dependency management are built-in

### 2.7 Open Standards

Recurrsive defines and publishes open schemas and protocols:

- Other tools can produce data Recurrsive consumes
- Other tools can consume data Recurrsive produces
- No vendor lock-in on data formats
- SARIF, OpenTelemetry, and other existing standards are adopted where applicable

### 2.8 Privacy and Governance First-Class

Privacy and data governance are not features — they are architectural constraints:

- **Read-only by default**: Recurrsive observes but does not modify unless explicitly authorized
- **Least-privilege access**: each collector requests only the minimum permissions required
- **Data never leaves boundaries**: processing happens where the data lives when required
- **PII is stripped before reasoning**: automatic detection and removal of sensitive fields
- **Audit everything**: every data access, every recommendation, every action is logged

---

## 3. The Digital Twin

### 3.1 What It Is

The Digital Twin is a **continuously synchronized semantic representation** of the entire software system. It is not a static snapshot — it is a living model that evolves in real-time as the system changes.

Think of it as a comprehensive, queryable, always-current "mental model" of the system that captures not just what exists, but how things relate, how they behave, and how they have changed over time.

### 3.2 What It Models

The Digital Twin maintains semantic models across nine dimensions:

| Dimension | What It Captures | Example Entities |
|---|---|---|
| **Architecture** | System structure, service boundaries, communication patterns, layers, modules | Services, endpoints, message queues, API gateways, load balancers |
| **Business Capabilities** | What the system does in business terms, feature mapping, domain boundaries | Features, user stories, business rules, domain events, value streams |
| **AI Workflows** | Agent graphs, prompt chains, tool-calling patterns, RAG pipelines, model routing | Agents, prompts, tools, models, memory stores, evaluation criteria |
| **Data Model** | Schemas, relationships, constraints, data flow, lineage, quality | Tables, collections, fields, indexes, migrations, ETL jobs, data pipelines |
| **Infrastructure** | Compute, storage, networking, configuration, secrets, scaling policies | Clusters, nodes, pods, containers, load balancers, CDNs, DNS, certificates |
| **Dependencies** | Package dependencies, service dependencies, data dependencies, temporal dependencies | Libraries, APIs, shared databases, event buses, cron schedules |
| **Product Flows** | User journeys, feature usage patterns, conversion funnels, interaction models | Pages, screens, actions, events, funnels, cohorts, segments |
| **Runtime Behavior** | Performance characteristics, error patterns, resource utilization, traffic patterns | Latency distributions, error rates, throughput curves, resource profiles |
| **Historical Evolution** | How every dimension has changed over time, decision history, trend lines | Commits, deployments, incidents, architecture decisions, metric trends |

### 3.3 How It Stays Synchronized

The Digital Twin is maintained through a three-stage pipeline:

```
┌─────────────┐    ┌──────────────┐    ┌──────────────────────┐
│  COLLECTORS  │───►│ NORMALIZERS  │───►│   DIGITAL TWIN       │
│              │    │              │    │                      │
│ Pull/Push/   │    │ Schema map   │    │ Incremental updates  │
│ Stream/Hook  │    │ Deduplicate  │    │ Conflict resolution  │
│              │    │ Enrich       │    │ Versioned snapshots  │
│              │    │ Validate     │    │ Event sourced        │
└─────────────┘    └──────────────┘    └──────────────────────┘
```

**Collectors** gather raw data from evidence sources using four ingestion modes:

| Mode | Mechanism | Latency | Use Case |
|---|---|---|---|
| **Pull** | Scheduled polling via API | Seconds–minutes | APIs without webhooks, batch data |
| **Push** | Webhooks, event subscriptions | Sub-second | Git pushes, CI events, alerts |
| **Stream** | Continuous data streams (Kafka, NATS, SSE) | Real-time | Logs, metrics, traces, AI completions |
| **Hook** | Lifecycle hooks in application code | Real-time | Custom instrumentation, agent tracing |

**Normalizers** transform raw data into the universal schema:

- Map source-specific schemas to the canonical Digital Twin schema
- Deduplicate entities across sources (e.g., a function seen in code AND in traces)
- Enrich with cross-references (e.g., link a slow query to the endpoint that calls it)
- Validate data integrity and freshness

**Incremental Updates** keep the twin current without full rebuilds:

- Event-sourced architecture: every change is an event, the twin is a projection
- Conflict resolution: when sources disagree, the twin maintains both views with provenance
- Versioned snapshots: the twin can be queried at any point in time
- Staleness detection: data older than its configured TTL is flagged and de-weighted in reasoning

### 3.4 How It's Queryable

The Digital Twin supports three query interfaces:

#### Natural Language

```
"Which endpoints have degraded by more than 20% in p99 latency over the last 30 days,
 and what code changes correlate with the degradation?"
```

The system translates natural language into structured queries, executes them, and returns results with full provenance.

#### Cypher (Graph Queries)

```cypher
MATCH (e:Endpoint)-[:CALLS]->(a:Agent)-[:USES_MODEL]->(m:Model)
WHERE e.p99_latency > 500 AND m.provider = 'openai'
RETURN e.path, a.name, m.name, e.p99_latency, a.avg_tokens_per_call
ORDER BY e.p99_latency DESC
LIMIT 20
```

#### GraphQL (Structured API)

```graphql
query {
  endpoints(filter: { p99Latency: { gt: 500 } }) {
    path
    method
    p99Latency
    calledAgents {
      name
      model { provider name }
      avgTokensPerCall
      avgCostPerCall
    }
    recentChanges(days: 30) {
      commit { sha author date }
      filesChanged
    }
  }
}
```

### 3.5 Example Queries and Their Value

| Query | Value Delivered |
|---|---|
| "What is the total monthly AI cost per feature?" | Maps token spend to business features, revealing which features are cost-efficient and which are not |
| "Which database tables have no application code referencing them?" | Identifies abandoned tables consuming storage and backup resources |
| "Show me all prompts that have been modified in the last 7 days and their evaluation score trends" | Tracks prompt quality over time and catches regressions early |
| "Which services have no owner assigned?" | Surfaces ownership gaps before they become incident response bottlenecks |
| "What is the blast radius if the OpenAI API goes down for 2 hours?" | Maps all dependencies on OpenAI to quantify business impact and identify fallback gaps |
| "Which user journeys touch the most services?" | Identifies high-coupling user paths that are fragile and slow |
| "Show me functions that are in hot paths but have zero test coverage" | Prioritizes testing effort by actual production risk, not arbitrary coverage targets |

---

## 4. The Five Layers

Recurrsive's architecture is organized into five layers, each building on the one below. Data flows upward; actions flow downward.

```
┌──────────────────────────────────────────────────────────────┐
│                    5. EXECUTION LAYER                        │
│              (Action — optional, approved)                   │
├──────────────────────────────────────────────────────────────┤
│                    4. EVOLUTION LAYER                        │
│              (Prioritization — what matters most)            │
├──────────────────────────────────────────────────────────────┤
│                    3. REASONING LAYER                        │
│              (Intelligence — hypotheses & debate)            │
├──────────────────────────────────────────────────────────────┤
│                    2. KNOWLEDGE LAYER                        │
│              (Understanding — the Digital Twin)              │
├──────────────────────────────────────────────────────────────┤
│                    1. REALITY LAYER                          │
│              (Facts — raw evidence from everywhere)          │
└──────────────────────────────────────────────────────────────┘
```

---

### 4.1 Reality Layer (Facts)

The Reality Layer is the foundation. It ingests, normalizes, and stores **raw evidence** from every part of the software system. It answers: *"What is actually happening?"*

Every fact in the Reality Layer has:
- **Source**: where it came from (system, API, file, stream)
- **Timestamp**: when it was observed
- **Freshness TTL**: how long it remains considered current
- **Confidence**: how reliable the source is (e.g., production metrics > static analysis guesses)
- **Provenance**: full chain of custody from raw data to normalized fact

#### 4.1.1 Development Evidence

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **Source Code** | ASTs, call graphs, dependency graphs, symbol tables, type information, comments, annotations, decorators | File system watcher + incremental parsing |
| **Git History** | Commits, diffs, blame, branch topology, merge patterns, commit frequency, file churn, author contributions | Git CLI / API |
| **Pull Requests** | PR descriptions, review comments, approval chains, time-to-merge, review depth, change size, conflict frequency | VCS platform API + webhooks |
| **Code Reviews** | Review comments, suggestions, nits vs blockers, reviewer expertise, review coverage | VCS platform API |
| **Issues & Tickets** | Issue descriptions, labels, priority, assignees, time-to-close, linked PRs, linked incidents | Issue tracker API |
| **Roadmaps** | Planned features, milestones, OKRs, strategic priorities, timelines | Project management API |
| **ADRs & RFCs** | Architecture decisions, alternatives considered, trade-offs documented, decision status | File system + document API |
| **Documentation** | README, guides, runbooks, API docs, inline docs, doc freshness, doc coverage | File system + document API |
| **API Contracts** | OpenAPI specs, GraphQL schemas, gRPC protos, AsyncAPI specs, contract versions, breaking changes | File system + registry API |
| **Design Systems** | Component inventory, usage frequency, consistency scores, accessibility compliance | Design system API + code analysis |

#### 4.1.2 Build Evidence

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **CI/CD Pipelines** | Pipeline definitions, run history, pass/fail rates, duration trends, flaky tests, retry counts | CI/CD platform API + webhooks |
| **Build Logs** | Build output, warnings, errors, timing breakdown, cache hit rates, artifact sizes | CI/CD platform API |
| **Test Results** | Test pass/fail, duration, flakiness score, coverage by file/function/branch, mutation testing results | Test runner output + CI artifacts |
| **Coverage Reports** | Line, branch, function, statement coverage; coverage trends; uncovered hot paths | Coverage tool output |
| **Static Analysis** | Linter findings, complexity metrics, code smells, duplication, style violations | SAST tool output (SARIF) |
| **Security Scans** | Vulnerability findings (CVEs), severity, exploitability, fix availability, SLA compliance | SAST/DAST/SCA tool output |
| **Package Manifests** | Dependencies, versions, licenses, known vulnerabilities, update availability, transitive deps | Package manager files |
| **Container Images** | Base images, layer sizes, vulnerability scans, image age, rebuild frequency | Container registry API |

#### 4.1.3 Infrastructure Evidence

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **Kubernetes** | Deployments, pods, services, ingresses, HPA configs, resource requests/limits, node utilization, events | K8s API + watch streams |
| **Docker** | Container configs, resource constraints, networking, volumes, health checks | Docker API |
| **Cloud Resources** | Compute instances, managed services, storage, networking, IAM policies, cost allocation tags | Cloud provider APIs |
| **Load Balancers** | Routing rules, health checks, connection counts, error rates, SSL/TLS config | Cloud/LB API |
| **Networking** | DNS records, firewall rules, VPC configs, peering, transit gateways, latency between zones | Cloud networking API |
| **Storage** | Volumes, object stores, backup policies, encryption, access patterns, costs | Cloud storage API |
| **Secrets Management** | Secret references (NOT values), rotation policies, access patterns, last-rotated timestamps | Secrets manager API (metadata only) |
| **Service Mesh** | Traffic policies, circuit breakers, retry configs, mTLS status, observability config | Service mesh API (Istio, Linkerd) |

#### 4.1.4 Production Runtime Evidence

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **Requests & Responses** | Endpoint traffic patterns, payload sizes, content types, status codes (sampled, no PII) | OpenTelemetry / APM |
| **Latency** | p50, p90, p95, p99, max; broken down by endpoint, service, dependency | OpenTelemetry / APM |
| **Throughput** | Requests per second, transactions per second, messages per second by service | Metrics (Prometheus, etc.) |
| **Errors** | Error rates, error types, stack traces, error correlation, error budgets | Error tracking (Sentry, etc.) |
| **Retries & Timeouts** | Retry counts, timeout rates, circuit breaker trips, fallback activations | OpenTelemetry / custom metrics |
| **Queue Depth** | Message queue sizes, consumer lag, dead letter queue sizes, processing latency | Queue system APIs |
| **Resource Utilization** | CPU, memory, disk, network I/O, GPU utilization by service/container | Infrastructure metrics |

#### 4.1.5 AI Runtime Evidence

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **Prompt Versions** | Prompt text, template variables, system/user/assistant messages, version history, A/B test assignments | Prompt management API / code |
| **Completion Quality** | Output text (if permitted), quality scores, relevance, faithfulness, coherence, format compliance | AI observability (LangFuse, etc.) |
| **Tool Calls** | Tool name, arguments, results, latency, success/failure, retry behavior | Agent framework hooks |
| **Agent Execution Graphs** | Step sequences, branching decisions, state transitions, termination conditions, cycle detection | Agent framework hooks |
| **Planning Traces** | Plan generation, plan refinement, plan execution, deviation detection | Agent framework hooks |
| **Memory & Context** | Context window utilization, memory retrieval quality, context composition strategy, retrieval scores | RAG/memory system hooks |
| **Hallucination Evaluations** | Factuality scores, groundedness, attribution, fabrication detection | Evaluation framework output |
| **Safety Evaluations** | Toxicity, bias, refusal rates, prompt injection detection, jailbreak attempts | Safety evaluation output |
| **Model Routing** | Model selection decisions, fallback chains, load balancing, A/B routing | Model router logs |
| **Token Usage & Cost** | Input tokens, output tokens, total tokens, cost per request, cost per feature, cost trends | Provider API / billing |

#### 4.1.6 Database Evidence

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **Schema — Structure** | Tables, collections, columns, types, relationships, foreign keys, constraints, check constraints | Database introspection queries |
| **Schema — Indexes** | Index definitions, covering indexes, partial indexes, unused indexes, index bloat | Database catalog queries |
| **Schema — Partitions** | Partition strategies, partition boundaries, partition sizes, partition pruning effectiveness | Database catalog queries |
| **Data — Row Counts** | Table sizes, collection sizes, growth rates, archival candidates | Statistics queries |
| **Data — Cardinality** | Distinct value counts per column, selectivity estimates, skew detection | Statistics queries |
| **Data — Null Ratios** | Percentage of NULL values per column, nullable columns that are never null | Statistics queries |
| **Data — Freshness** | Last insert/update timestamps, data staleness, refresh lag for materialized views | Metadata queries |
| **Data — Distribution** | Value distribution histograms, outlier detection, data skew | Sampling queries |
| **Data — Drift** | Schema drift detection, data type changes, constraint changes, migration history | Schema diff + migration files |
| **Data — Growth** | Storage growth rate, row count growth rate, index growth rate, projected capacity | Time-series metrics |
| **Data — Hot Partitions** | Uneven data distribution, hotspot detection, rebalancing candidates | Partition statistics |
| **Data — Duplicates** | Duplicate detection by key columns, near-duplicate fuzzy matching | Sampling queries |
| **Data — Orphans** | Rows referencing non-existent parents, broken relationships, referential integrity gaps | Join queries (sampled) |
| **Workload — Slow Queries** | Query execution plans, slow query logs, query frequency × duration rankings | Query log analysis |
| **Workload — Lock Contention** | Lock wait times, deadlock frequency, lock escalation events | Database monitoring |
| **Workload — Missing Indexes** | Query plans with sequential scans on large tables, index advisor recommendations | Query plan analysis |
| **Workload — Read/Write Ratios** | Read vs write throughput, read replica utilization, write amplification | Database metrics |
| **Workload — Cache Effectiveness** | Buffer pool hit rates, query cache hit rates, working set size vs available memory | Database metrics |
| **Workload — Connections** | Connection pool utilization, connection churn, max connection headroom, idle connections | Connection pool metrics |

#### 4.1.7 Business Data (When Permitted)

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **Conversion Funnels** | Step-by-step conversion rates, drop-off points, funnel velocity | Product analytics API |
| **Feature Adoption** | Feature usage rates by cohort, time-to-adoption, feature stickiness | Product analytics API |
| **Segmentation** | User segment definitions, segment-level metrics, behavioral clustering | Product analytics API |
| **Churn** | Churn rate, churn predictors, churn correlation with features/errors/latency | Business intelligence API |
| **Revenue** | Revenue per feature (when available), ARPU trends, pricing tier distribution | Business intelligence API |
| **Cohorts** | Cohort retention curves, cohort-level feature usage, cohort-level quality metrics | Product analytics API |

#### 4.1.8 Product Usage Evidence

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **User Journeys** | Common navigation paths, journey completion rates, journey duration | Product analytics API |
| **Session Flows** | Page/screen sequences, session duration, session depth, bounce rates | Product analytics API |
| **Drop-offs** | Abandonment points, rage clicks, dead clicks, error-correlated drop-offs | Product analytics API |
| **Feature Adoption** | Feature discovery rate, feature engagement depth, feature retention | Product analytics API |
| **Search Behavior** | Search queries, zero-result rates, search refinement patterns, search-to-action conversion | Search analytics |
| **Failed Actions** | Failed form submissions, failed API calls from UI, error message exposure | Product analytics + error tracking |
| **Navigation Friction** | Back-button usage, breadcrumb usage, help page visits, excessive scrolling | Product analytics API |
| **Accessibility** | Screen reader usage, keyboard navigation patterns, high-contrast mode, font scaling | Product analytics + a11y tools |
| **Devices** | Device types, screen sizes, browser versions, OS versions, input methods | Product analytics API |

#### 4.1.9 Customer Signals

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **Support Tickets** | Ticket volume, categories, severity, resolution time, escalation rate, feature/error correlation | Zendesk / Salesforce API |
| **Feature Requests** | Request volume by feature, upvote counts, customer segment of requesters | Issue tracker / feedback tool API |
| **App Store Reviews** | Rating distribution, review text (sentiment, topics), rating trends | App store API |
| **GitHub Issues** | Community-reported bugs, feature requests, discussion activity | GitHub API |
| **Community Forums** | Question frequency, answer rates, common pain points, trending topics | Forum API / scraping |
| **Slack / Discord** | Support channel activity, common questions, response times (public channels only) | Bot API (with consent) |

#### 4.1.10 Business Signals

| Source | Data Collected | Collector Mechanism |
|---|---|---|
| **Revenue** | MRR, ARR, revenue by plan/tier, revenue trends | Business intelligence API |
| **Cost** | Infrastructure cost, AI cost, third-party service cost, total cost of ownership | Cloud billing + vendor APIs |
| **Margin** | Gross margin per customer, margin trends, cost-to-serve | Calculated from revenue + cost |
| **Customer Lifetime Value (CLV)** | CLV by segment, CLV trends, CLV predictors | Business intelligence API |
| **Acquisition** | CAC, signup rates, trial-to-paid conversion, acquisition channel effectiveness | Marketing / product analytics |
| **Retention** | Monthly/annual retention rates, retention by cohort, retention predictors | Product analytics API |
| **Activation** | Time-to-value, activation rate, activation milestones | Product analytics API |
| **Expansion** | Upsell rate, expansion revenue, feature-to-upsell correlation | Business intelligence API |
| **Renewal** | Renewal rate, renewal predictors, at-risk accounts | CRM API |
| **SLA Performance** | SLA compliance rates, SLA breach incidents, SLA headroom | Monitoring + incident management |

---

### 4.2 Knowledge Layer (Understanding)

The Knowledge Layer transforms raw facts from the Reality Layer into **structured understanding**. It builds and maintains the **Universal Knowledge Graph** — the queryable semantic model that makes cross-dimensional reasoning possible.

#### 4.2.1 What It Understands

| Understanding Domain | Description | Built From |
|---|---|---|
| **Architecture** | Service boundaries, communication patterns, layering, coupling, cohesion, architectural styles | Code analysis + infrastructure + runtime |
| **Dependencies** | Direct, transitive, runtime, and implicit dependencies between all entities | Package manifests + code + infrastructure + runtime |
| **Workflows** | End-to-end request flows, business process flows, data processing pipelines | Code + runtime traces + documentation |
| **Agents** | Agent capabilities, tool inventories, decision patterns, execution graphs, quality profiles | AI runtime evidence + code |
| **Prompts** | Prompt inventories, version history, quality trends, model compatibility, cost profiles | Code + AI runtime |
| **Business Domains** | Domain boundaries, ubiquitous language, domain events, bounded contexts | Code + documentation + business data |
| **Data Lineage** | Data flow from source to destination through transformations, aggregations, and derivations | Code + database + ETL/pipeline configs |
| **Ownership** | Service owners, code owners, on-call rotations, escalation paths, knowledge concentration | VCS (CODEOWNERS) + org config + git blame |
| **Documentation** | Doc inventory, doc freshness, doc coverage gaps, doc-to-code consistency | File system + documentation platforms |

#### 4.2.2 The Universal Knowledge Graph

The Knowledge Graph is the central data structure of the Digital Twin. It models **entities** and **relationships** in a property graph.

**Core Entity Types:**

| Category | Entity Types |
|---|---|
| **Code** | `Repository`, `File`, `Module`, `Function`, `Class`, `Method`, `Interface`, `Type`, `Variable`, `Constant` |
| **API** | `Endpoint`, `Route`, `GraphQLField`, `gRPCMethod`, `WebSocketChannel`, `EventTopic` |
| **AI** | `Prompt`, `Agent`, `Tool`, `Model`, `MemoryStore`, `EvalCriterion`, `RAGPipeline`, `Chain`, `Workflow` |
| **Data** | `Database`, `Table`, `Collection`, `Column`, `Index`, `Query`, `Migration`, `DataPipeline`, `Schema` |
| **Infrastructure** | `Service`, `Container`, `Pod`, `Cluster`, `LoadBalancer`, `CDN`, `Queue`, `Cache`, `ObjectStore` |
| **Runtime** | `TelemetryStream`, `Metric`, `Trace`, `Span`, `Log`, `Alert`, `Incident` |
| **Dependencies** | `Package`, `Library`, `ExternalAPI`, `SharedDatabase`, `EventBus` |
| **Product** | `Feature`, `UserJourney`, `Funnel`, `Segment`, `Experiment`, `FeatureFlag` |
| **Business** | `BusinessMetric`, `SLA`, `CostCenter`, `Revenue`, `Customer` |
| **Organization** | `Team`, `Person`, `OnCallRotation`, `Runbook`, `ADR`, `RFC` |

**Core Relationship Types:**

| Relationship | From → To | Properties |
|---|---|---|
| `CALLS` | Function → Function | frequency, avg_latency |
| `IMPORTS` | Module → Module | version_constraint |
| `DEPENDS_ON` | Service → Service | protocol, criticality |
| `USES_MODEL` | Agent → Model | token_budget, fallback_order |
| `QUERIES` | Function → Table | query_type, avg_duration |
| `OWNS` | Team → Service | since, on_call |
| `TRIGGERS` | Event → Workflow | conditions |
| `PART_OF` | Endpoint → Feature | coverage |
| `DEPLOYED_ON` | Service → Cluster | replicas, resources |
| `TESTED_BY` | Function → TestCase | coverage_type |
| `DOCUMENTED_BY` | Service → Document | freshness |
| `COSTS` | Model → CostCenter | cost_per_1k_tokens |
| `AFFECTS` | Incident → Service | severity, duration |
| `PRODUCES` | DataPipeline → Table | freshness, SLA |
| `CONSUMES` | Agent → Tool | call_frequency, error_rate |

Every entity and relationship carries:
- **Properties**: key-value pairs with typed values
- **Provenance**: which collector(s) produced this data, when, and with what confidence
- **Version**: the entity's version history, enabling time-travel queries
- **Staleness**: time since last update, with automatic de-weighting in reasoning

---

### 4.3 Reasoning Layer (Intelligence)

The Reasoning Layer is the cognitive core of Recurrsive. It takes the structured understanding from the Knowledge Layer and produces **hypotheses** — not conclusions, not recommendations, but testable hypotheses with evidence and confidence.

#### 4.3.1 Specialist Reasoning Engines

Each specialist is a focused reasoning engine with deep expertise in one domain. Specialists produce hypotheses independently before entering the debate process.

| Specialist | Focus Area | Example Hypothesis |
|---|---|---|
| **Architecture** | Coupling, cohesion, boundaries, patterns, anti-patterns, complexity, modularity | "Service X has accumulated a God Service anti-pattern with 47 endpoints and 12 database dependencies, suggesting decomposition would reduce blast radius" |
| **Performance** | Latency, throughput, resource efficiency, bottlenecks, scaling limits | "The p99 latency spike on /api/search correlates with a 3x increase in vector DB query time after the RAG index grew past 10M documents" |
| **Security** | Vulnerabilities, misconfigurations, access control, secrets, supply chain | "The JWT validation middleware is bypassed on 3 internal endpoints that are now exposed through the new API gateway" |
| **Cost** | Infrastructure spend, AI token costs, cost per transaction, cost efficiency | "Switching the summarization agent from GPT-4o to Claude 3.5 Haiku for Tier 1 (low-complexity) requests would reduce AI costs by 34% with <2% quality degradation based on eval scores" |
| **AI Quality** | Prompt effectiveness, agent reliability, hallucination rates, tool-call accuracy, context quality | "The customer support agent's hallucination rate increased from 2.1% to 8.7% after the knowledge base update on June 15th, correlating with 3 new product categories lacking documentation" |
| **Product** | Feature adoption, user journey friction, conversion impact, engagement patterns | "Users who encounter the onboarding wizard complete activation at 73% vs 31% for those who skip it, but 44% of users aren't shown the wizard due to a feature flag misconfiguration" |
| **UX** | Interface responsiveness, interaction patterns, error states, loading performance | "The checkout flow shows a 12% rage-click rate on the 'Submit' button, correlating with a 3-second delay caused by synchronous fraud detection API call" |
| **Accessibility** | WCAG compliance, screen reader compatibility, keyboard navigation, color contrast | "14 interactive elements lack ARIA labels, and the primary CTA fails WCAG AA contrast ratio at 3.2:1 (minimum 4.5:1 required)" |
| **Privacy** | PII exposure, data retention, consent compliance, cross-border data flow | "User email addresses appear in 3 log streams that are forwarded to a third-party observability provider without explicit consent" |
| **Reliability** | Failure modes, resilience, recovery, redundancy, blast radius, chaos engineering gaps | "The payment service has a single point of failure in its Redis session store with no fallback, and the circuit breaker timeout (30s) exceeds the user-facing timeout (10s)" |
| **Compliance** | Regulatory requirements, audit readiness, policy violations, certification gaps | "SOC 2 requires access reviews every 90 days; the last review was 147 days ago, and 3 terminated employees retain active service accounts" |
| **Developer Experience** | Build times, onboarding friction, documentation gaps, tooling pain, cognitive load | "The average PR build time has increased from 4.2 to 11.7 minutes over 60 days, correlating with the addition of 3 new integration test suites that could run in parallel" |

#### 4.3.2 Multi-Agent Debate Protocol

Specialists do not operate in isolation. Their hypotheses are refined through a structured **multi-agent debate**:

```
┌─────────────────────────────────────────────────────────┐
│                  DEBATE PROTOCOL                        │
│                                                         │
│  Phase 1: PRESENTATION                                  │
│  ├─ Each specialist presents hypotheses with evidence   │
│  ├─ Hypotheses are tagged with domain, confidence,      │
│  │  and evidence links                                  │
│  └─ No cross-talk in this phase                         │
│                                                         │
│  Phase 2: CHALLENGE                                     │
│  ├─ Specialists challenge each other's hypotheses       │
│  ├─ "Your performance hypothesis doesn't account for    │
│  │   the security constraint that requires synchronous  │
│  │   encryption on that path"                           │
│  ├─ Counter-evidence is presented                       │
│  └─ Confidence scores are adjusted up or down           │
│                                                         │
│  Phase 3: SYNTHESIS                                     │
│  ├─ Synthesizer agent consolidates findings             │
│  ├─ Merges overlapping hypotheses                       │
│  ├─ Identifies conflicting hypotheses                   │
│  └─ Produces unified opportunity candidates             │
│                                                         │
│  Phase 4: JUDGMENT                                      │
│  ├─ Judge agent scores each opportunity on:             │
│  │  evidence strength, internal consistency,            │
│  │  actionability, expected impact                      │
│  ├─ Assigns final confidence score                      │
│  └─ Flags opportunities requiring human review          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

#### 4.3.3 Cognitive Frameworks (Not Personas)

The reasoning engines use **cognitive frameworks** — structured thinking patterns — not "personas" or "role-play." This distinction matters:

| Cognitive Framework | Thinking Pattern | Application |
|---|---|---|
| **Causal Analysis** | Identify root causes, not symptoms; trace causal chains | Performance regressions, incident analysis |
| **Trade-off Analysis** | Explicitly enumerate trade-offs; no free lunches | Architecture decisions, technology selection |
| **Counterfactual Reasoning** | "What would happen if we didn't act?" | Risk assessment, opportunity cost |
| **Adversarial Thinking** | "How could this hypothesis be wrong?" | Security, reliability, confidence calibration |
| **Systems Thinking** | Second-order effects, feedback loops, emergent behavior | Architecture, scaling, organizational impact |
| **Bayesian Updating** | Update beliefs based on new evidence, track prior probabilities | Confidence calibration, trend analysis |
| **Temporal Reasoning** | Consider time dependencies, ordering constraints, decay, urgency | Prioritization, SLA management, decay of value |

#### 4.3.4 Evidence Scoring

Every piece of evidence used in reasoning is scored:

| Dimension | Scale | Description |
|---|---|---|
| **Relevance** | 0.0–1.0 | How directly does this evidence relate to the hypothesis? |
| **Recency** | 0.0–1.0 | How recent is this evidence? (Decays based on source-specific TTL) |
| **Reliability** | 0.0–1.0 | How trustworthy is the source? (Production metrics > static analysis guesses) |
| **Corroboration** | 0.0–1.0 | Is this evidence supported by other independent sources? |
| **Specificity** | 0.0–1.0 | How specific is this evidence to the hypothesis vs. general? |

**Composite Evidence Score** = weighted combination of all dimensions, with weights configurable per organization.

---

### 4.4 Evolution Layer (Prioritization)

The Evolution Layer takes hypotheses from the Reasoning Layer and transforms them into **prioritized, actionable opportunities** by evaluating business and technical impact.

#### 4.4.1 Opportunity Ranking

Hypotheses compete for attention. Each is scored on seven dimensions:

| Dimension | Weight (default) | Description |
|---|---|---|
| **Business Impact** | 0.25 | Expected impact on revenue, conversion, retention, satisfaction |
| **Technical Impact** | 0.20 | Expected impact on performance, reliability, security, quality |
| **Confidence** | 0.20 | Strength of evidence and reasoning supporting this opportunity |
| **Cost (inverse)** | 0.10 | Estimated effort to implement (lower cost = higher score) |
| **Risk (inverse)** | 0.10 | Risk of unintended consequences (lower risk = higher score) |
| **Dependencies** | 0.05 | Number and complexity of dependencies (fewer = higher score) |
| **Time Sensitivity** | 0.10 | Urgency — will the opportunity's value decay if delayed? |

Weights are configurable per organization and can be adjusted to reflect strategic priorities (e.g., a company in "reliability mode" can increase the reliability weight).

**Composite Evolution Score** = Σ(dimension_score × weight), normalized to 0.0–1.0.

#### 4.4.2 The Evolution Graph

The Evolution Graph is a directed acyclic graph (DAG) of opportunities showing dependencies, conflicts, and synergies:

```
┌───────────────┐        ┌───────────────┐
│ Decompose     │───────►│ Add circuit   │
│ monolith      │        │ breakers      │
│ (OPP-001)     │        │ (OPP-003)     │
└───────┬───────┘        └───────────────┘
        │
        ▼
┌───────────────┐        ┌───────────────┐
│ Migrate to    │◄──────►│ Optimize DB   │
│ event-driven  │ synergy│ queries       │
│ (OPP-002)     │        │ (OPP-004)     │
└───────────────┘        └───────────────┘
```

- **Dependencies**: OPP-003 depends on OPP-001 (can't add circuit breakers to services that don't exist yet)
- **Synergies**: OPP-002 and OPP-004 amplify each other's impact
- **Conflicts**: some opportunities may be mutually exclusive (e.g., two different architectural approaches)

#### 4.4.3 Maturity Tracking

Recurrsive tracks system maturity across eight dimensions over time:

| Maturity Dimension | Level 1 (Ad-hoc) | Level 2 (Defined) | Level 3 (Measured) | Level 4 (Optimized) | Level 5 (Evolving) |
|---|---|---|---|---|---|
| **Architecture** | Monolith, no boundaries | Service boundaries defined | Coupling/cohesion measured | Architecture fitness functions | Self-optimizing boundaries |
| **AI** | Ad-hoc prompts, no evals | Prompt versioning, basic evals | Quality metrics tracked | A/B testing, optimization | Self-improving prompts |
| **Security** | No security scanning | Automated SAST/DAST | Vulnerability SLAs met | Threat modeling integrated | Continuous security posture |
| **Operational** | Manual deployments | CI/CD automated | SLO/SLI defined | Error budgets enforced | Self-healing systems |
| **Product** | No usage tracking | Basic analytics | Funnel optimization | Experiment-driven | Predictive product decisions |
| **Developer Experience** | No standards | Style guides, linting | Build time SLAs | DX metrics dashboard | Continuous DX optimization |
| **Reliability** | Hope-based | Basic monitoring | SLOs with error budgets | Chaos engineering | Antifragile systems |
| **Data** | No schema management | Migrations tracked | Data quality monitored | Data contracts enforced | Self-documenting data |

#### 4.4.4 Evolution Timeline

A week-over-week view of system health:

```
Week    Arch  AI   Sec  Ops  Prod  DX   Rel  Data  Overall
2026-24  3.2  2.8  3.5  4.1  2.5   3.0  3.8  2.9   3.2
2026-25  3.2  3.1  3.5  4.1  2.7   3.1  3.8  2.9   3.3  ↑
2026-26  3.4  3.1  3.7  4.2  2.7   3.3  3.9  3.0   3.4  ↑
2026-27  3.4  3.3  3.7  4.2  2.9   3.3  3.9  3.1   3.5  ↑
```

Trends are tracked, anomalies detected, and regressions flagged automatically.

---

### 4.5 Execution Layer (Action)

The Execution Layer is **optional** and **always requires explicit approval** before any change is made. Recurrsive is primarily a read-only intelligence system; execution is opt-in.

#### 4.5.1 Capabilities

| Capability | Description | Approval Required |
|---|---|---|
| **Generate RFCs** | Create Architecture Decision Records or Requests for Comments from opportunities | Low (document creation) |
| **Generate ADRs** | Create formal Architecture Decision Records with alternatives, trade-offs, and decision | Low (document creation) |
| **Open Issues** | Create issues in the team's issue tracker with full context and evidence links | Low (issue creation) |
| **Create Pull Requests** | Generate code changes with full context, test updates, and documentation | High (code change) |
| **Run Experiments** | Design and configure A/B tests or canary deployments to validate hypotheses | High (production change) |
| **Launch Feature Flags** | Create or modify feature flag configurations to enable gradual rollouts | High (production change) |
| **Create Benchmarks** | Generate benchmark suites to measure baseline and improvement | Medium (test creation) |
| **Run Evaluations** | Execute AI evaluation suites against current prompts/agents and proposed changes | Medium (evaluation run) |

#### 4.5.2 Approval Workflow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Recurrsive│────►│ Approval │────►│ Approved │────►│ Executed │
│ proposes  │     │ Queue    │     │ by human │     │ & tracked│
│ action    │     │          │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                       │
                       ▼
                 ┌──────────┐
                 │ Rejected │ ← feedback captured for learning
                 │ by human │
                 └──────────┘
```

- **No autonomous production changes**: every action that modifies production state requires human approval
- **Approval levels**: configurable by action type (e.g., RFC creation auto-approved, PR creation requires lead approval)
- **Feedback loop**: rejections are fed back into the learning system with reasons
- **Rollback plans**: every approved action includes a rollback plan that is validated before execution

---

## 5. The Opportunity Format

An **Opportunity** is the fundamental output unit of Recurrsive. It represents a specific, evidence-backed, actionable possibility to improve the system.

### 5.1 Complete Schema

```yaml
opportunity:
  id: string                    # Unique identifier (e.g., "OPP-2026-0847")
  title: string                 # Human-readable summary (max 120 chars)
  type: enum                    # "opportunity" | "risk" | "debt"
  category: string              # Domain category (performance, security, cost, ai_quality, etc.)

  problem: string               # Clear description of the current state and why it's suboptimal
  evidence: Evidence[]          # Array of supporting evidence items
  recommendation: string        # Specific, actionable recommendation

  expected_impact:
    description: string         # Narrative description of expected impact
    metrics:                    # Specific, measurable expected changes
      - metric: string          # Metric name (e.g., "p99_latency_ms")
        current_value: number   # Current measured value
        expected_value: number  # Expected value after implementation
        unit: string            # Unit of measurement
        measurement_method: string  # How to measure this

  confidence: float             # 0.0–1.0, composite confidence score
  effort: enum                  # "trivial" | "small" | "medium" | "large" | "epic"
  risk: enum                    # "low" | "medium" | "high" | "critical"

  validation_plan: string       # How to verify the recommendation works
  rollback_plan: string         # How to undo if it doesn't work

  reasoning:
    proposer: string            # Which specialist engine proposed this
    supporters: string[]        # Which specialists agree, and why
    dissenters: string[]        # Which specialists disagree, and why
    consensus_score: float      # 0.0–1.0, degree of specialist agreement
    evidence_links: string[]    # URIs to specific evidence items
    debate_transcript: string   # Summary of the multi-agent debate

  locations: Location[]         # SARIF-compatible source locations
  related_opportunities: string[] # IDs of related opportunities
  dependencies: string[]       # IDs of opportunities that must be completed first

  status: enum                  # "proposed" | "accepted" | "rejected" | "implemented" | "validated"
  simulation_results: SimulationResult  # Results from impact simulation

  tags: string[]                # Freeform tags for filtering
  created_at: datetime          # ISO 8601
  updated_at: datetime          # ISO 8601
```

**Sub-schemas:**

```yaml
Evidence:
  id: string
  source: string                # Collector that produced this evidence
  type: string                  # "metric" | "code" | "trace" | "log" | "document" | "user_report"
  description: string           # Human-readable description
  data: object                  # Source-specific evidence data
  collected_at: datetime
  confidence: float             # 0.0–1.0
  uri: string                   # Link to the original data

Location:                       # SARIF-compatible
  uri: string                   # File path or resource URI
  startLine: integer
  startColumn: integer
  endLine: integer
  endColumn: integer
  message: string               # Context for this location

SimulationResult:
  ran_at: datetime
  scenario: string              # Description of simulated scenario
  predicted_outcome: object     # Predicted metric changes
  confidence_interval: object   # Upper/lower bounds
  assumptions: string[]         # Assumptions made in simulation
  limitations: string[]         # Known limitations of this simulation
```

### 5.2 Full Example Opportunity

```yaml
opportunity:
  id: "OPP-2026-0847"
  title: "Replace synchronous fraud check with async pattern to eliminate checkout latency spike"
  type: "opportunity"
  category: "performance"

  problem: |
    The checkout endpoint POST /api/v2/checkout has a p99 latency of 4,200ms,
    exceeding the 2,000ms SLO. Root cause: a synchronous call to the fraud
    detection service (FraudShield API) that blocks the response. The fraud
    check averages 1,800ms but spikes to 3,500ms during peak hours (2-4pm UTC).
    This correlates with a 12% cart abandonment rate increase during peak hours
    compared to off-peak, representing an estimated $47K/month in lost revenue.

  evidence:
    - id: "EV-9901"
      source: "opentelemetry-collector"
      type: "trace"
      description: "p99 latency breakdown of /api/v2/checkout showing 82% of time spent in fraud_check span"
      data:
        endpoint: "/api/v2/checkout"
        p99_latency_ms: 4200
        fraud_check_span_p99_ms: 3500
        sample_size: 142000
        time_range: "2026-06-01 to 2026-06-28"
      collected_at: "2026-06-28T23:00:00Z"
      confidence: 0.95
      uri: "recurrsive://traces/checkout-latency-breakdown"

    - id: "EV-9902"
      source: "posthog-collector"
      type: "metric"
      description: "Cart abandonment rate comparison: peak hours vs off-peak"
      data:
        peak_abandonment_rate: 0.23
        offpeak_abandonment_rate: 0.11
        correlation_with_latency: 0.87
      collected_at: "2026-06-28T22:00:00Z"
      confidence: 0.82
      uri: "recurrsive://product/cart-abandonment-analysis"

    - id: "EV-9903"
      source: "git-collector"
      type: "code"
      description: "Synchronous await on fraudShieldClient.check() in checkout handler"
      data:
        file: "src/api/checkout/handler.ts"
        function: "processCheckout"
        line: 47
        code_snippet: "const result = await fraudShieldClient.check(order);"
      collected_at: "2026-06-28T20:00:00Z"
      confidence: 1.0
      uri: "recurrsive://code/src/api/checkout/handler.ts#L47"

  recommendation: |
    Decouple the fraud check from the checkout response path:
    1. Accept the order optimistically with status "pending_verification"
    2. Publish a FraudCheckRequested event to the message queue
    3. Fraud service processes asynchronously and publishes FraudCheckCompleted
    4. If fraud detected: cancel order, notify user, trigger refund
    5. Historical data shows 0.02% fraud rate, so 99.98% of orders proceed without delay
    This pattern is used successfully by the order-update service (OPP-0612).

  expected_impact:
    description: "Reduce checkout p99 latency by ~75%, reducing peak-hour cart abandonment"
    metrics:
      - metric: "checkout_p99_latency_ms"
        current_value: 4200
        expected_value: 800
        unit: "milliseconds"
        measurement_method: "OpenTelemetry p99 over 7-day window"
      - metric: "peak_cart_abandonment_rate"
        current_value: 0.23
        expected_value: 0.13
        unit: "ratio"
        measurement_method: "PostHog funnel: cart → checkout_complete during 2-4pm UTC"
      - metric: "estimated_monthly_revenue_recovery"
        current_value: 0
        expected_value: 47000
        unit: "USD"
        measurement_method: "Revenue delta during peak hours, 30-day trailing"

  confidence: 0.88
  effort: "medium"
  risk: "medium"

  validation_plan: |
    1. Deploy async checkout behind feature flag to 5% of traffic
    2. Measure p99 latency for flagged vs control group over 7 days
    3. Monitor fraud detection latency (should not regress)
    4. Compare cart abandonment rates between groups
    5. Verify no orders slip through without fraud check completion
    Success criteria: p99 < 1000ms AND fraud check completion rate > 99.99%

  rollback_plan: |
    1. Disable feature flag (immediate rollback to synchronous path)
    2. Drain pending fraud check queue
    3. Verify all in-flight orders have fraud check completed
    Estimated rollback time: < 2 minutes via feature flag

  reasoning:
    proposer: "performance-specialist"
    supporters:
      - "product-specialist: Confirms correlation between latency and abandonment from user journey analysis"
      - "cost-specialist: Async pattern reduces compute costs by eliminating blocked threads during fraud check"
      - "reliability-specialist: Decoupling reduces blast radius of FraudShield outages"
    dissenters:
      - "security-specialist: Accepts the pattern but flags risk of processing orders before fraud check completes. Mitigated by order hold and 0.02% historical fraud rate."
    consensus_score: 0.91
    evidence_links:
      - "recurrsive://traces/checkout-latency-breakdown"
      - "recurrsive://product/cart-abandonment-analysis"
      - "recurrsive://code/src/api/checkout/handler.ts#L47"
    debate_transcript: |
      Performance specialist presented latency evidence. Product specialist
      corroborated with abandonment data. Security specialist raised concern
      about pre-verification order processing. Team noted 0.02% fraud rate
      and order hold mechanism as mitigation. Consensus reached.

  locations:
    - uri: "src/api/checkout/handler.ts"
      startLine: 42
      startColumn: 1
      endLine: 58
      endColumn: 1
      message: "Synchronous fraud check in checkout handler"
    - uri: "src/services/fraud/client.ts"
      startLine: 15
      startColumn: 1
      endLine: 30
      endColumn: 1
      message: "FraudShield client with synchronous check method"

  related_opportunities:
    - "OPP-2026-0612"  # Order-update service async pattern (reference implementation)
    - "OPP-2026-0901"  # FraudShield API timeout optimization

  dependencies: []  # No blocking dependencies

  status: "proposed"

  simulation_results:
    ran_at: "2026-06-28T23:30:00Z"
    scenario: "Route 100% of checkout traffic through async fraud check path"
    predicted_outcome:
      p99_latency_ms: 750
      cart_abandonment_rate: 0.12
      fraud_check_completion_rate: 0.9999
    confidence_interval:
      p99_latency_ms: [600, 950]
      cart_abandonment_rate: [0.10, 0.15]
    assumptions:
      - "FraudShield API latency is independent of call pattern (sync vs async)"
      - "Message queue latency adds < 50ms"
      - "Cart abandonment is primarily latency-driven during peak hours"
    limitations:
      - "Simulation does not account for potential user behavior changes from 'pending_verification' status display"
      - "Revenue estimate assumes linear relationship between abandonment rate and latency"

  tags: ["checkout", "latency", "revenue", "fraud", "async"]
  created_at: "2026-06-28T23:45:00Z"
  updated_at: "2026-06-28T23:45:00Z"
```

---

## 6. The Recommendation Pipeline

Every recommendation in Recurrsive flows through a ten-stage pipeline. No stage can be skipped.

```
┌─────────────┐    ┌──────────┐    ┌────────────┐    ┌────────────┐
│ 1. Observe  │───►│2. Collect │───►│3. Hypothe- │───►│4. Simulate │
│             │    │ Evidence  │    │   size     │    │            │
└─────────────┘    └──────────┘    └────────────┘    └────────────┘
                                                           │
┌─────────────┐    ┌──────────┐    ┌────────────┐          │
│ 7. Experi-  │◄───│6. Risk   │◄───│5. Expected │◄─────────┘
│   ment Plan │    │ Assess   │    │  Outcome   │
└──────┬──────┘    └──────────┘    └────────────┘
       │
       ▼
┌─────────────┐    ┌──────────┐    ┌────────────┐
│ 8. Decision │───►│9. Learn  │───►│10. Update  │
│             │    │          │    │ Knowledge  │
└─────────────┘    └──────────┘    └────────────┘
```

### Stage 1: Observation

The system continuously monitors all evidence sources for **signals** — deviations from baselines, anomalies, trends, threshold breaches, and pattern matches.

- **Baseline comparison**: is this metric significantly different from its 7-day / 30-day / 90-day baseline?
- **Anomaly detection**: does this pattern deviate from the expected distribution?
- **Trend detection**: is there a statistically significant trend in this metric?
- **Threshold monitoring**: has this metric crossed a defined threshold or SLO?
- **Pattern matching**: does this code/config/behavior match a known anti-pattern?

### Stage 2: Evidence Collection

When a signal is detected, the system gathers **corroborating and contradicting evidence** from across the Digital Twin:

- Query related entities in the Knowledge Graph
- Pull recent metrics for affected components
- Check historical patterns for similar signals
- Identify recent changes that may correlate
- Gather evidence from all relevant dimensions (code + runtime + data + product)

### Stage 3: Hypothesis Formation

Specialist reasoning engines form **testable hypotheses** explaining the observation:

- Each hypothesis has a clear statement, supporting evidence, and predicted consequences
- Multiple competing hypotheses are generated (not just the most obvious)
- Hypotheses enter the multi-agent debate protocol (Section 4.3.2)
- Hypotheses that survive debate are promoted to opportunities

### Stage 4: Simulation

Surviving hypotheses are simulated against the Digital Twin:

- **What-if analysis**: what happens to system metrics if we implement this change?
- **Blast radius estimation**: what other components are affected?
- **Load simulation**: how does this change behave under current and projected load?
- **Cost modeling**: what is the implementation cost vs. expected savings?

### Stage 5: Expected Outcome

Simulation results are translated into **specific, measurable expected outcomes**:

- Named metrics with current and expected values
- Confidence intervals (not point estimates)
- Time-to-impact estimates
- Prerequisites and assumptions made explicit

### Stage 6: Risk Assessment

Every opportunity is assessed for risk:

- **Implementation risk**: how likely is the implementation to introduce bugs?
- **Operational risk**: how might this affect production stability?
- **Business risk**: what is the worst-case business impact?
- **Reversibility**: how easily can this change be rolled back?
- **Dependency risk**: what other changes does this depend on?

### Stage 7: Experiment Plan

A concrete plan to validate the hypothesis in production (when applicable):

- Feature flag strategy
- Traffic allocation (percentage, segments)
- Duration of experiment
- Success criteria (specific metric thresholds)
- Guardrail metrics (metrics that must NOT regress)
- Data collection plan

### Stage 8: Decision

The opportunity is presented to the team with full context:

- Problem statement with evidence
- Recommendation with expected impact
- Risk assessment with rollback plan
- Experiment plan
- Reasoning transparency (who agreed, who disagreed, why)

The team **accepts**, **rejects**, or **defers** the opportunity.

### Stage 9: Learning

Whether accepted or rejected, the system learns:

- **If accepted and implemented**: track actual outcomes vs. predicted outcomes; calibrate confidence models
- **If accepted and outcomes differ**: analyze why predictions were wrong; adjust reasoning
- **If rejected**: capture rejection reasons; adjust future recommendations
- **If deferred**: re-evaluate when conditions change

### Stage 10: Knowledge Base Update

Learnings flow back into the system:

- Successful patterns are added to the knowledge base
- Failed predictions are used to calibrate confidence models
- Rejection reasons inform future hypothesis filtering
- The system improves its recommendations over time

---

## 7. Evidence Sources — Complete Collector List

Every integration is implemented as a **Collector Plugin** conforming to the `Collector` interface. Below is the complete list of supported and planned sources, organized by category. As of v0.5.7, 14 collectors are implemented (Git, Documentation, Environment, CI/CD, Database, GitHub, GitLab, OpenTelemetry, Cloud Cost, Error Tracking, APM, Langfuse, Arize, Helicone); the remainder are planned for future releases.

### 7.1 Code & Version Control

| Collector | Sources | Data Collected |
|---|---|---|
| `git-collector` | Any Git repository (local) | Commits, diffs, blame, branches, tags, file history, churn |
| `github-collector` | GitHub (cloud & enterprise) | Repos, PRs, reviews, issues, actions, packages, CODEOWNERS, releases |
| `gitlab-collector` | GitLab (cloud & self-hosted) | Repos, MRs, reviews, issues, pipelines, packages, releases |
| `bitbucket-collector` | Bitbucket (cloud & server) | Repos, PRs, reviews, pipelines, deployments |
| `azure-devops-collector` | Azure DevOps | Repos, PRs, work items, pipelines, artifacts, boards |
| `local-folder-collector` | Local filesystem | File contents, directory structure, file metadata |

### 7.2 Databases

| Collector | Sources | Data Collected |
|---|---|---|
| `postgres-collector` | PostgreSQL | Schema, statistics, slow queries, indexes, connections, locks, replication lag |
| `mysql-collector` | MySQL / MariaDB | Schema, statistics, slow queries, indexes, connections, InnoDB metrics |
| `sqlserver-collector` | SQL Server | Schema, statistics, query plans, indexes, DMVs, wait stats |
| `sqlite-collector` | SQLite | Schema, statistics, query plans, pragma settings |
| `mongodb-collector` | MongoDB | Collections, indexes, slow queries, profiler output, replica set status |
| `redis-collector` | Redis | Key patterns, memory usage, slow log, client connections, cluster info |
| `clickhouse-collector` | ClickHouse | Tables, partitions, query log, merge activity, replication status |
| `elastic-collector` | Elasticsearch / OpenSearch | Indices, mappings, slow logs, cluster health, shard allocation |
| `neo4j-collector` | Neo4j | Schema, constraints, indexes, query log, database metrics |

### 7.3 AI Providers

| Collector | Sources | Data Collected |
|---|---|---|
| `openai-collector` | OpenAI API | Usage, costs, model versions, rate limits, fine-tuning status |
| `anthropic-collector` | Anthropic API | Usage, costs, model versions, rate limits |
| `gemini-collector` | Google Gemini API | Usage, costs, model versions, rate limits |
| `mistral-collector` | Mistral API | Usage, costs, model versions |
| `xai-collector` | xAI (Grok) API | Usage, costs, model versions |
| `deepseek-collector` | DeepSeek API | Usage, costs, model versions |
| `local-model-collector` | Local model servers | Model inventory, resource utilization, inference latency |
| `litellm-collector` | LiteLLM proxy | Unified usage across providers, routing decisions, fallback events |
| `openrouter-collector` | OpenRouter | Usage, costs, routing, model availability |
| `ollama-collector` | Ollama | Model inventory, resource usage, inference metrics |
| `vllm-collector` | vLLM | Model serving metrics, batch sizes, KV cache utilization |

### 7.4 AI Frameworks

| Collector | Sources | Data Collected |
|---|---|---|
| `langgraph-collector` | LangGraph | Graph definitions, state transitions, checkpoints, tool calls |
| `crewai-collector` | CrewAI | Crew definitions, agent configs, task execution, delegation patterns |
| `llamaindex-collector` | LlamaIndex | Index structures, query pipelines, retrieval quality, chunking strategies |
| `autogen-collector` | AutoGen | Agent conversations, tool use, termination conditions |
| `mastra-collector` | Mastra | Workflow definitions, agent configs, tool registries, syncs |
| `semantic-kernel-collector` | Semantic Kernel | Plugins, planners, memory, function calling |
| `haystack-collector` | Haystack | Pipeline definitions, component configs, document stores |
| `dspy-collector` | DSPy | Module definitions, optimizers, compiled prompts, metrics |
| `openai-agents-collector` | OpenAI Agents SDK | Agent definitions, tool use, handoffs, guardrails |
| `mcp-collector` | Model Context Protocol | Server definitions, tool schemas, resource access, prompt templates |

### 7.5 Cloud Providers

| Collector | Sources | Data Collected |
|---|---|---|
| `aws-collector` | AWS | EC2, ECS, EKS, Lambda, RDS, S3, CloudWatch, Cost Explorer, IAM, VPC |
| `azure-collector` | Microsoft Azure | AKS, App Service, Functions, Cosmos DB, Monitor, Cost Management |
| `gcp-collector` | Google Cloud | GKE, Cloud Run, Cloud Functions, BigQuery, Cloud Monitoring, Billing |
| `digitalocean-collector` | DigitalOcean | Droplets, K8s, Databases, Spaces, monitoring |
| `railway-collector` | Railway | Services, deployments, metrics, logs |
| `render-collector` | Render | Services, deployments, metrics, logs |
| `fly-collector` | Fly.io | Machines, volumes, metrics, regions |
| `vercel-collector` | Vercel | Deployments, functions, edge config, analytics |
| `cloudflare-collector` | Cloudflare | Workers, R2, D1, KV, analytics, security events |

### 7.6 CI/CD

| Collector | Sources | Data Collected |
|---|---|---|
| `github-actions-collector` | GitHub Actions | Workflow runs, job durations, step outputs, artifact sizes, cache stats |
| `gitlab-ci-collector` | GitLab CI | Pipeline runs, job durations, artifact sizes, cache stats |
| `azure-pipelines-collector` | Azure Pipelines | Pipeline runs, stage durations, approvals, environments |
| `jenkins-collector` | Jenkins | Build history, durations, test results, plugin versions |
| `circleci-collector` | CircleCI | Pipeline runs, job durations, resource usage, orb versions |
| `argo-collector` | Argo CD / Workflows | Application syncs, workflow runs, rollback events, health status |

### 7.7 Observability

| Collector | Sources | Data Collected |
|---|---|---|
| `opentelemetry-collector` | OpenTelemetry (OTLP) | Traces, metrics, logs (the primary telemetry standard) |
| `langfuse-collector` | LangFuse | LLM traces, scores, prompt management, cost tracking |
| `phoenix-collector` | Arize Phoenix | LLM traces, embeddings, evaluations, drift detection |
| `helicone-collector` | Helicone | LLM request logs, costs, latency, caching stats |
| `sentry-collector` | Sentry | Errors, performance transactions, replays, crons |
| `datadog-collector` | Datadog | Metrics, traces, logs, monitors, dashboards |
| `prometheus-collector` | Prometheus | Time-series metrics, alert rules, recording rules |
| `grafana-collector` | Grafana | Dashboard definitions, alert rules, annotation history |
| `newrelic-collector` | New Relic | APM data, infrastructure metrics, synthetic monitors |
| `elastic-apm-collector` | Elastic APM | Traces, metrics, logs, service maps |
| `splunk-collector` | Splunk | Log analytics, security events, IT operations data |

### 7.8 Product Analytics

| Collector | Sources | Data Collected |
|---|---|---|
| `posthog-collector` | PostHog | Events, funnels, retention, feature flags, session replays, surveys |
| `mixpanel-collector` | Mixpanel | Events, funnels, retention, cohorts, impact analysis |
| `amplitude-collector` | Amplitude | Events, funnels, retention, experiments, user journeys |
| `launchdarkly-collector` | LaunchDarkly | Feature flags, experiments, targeting rules, flag dependencies |

### 7.9 Customer Signals

| Collector | Sources | Data Collected |
|---|---|---|
| `zendesk-collector` | Zendesk | Tickets, satisfaction scores, response times, categories |
| `salesforce-collector` | Salesforce | Cases, accounts, opportunities, product feedback |
| `jira-collector` | Jira | Issues, epics, sprints, velocity, backlog health |
| `slack-collector` | Slack | Public channel messages (support/feedback channels, with consent) |
| `discord-collector` | Discord | Public channel messages (community/support, with consent) |

### 7.10 Documentation

| Collector | Sources | Data Collected |
|---|---|---|
| `prd-collector` | PRD files (markdown, etc.) | Requirements, features, priorities, success criteria |
| `readme-collector` | README files | Project descriptions, setup instructions, architecture overviews |
| `rfc-collector` | RFC documents | Proposals, alternatives, decisions, status |
| `adr-collector` | ADR documents | Architecture decisions, context, consequences |
| `openapi-collector` | OpenAPI / Swagger specs | Endpoint definitions, schemas, examples, versions |
| `graphql-schema-collector` | GraphQL schema files | Types, queries, mutations, subscriptions, directives |
| `confluence-collector` | Confluence | Pages, spaces, labels, comments, attachments |
| `notion-collector` | Notion | Pages, databases, properties, relations |

---

## 8. Privacy & Governance

Privacy and governance are **architectural constraints**, not optional features. Every component is designed with these constraints from the ground up.

### 8.1 Read-Only by Default

Recurrsive operates in **read-only mode** unless explicitly configured otherwise:

- All collectors default to read-only API scopes
- No write operations are performed without explicit opt-in per integration
- The Execution Layer is entirely opt-in and disabled by default
- Even when enabled, every write operation requires human approval

### 8.2 Least-Privilege Access

Each collector requests **only the minimum permissions** required:

| Example Collector | Permissions Requested | Permissions NOT Requested |
|---|---|---|
| `github-collector` | `repo:read`, `issues:read`, `actions:read` | `repo:write`, `admin`, `delete` |
| `postgres-collector` | `SELECT` on `pg_catalog`, `information_schema`; `pg_stat_statements` read | `INSERT`, `UPDATE`, `DELETE`, `CREATE`, `DROP` |
| `openai-collector` | Usage API read access | Model management, fine-tuning, file upload |

### 8.3 Fine-Grained Permissions

Organizations configure access at multiple levels:

```yaml
permissions:
  collectors:
    github-collector:
      enabled: true
      repositories:
        include: ["org/frontend", "org/backend"]
        exclude: ["org/secret-project"]
      data_types:
        include: ["code", "prs", "issues"]
        exclude: ["review_comments"]  # Too sensitive
    postgres-collector:
      enabled: true
      databases:
        include: ["app_db"]
        exclude: ["auth_db"]  # Contains PII
      schemas:
        include: ["public"]
      tables:
        exclude: ["users", "sessions"]  # PII tables
```

### 8.4 Field-Level Masking

Sensitive fields are automatically detected and masked before entering the Knowledge Graph:

| Field Pattern | Masking Strategy | Example |
|---|---|---|
| Email addresses | Hash + domain preservation | `a3f9c2@example.com` |
| API keys / tokens | Full redaction | `[REDACTED]` |
| IP addresses | Subnet preservation | `192.168.x.x` |
| Names | Pseudonymization | `User-7a3f` |
| Credit card numbers | Full redaction | `[REDACTED]` |
| SSN / government IDs | Full redaction | `[REDACTED]` |
| Phone numbers | Full redaction | `[REDACTED]` |

### 8.5 Pseudonymization

When identity correlation is needed for analysis (e.g., "how many unique users hit this bug?"), Recurrsive uses **pseudonymization**:

- Consistent one-way hashing ensures the same user gets the same pseudonym
- Pseudonym mappings are stored separately from analysis data
- Mappings can be deleted independently (right to be forgotten)
- Pseudonymized data cannot be re-identified without the mapping table

### 8.6 Regional Data Residency

Data processing respects geographic boundaries:

- Collectors can be configured to process data in specific regions
- The Digital Twin can be sharded by region
- Cross-region data flows are explicitly configured and logged
- Supports EU (GDPR), US (CCPA), and other regional requirements

### 8.7 Audit Trails

Every action in the system is logged:

| Audit Event | Data Captured |
|---|---|
| Data collection | Source, timestamp, data types, volume, collector identity |
| Data access | Who/what accessed the data, query, timestamp, result size |
| Reasoning | Which specialist accessed which evidence, reasoning chain |
| Recommendation | Full opportunity record with evidence chain |
| Execution | Action taken, approver, timestamp, outcome |
| Configuration change | What changed, who changed it, previous value, new value |

Audit logs are:
- Immutable (append-only)
- Retained according to configurable retention policy (default: 1 year)
- Exportable for compliance review
- Queryable for incident investigation

### 8.8 Policy Enforcement

Organizational policies are enforced at the platform level (see Section 14 for details):

- Data classification policies determine what data can be collected
- Retention policies determine how long data is kept
- Access policies determine who can see what
- Execution policies determine what actions require what approval levels

### 8.9 BYOC — Bring Your Own Credentials

Recurrsive **never stores third-party credentials in its own systems**:

- Credentials are stored in the customer's secret management system (Vault, AWS Secrets Manager, Azure Key Vault, etc.)
- Recurrsive references credentials by secret path, not value
- Credential rotation is handled by the customer's existing processes
- In managed cloud mode: credentials are stored in the customer's isolated tenant, encrypted at rest with customer-managed keys

### 8.10 Air-Gapped Deployment

For high-security environments:

- Recurrsive can be deployed entirely within a private network with no internet access
- All AI reasoning can use local models (Ollama, vLLM)
- No telemetry, usage data, or system information leaves the deployment
- Updates are applied via manual artifact transfer

### 8.11 Configurable Retention

Every data type has a configurable retention period:

```yaml
retention:
  raw_evidence:
    default: 90d
    traces: 30d
    metrics: 365d
    code_snapshots: 180d
  knowledge_graph:
    entities: 365d
    relationships: 365d
  opportunities:
    active: indefinite
    rejected: 180d
    validated: indefinite
  audit_logs:
    default: 365d
    security_events: 730d
```

### 8.12 Automatic PII / Sensitive Field Removal

Before any data reaches the AI reasoning engines:

1. **Detection**: ML-based PII detection scans all text fields
2. **Classification**: detected fields are classified by sensitivity level
3. **Removal**: PII above the configured threshold is stripped or pseudonymized
4. **Verification**: a second pass confirms removal
5. **Logging**: all PII detections are logged for audit

The reasoning engines **never see raw PII**. They work with pseudonymized, aggregated, or structural data only.

---

## 9. Plugin & Extensibility Architecture

Recurrsive is built as a **plugin-first platform**. The core is minimal; intelligence comes from plugins.

### 9.1 Plugin Types

| Plugin Type | Interface | Purpose | Example |
|---|---|---|---|
| **Collector** | `ICollector` | Ingest data from external sources | `github-collector`, `postgres-collector` |
| **Normalizer** | `INormalizer` | Transform raw data to canonical schema | `sarif-normalizer`, `otel-normalizer` |
| **Analyzer** | `IAnalyzer` | Extract patterns and features from data | `ast-analyzer`, `dependency-analyzer` |
| **Reasoner** | `IReasoner` | Generate hypotheses from analyzed data | `performance-reasoner`, `security-reasoner` |
| **Scorer** | `IScorer` | Score opportunities on specific dimensions | `business-impact-scorer`, `effort-scorer` |
| **Policy** | `IPolicy` | Enforce organizational rules and constraints | `data-retention-policy`, `approval-policy` |
| **Visualization** | `IVisualization` | Render data for human consumption | `graph-viz`, `timeline-viz`, `dashboard-viz` |
| **Exporter** | `IExporter` | Export data to external systems | `sarif-exporter`, `jira-exporter`, `csv-exporter` |
| **Integration** | `IIntegration` | Bidirectional integration with external tools | `slack-integration`, `teams-integration` |
| **Execution Adapter** | `IExecutor` | Execute approved actions | `github-pr-executor`, `k8s-executor` |

### 9.2 Plugin Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Discover │───►│ Install  │───►│Configure │───►│ Activate │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                      │
┌──────────┐    ┌──────────┐    ┌──────────┐          │
│ Remove   │◄───│ Disable  │◄───│  Run     │◄─────────┘
└──────────┘    └──────────┘    └──────────┘
```

- **Discovery**: plugins are discovered from registries (official, community, private)
- **Installation**: plugins are installed with dependency resolution and version pinning
- **Configuration**: each plugin exposes a typed configuration schema
- **Activation**: plugins are activated and begin processing
- **Runtime**: plugins execute within sandboxed environments with resource limits
- **Disable/Remove**: plugins can be disabled (config preserved) or removed (clean uninstall)

### 9.3 Plugin SDK

The Plugin SDK provides:

- **Typed interfaces** for each plugin type (TypeScript, Python, Go)
- **Test harness** for unit and integration testing of plugins
- **Local development server** for testing plugins against a mock Digital Twin
- **Documentation generator** from plugin metadata
- **Publishing tools** for submitting plugins to the registry

### 9.4 Plugin Security Model

- Plugins run in **sandboxed environments** with declared permissions
- Plugins declare what data they need access to (manifest-based)
- Plugins cannot access data outside their declared scope
- Plugin code is scanned for known vulnerabilities before registry listing
- Official plugins are signed; community plugins have a trust tier system

---

## 10. Domain Intelligence Packs

Domain Intelligence Packs are curated bundles of analyzers, reasoners, policies, and benchmarks tailored to specific industries. They extend Recurrsive's general-purpose intelligence with domain-specific knowledge.

### 10.1 Available Packs

| Domain Pack | Specialized Analyzers | Specialized Rules | Compliance Frameworks |
|---|---|---|---|
| **Healthcare** | HIPAA data flow analysis, PHI detection, audit trail validation, HL7/FHIR compliance | BAA requirement checks, minimum necessary access, breach notification readiness | HIPAA, HITECH, FDA 21 CFR Part 11 |
| **Finance** | PCI-DSS scope analysis, transaction integrity, fraud detection pattern analysis, SOX control validation | Cardholder data detection, encryption at rest/transit, access logging, segregation of duties | PCI-DSS, SOX, SOC 2, GLBA |
| **Legal** | Attorney-client privilege detection, document retention analysis, e-discovery readiness, conflict of interest detection | Privilege tag enforcement, retention schedule compliance, matter management integrity | ABA Model Rules, GDPR (data subject rights) |
| **Manufacturing** | OT/IT boundary analysis, SCADA security, supply chain integrity, digital twin synchronization | Safety-critical system analysis, ICS protocol security, firmware version tracking | IEC 62443, NIST CSF, ISO 27001 |
| **Retail** | Inventory system analysis, POS integration security, recommendation engine quality, pricing integrity | Payment flow security, customer data protection, omnichannel consistency | PCI-DSS, CCPA, GDPR |
| **Education** | FERPA compliance, student data protection, accessibility (WCAG/Section 508), LMS integration analysis | Student record access control, age-appropriate content filtering, accessibility scoring | FERPA, COPPA, Section 508, WCAG 2.1 |
| **Gaming** | Real-time performance analysis, matchmaking fairness, anti-cheat integrity, loot box probability auditing | Frame budget analysis, tick rate optimization, player data protection | ESRB, PEGI, regional gambling regulations |
| **Robotics** | ROS/ROS2 analysis, sensor data pipeline integrity, safety constraint validation, control loop timing | Hard real-time deadline analysis, fault tolerance patterns, sensor fusion quality | ISO 26262, IEC 61508, DO-178C |
| **Enterprise SaaS** | Multi-tenancy isolation, feature flag hygiene, billing integration integrity, SSO/SCIM compliance | Tenant data isolation verification, rate limiting, audit trail completeness, SLA tracking | SOC 2, ISO 27001, GDPR, CCPA |

### 10.2 Pack Structure

Each Domain Intelligence Pack contains:

```
domain-pack-healthcare/
├── manifest.yaml           # Pack metadata, dependencies, version
├── analyzers/              # Domain-specific analyzers
│   ├── hipaa-data-flow.ts
│   ├── phi-detection.ts
│   └── audit-trail-validator.ts
├── reasoners/              # Domain-specific reasoning engines
│   └── healthcare-compliance-reasoner.ts
├── policies/               # Domain-specific policies
│   ├── hipaa-baseline.yaml
│   └── phi-handling.yaml
├── benchmarks/             # Domain-specific benchmarks
│   └── healthcare-security-benchmark.yaml
├── rules/                  # Domain-specific detection rules
│   ├── phi-in-logs.yaml
│   └── unencrypted-phi-transit.yaml
└── docs/                   # Domain documentation
    └── README.md
```

---

## 11. Deployment Models

Recurrsive supports multiple deployment models to fit different organizational needs, security requirements, and scale.

### 11.1 Deployment Options

| Model | Description | Best For | AI Reasoning |
|---|---|---|---|
| **Local CLI** | Single binary, runs on developer's machine | Individual developers, small teams, evaluation | Local models or cloud API |
| **Docker** | `docker compose up` with all services | Small-to-medium teams, development environments | Local models or cloud API |
| **EasyPanel** | One-click deploy via Create from Schema config | Teams using EasyPanel for self-hosted PaaS | Local models or cloud API |
| **Kubernetes** | Helm chart with full production configuration | Medium-to-large teams, production workloads | Local models or cloud API |
| **GitHub App** | Installed as a GitHub App, triggers on events | Teams using GitHub, automated PR analysis | Cloud API (managed) |
| **GitLab App** | Installed as a GitLab integration | Teams using GitLab, automated MR analysis | Cloud API (managed) |
| **IDE Extensions** | VS Code, JetBrains, Neovim plugins | Individual developers, real-time feedback | Local models or cloud API |
| **MCP Server** | Model Context Protocol server for AI assistants | AI-assisted development workflows | Via MCP client |
| **REST API** | 160+ endpoints across 37 route modules | Custom integrations, dashboards, automation | N/A (API only) |
| **GraphQL API** | GraphQL API for flexible querying | Complex queries, custom UIs, data exploration | N/A (API only) |
| **SDK** | TypeScript, Python, Go SDKs | Embedding Recurrsive in other tools | N/A (SDK only) |
| **Managed Cloud** | Fully managed SaaS with multi-tenant support | Teams wanting zero-ops, fastest onboarding | Managed (customer-isolated) |

### 11.2 Architecture by Deployment Model

#### Local CLI

```
┌────────────────────────────┐
│     Developer Machine      │
│  ┌──────────────────────┐  │
│  │   recurrsive CLI     │  │
│  │  ┌────────────────┐  │  │
│  │  │ Embedded DB    │  │  │
│  │  │ (SQLite +      │  │  │
│  │  │  in-memory     │  │  │
│  │  │  graph)        │  │  │
│  │  └────────────────┘  │  │
│  │  ┌────────────────┐  │  │
│  │  │ Collectors     │  │  │
│  │  │ (local only)   │  │  │
│  │  └────────────────┘  │  │
│  │  ┌────────────────┐  │  │
│  │  │ Reasoning      │  │  │
│  │  │ (local/cloud)  │  │  │
│  │  └────────────────┘  │  │
│  └──────────────────────┘  │
└────────────────────────────┘
```

#### Kubernetes (Production)

```
┌─────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                   │
│                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│  │ API Gateway │  │ Web UI      │  │ Scheduler   │  │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘  │
│         │                                  │         │
│  ┌──────┴──────────────────────────────────┴──────┐  │
│  │              Core Services                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │Collector │ │Knowledge │ │  Reasoning    │  │  │
│  │  │Manager   │ │Graph     │ │  Engine       │  │  │
│  │  └──────────┘ └──────────┘ └───────────────┘  │  │
│  │  ┌──────────┐ ┌──────────┐ ┌───────────────┐  │  │
│  │  │Evolution │ │Execution │ │  Plugin       │  │  │
│  │  │Engine    │ │Engine    │ │  Runtime      │  │  │
│  │  └──────────┘ └──────────┘ └───────────────┘  │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  ┌──────────────────── Data ─────────────────────┐   │
│  │  PostgreSQL    Neo4j    Redis    Object Store  │   │
│  └────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────┘
```

### 11.3 Current Implementation (v0.5.7)

As of v0.5.7, the following deployment surface is implemented:

| Component | Count | Notes |
|---|---|---|
| **REST Endpoints** | 160+ | Across 37 route modules |
| **Built-in Analyzers** | 12 | 80+ analysis rules |
| **Built-in Collectors** | 14 | Including enterprise integrations (GitHub, GitLab, OpenTelemetry, Langfuse, Arize, Helicone, Cloud Cost, Error Tracking, APM) |
| **Specialist Agents** | 19 | With Custom Specialist Agent SDK |
| **CLI Commands** | 25 | Full management and analysis |
| **MCP Tools** | 42 | Plus 21 prompts and 16 resources |
| **Dashboard Pages** | 40 | Including multi-tenant management, plugins, secrets, SSO, scheduling, simulation, confidence calibration |
| **Website Pages** | 23 | Marketing site with docs hub, marketplace, cloud, and partner portal |
| **Entity Types** | 43 | With 43 relationship types in the knowledge graph |
| **Policy Sets** | 5 | With 15 built-in rules |
| **Report Formats** | 4 | Markdown, HTML, JSON, SARIF v2.1.0 |
| **Git URL Analysis** | ✓ | Clone and analyze remote repositories via `POST /api/v1/analyze` with `gitUrl` |
| **Multi-Tenant Support** | ✓ | Tenant CRUD, tier management, quota tracking |
| **EasyPanel Deploy** | ✓ | One-click deploy via `easypanel.json` |
| **Docker Images** | 3 | Server, dashboard, website |

---

## 12. Explainability

Every recommendation Recurrsive produces must be **fully explainable**. No black boxes. No "trust me" outputs.

### 12.1 The Seven Questions

Every opportunity MUST answer these seven questions:

| Question | What It Covers | Where in Opportunity |
|---|---|---|
| **What changed?** | The specific observation that triggered this opportunity | `problem` field |
| **Why does it matter?** | The business and technical impact of the current state | `expected_impact` field |
| **What evidence supports this?** | All data points, metrics, code locations, and traces | `evidence[]` field |
| **What assumptions were made?** | Explicit assumptions in the reasoning chain | `simulation_results.assumptions` |
| **What are the trade-offs?** | What gets better, what might get worse, what's unchanged | `reasoning.debate_transcript` |
| **What if we do nothing?** | Projected trajectory if no action is taken | `risk` field + counterfactual in reasoning |
| **How do we validate?** | Concrete experiment to prove or disprove the recommendation | `validation_plan` field |

### 12.2 Evidence Provenance Chain

Every recommendation includes a full provenance chain from raw data to recommendation:

```
Raw Data (OpenTelemetry trace)
  └─► Normalized Fact (endpoint latency measurement)
       └─► Correlated Insight (latency correlates with code change)
            └─► Hypothesis (synchronous call is root cause)
                 └─► Debated Hypothesis (3 specialists agree, 1 dissents)
                      └─► Scored Opportunity (confidence: 0.88)
                           └─► Prioritized Recommendation (rank: #3)
```

Every link in the chain is clickable and auditable.

### 12.3 Reasoning Transparency

The multi-agent debate is summarized in every opportunity:

- **Who proposed** the hypothesis and why
- **Who supported** it and with what additional evidence
- **Who dissented** and what their concerns were
- **How concerns were addressed** (or acknowledged as limitations)
- **The consensus score** indicating degree of agreement

---

## 13. Open Standards

Recurrsive defines and publishes open schemas to prevent vendor lock-in and enable ecosystem interoperability.

### 13.1 Published Schemas

| Schema | Format | Purpose | Standards Adopted |
|---|---|---|---|
| **System Graph Schema** | JSON Schema + JSON-LD | Universal schema for the Digital Twin knowledge graph | Schema.org, SPDX |
| **Findings Schema** | SARIF-extended | Schema for raw findings from analyzers | SARIF 2.1.0 |
| **Opportunity Schema** | JSON Schema | Schema for opportunities (Section 5) | Custom, SARIF-compatible locations |
| **Experiment Schema** | JSON Schema | Schema for experiment definitions and results | Custom |
| **Benchmark Schema** | JSON Schema | Schema for benchmark definitions and results | Custom |
| **Evaluation Schema** | JSON Schema | Schema for AI evaluation definitions and results | Custom |
| **Policy Schema** | JSON Schema + OPA Rego | Schema for organizational policies | Open Policy Agent |
| **Execution Plan Schema** | JSON Schema | Schema for approved execution plans | Custom |
| **Collector Manifest** | JSON Schema | Schema for collector plugin declarations | Custom |
| **Plugin Manifest** | JSON Schema | Schema for all plugin type declarations | Custom |

### 13.2 Interoperability Standards

| Standard | How Recurrsive Uses It |
|---|---|
| **SARIF 2.1.0** | All code-level findings use SARIF-compatible locations; export to SARIF for IDE integration |
| **OpenTelemetry** | Primary telemetry ingestion format; OTLP for traces, metrics, logs |
| **SPDX** | Software Bill of Materials for dependency tracking |
| **CycloneDX** | Alternative SBOM format support |
| **Open Policy Agent (OPA)** | Policy definitions in Rego language |
| **JSON-LD** | Linked data format for knowledge graph interoperability |
| **GraphQL** | Query interface for the Digital Twin |
| **OpenAPI 3.1** | REST API specification |
| **CloudEvents** | Event format for webhook and event-driven integrations |
| **STIX/TAXII** | Threat intelligence sharing (security domain pack) |

---

## 14. Governance & Policy Engine

The Governance & Policy Engine enables organizations to encode their rules, standards, and requirements as machine-enforceable policies.

### 14.1 Policy Structure

```yaml
policy:
  id: string                    # Unique identifier
  name: string                  # Human-readable name
  description: string           # What this policy enforces
  version: string               # Semantic version
  severity: enum                # "info" | "warning" | "error" | "critical"
  scope:                        # Where this policy applies
    repositories: string[]      # Glob patterns
    services: string[]          # Service name patterns
    environments: string[]      # "production" | "staging" | "development"
  rules: Rule[]                 # The actual enforcement rules
  exceptions: Exception[]       # Approved exceptions
  enforcement: enum             # "audit" | "warn" | "block"
  owner: string                 # Team/person responsible
  review_schedule: string       # Cron expression for policy review
```

### 14.2 Example Policies

#### Policy: All AI Agents Must Have Evaluation Suites

```yaml
policy:
  id: "POL-AI-001"
  name: "AI Agent Evaluation Coverage"
  description: "Every AI agent in production must have an associated evaluation suite with at least 50 test cases covering accuracy, safety, and cost."
  version: "1.0.0"
  severity: "error"
  scope:
    environments: ["production"]
  rules:
    - id: "RULE-001"
      condition: |
        FOR EACH agent IN knowledge_graph.entities
        WHERE agent.type = 'Agent' AND agent.environment = 'production'
        ASSERT EXISTS eval_suite
        WHERE eval_suite.agent_id = agent.id
          AND eval_suite.test_count >= 50
          AND eval_suite.categories CONTAINS ALL ['accuracy', 'safety', 'cost']
      message: "Agent '{{agent.name}}' lacks a complete evaluation suite"
  exceptions:
    - agent: "internal-logging-agent"
      reason: "Internal-only agent with no user-facing output"
      approved_by: "security-team"
      expires: "2026-12-31"
  enforcement: "warn"
  owner: "ai-platform-team"
  review_schedule: "0 0 1 */3 *"  # Quarterly review
```

#### Policy: Database Schema Changes Require Migration Review

```yaml
policy:
  id: "POL-DATA-001"
  name: "Database Migration Review"
  description: "All schema changes to production databases must be reviewed by the data team and include a rollback migration."
  version: "1.0.0"
  severity: "error"
  scope:
    environments: ["production"]
  rules:
    - id: "RULE-001"
      condition: |
        FOR EACH migration IN knowledge_graph.entities
        WHERE migration.type = 'Migration' AND migration.target_env = 'production'
        ASSERT migration.reviewed_by CONTAINS ANY data_team.members
          AND migration.rollback_migration EXISTS
      message: "Migration '{{migration.name}}' missing data team review or rollback migration"
  enforcement: "block"
  owner: "data-team"
  review_schedule: "0 0 1 */6 *"  # Semi-annual review
```

#### Policy: No Secrets in Code

```yaml
policy:
  id: "POL-SEC-001"
  name: "No Hardcoded Secrets"
  description: "No API keys, passwords, tokens, or other secrets may appear in source code."
  version: "1.0.0"
  severity: "critical"
  scope:
    repositories: ["*"]
  rules:
    - id: "RULE-001"
      condition: |
        FOR EACH file IN knowledge_graph.entities
        WHERE file.type = 'File' AND file.contains_secret = true
        ASSERT FALSE
      message: "File '{{file.path}}' contains a hardcoded secret: {{file.secret_type}}"
  enforcement: "block"
  owner: "security-team"
  review_schedule: "0 0 * * 1"  # Weekly review
```

### 14.3 Policy Enforcement Modes

| Mode | Behavior |
|---|---|
| **Audit** | Violations are logged and reported but do not block any actions |
| **Warn** | Violations generate warnings in opportunities and notifications |
| **Block** | Violations prevent execution actions from being approved; escalate to policy owner |

### 14.4 Policy Inheritance

Policies can be organized hierarchically:

```
Organization Policies (mandatory for all)
  └── Team Policies (additional rules per team)
       └── Project Policies (project-specific overrides)
```

Lower-level policies can **add** rules but cannot **weaken** higher-level policies (unless an exception is explicitly granted with approval and expiration).

---

## 15. Benchmarking

Recurrsive enables teams to understand where they stand by benchmarking against multiple reference points.

### 15.1 Benchmark Categories

| Benchmark Type | What It Compares | Data Source |
|---|---|---|
| **Industry Benchmarks** | Compare metrics against industry medians and top quartiles | Anonymized, aggregated data from opted-in Recurrsive users |
| **Similar AI Applications** | Compare against applications with similar architecture, scale, and AI usage patterns | Anonymized, aggregated data (opt-in only) |
| **Open-Source Projects** | Compare practices against well-maintained open-source projects | Public repository analysis |
| **Best Practices** | Compare against documented best practices and standards | Curated knowledge base |
| **Internal History** | Compare against the system's own historical performance | Digital Twin historical data |
| **Research Papers** | Compare against techniques and results published in academic research | Curated research database |

### 15.2 Benchmark Metrics

Benchmarks cover all maturity dimensions:

```yaml
benchmark_report:
  system: "my-app"
  generated_at: "2026-06-28T12:00:00Z"

  architecture:
    coupling_score: { value: 0.35, industry_p50: 0.42, industry_p25: 0.28 }
    service_count: { value: 12, similar_apps_avg: 15 }
    api_consistency: { value: 0.78, best_practice: 0.90 }

  ai_quality:
    eval_coverage: { value: 0.65, best_practice: 0.90 }
    hallucination_rate: { value: 0.03, industry_p50: 0.05 }
    cost_per_request: { value: 0.012, similar_apps_avg: 0.018 }

  security:
    vuln_sla_compliance: { value: 0.92, industry_p50: 0.85 }
    secret_scan_coverage: { value: 1.0, best_practice: 1.0 }
    dependency_freshness: { value: 0.78, industry_p50: 0.65 }

  operational:
    deployment_frequency: { value: "3/day", industry_p50: "1/day" }
    change_failure_rate: { value: 0.05, industry_p50: 0.15 }
    mttr_minutes: { value: 28, industry_p50: 60 }

  developer_experience:
    build_time_seconds: { value: 420, industry_p50: 300 }
    pr_merge_time_hours: { value: 18, industry_p50: 24 }
    onboarding_days: { value: 5, industry_p50: 14 }
```

### 15.3 Benchmark Privacy

- All benchmark data is **opt-in only**
- Data is **anonymized and aggregated** before inclusion in benchmarks
- Individual system data is **never** shared with other organizations
- Organizations can participate in benchmarks without sharing their own data (receive-only mode)

---

## 16. Automatic Experiments

Recurrsive can design, configure, and track experiments to validate hypotheses before full implementation.

### 16.1 Experiment Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Design   │───►│ Configure│───►│ Execute  │───►│ Analyze  │
│          │    │          │    │          │    │          │
│ Variants │    │ Feature  │    │ Traffic  │    │ Results  │
│ Metrics  │    │ Flags    │    │ Routing  │    │ Decision │
│ Criteria │    │ Duration │    │ Monitor  │    │ Learning │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### 16.2 Experiment Schema

```yaml
experiment:
  id: string
  opportunity_id: string          # The opportunity this experiment validates
  hypothesis: string              # The testable hypothesis

  variants:
    control:
      description: string         # Current behavior
      allocation: float           # Traffic percentage (e.g., 0.90)
    treatment:
      description: string         # Modified behavior
      allocation: float           # Traffic percentage (e.g., 0.10)
      changes: Change[]           # Specific changes made

  primary_metric:
    name: string                  # The main metric being tested
    direction: enum               # "increase" | "decrease"
    minimum_detectable_effect: float  # Smallest meaningful change
    current_baseline: float       # Current value

  guardrail_metrics:              # Metrics that must NOT regress
    - name: string
      maximum_regression: float   # Maximum acceptable regression
      current_value: float

  duration:
    minimum_days: integer
    maximum_days: integer
    required_sample_size: integer  # Statistical power calculation

  success_criteria: string        # Clear definition of success
  rollback_trigger: string        # Conditions for automatic rollback

  status: enum                    # "designed" | "configured" | "running" | "completed" | "rolled_back"
  results:
    primary_metric_delta: float
    confidence_interval: [float, float]
    p_value: float
    guardrail_status: object
    recommendation: enum          # "ship" | "iterate" | "abandon"
```

### 16.3 Variant Generation

When an opportunity suggests a code change, Recurrsive can generate experiment variants:

- **Prompt experiments**: A/B test different prompt versions with identical inputs
- **Model experiments**: Compare model providers/versions on the same workload
- **Architecture experiments**: Feature-flag different implementation approaches
- **Configuration experiments**: Test different timeout, retry, cache, or scaling configurations
- **Cost experiments**: Compare cost/quality trade-offs with different resource allocations

### 16.4 Results Tracking

Experiment results are tracked in the Digital Twin and fed back into the recommendation pipeline:

- **Successful experiments** increase confidence in related opportunities
- **Failed experiments** decrease confidence and trigger re-evaluation
- **Ambiguous experiments** trigger extended runs or redesigned experiments
- All results are stored permanently as part of the system's institutional memory

---

## 17. Continuous Learning

Recurrsive improves its own reasoning over time through structured learning mechanisms.

### 17.1 Decision Memory

Every decision made by the team (accept, reject, defer, modify an opportunity) is recorded with context:

```yaml
decision:
  opportunity_id: string
  decision: enum                  # "accepted" | "rejected" | "deferred" | "modified"
  decided_by: string
  decided_at: datetime
  reasoning: string               # Why this decision was made
  modifications: string           # If modified, what was changed
  context:                        # State of the system at decision time
    system_load: string
    team_capacity: string
    strategic_priorities: string[]
```

### 17.2 Outcome Tracking

For accepted opportunities, Recurrsive tracks the actual outcome vs. prediction:

| Tracked Metric | Purpose |
|---|---|
| **Predicted vs. actual metric change** | Calibrate prediction accuracy |
| **Time to implement** | Calibrate effort estimates |
| **Unintended side effects** | Identify blind spots in reasoning |
| **Rollback rate** | Track recommendation reliability |
| **Team satisfaction** | Track recommendation relevance |

### 17.3 Model Calibration

Confidence scores are calibrated using historical accuracy:

- If the system predicts 0.8 confidence, approximately 80% of those recommendations should prove correct
- Calibration curves are computed and published for transparency
- Over-confident and under-confident specialists are adjusted
- Calibration is tracked per specialist, per category, and overall

### 17.4 Pattern Learning

Successful patterns are extracted and stored:

```yaml
learned_pattern:
  id: string
  name: string                    # e.g., "Async decoupling for external API calls"
  description: string
  source_opportunities: string[]  # Opportunities where this pattern was successful
  applicability_criteria: string  # When to suggest this pattern
  expected_impact: object         # Typical impact metrics
  confidence: float               # Based on historical success rate
  times_applied: integer
  success_rate: float
```

### 17.5 Evolution Scoring

The system tracks its own evolution:

| Meta-Metric | What It Measures |
|---|---|
| **Prediction accuracy** | How often predicted outcomes match actual outcomes |
| **Accept rate** | What percentage of recommendations are accepted |
| **False positive rate** | How often the system flags something that isn't actually a problem |
| **Time-to-value** | How quickly accepted recommendations deliver measurable improvement |
| **Coverage** | What percentage of system dimensions are actively monitored |
| **Freshness** | How current is the Digital Twin data |
| **Specialist calibration** | Per-specialist confidence calibration score |
| **Learning velocity** | How quickly the system improves its recommendations based on feedback |

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| **Engineering Intelligence Platform** | A platform that continuously models an entire software system and provides evidence-based intelligence and recommendations |
| **Digital Twin** | The continuously synchronized semantic representation of a software system maintained by Recurrsive |
| **Opportunity** | A specific, evidence-backed, actionable possibility to improve the system |
| **Collector** | A plugin that ingests data from an external source |
| **Normalizer** | A plugin that transforms raw data into the canonical Digital Twin schema |
| **Specialist** | A focused reasoning engine with deep expertise in one domain |
| **Hypothesis** | A testable claim about the system produced by a specialist |
| **Evolution Graph** | A DAG of opportunities showing dependencies, conflicts, and synergies |
| **Evidence Chain** | The full provenance from raw data to scored opportunity |
| **Maturity Level** | A 1–5 rating of system sophistication in a specific dimension |
| **Domain Intelligence Pack** | A curated bundle of domain-specific analyzers, rules, and benchmarks |
| **Policy** | A machine-enforceable organizational rule |
| **Experiment** | A controlled test to validate a hypothesis before full implementation |
| **BYOC** | Bring Your Own Credentials — credentials stay in the customer's infrastructure |

## Appendix B: Document Revision History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.2.0 | 2026-07-05 | Recurrsive Team | Updated to reflect v0.5.7: all synthetic/mock data removed from production code — SSO uses real SAML parsing, 9 collectors rewritten with real API clients (native fetch), GraphQL seed data removed, scheduling uses real cron parser, CLI simulation wired to server API. All docs aligned, 3,293 tests passing. |
| 1.1.0 | 2026-07-04 | Recurrsive Team | Updated to reflect v0.5.6: added §11.3 current implementation stats (12 analyzers, 14 collectors, 19 specialists, 160+ endpoints across 37 route modules, 42 MCP tools, 28 CLI commands, 46 dashboard pages, 23 website pages), added EasyPanel and multi-tenant deployment options, added git URL analysis capability, clarified collector implementation status in §7 |
| 1.0.0 | 2026-06-29 | Recurrsive Team | Initial comprehensive PRD |

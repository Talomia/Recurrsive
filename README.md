<div align="center">

# Recurrsive

**Engineering Intelligence Platform**

Understand your entire software system. Make better engineering decisions.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9+-orange.svg)](https://pnpm.io/)

</div>

---

## The Problem

Engineering leaders make hundreds of decisions: what to build, what to fix, where to invest. These decisions are based on incomplete information scattered across repositories, observability dashboards, incident retrospectives, AI traces, cost reports, and architecture diagrams.

Today's tools answer narrow questions:
- **Code assistants** (Copilot, Cursor) help write code but don't understand the system
- **Observability tools** (Datadog, Sentry) see production but don't reason about architecture
- **Static analyzers** (SonarQube, ESLint) catch syntax issues but miss systemic risks
- **AI evaluators** (Langfuse, Arize) track prompts but don't connect to business outcomes

No single tool answers: **"What are the highest-value improvements across my entire system?"**

## What is Recurrsive?

Recurrsive is an **Engineering Intelligence Platform** that continuously builds a knowledge graph of your entire software system — source code, architecture, AI components, infrastructure, costs, reliability, security, and documentation — and produces **evidence-backed recommendations** ranked by expected business impact.

Instead of telling you *"latency increased,"* Recurrsive tells you:

> *"Fixing these four issues will improve checkout conversion by an estimated 2.1%, reduce cloud spend by $380K/year, and require approximately three engineering weeks."*

That is **Decision Confidence** — the core value Recurrsive delivers.

### Key Capabilities

| Capability | Description |
|---|---|
| 🔍 **Evidence Collection** | Git repos, docs, ADRs, API contracts with PII detection & governance |
| 🧠 **Knowledge Graph** | Living digital twin — 43 entity types, 43 relationship types |
| 🔬 **10 Built-in Analyzers** | Architecture, AI, Performance, Cost, Reliability, Security, Data, Docs, UX, Product |
| 🤖 **Multi-Agent Reasoning** | 19 specialist AI agents debate and rank improvement opportunities |
| 📊 **Opportunity Management** | Prioritized roadmap with evidence, validation plans, rollback plans |
| 🛡️ **Policy Engine** | Governance rules with recursive descent expression evaluation |
| 🔌 **MCP Server** | Expose analysis to Claude, Cursor, Copilot, and other AI assistants |
| 📡 **REST + WebSocket API** | Real-time analysis with live progress streaming |
| 🐳 **Docker Ready** | Multi-stage Dockerfile with Apache AGE PostgreSQL |

### Platform Overview

| Surface | Count |
|---------|-------|
| 📡 Server REST endpoints | 54 |
| ⌨️ CLI commands | 19 |
| 🔌 MCP tools | 26 |
| 💬 MCP prompts | 15 |
| 📦 MCP resources | 9 |
| 📊 Dashboard pages | 20 |
| ✅ Tests | 2,176+ |
| 📁 Packages | 13 (9 core + 4 apps) |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0

### Install & Build

```bash
# Clone
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### CLI Usage (14 commands)

```bash
# Link the CLI globally (after building)
npx --package ./apps/cli recurrsive --help

# Or link it permanently for development
pnpm --filter @recurrsive/cli link --global

# Initialize Recurrsive in your project
cd your-project
recurrsive init

# Run analysis
recurrsive analyze .

# View opportunities
recurrsive opportunities --top 10

# Check system health
recurrsive health

# Explore the knowledge graph
recurrsive graph --stats

# View intelligence timeline
recurrsive timeline

# Generate reports
recurrsive report --format html

# Manage configuration
recurrsive config --list

# Full-text search across the knowledge graph
recurrsive search "authentication"

# Export/import graph snapshots
recurrsive snapshot export --output backup.json
recurrsive snapshot import backup.json

# Policy compliance checks
recurrsive policy check
recurrsive policy list

# Manage webhooks
recurrsive webhooks list
recurrsive webhooks add --url https://example.com/hook --events analysis.complete

# Manage notification channels
recurrsive notifications channels
recurrsive notifications test console
recurrsive notifications history

# Batch analysis across multiple projects
recurrsive batch run --projects ./proj1 ./proj2
recurrsive batch status <batch_id>
recurrsive batch history
```

### MCP Server (for AI Assistants)

Add to your MCP configuration:

```json
{
  "mcpServers": {
    "recurrsive": {
      "command": "node",
      "args": ["path/to/recurrsive/apps/mcp/dist/bin.js"],
      "env": {
        "RECURRSIVE_PROJECT_PATH": "/path/to/your/project"
      }
    }
  }
}
```

**Available MCP tools (18), prompts (9), resources (6):**

*Tools — Analysis:*
- `analyze_project` — Run the full analysis pipeline
- `get_opportunities` — Get prioritized improvement opportunities
- `get_opportunity_detail` — Deep dive into a specific opportunity
- `get_health_score` — Get system health score and maturity
- `list_findings` — List analysis findings with severity filter

*Tools — Inspection:*
- `query_graph` — Query the knowledge graph
- `get_entity` — Get full entity details by ID
- `trace_dependency` — Trace dependency chain between entities
- `explain_entity` — LLM-powered entity explanation
- `analyze_impact` — Analyze blast radius of changing an entity
- `search_graph` — Full-text search across the knowledge graph (FTS5)

*Tools — Governance:*
- `check_policies` — Run policy compliance checks
- `list_policies` — List available policy sets
- `export_sarif` — Export findings as SARIF v2.1.0
- `get_governance_status` — Data governance summary

*Tools — Webhooks:*
- `list_webhooks` — List registered webhook integrations
- `register_webhook` — Register a new webhook endpoint
- `list_webhook_events` — List supported webhook event types

### Docker

```bash
# Start with PostgreSQL + Apache AGE
cd docker
docker-compose up -d

# Development mode
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

### REST API

```bash
# Start the server
node apps/server/dist/bin.js

# Trigger analysis
curl -X POST http://localhost:3000/api/v1/analyze \
  -H "Content-Type: application/json" \
  -d '{"path": "/path/to/project"}'

# Get opportunities
curl http://localhost:3000/api/v1/opportunities?top=10

# Health score
curl http://localhost:3000/api/v1/health-score

# Real-time updates via WebSocket
wscat -c ws://localhost:3000/ws
```

---

## Architecture

Recurrsive follows a four-phase pipeline — **Collect → Understand → Reason → Evolve** — where the LLM is never the source of truth. It reasons only over structured evidence in the knowledge graph.

```
┌─────────────────────────────────────────────────┐
│              EVOLVE (Presentation)               │
│     CLI  ·  MCP Server  ·  REST API  ·  Dashboard│
├─────────────────────────────────────────────────┤
│                   REASON                         │
│  19 Specialists  ·  Debate  ·  Judge  ·  Memory  │
│  Opportunities  ·  Policy  ·  Experiments        │
├─────────────────────────────────────────────────┤
│                 UNDERSTAND                        │
│  Graph Engine  ·  10 Analyzers  ·  66+ Rules     │
│  Parsers  ·  AI Pattern Detection                │
├─────────────────────────────────────────────────┤
│                   COLLECT                         │
│  Collectors  ·  Git  ·  Docs  ·  Telemetry       │
│  Knowledge Graph  (43 entities, 43 relationships)│
└─────────────────────────────────────────────────┘
```

### Monorepo Structure

```
recurrsive/
├── packages/
│   ├── core/           # Type system, schemas, utilities
│   ├── graph/          # Dual-backend knowledge graph — AGE + SQLite
│   ├── collectors/     # Data ingestion with privacy governance
│   ├── parsers/        # Tree-sitter + AI pattern detection
│   ├── analyzers/      # 10 built-in analyzers, 66+ rules
│   ├── reasoning/      # Multi-agent debate engine
│   ├── opportunities/  # Lifecycle + SARIF export
│   ├── policy/         # Policy engine + 5 built-in policies
│   └── presentation/   # Reports + notifications + terminal
├── apps/
│   ├── cli/            # Commander.js CLI — 19 commands
│   ├── mcp/            # MCP server — 26 tools, 9 resources, 15 prompts
│   ├── server/         # Fastify REST + WebSocket API — 54 endpoints
│   └── dashboard/      # Next.js dashboard — 20 pages
├── docker/             # Dockerfile + docker-compose
├── docs/
│   ├── PRD.md          # Product Requirements
│   ├── ARCHITECTURE.md # Technical Architecture
│   ├── STRATEGY.md     # Product Strategy & Business Model
│   ├── ROADMAP.md      # Phased Roadmap
│   ├── API.md          # API Reference (REST, MCP, CLI)
│   └── DEVELOPMENT.md  # Developer Setup Guide
└── turbo.json          # Turborepo build orchestration
```

---

## Packages

### `@recurrsive/core`
Core type system with **43 entity types**, **43 relationship types**, Zod schemas, structured logger, error hierarchy, and shared utilities.

### `@recurrsive/graph`
Dual-backend knowledge graph with a unified `GraphClient` interface:
- **PostgreSQL + Apache AGE** for production (Cypher queries)
- **SQLite** for local CLI use (zero configuration)

### `@recurrsive/collectors`
Pluggable data collection with built-in **PII detection**, field masking, and audit logging:
- **Git Collector** — 20+ language detection, framework recognition, AI provider detection
- **Documentation Collector** — READMEs, ADRs, RFCs, API contracts
- **Environment Collector** — Docker, Docker Compose, Kubernetes infrastructure topology
- **CI/CD Collector** — GitHub Actions workflows, GitLab CI pipelines
- **Database Collector** — SQL schemas, Prisma models, Drizzle ORM definitions

### `@recurrsive/parsers`
Multi-language code analysis:
- **Tree-sitter** parser with graceful WASM fallback
- **TypeScript** and **Python** extractors
- **AI Pattern Detector** — 13 pattern types including LLM calls, prompt templates, agent definitions, RAG pipelines, MCP servers
- **Cross-file resolver** for import/dependency tracking

### `@recurrsive/analyzers`
10 specialized analyzers with 66+ analysis rules:

| Analyzer | Focus |
|----------|-------|
| Architecture | Circular deps, god modules, coupling |
| AI | Hardcoded models, prompt injection, agent loops |
| Performance | Sequential LLM calls, N+1 queries, caching |
| Cost | Expensive models, missing token tracking |
| Reliability | Single points of failure, missing retries |
| Security | Secrets, PII exposure, SQL injection |
| Data | Missing indexes, schema anti-patterns |
| Documentation | Missing docs, stale content, API drift |
| UX | Missing loading/error/empty states |
| Product | Dead feature flags, missing analytics |

### `@recurrsive/reasoning`
Multi-agent reasoning engine:
- **19 Specialist Agents** with cognitive frameworks and detailed system prompts
- **Debate Protocol** with challenge/defend cycles and dual consensus detection
- **Synthesizer** — Transforms hypotheses into structured opportunities
- **Judge** — Weighted multi-factor scoring
- **Memory Store** — Decision tracking and specialist accuracy calibration

### `@recurrsive/opportunities`
Complete opportunity lifecycle:
- Create, update, accept, reject with timestamps
- Composite scoring with dependency clustering
- **SARIF v2.1.0** export for CI/CD integration
- Markdown reports with executive summaries
- Roadmap generation (Quick Wins → Strategic → Long-term)

### `@recurrsive/policy`
Governance and compliance:
- Recursive descent expression parser (no `eval()`)
- 5 built-in policy sets (15 rules): Security Baseline, Change Management, Cost Governance, Compliance, Quality Gates
- Block, warn, require_approval actions

### `@recurrsive/presentation`
Reports and output formatting:
- **Markdown** and **HTML** reports (self-contained with embedded CSS/SVG)
- Console notifications with ANSI colors and severity icons
- Webhook notifications with retry
- Terminal formatter with box-drawing tables and progress bars

---

## Notification Channels

Recurrsive supports three notification channels for alerting on analysis results, policy violations, and system events:

| Channel | Description | Configuration |
|---------|-------------|---------------|
| 📺 **Console** | Log to server console with ANSI colors and severity icons | Always available — no setup needed |
| 💬 **Slack** | Post to a Slack channel via incoming webhook | Set `SLACK_WEBHOOK_URL` environment variable |
| 🌐 **HTTP** | POST to any custom HTTP endpoint | Provide a `url` per notification or in config |

```bash
# CLI
recurrsive notifications channels          # List available channels
recurrsive notifications test console      # Send a test notification
recurrsive notifications history           # View recent notifications

# REST API
curl http://localhost:3000/api/v1/notifications/channels
curl -X POST http://localhost:3000/api/v1/notifications/test \
  -H "Content-Type: application/json" \
  -d '{"channel": "console"}'
```

---

## Webhook Events

Register webhooks to receive real-time notifications when platform events occur.

| Event | Description |
|-------|-------------|
| `analysis.complete` | Triggered when an analysis run completes successfully |
| `analysis.failed` | Triggered when an analysis run fails |
| `opportunity.created` | Triggered when a new improvement opportunity is identified |
| `opportunity.updated` | Triggered when an opportunity status changes |
| `policy.violation` | Triggered when a policy check finds a violation |
| `health.degraded` | Triggered when the project health score drops below threshold |
| `snapshot.created` | Triggered when a new knowledge graph snapshot is saved |

```bash
# Register a webhook
curl -X POST http://localhost:3000/api/v1/webhooks \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/hook", "events": ["analysis.complete", "policy.violation"]}'

# List registered webhooks
curl http://localhost:3000/api/v1/webhooks

# Test a webhook
curl -X POST http://localhost:3000/api/v1/webhooks/wh_000001/test

# View supported event types
curl http://localhost:3000/api/v1/webhooks/events
```

---

## Configuration

Create `recurrsive.config.yaml` in your project root (or run `recurrsive init`):

```yaml
# Recurrsive Configuration
version: "1"

project:
  name: my-project
  repository: https://github.com/org/my-project

# Knowledge graph backend
graph:
  provider: sqlite  # or 'postgresql_age'
  connection_string: .recurrsive/graph.db  # only needed for custom path

# Analyzers
analyzers:
  enabled: ["*"]  # glob patterns — '*' enables all
  disabled: []    # glob patterns to exclude

# LLM configuration (for reasoning engine)
reasoning:
  provider: openai
  model: gpt-4.1-mini  # or gpt-4o, claude-sonnet-4-20250514, ollama/llama3, etc.
  # api_key: ${OPENAI_API_KEY}  # or set RECURRSIVE_LLM_API_KEY env var
  max_debate_rounds: 3
  temperature: 0.3

# Data governance
governance:
  pii_detection: true
  masked_fields:
    - password
    - secret
    - token
  excluded_patterns:
    - "**/node_modules/**"
    - "**/dist/**"
    - "**/.git/**"

# Output
output:
  format: markdown  # json, markdown, sarif, html
  directory: .recurrsive
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/GETTING_STARTED.md) | Step-by-step tutorial for first analysis |
| [Product Strategy](docs/STRATEGY.md) | Positioning, business model, go-to-market, and feasibility |
| [Product Roadmap](docs/ROADMAP.md) | Phased roadmap with current status |
| [Product Requirements](docs/PRD.md) | Vision, capabilities, and detailed specifications |
| [Architecture Guide](docs/ARCHITECTURE.md) | Technical architecture, data model, and deployment |
| [API Reference](docs/API.md) | REST, WebSocket, and MCP endpoints |
| [Development Guide](docs/DEVELOPMENT.md) | Setup, testing, and contribution workflow |
| [Examples](examples/) | Configuration examples for basic, AI, and enterprise projects |
| [Changelog](CHANGELOG.md) | Version history and release notes |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for full details.

```bash
# Development
pnpm install
pnpm build
pnpm test
pnpm typecheck

# Watch mode
pnpm dev

# Format code
pnpm format
```

---

## License

[Apache-2.0](LICENSE)

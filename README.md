<div align="center">

# Recurrsive

**The Evolution Runtime for AI Software**

Continuously understand, evaluate, simulate, and evolve software systems.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9+-orange.svg)](https://pnpm.io/)

</div>

---

## What is Recurrsive?

Recurrsive is not another code reviewer, static analyzer, or observability platform.

It is a **Software Evolution Platform** that continuously analyzes your entire software system — source code, architecture, prompts, agents, MCP servers, tools, workflows, infrastructure, costs, UX, latency, reliability, security, evaluations, databases, APIs, documentation, and production telemetry — and produces an **evolving roadmap** of the highest-value improvements.

Think of it as:

> **GitHub Copilot × Datadog × Architecture Review Board** — unified into an autonomous system that never sleeps.

### Key Capabilities

| Capability | Description |
|---|---|
| 🔍 **Evidence Collection** | Git repos, docs, ADRs, API contracts, runtime metrics |
| 🧠 **Knowledge Graph** | Living digital twin of your entire system |
| 🔬 **10 Built-in Analyzers** | Architecture, AI, Performance, Cost, Reliability, Security, Data, Docs, UX, Product |
| 🤖 **Multi-Agent Reasoning** | 8 specialist AI agents debate and rank improvement opportunities |
| 📊 **Opportunity Management** | Prioritized roadmap with SARIF export, validation plans, rollback plans |
| 🛡️ **Policy Engine** | Governance rules with recursive descent expression evaluation |
| 🔌 **MCP Server** | Expose analysis to Claude, Cursor, Copilot, and other AI assistants |
| 📡 **REST + WebSocket API** | Real-time analysis with 16 REST endpoints |
| 🐳 **Docker Ready** | Multi-stage Dockerfile with Apache AGE PostgreSQL |

---

## Quick Start

### Prerequisites

- **Node.js** ≥ 20.0.0
- **pnpm** ≥ 9.0.0

### Install & Build

```bash
# Clone
git clone https://github.com/recurrsive/recurrsive.git
cd recurrsive

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### CLI Usage

```bash
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

# View evolution timeline
recurrsive timeline
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

**Available MCP tools:**
- `analyze_project` — Run the full analysis pipeline
- `get_opportunities` — Get prioritized improvement opportunities
- `get_opportunity_detail` — Deep dive into a specific opportunity
- `query_graph` — Query the knowledge graph
- `get_health_score` — Get system health score and maturity

### Docker

```bash
# Start with PostgreSQL + Apache AGE
cd docker
docker-compose up -d

# Development mode (with hot reload)
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

Recurrsive is organized as a 5-layer stack:

```
┌─────────────────────────────────────────────────┐
│                  EXECUTION                       │
│         CLI  ·  MCP Server  ·  REST API          │
├─────────────────────────────────────────────────┤
│                  EVOLUTION                        │
│  Opportunities  ·  Policy  ·  Presentation       │
├─────────────────────────────────────────────────┤
│                  REASONING                        │
│  8 Specialists  ·  Debate  ·  Judge  ·  Memory   │
├─────────────────────────────────────────────────┤
│                  KNOWLEDGE                        │
│  Graph Engine  ·  Analyzers  ·  Parsers          │
├─────────────────────────────────────────────────┤
│                   REALITY                         │
│  Collectors  ·  Git  ·  Docs  ·  Telemetry       │
└─────────────────────────────────────────────────┘
```

### Monorepo Structure

```
recurrsive/
├── packages/
│   ├── core/           # Type system, schemas, utilities (20 files)
│   ├── graph/          # Dual-backend knowledge graph — AGE + SQLite (9 files)
│   ├── collectors/     # Data ingestion with governance (10 files)
│   ├── parsers/        # Tree-sitter + AI pattern detection (12 files)
│   ├── analyzers/      # 10 built-in analyzers (26 files)
│   ├── reasoning/      # Multi-agent debate engine (16 files)
│   ├── opportunities/  # Lifecycle + SARIF export (6 files)
│   ├── policy/         # Policy engine + 5 built-in policies (4 files)
│   └── presentation/   # Reports + notifications + terminal (10 files)
├── apps/
│   ├── cli/            # Commander.js CLI — 6 commands (13 files)
│   ├── mcp/            # MCP server — 5 tools, 4 resources, 3 prompts (10 files)
│   └── server/         # Fastify REST + WebSocket API (11 files)
├── docker/             # Dockerfile + docker-compose
├── docs/
│   ├── PRD.md          # Product Requirements (2,096 lines)
│   └── ARCHITECTURE.md # Technical Architecture (2,304 lines)
└── turbo.json          # Turborepo build orchestration
```

---

## Packages

### `@recurrsive/core`
Core type system with **43 entity types**, **40 relationship types**, Zod schemas, structured logger, error hierarchy, and shared utilities.

### `@recurrsive/graph`
Dual-backend knowledge graph with a unified `GraphClient` interface:
- **PostgreSQL + Apache AGE** for production (Cypher queries)
- **SQLite** for local CLI use (zero configuration)

### `@recurrsive/collectors`
Pluggable data collection with built-in **PII detection**, field masking, and audit logging:
- **Git Collector** — 20+ language detection, framework recognition, AI provider detection
- **Documentation Collector** — READMEs, ADRs, RFCs, API contracts

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
- **8 Specialist Agents** with cognitive frameworks and detailed system prompts
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

## Configuration

Create `.recurrsive/config.yaml` in your project root (or run `recurrsive init`):

```yaml
# Recurrsive Configuration
project:
  name: my-project
  repository: https://github.com/org/my-project

# Knowledge graph backend
graph:
  provider: sqlite  # or 'postgresql_age'
  sqlite:
    path: .recurrsive/graph.db

# Analyzers to enable
analyzers:
  enabled:
    - architecture
    - ai
    - performance
    - cost
    - reliability
    - security
    - data
    - docs
    - ux
    - product

# LLM configuration (for reasoning engine)
reasoning:
  enabled: true
  provider: openai
  model: gpt-4o
  api_key: ${OPENAI_API_KEY}  # or set OPENAI_API_KEY env var

# Data governance
governance:
  pii_detection: true
  masked_fields:
    - password
    - secret
    - token
  excluded_patterns:
    - '**/node_modules/**'
    - '**/dist/**'
    - '**/.git/**'
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Product Requirements](docs/PRD.md) | Complete PRD (2,096 lines) — vision, strategy, capabilities, phases |
| [Architecture Guide](docs/ARCHITECTURE.md) | Technical architecture (2,304 lines) — 5-layer stack, data model, deployment |

---

## Contributing

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

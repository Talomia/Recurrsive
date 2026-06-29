<div align="center">

# Recurrsive

**The Evolution Runtime for AI Software**

Continuously understand, evaluate, and evolve software systems.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9+-orange.svg)](https://pnpm.io/)

</div>

---

## The Problem

Engineering teams building AI-powered software face a unique challenge: their systems are **living organisms**, not static codebases. Models drift. Prompts degrade. Agent workflows break silently. Costs spike overnight. Architecture accumulates debt in dimensions no linter can detect.

Today's tools address fragments of this problem:
- **Code assistants** (Copilot, Cursor) help write code but don't understand the system
- **Observability tools** (Datadog, Sentry) see production but don't reason about architecture  
- **Static analyzers** (SonarQube, ESLint) catch syntax issues but miss AI-specific risks
- **Architecture review boards** are periodic, manual, and don't scale

No single tool continuously understands the entire system and tells you what to improve next.

## What is Recurrsive?

Recurrsive is a **Software Evolution Platform** that continuously analyzes your entire software system — source code, architecture, prompts, agents, tools, workflows, infrastructure, costs, reliability, security, databases, APIs, and documentation — and produces a **prioritized roadmap** of the highest-value improvements.

> **GitHub Copilot × Datadog × Architecture Review Board** — unified into an autonomous system that never sleeps.

### Key Capabilities

| Capability | Description |
|---|---|
| 🔍 **Evidence Collection** | Git repos, docs, ADRs, API contracts with PII detection & governance |
| 🧠 **Knowledge Graph** | Living digital twin — 43 entity types, 40 relationship types |
| 🔬 **10 Built-in Analyzers** | Architecture, AI, Performance, Cost, Reliability, Security, Data, Docs, UX, Product |
| 🤖 **Multi-Agent Reasoning** | 8 specialist AI agents debate and rank improvement opportunities |
| 📊 **Opportunity Management** | Prioritized roadmap with SARIF export, validation plans, rollback plans |
| 🛡️ **Policy Engine** | Governance rules with recursive descent expression evaluation |
| 🔌 **MCP Server** | Expose analysis to Claude, Cursor, Copilot, and other AI assistants |
| 📡 **REST + WebSocket API** | Real-time analysis with live progress streaming |
| 🐳 **Docker Ready** | Multi-stage Dockerfile with Apache AGE PostgreSQL |

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
│   ├── cli/            # Commander.js CLI — 6 commands
│   ├── mcp/            # MCP server — 5 tools, 4 resources, 3 prompts
│   └── server/         # Fastify REST + WebSocket API
├── docker/             # Dockerfile + docker-compose
├── docs/
│   ├── PRD.md          # Product Requirements
│   └── ARCHITECTURE.md # Technical Architecture
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
| [Product Requirements](docs/PRD.md) | Vision, strategy, capabilities, and roadmap |
| [Architecture Guide](docs/ARCHITECTURE.md) | Technical architecture, data model, and deployment |
| [Contributing Guide](CONTRIBUTING.md) | Development setup, style guide, and PR process |
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

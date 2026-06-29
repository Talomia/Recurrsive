# Recurrsive API Reference

Recurrsive exposes three interface layers: a **REST API**, a **WebSocket API**, and an **MCP Server**.

---

## REST API

Base URL: `http://localhost:3000`

### Health & Status

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Liveness probe (returns `{ status: 'ok' }`) |
| `GET` | `/api/v1/health-score` | Project health score, maturity scores, and overview |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/analyze` | Start a new analysis run |
| `GET` | `/api/v1/analysis/status` | Current analysis status (phase, progress, message) |
| `GET` | `/api/v1/analysis/history` | History of past analysis runs |

#### `POST /api/v1/analyze`

**Body:**
```json
{
  "project_path": "/path/to/project",
  "analyzers": ["architecture", "security"],  // optional, default: all
  "include_reasoning": true                    // optional, default: false
}
```

**Response:**
```json
{
  "run_id": "uuid",
  "status": "running",
  "started_at": "2026-01-01T00:00:00Z",
  "ws": "ws://localhost:3000/ws"
}
```

### Findings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/findings` | List findings with filtering |
| `GET` | `/api/v1/findings/:id` | Get a specific finding by ID |
| `GET` | `/api/v1/findings/summary` | Summary by severity, category, analyzer |

#### Query Parameters for `GET /api/v1/findings`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `severity` | `string` | — | Filter by severity: `critical`, `high`, `medium`, `low`, `info` |
| `category` | `string` | — | Filter by category: `architecture`, `security`, `performance`, etc. |
| `analyzer` | `string` | — | Filter by analyzer ID |
| `limit` | `number` | `50` | Max results per page |
| `offset` | `number` | `0` | Pagination offset |

### Opportunities

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/opportunities` | List all opportunities |
| `GET` | `/api/v1/opportunities/:id` | Get opportunity detail |
| `PATCH` | `/api/v1/opportunities/:id/status` | Update opportunity status |
| `GET` | `/api/v1/opportunities/export/sarif` | Export opportunities as SARIF |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/reports/markdown` | Generate Markdown report |
| `GET` | `/api/v1/reports/html` | Generate HTML report |
| `GET` | `/api/v1/reports/sarif` | Generate SARIF report |
| `GET` | `/api/v1/reports/json` | Generate JSON report |

### Knowledge Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/graph/entities` | List entities with optional type filter |
| `GET` | `/api/v1/graph/entities/:id` | Get entity details |
| `GET` | `/api/v1/graph/entities/:id/neighbors` | Get related entities |
| `GET` | `/api/v1/graph/stats` | Graph statistics |

### Timeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/timeline/events` | Evolution timeline events |
| `GET` | `/api/v1/timeline/trends` | Trend data over time |

---

## WebSocket API

Connect to `ws://localhost:3000/ws` for real-time events.

### Event Types

| Event | Description |
|-------|-------------|
| `analysis:started` | Analysis run has begun |
| `analysis:progress` | Progress update (phase, %) |
| `analysis:finding` | New finding discovered |
| `analysis:complete` | Analysis finished |
| `analysis:error` | Analysis failed |

### Event Format

```json
{
  "type": "analysis:progress",
  "timestamp": "2026-01-01T00:00:01Z",
  "data": {
    "phase": "analyzing",
    "progress": 45,
    "message": "Running security analyzer..."
  }
}
```

---

## MCP Server

The MCP server exposes Recurrsive as an AI tool provider compatible with the [Model Context Protocol](https://modelcontextprotocol.io/).

### Tools (10)

| Tool | Description |
|------|-------------|
| `analyze_project` | Run full analysis on a project directory |
| `get_health_score` | Get project health and maturity scores |
| `list_opportunities` | List opportunities with filtering |
| `get_opportunity` | Get detailed opportunity information |
| `export_sarif` | Export analysis results as SARIF |
| `list_findings` | List findings with severity/category filter |
| `get_entity` | Get entity details from knowledge graph |
| `trace_dependency` | Trace dependency chain between entities |
| `explain_entity` | LLM-powered entity explanation |
| `analyze_impact` | Analyze blast radius of changing an entity |

### Prompts (6)

| Prompt | Description |
|--------|-------------|
| `interpret_health_report` | Guide interpretation of health scores |
| `prioritize_opportunities` | Help prioritize improvement opportunities |
| `review_findings` | Structured review of analysis findings |
| `architecture_review` | System architecture review template |
| `security_assessment` | Security assessment template |
| `cost_analysis` | Cost optimization analysis template |

### Resources (4)

| Resource | URI Pattern | Description |
|----------|-------------|-------------|
| Health Report | `recurrsive://reports/health` | Latest health assessment |
| Opportunities | `recurrsive://reports/opportunities` | Current opportunities list |
| Findings | `recurrsive://reports/findings` | Analysis findings summary |
| Timeline | `recurrsive://reports/timeline` | Evolution timeline |

---

## CLI Commands (8)

```bash
recurrsive init            # Initialize a project for analysis
recurrsive analyze         # Run analysis pipeline
recurrsive opportunities   # View and manage opportunities
recurrsive graph           # Explore the knowledge graph
recurrsive timeline        # View evolution timeline
recurrsive health          # Show health scores
recurrsive report          # Generate reports (markdown/html/sarif/json)
recurrsive config          # View, validate, or locate configuration
```

### Global Flags

| Flag | Description |
|------|-------------|
| `--config <path>` | Path to config file |
| `--verbose` | Enable verbose logging |
| `--json` | Output as JSON |
| `--no-color` | Disable color output |

---

## Authentication

> **Note:** Authentication is not yet implemented. The API server currently runs without auth. This is planned for a future release.

## Rate Limiting

> **Note:** Rate limiting is not yet implemented. All endpoints are currently unthrottled.

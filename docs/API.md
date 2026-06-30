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
| `GET` | `/api/v1/metrics/performance` | Performance metrics (analyzer timing, finding trends) |

### Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/analyze` | Start a new analysis run |
| `GET` | `/api/v1/analysis/status` | Current analysis status (phase, progress, message) |
| `GET` | `/api/v1/analysis/history` | History of past analysis runs |
| `GET` | `/api/v1/analysis/compare?baseline=N` | Compare analysis runs (current vs baseline run N) |

#### `POST /api/v1/analyze`

**Body:**
```json
{
  "path": "/path/to/project",
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
| `PATCH` | `/api/v1/opportunities/:id` | Update opportunity status |
| `GET` | `/api/v1/opportunities/export/:format` | Export opportunities (sarif, json, markdown) |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/reports/:format` | Generate report in specified format (`markdown`, `html`, `sarif`, `json`) |

### Knowledge Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/graph/entities` | List entities with optional type filter |
| `GET` | `/api/v1/graph/entities/:id` | Get entity details |
| `GET` | `/api/v1/graph/entities/:id/neighbors` | Get related entities |
| `GET` | `/api/v1/graph/stats` | Graph statistics |
| `GET` | `/api/v1/graph/search?q=` | Full-text search (FTS5, ranked) |

### Timeline

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/timeline` | Full intelligence timeline |
| `GET` | `/api/v1/timeline/snapshots` | List timeline snapshots |
| `GET` | `/api/v1/timeline/trends` | Trend data over time |

### Snapshots

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/snapshots/export` | Export graph as portable JSON |
| `POST` | `/api/v1/snapshots/import` | Import from snapshot file |

### Policies

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/policies` | List active policy sets and rules |
| `POST` | `/api/v1/policies/evaluate` | Evaluate opportunities against policies |
| `GET` | `/api/v1/policies/compliance` | Get compliance report and score |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/webhooks` | List registered webhooks |
| `POST` | `/api/v1/webhooks` | Register a new webhook |
| `DELETE` | `/api/v1/webhooks/:id` | Remove a webhook |
| `PATCH` | `/api/v1/webhooks/:id` | Update webhook settings |
| `POST` | `/api/v1/webhooks/:id/test` | Send a test event |
| `GET` | `/api/v1/webhooks/:id/deliveries` | View delivery history |
| `GET` | `/api/v1/webhooks/events` | List supported event types |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/config` | Get current server configuration |
| `PATCH` | `/api/v1/config` | Update runtime config (in-memory) |
| `GET` | `/api/v1/config/features` | List available features and enabled status |

### Audit Trail

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/audit` | List audit events (query: `?limit=&type=`) |
| `POST` | `/api/v1/audit` | Record a new audit event |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/analytics/summary` | Analysis trends (12-week), health score |
| `GET` | `/api/v1/analytics/top-categories` | Finding categories with counts |

### Experiments

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/experiments` | List experiments (query: `?status=`) |
| `POST` | `/api/v1/experiments` | Create new experiment |
| `GET` | `/api/v1/experiments/:id` | Get experiment details |
| `PUT` | `/api/v1/experiments/:id/status` | Update experiment status |

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

### Tools (22+)

| Tool | Description |
|------|-------------|
| `analyze_project` | Run full analysis on a project directory |
| `get_opportunities` | List prioritized improvement opportunities |
| `get_opportunity_detail` | Deep dive into a specific opportunity |
| `query_graph` | Query the knowledge graph |
| `get_health_score` | Get project health and maturity scores |
| `list_findings` | List findings with severity/category filter |
| `get_entity` | Get entity details from knowledge graph |
| `trace_dependency` | Trace dependency chain between entities |
| `explain_entity` | LLM-powered entity explanation |
| `analyze_impact` | Analyze blast radius of changing an entity |
| `search_graph` | Full-text search across the knowledge graph |
| `export_snapshot` | Export knowledge graph as portable JSON |
| `import_snapshot` | Import entities and relationships from a snapshot |
| `evaluate_policies` | Evaluate opportunities against policy rules |
| `compare_analyses` | Compare findings between analysis runs |
| `list_webhooks` | List registered webhook integrations |
| `register_webhook` | Register a new webhook for events |
| `manage_webhook` | Update, test, or delete a webhook |
| `start_batch_analysis` | Start batch analysis across multiple projects |
| `get_batch_status` | Check status of a running batch analysis |
| `list_experiments` | List engineering experiments |
| `create_experiment` | Create a new engineering experiment |

### Prompts (12)

| Prompt | Description |
|--------|-------------|
| `interpret_health_report` | Guide interpretation of health scores |
| `plan_improvement_cycle` | Plan an improvement cycle from opportunities |
| `explain_opportunity` | Detailed explanation of a specific opportunity |
| `architecture_review` | System architecture review template |
| `security_assessment` | Security assessment template |
| `cost_analysis` | Cost optimization analysis template |
| `policy_compliance_report` | Generate compliance report against policies |
| `snapshot_comparison` | Compare snapshots for architectural drift |
| `risk_assessment` | Comprehensive project risk assessment |
| `configure_notifications` | Guide setting up notification channels |
| `batch_analysis_plan` | Plan a batch analysis strategy |
| `audit_review` | Review audit trail events and identify patterns |

### Resources (7)

| Resource | URI | Description |
|----------|-----|-------------|
| Health Report | `recurrsive://health/latest` | Latest health assessment |
| Top Opportunities | `recurrsive://opportunities/top` | Top 10 opportunities |
| Graph Summary | `recurrsive://graph/summary` | Knowledge graph statistics |
| Intelligence Snapshot | `recurrsive://timeline/latest` | Latest intelligence snapshot |
| Active Policies | `recurrsive://policies/active` | Currently active policy rules |
| Webhook Status | `recurrsive://webhooks/status` | Webhook integration status |
| Analytics Summary | `recurrsive://analytics/summary` | Analysis trends summary |

---

## CLI Commands (17+)

```bash
recurrsive init            # Initialize a project for analysis
recurrsive analyze         # Run analysis pipeline
recurrsive opportunities   # View and manage opportunities
recurrsive graph           # Explore the knowledge graph
recurrsive timeline        # View intelligence timeline
recurrsive health          # Show health scores
recurrsive report          # Generate reports (markdown/html/sarif/json)
recurrsive config          # View, validate, set, or reset configuration
recurrsive search          # Full-text search across the knowledge graph
recurrsive snapshot        # Export/import graph snapshots
recurrsive policy          # Policy compliance checks
recurrsive webhooks        # Manage webhook integrations
recurrsive notifications   # Manage notification channels
recurrsive batch           # Run batch analysis across projects
recurrsive audit           # View and search audit trail
recurrsive analytics       # View analysis trends and categories
recurrsive experiments     # Manage A/B testing experiments
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

The API server supports optional API key authentication via the `X-API-Key` header. Configure with the `RECURRSIVE_API_KEY` environment variable. Health endpoints are excluded from auth.

## Rate Limiting

All API endpoints are rate-limited using a token-bucket algorithm. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Exceeding the limit returns HTTP 429.

## Middleware

| Middleware | Description |
|-----------|-------------|
| Rate Limiter | Token-bucket rate limiting with configurable window |
| Request Logger | Circular buffer logging (last 500 requests) |
| API Key Auth | Header-based auth with path exclusions |

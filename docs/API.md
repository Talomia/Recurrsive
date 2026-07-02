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
| `GET` | `/api/v1/audit` | List audit events (auto-captured by middleware). Filters: `?action=`, `?userId=`, `?method=`, `?status=`, `?from=`, `?to=`, `?limit=`, `?offset=` |
| `GET` | `/api/v1/audit/stats` | Aggregated audit statistics (byAction, byUser, byStatusGroup, recentErrors) |

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

### Notifications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/notifications/channels` | List available notification channels |
| `POST` | `/api/v1/notifications/test` | Send a test notification |
| `GET` | `/api/v1/notifications/history` | View notification history |

### Batch Analysis

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/batch/analyze` | Start a new batch analysis across projects |
| `GET` | `/api/v1/batch/status/:id` | Get batch analysis status |
| `GET` | `/api/v1/batch/history` | List past batch analyses |

### Export

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/export` | Create a new data export |
| `GET` | `/api/v1/export/:id/download` | Download an export file |
| `GET` | `/api/v1/export/history` | View export history |

### Search

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/search` | Full-text search across all entities, findings, and opportunities |

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

### Tools (42)

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
| `search_codebase` | Full-text search across the codebase |
| `get_audit_events` | Retrieve audit trail events |
| `take_snapshot` | Create a point-in-time knowledge graph snapshot |
| `get_timeline` | Get intelligence timeline with trend data |
| `export_report` | Export analysis data in various formats |
| `compare_analysis_runs` | Compare two analysis runs to identify changes |
| `list_projects` | List all projects with health scores |
| `get_project` | Get detailed project info with dimensions |
| `compare_project_health` | Compare health across projects |
| `forecast_health` | Predict health trajectory with confidence intervals |
| `what_if_analysis` | Simulate impact of hypothetical actions |
| `get_evolution` | Get evolution graph with trends and milestones |
| `list_simulations` | List simulations with status and risk level |
| `run_simulation` | Run a simulation (chaos, stress_test, etc.) |
| `get_confidence` | Get confidence calibration with Brier scores |
| `list_intelligence_packs` | List domain intelligence packs |
| `list_plugins` | List installed plugins with status |
| `list_tenants` | List tenants with tier and quota info |
| `get_benchmarks` | Get cloud benchmarking data |
| `list_secrets` | List secrets metadata (never exposes values) |

### Prompts (21)

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
| `deep_dive_finding` | Deep analysis of a specific security finding |
| `compare_snapshots` | Compare two snapshots and identify drift |
| `generate_action_items` | Generate actionable items from analysis results |
| `forecast_health` | Generate health forecast analysis |
| `simulation_review` | Review simulation results and recommend actions |
| `confidence_analysis` | Analyze prediction confidence calibration |
| `plugin_evaluation` | Evaluate a plugin for installation |
| `tenant_optimization` | Optimize tenant resource usage |
| `security_review` | Comprehensive security posture review |

### Resources (16)

| Resource | URI | Description |
|----------|-----|-------------|
| Health Report | `recurrsive://health/latest` | Latest health assessment |
| Top Opportunities | `recurrsive://opportunities/top` | Top 10 opportunities |
| Graph Summary | `recurrsive://graph/summary` | Knowledge graph statistics |
| Intelligence Snapshot | `recurrsive://timeline/latest` | Latest intelligence snapshot |
| Active Policies | `recurrsive://policies/active` | Currently active policy rules |
| Webhook Status | `recurrsive://webhooks/status` | Webhook integration status |
| Analytics Summary | `recurrsive://analytics/summary` | Analysis trends summary |
| Experiment Status | `recurrsive://experiments/active` | Active engineering experiments |
| Experiment Results | `recurrsive://experiments/results` | Completed experiment results |
| Project List | `recurrsive://projects/list` | All projects with health scores |
| Project Comparison | `recurrsive://projects/comparison` | Cross-project health comparison |
| Project Timeline | `recurrsive://projects/timeline` | Project evolution timeline |
| Platform Status | `recurrsive://platform/status` | Platform status overview |
| Installed Plugins | `recurrsive://plugins/installed` | Installed plugins list |
| Tenant Overview | `recurrsive://tenants/overview` | Multi-tenant overview |
| Cloud Benchmarks | `recurrsive://benchmarks/latest` | Latest cloud benchmarks |

---

## CLI Commands (25)

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
recurrsive comparisons     # Compare analysis runs (list, diff)
recurrsive export          # Export data (create, history)
recurrsive projects        # Multi-project management (list, show, compare)
recurrsive forecast        # Health forecasting (health, what-if)
recurrsive plugins         # Plugin management (list, marketplace, install)
recurrsive secrets         # Secret management (list, rotate, audit-log)
recurrsive simulate        # Simulation engine (list, run, show)
recurrsive cloud           # Cloud platform (benchmarks, patterns, partners)
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

The API server supports JWT and API key authentication:

- **JWT tokens** — `Authorization: Bearer <token>` header
- **API keys** — `X-API-Key: <key>` header

Login with demo credentials to obtain a JWT token:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'
```

### Auth Endpoints

| Method | Endpoint | Auth Required | Description |
|--------|----------|:---:|-------------|
| `POST` | `/api/v1/auth/login` | No | Login with credentials → JWT token |
| `POST` | `/api/v1/auth/refresh` | Yes | Refresh JWT token |
| `GET` | `/api/v1/auth/me` | Yes | Get current user info |
| `POST` | `/api/v1/api-keys` | Admin | Create API key |
| `GET` | `/api/v1/api-keys` | Yes | List API keys |
| `DELETE` | `/api/v1/api-keys/:id` | Admin | Revoke API key |

### Roles (RBAC)

| Role | Level | Permissions |
|------|:-----:|-------------|
| `admin` | 3 | Full access — all endpoints, API key management |
| `analyst` | 2 | Read/write — analysis, findings, opportunities |
| `viewer` | 1 | Read-only — view data, cannot trigger analysis |

Health endpoints are excluded from authentication.

## Rate Limiting

All API endpoints are rate-limited using a token-bucket algorithm. Responses include `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset` headers. Exceeding the limit returns HTTP 429.

## Middleware

| Middleware | Description |
|-----------|-------------|
| JWT Auth | HMAC-SHA256 JWT token verification |
| API Key Auth | SHA-256 hashed API key validation |
| RBAC | Role-based access control (admin/analyst/viewer) |
| Rate Limiter | Token-bucket rate limiting with configurable window |
| Request Logger | Circular buffer logging (last 500 requests) |
| Audit Middleware | Auto-capture all requests into audit trail |

### Projects (Multi-Project)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/projects` | List all projects |
| `GET` | `/api/v1/projects/:id` | Get project details |
| `POST` | `/api/v1/projects` | Create new project |
| `PUT` | `/api/v1/projects/:id` | Update project |
| `DELETE` | `/api/v1/projects/:id` | Delete project |
| `GET` | `/api/v1/projects/compare/health` | Cross-project health comparison |

### Forecasting & Intelligence

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/forecasting/health` | Health trajectory prediction (linear regression) |
| `POST` | `/api/v1/forecasting/what-if` | What-if impact simulation |
| `GET` | `/api/v1/forecasting/evolution` | Evolution graph (decisions, outcomes, learnings) |

#### `GET /api/v1/forecasting/health`

**Query Parameters:**
- `horizon` — Days to forecast (default: 30, max: 180)
- `history` — Historical days for model fitting (default: 90)

**Response includes:** current score, trend (improving/declining/stable), confidence (R²), forecast with bounds, target estimates.

#### `POST /api/v1/forecasting/what-if`

**Body:**
```json
{
  "actions": [
    { "type": "fix-critical-findings", "description": "Fix all critical security findings" },
    { "type": "add-tests", "description": "Increase test coverage to 80%" }
  ]
}
```

**Supported action types:** `fix-critical-findings`, `add-tests`, `upgrade-dependencies`, `add-monitoring`, `refactor-architecture`, `add-documentation`, `enable-strict-mode`, `fix-security-issues`, `optimize-performance`, `add-rate-limiting`.

### SSO / SAML

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/sso/providers` | List SSO configurations |
| `GET` | `/api/v1/sso/providers/:id` | Get SSO config details |
| `PUT` | `/api/v1/sso/providers/:id` | Create/update SSO config |
| `DELETE` | `/api/v1/sso/providers/:id` | Delete SSO config |
| `GET` | `/api/v1/sso/login/:provider` | Initiate SSO login (returns redirect URL) |
| `POST` | `/api/v1/sso/callback/:provider` | Process SAML response, issue JWT |
| `GET` | `/api/v1/sso/sessions` | List active SSO sessions |
| `DELETE` | `/api/v1/sso/sessions/:id` | Revoke SSO session |

Supported identity providers: Okta, Auth0, Azure AD, Google Workspace, Custom.

### Secret Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/secrets` | List secrets (metadata only, never values) |
| `GET` | `/api/v1/secrets/:id` | Get secret metadata |
| `POST` | `/api/v1/secrets` | Create secret |
| `POST` | `/api/v1/secrets/:id/rotate` | Rotate secret (increment version) |
| `DELETE` | `/api/v1/secrets/:id` | Delete secret |
| `GET` | `/api/v1/secrets/audit/log` | Get secret access audit log |
| `GET` | `/api/v1/secrets/health/rotation` | Check rotation health status |

Supported backends: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, Local.

### Confidence Calibration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/confidence/overview` | Overall calibration: Brier scores, accuracy, calibration curves |
| `GET` | `/api/v1/confidence/predictions` | List predictions (filter by analyzer, status, severity) |
| `POST` | `/api/v1/confidence/predictions/:id/outcome` | Record prediction outcome |
| `GET` | `/api/v1/confidence/calibration/:analyzerId` | Per-analyzer calibration curve |

### Multi-Tenant

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/tenants` | List all tenants |
| `GET` | `/api/v1/tenants/:id` | Get tenant details |
| `POST` | `/api/v1/tenants` | Create tenant |
| `PUT` | `/api/v1/tenants/:id` | Update tenant (tier, status, domain) |
| `DELETE` | `/api/v1/tenants/:id` | Delete tenant |
| `GET` | `/api/v1/tenants/:id/quotas` | Get quota usage and limits |
| `GET` | `/api/v1/tenants/tiers/info` | Tier comparison (free/team/enterprise) |

### Simulation Engine

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/simulations` | List simulations |
| `GET` | `/api/v1/simulations/:id` | Get simulation with results |
| `POST` | `/api/v1/simulations` | Create and run simulation |

Simulation types: `traffic-replay`, `load-test`, `failure-injection`, `dependency-change`, `architecture-change`.

### PR Generation

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/pull-requests` | List generated PRs |
| `GET` | `/api/v1/pull-requests/:id` | Get PR details with changes |
| `POST` | `/api/v1/pull-requests/generate` | Generate PR from recommendation |
| `POST` | `/api/v1/pull-requests/:id/submit` | Submit PR for review |

### Domain Intelligence Packs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/intelligence-packs` | List all packs (Healthcare, Finance, K8s, AI Safety) |
| `GET` | `/api/v1/intelligence-packs/:id` | Get pack details (analyzers, frameworks, rules) |
| `POST` | `/api/v1/intelligence-packs/:id/install` | Install pack |
| `DELETE` | `/api/v1/intelligence-packs/:id/uninstall` | Uninstall pack |

### Recurrsive Cloud

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/cloud/benchmarks` | Submit anonymized benchmark (opt-in) |
| `GET` | `/api/v1/cloud/benchmarks/report` | Get benchmark report with percentiles |
| `GET` | `/api/v1/cloud/patterns` | Cross-org learned patterns |
| `GET` | `/api/v1/cloud/patterns/:id` | Pattern details |
| `GET` | `/api/v1/cloud/partners` | Partner directory |
| `GET` | `/api/v1/cloud/partners/:id` | Partner details |
| `POST` | `/api/v1/cloud/partners/apply` | Apply for partner program |
| `GET` | `/api/v1/cloud/services` | Managed service tiers |
| `GET` | `/api/v1/cloud/info` | Platform info and status |

### GraphQL API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/graphql` | Execute GraphQL query |
| `GET` | `/api/v1/graphql/schema` | Get SDL schema (text/plain) |
| `GET` | `/api/v1/graphql/introspection` | Schema introspection metadata |

#### `POST /api/v1/graphql`

**Body:**
```json
{
  "query": "{ projects { id name healthScore } }",
  "variables": {}
}
```

**Supported queries:** `projects`, `project(id)`, `findings(severity, analyzerId, limit)`, `analyzers`, `collectors`, `healthScore`, `opportunities(limit)`.

**Response format:** `{ "data": { ... }, "errors": [...] }`

---

### Scheduling

Report scheduling and automated export routes.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/schedules` | List all schedules |
| `GET` | `/api/v1/schedules/:id` | Get schedule details |
| `POST` | `/api/v1/schedules` | Create a new schedule |
| `PUT` | `/api/v1/schedules/:id` | Update an existing schedule |
| `DELETE` | `/api/v1/schedules/:id` | Delete a schedule |
| `POST` | `/api/v1/schedules/:id/run` | Trigger an immediate run |
| `GET` | `/api/v1/schedules/:id/runs` | List previous runs |
| `POST` | `/api/v1/schedules/:id/toggle` | Enable/disable a schedule |

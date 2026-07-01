# Getting Started with Recurrsive

A step-by-step tutorial to get Recurrsive running and analyzing your first project.

## Prerequisites

| Requirement | Minimum Version |
|-------------|----------------|
| **Node.js** | 20.0.0+ |
| **pnpm** | 9.0.0+ |
| **Git** | 2.30+ |

## Step 1: Clone and Build

```bash
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

This will build 13 packages including the CLI, server, dashboard, and MCP server.

## Step 2: Link the CLI

```bash
# Option A: Use npx (no global install)
npx --package ./apps/cli recurrsive --help

# Option B: Link globally for development
pnpm --filter @recurrsive/cli link --global
recurrsive --help
```

## Step 3: Initialize a Project

Navigate to any project you want to analyze:

```bash
cd /path/to/your/project
recurrsive init
```

This creates a `.recurrsive/` directory with:
- `config.json` (or `config.yaml`) — Configuration file
- `graph.db` — SQLite knowledge graph database
- `snapshots/` — Intelligence timeline data

### Configuration

The init command auto-detects your project's language, frameworks, and AI providers.
You can customize the configuration:

```yaml
# .recurrsive/config.yaml
version: "1"

project:
  name: my-project
  repository: https://github.com/org/my-project

graph:
  provider: sqlite

analyzers:
  enabled: ["*"]       # Run all analyzers
  disabled: []         # Or exclude specific ones

output:
  format: markdown     # json, markdown, sarif, html
  directory: .recurrsive
```

## Step 4: Run Analysis

```bash
# Full analysis (all 13 analyzers)
recurrsive analyze .

# Run specific analyzers only
recurrsive analyze . --analyzers security,performance

# Include AI-powered reasoning (requires LLM API key)
recurrsive analyze . --reasoning
```

The analysis pipeline:
1. **Collect** — Discovers code, docs, configs, CI/CD, databases
2. **Parse** — Extracts entities and relationships using Tree-sitter
3. **Build Graph** — Populates the knowledge graph with entities
4. **Analyze** — Runs all enabled analyzers against the graph
5. **Reason** (optional) — AI agents debate and rank opportunities

## Step 5: Explore Results

### Health Score

```bash
recurrsive health
```

Shows an overall health score (0–100) with maturity breakdown across 10 dimensions.

### Opportunities

```bash
# View top 10 opportunities
recurrsive opportunities --top 10

# Filter by type
recurrsive opportunities --type risk
recurrsive opportunities --type debt
recurrsive opportunities --type opportunity
```

### Knowledge Graph

```bash
# Graph statistics
recurrsive graph

# Search entities
recurrsive graph --search "auth"

# View entity details
recurrsive graph --neighbors <entity-id>

# Filter by type
recurrsive graph --type function
```

### Timeline

```bash
# View intelligence timeline
recurrsive timeline

# Compare two snapshots
recurrsive timeline --compare snap-1 snap-2
```

### Search

```bash
# Full-text search across the knowledge graph
recurrsive search "authentication"

# Search with type filter
recurrsive search "handler" --type function
```

### Snapshots

```bash
# Export the knowledge graph as portable JSON
recurrsive snapshot export --output backup.json

# Import from a snapshot file
recurrsive snapshot import backup.json
```

### Reports

```bash
# Generate a markdown report
recurrsive report --format markdown

# Generate SARIF for GitHub Code Scanning
recurrsive report --format sarif > results.sarif

# Generate JSON for CI/CD pipelines
recurrsive report --format json

# Generate HTML for sharing
recurrsive report --format html
```

## Step 6: Start the Server (Optional)

```bash
# Start the REST API + WebSocket server
node apps/server/dist/bin.js

# Server runs at http://localhost:3000
# API docs: http://localhost:3000/health
```

### Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/analyze` | Trigger analysis |
| `GET` | `/api/v1/health-score` | Health + maturity scores |
| `GET` | `/api/v1/opportunities` | Prioritized opportunities |
| `GET` | `/api/v1/graph/entities` | Browse knowledge graph |
| `GET` | `/api/v1/reports/:format` | Download reports |

## Step 7: Launch the Dashboard (Optional)

```bash
cd apps/dashboard
pnpm dev
# Opens at http://localhost:3100
```

The dashboard provides:
- Health score gauge and trend charts
- Opportunity browser with filtering
- Knowledge graph visualization
- Report generation and export
- System configuration

## Step 8: Connect AI Assistants via MCP (Optional)

Add Recurrsive as an MCP server for Claude, Cursor, or Copilot:

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

This gives your AI assistant 42 tools, 15 prompts, and 9 resources to analyze, query, and reason about your codebase.

---

## Troubleshooting

### Build Errors

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Analysis Fails

```bash
# Check the config is valid
recurrsive config validate

# Try with verbose logging
recurrsive analyze . --verbose
```

### Missing Dependencies

```bash
# Check Node.js version
node --version  # Should be 20+

# Check pnpm version
pnpm --version  # Should be 9+
```

## Next Steps

- Read the [Architecture Guide](ARCHITECTURE.md) for system design details
- Read the [API Reference](API.md) for endpoint documentation
- Read the [Product Requirements](PRD.md) for full capability descriptions
- Check the [Roadmap](ROADMAP.md) for upcoming features

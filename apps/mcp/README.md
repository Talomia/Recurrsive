# Recurrsive MCP Server

The Model Context Protocol adapter exposes recorded analysis, graph, governance, batch, snapshot, report, project, and projection workflows to compatible assistants over stdio.

The production inventory is registered at runtime and covered by tests. Removed speculative surfaces—simulation, arbitrary what-if scoring, plugin installation, tenant management, and prediction calibration—are not exposed.

```bash
pnpm --filter @recurrsive/mcp build
pnpm --filter @recurrsive/mcp test
pnpm --filter @recurrsive/mcp start
```

Configure API-backed tools and resources with:

```bash
export RECURRSIVE_API_URL=http://localhost:3000
export RECURRSIVE_API_TOKEN=<jwt>
export RECURRSIVE_PROJECT_ID=<registered-project-id>
```

Use `RECURRSIVE_API_KEY` instead of `RECURRSIVE_API_TOKEN` when authenticating
with an API key. A tool's `project_id` argument overrides
`RECURRSIVE_PROJECT_ID`. Missing project scope is returned as an explicit MCP
error rather than silently reading unrelated or empty data.

Local analysis tools use the same core collectors, analyzers, and graph
implementations as the CLI.

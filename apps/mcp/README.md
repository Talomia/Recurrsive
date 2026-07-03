# Recurrsive MCP Server

**Model Context Protocol Server** — 42 tools, 21 prompts, and 16 resources that expose the Engineering Intelligence Platform to AI coding assistants.

## Overview

The Recurrsive MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io) to let AI assistants (Cursor, Windsurf, Claude Code, etc.) access analysis results, query the knowledge graph, run governance checks, and manage projects — all through a standardized stdio transport.

### Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **Analysis Tools** | Run analyses, inspect findings, search across entities |
| 📊 **Intelligence Tools** | Forecasting, what-if simulations, trend intelligence |
| 🛡️ **Governance Tools** | Policy checks, compliance validation, audit queries |
| 📦 **Batch & Snapshot Tools** | Multi-project batch runs, snapshot export/import |
| 🧪 **Experiment Tools** | A/B experiment management and result tracking |
| 🔌 **Platform Tools** | Project management, webhooks, export, cloud operations |
| 💬 **Prompts** | 21 pre-built prompt templates for analysis, assessments, governance, intelligence, and operations |
| 📚 **Resources** | 16 resources exposing reports, analytics, governance data, experiments, and project metadata |

### Tech Stack

- **@modelcontextprotocol/sdk** for MCP protocol implementation
- **Zod** for tool input schema validation
- **TypeScript 5.7+**
- **stdio transport** for AI assistant communication
- Consumes `@recurrsive/core`, `analyzers`, `graph`, `reasoning`, and more

## Getting Started

```bash
# From the monorepo root
pnpm install
pnpm build

# Start the MCP server
pnpm --filter @recurrsive/mcp start
```

### Configure in your AI assistant

```json
{
  "mcpServers": {
    "recurrsive": {
      "command": "node",
      "args": ["apps/mcp/dist/bin.js"]
    }
  }
}
```

## Capabilities

| Type | Modules | Total |
|------|---------|-------|
| **Tools** | analyze, inspect, governance, webhooks, batch, experiments, search, snapshots, export, projects, forecasting, intelligence, platform | 42 |
| **Prompts** | templates, assessments, governance, operations, analysis, intelligence, platform | 21 |
| **Resources** | reports, governance, analytics, experiments, projects, platform | 16 |

## Scripts

| Script | Description |
|--------|-------------|
| `build` | Compile TypeScript with `tsc` |
| `dev` | Watch-mode compilation |
| `start` | Start the MCP server (`dist/bin.js`) |
| `test` | Run tests with Vitest |
| `clean` | Remove the `dist/` directory |
| `typecheck` | Type-check without emitting |
| `lint` | Lint source with ESLint |

## License

[Apache-2.0](../../LICENSE)

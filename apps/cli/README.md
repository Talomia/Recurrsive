# Recurrsive CLI

**Engineering Intelligence from the Terminal** — 29 commands for analyzing, inspecting, and managing software projects via the `recurrsive` executable.

## Overview

The Recurrsive CLI is a Commander-based tool that brings the full Engineering Intelligence Platform to your terminal. Run analyses, query the knowledge graph, manage policies, generate reports, and more — all from a single `recurrsive` command.

### Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **analyze** | Run full or incremental analysis on a project |
| 🏥 **health** | Project health scores and maturity assessment |
| 💡 **opportunities** | Discover prioritized improvement opportunities |
| 🗺️ **graph** | Query and explore the knowledge graph |
| 📊 **analytics** | Aggregate metrics, trends, and category breakdowns |
| ⏳ **timeline** | View intelligence timeline and historical trends |
| 📋 **report** | Generate reports in markdown, HTML, SARIF, and JSON |
| 🛡️ **policy** | Manage governance rules and compliance checks |
| 🔔 **notifications** | Configure notification channels and alerts |
| 🧪 **experiments** | Manage engineering experiments and A/B tests |
| 📦 **batch** | Run batch analysis across multiple projects |
| 🔮 **forecasting** | Generate and view project forecasts |
| 🎭 **simulation** | Run what-if simulations on proposed changes |
| 🔌 **plugins** | Manage analysis plugins |
| ☁️ **cloud** | Interact with Recurrsive Cloud services |

Additional commands: `init`, `config`, `search`, `snapshot`, `webhooks`, `audit`, `comparisons`, `export`, `projects`, `secrets`.

### Tech Stack

- **Commander 12** for argument parsing and subcommands
- **TypeScript 5.7+**
- Consumes `@recurrsive/core`, `analyzers`, `graph`, `reasoning`, and more

## Getting Started

```bash
# From the monorepo root
pnpm install
pnpm build

# Run the CLI
pnpm --filter @recurrsive/cli start

# Or invoke directly after build
node apps/cli/dist/bin.js analyze ./my-project
```

## Scripts

| Script | Description |
|--------|-------------|
| `build` | Compile TypeScript with `tsc` |
| `dev` | Watch-mode compilation |
| `start` | Run the CLI entry point (`dist/bin.js`) |
| `test` | Run tests with Vitest |
| `clean` | Remove the `dist/` directory |
| `typecheck` | Type-check without emitting |
| `lint` | Lint source with ESLint |

## License

[Apache-2.0](../../LICENSE)

# Recurrsive Server

**REST API + WebSocket Server** — 150 endpoints across 34 route modules, powered by Fastify with OpenAPI 3.1 documentation and real-time WebSocket support.

## Overview

The Recurrsive Server is the API backbone of the Engineering Intelligence Platform. It exposes a comprehensive REST API for analysis, graph queries, opportunity management, reporting, governance, and more — plus WebSocket channels for real-time analysis progress and event streaming.

### Key Features

| Feature | Description |
|---------|-------------|
| 🔍 **Analysis** | Run analyses, query findings, manage analysis history |
| 💡 **Opportunities** | CRUD and export for prioritized improvements |
| 🗺️ **Graph** | Knowledge graph queries and entity exploration |
| 📊 **Analytics** | Metrics summaries, trends, and category breakdowns |
| 📋 **Reports** | Generate reports in Markdown, HTML, SARIF, and JSON |
| 🛡️ **Policies** | Governance rule enforcement and compliance checks |
| 🔐 **Auth & SSO** | Authentication, API key management, and SSO integration |
| 📡 **WebSocket** | Real-time analysis progress and event streaming |
| 📖 **OpenAPI** | Auto-generated spec at `/api/v1/openapi.json` with Swagger UI at `/api/docs` |
| ☁️ **Cloud & Multi-Tenant** | Cloud services, multi-tenant isolation, and marketplace |

### Route Groups

`health` · `analysis` · `findings` · `opportunities` · `graph` · `timeline` · `reports` · `snapshots` · `policies` · `webhooks` · `config` · `notifications` · `batch` · `audit` · `analytics` · `experiments` · `search` · `export` · `auth` · `projects` · `forecasting` · `sso` · `scheduling` · `plugins` · `secrets` · `confidence` · `multi-tenant` · `simulation` · `cloud` · `graphql` · `marketplace` · `partners` · `openapi` · `data-masking`

### Tech Stack

- **Fastify 5** with `@fastify/cors` and `@fastify/websocket`
- **OpenAPI 3.1** specification with Swagger UI
- **TypeScript 5.7+**
- Consumes `@recurrsive/core`, `analyzers`, `graph`, `reasoning`, `presentation`, and more

## Getting Started

```bash
# From the monorepo root
pnpm install
pnpm build

# Start the server (default port 3000)
pnpm --filter @recurrsive/server start
```

Open [http://localhost:3000/api/docs](http://localhost:3000/api/docs) to browse the Swagger UI.

## Scripts

| Script | Description |
|--------|-------------|
| `build` | Compile TypeScript with `tsc` |
| `dev` | Watch-mode compilation |
| `start` | Start the server (`dist/bin.js`) |
| `test` | Run tests with Vitest |
| `clean` | Remove the `dist/` directory |
| `typecheck` | Type-check without emitting |
| `lint` | Lint source with ESLint |

## License

[Apache-2.0](../../LICENSE)

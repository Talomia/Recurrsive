# Getting Started

## Install

```bash
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive
pnpm install --frozen-lockfile
pnpm build
```

Node.js 22 and pnpm 9 are recommended.

## Verify the workspace

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Run locally

Start the server and dashboard using their package scripts. The API defaults to port 3000 and the dashboard to port 3100. Local development uses persistent SQLite state unless a PostgreSQL/AGE URL is configured.

Open the dashboard. A fresh deployment redirects to `/setup`; create the first administrator there. The dashboard stores the resulting session in an HttpOnly cookie.

## Register and analyze a project

From the dashboard, create a project with its repository details and start analysis from that project. Server analysis is keyed by project ID. For remote repositories, the submitted URL must match the registered project and an allowed Git host.

From the CLI:

```bash
recurrsive init
recurrsive analyze .
recurrsive health
recurrsive opportunities
recurrsive report --format html
```

Use `recurrsive --help` for the authoritative command list.

## Direct API use

Check first-run state, complete setup or login, then send the returned JWT as a bearer token. Register a project before calling analysis.

The authoritative runtime route list is available at:

```text
GET /api/v1/openapi.json
```

## MCP

Build the MCP app and configure your MCP client to run `apps/mcp/dist/bin.js`. Set the API connection and authentication variables required by `apps/mcp/src/api.ts`. The registered MCP tool list is authoritative; documentation does not hard-code a count.

## Production

Do not use development defaults in production. PostgreSQL with Apache AGE, strong unique JWT and encryption secrets, exact CORS origin, HTTPS domains, backups, and tested rollback are required. See [DEPLOYMENT.md](DEPLOYMENT.md).

# Getting Started

## Install

```bash
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive
pnpm install --frozen-lockfile
pnpm build
```

Node.js 22 and pnpm 11.7.0 or newer are required.

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

API-backed CLI commands require authentication and, for project data, an
explicit project scope:

```bash
export RECURRSIVE_API_URL=http://localhost:3000
export RECURRSIVE_TOKEN=<jwt>
export RECURRSIVE_PROJECT_ID=<registered-project-id>
```

`RECURRSIVE_API_KEY` can be used instead of a bearer token. Project-scoped
commands also accept `--project-id` to override the environment value.

## Direct API use

Check first-run state, complete setup or login, then send the returned JWT as a bearer token. Register a project before calling analysis.

The authoritative runtime route list is available at:

```text
GET /api/v1/openapi.json
```

## MCP

Build the MCP app and configure your MCP client to run `apps/mcp/dist/bin.js`.
Set `RECURRSIVE_API_URL`, either `RECURRSIVE_API_TOKEN` or
`RECURRSIVE_API_KEY`, and `RECURRSIVE_PROJECT_ID` for API-backed tools and
resources. Tool calls with a `project_id` argument override the environment
scope. The registered MCP tool list is authoritative; documentation does not
hard-code a count.

## Production

Do not use development defaults in production. PostgreSQL with Apache AGE, strong unique JWT and encryption secrets, exact CORS origin, HTTPS domains, backups, and tested rollback are required. See [DEPLOYMENT.md](DEPLOYMENT.md).

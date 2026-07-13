# Recurrsive

Recurrsive is a self-hosted engineering analysis platform. It collects repository evidence, runs deterministic analyzers, stores project-scoped findings and opportunities, and exposes the results through a dashboard, CLI, REST API, WebSocket stream, and MCP server.

The project is Apache-2.0 licensed. It does not currently provide a managed SaaS service. Production installations run in infrastructure controlled by the deploying organization.

## What is implemented

- Git and repository evidence collection
- Static analysis across architecture, security, reliability, data, testing, documentation, dependencies, API contracts, AI usage, cost, and performance
- Evidence-backed opportunity promotion from analyzer findings
- Project-scoped persisted analysis results and history
- SQLite for local development and PostgreSQL with Apache AGE for production
- Local accounts, API keys, role-based access, invitations, optional SSO, audit logging, secret encryption, and data masking
- Reports, policies, schedules, webhooks, notifications, batch analysis, snapshots, and an experiment registry
- Dashboard, CLI, MCP server, generated OpenAPI inventory, and ticket-authenticated WebSocket updates
- Docker and EasyPanel deployment definitions

Recurrsive does not claim to run load tests, chaos experiments, create GitHub pull requests, isolate multiple customer tenants, or operate managed cloud infrastructure. Those surfaces are intentionally absent until they have real integrations and isolation boundaries.

## Requirements

- Node.js 22 or newer
- pnpm 9
- Docker for the production-like stack

## Local development

```bash
git clone https://github.com/Talomia/Recurrsive.git
cd Recurrsive
pnpm install --frozen-lockfile
pnpm build
pnpm test
```

Start the API and dashboard with the package scripts described in `package.json`. Local development persists state in SQLite. Run the setup flow once to create the first administrator.

## Production deployment

Production mode requires PostgreSQL with Apache AGE and refuses to start with placeholder or weak secrets. At minimum configure:

- `DATABASE_URL`
- `JWT_SECRET` — unique random value of at least 32 characters
- `SECRETS_ENCRYPTION_KEY` — distinct unique random value of at least 32 characters
- `CORS_ORIGIN` — the exact dashboard origin
- `PUBLIC_API_URL` — browser-reachable API origin
- `INTERNAL_API_URL` — container-to-container API origin for the dashboard

The supported container topology and health checks are in [docker/docker-compose.yml](docker/docker-compose.yml). EasyPanel service definitions are in [easypanel.json](easypanel.json). Deployment, backup, restore, and rollback instructions are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

Never commit live credentials. Replace every deployment placeholder in the target platform's secret manager before starting production services.

## Authentication

The dashboard uses a same-origin backend-for-frontend route. Login and setup tokens are stored in an `HttpOnly`, `SameSite=Lax` cookie and are not exposed to browser JavaScript. Direct API consumers use either:

```http
Authorization: Bearer <jwt>
```

or:

```http
X-API-Key: <api-key>
```

WebSocket clients first request a short-lived, one-use ticket from `POST /api/v1/auth/ws-ticket`, then connect to `/ws?ticket=...`. JWTs are never placed in WebSocket URLs.

## API workflow

1. Check `GET /api/v1/setup/status`.
2. Create the first admin with `POST /api/v1/setup`, or sign in with `POST /api/v1/auth/login`.
3. Register a repository with `POST /api/v1/projects`.
4. Start analysis with `POST /api/v1/analyze` using that project ID.
5. Poll project-scoped status/history or consume WebSocket events.

The runtime-generated route inventory is served at `GET /api/v1/openapi.json`. It is built from the routes actually registered by the server, so removed or disabled endpoints are not advertised.

## Trust model

Analyzer output is the source evidence. Opportunities are derived from concrete findings and retain their source locations, severity, explanation, and recommended action. Trend projection is shown only after at least three recorded health scores and is labeled as linear extrapolation; it is not presented as a guaranteed outcome.

## Quality gates

```bash
pnpm audit --prod
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs these gates and builds the API, dashboard, and website containers. Dependabot and CodeQL workflows are also configured.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Product scope](docs/PRD.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](CONTRIBUTING.md)

## License

[Apache License 2.0](LICENSE)

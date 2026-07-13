# Architecture

## System boundary

Recurrsive is a self-hosted monorepo with five user-facing applications:

- `apps/server` — Fastify REST API, analysis coordinator, persistence, and WebSocket server
- `apps/dashboard` — Next.js authenticated dashboard and same-origin API proxy
- `apps/cli` — command-line client and local analysis entrypoints
- `apps/mcp` — MCP tools, prompts, and resources backed by the API
- `apps/website` — static product and documentation site with server-side form proxies

Shared packages contain collectors, parsers, analyzers, graph storage, reasoning, opportunity promotion, policy evaluation, and presentation logic.

## Analysis flow

```text
registered project
      |
      v
analysis coordinator (one active job)
      |
      v
collect repository evidence
      |
      v
parse files and build graph entities
      |
      v
run deterministic analyzers
      |
      v
persist findings + actual health score
      |
      v
promote supported findings to opportunities
      |
      v
persist project-scoped cache/history and emit realtime events
```

The coordinator is intentionally serial. This matches the current singleton analysis state and prevents one project from overwriting another while a job runs. A future concurrent worker model must first move every mutable analysis component behind explicit job/project ownership.

## Persistence

Local development uses a durable SQLite store. Production requires PostgreSQL with Apache AGE and fails closed if it cannot connect. Analysis caches, history, finding state, projects, users, invitations, API keys, secrets metadata, audits, contact submissions, schedules, policies, webhooks, notifications, experiments, and other route state use the durable store.

Production does not fall back to in-memory or SQLite storage.

## Project isolation

Analysis data is keyed by registered project ID. Analysis, status, history, findings, opportunities, batch jobs, and realtime events require or carry that ID. Remote analysis accepts only a repository URL that matches the registered project and an allowed Git host.

Project scoping is not tenant isolation. All projects in one deployment share its administrative boundary and database.

## Authentication and authorization

The API accepts HMAC-SHA256 JWTs or API keys. HTTP routes are authenticated by default; public routes are explicitly enumerated. Roles are ordered `viewer < analyst < admin`.

- viewers may read authenticated resources
- analysts may mutate ordinary project data
- administrators control users, API keys, configuration, SSO, secrets, data masking, and other security-sensitive state

The dashboard never stores JWTs in browser JavaScript storage. Its Next.js proxy exchanges login/setup responses for an HttpOnly cookie and injects the bearer token upstream. WebSocket authentication uses a hashed, 60-second, one-use ticket.

## Secrets

Secret values use AES-GCM encryption before persistence. Production requires a unique encryption key distinct from the JWT secret. Only the local encrypted backend is advertised; unsupported external vault integrations are not exposed as working options.

## API inventory

The OpenAPI route list is generated from routes registered in the running Fastify instance. Authorization metadata is derived from the same public-route allowlist used by middleware. A manually maintained Swagger document is not used.

## Trend projection

Each successful analysis stores the actual health score calculated from that run. Trend projection requires three recorded scores and performs linear regression over elapsed days. R² is reported as observed-data fit. Prediction intervals use residual standard error. With insufficient history, the API returns `available: false` and no projected points.

## Deployment topology

The production stack contains:

- PostgreSQL with Apache AGE on an internal network
- API container running as a non-root user
- dashboard container with internal API access and a public API origin for realtime connections
- optional website container

Database storage is persistent. Health checks gate dependencies. Secrets are supplied by the deployment platform, not committed files. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Deliberately absent

The production architecture does not include managed SaaS control-plane services, tenant isolation, synthetic load/chaos simulation, or source-control pull-request execution. Those capabilities require real external execution and stronger boundaries than record CRUD.

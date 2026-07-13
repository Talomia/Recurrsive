# Recurrsive Server

The Fastify API provides authenticated project analysis, findings, evidence-backed opportunities, graph queries, history, reports, policies, scheduling, notifications, audit data, WebSocket progress, setup, users, invitations, SSO, secrets, and operational health.

The OpenAPI 3.1 document is generated from the registered runtime routes at `/api/v1/openapi.json`; `/api/docs` redirects to that inventory. Authentication is default-deny outside the explicitly enumerated setup, login, invite, health, contact, SSO, and documentation routes.

```bash
pnpm --filter @recurrsive/server build
pnpm --filter @recurrsive/server test
pnpm --filter @recurrsive/server start
```

Production startup requires PostgreSQL with Apache AGE, strong JWT and encryption secrets, and explicit CORS origins. See [deployment](../../docs/DEPLOYMENT.md).

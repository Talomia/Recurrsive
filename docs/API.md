# Recurrsive API

The server publishes its authoritative runtime route inventory at:

```text
GET /api/v1/openapi.json
```

The inventory is generated from registered Fastify routes. This file describes the stable workflow and security model without duplicating a manually maintained endpoint list.

## Authentication

Public routes are limited to health, initial setup, login, one-time invite acceptance, contact submissions, SSO initiation/callback, and the OpenAPI inventory. Every other route is authenticated by default.

Direct clients send a JWT bearer token or API key:

```http
Authorization: Bearer <token>
X-API-Key: <key>
```

Dashboard browser requests use the dashboard's same-origin `/api/v1/*` proxy and an HttpOnly session cookie. The proxy injects the bearer credential server-side.

Roles are `viewer`, `analyst`, and `admin`. Viewers are read-only. Analysts can mutate ordinary project data. Identity, configuration, SSO, secrets, and other security-sensitive mutations require an administrator.

## First-run workflow

```text
GET  /api/v1/setup/status
POST /api/v1/setup
POST /api/v1/auth/login
GET  /api/v1/auth/me
```

Setup is accepted only while no users exist. Login and setup return a token to direct API consumers; the dashboard proxy removes it from the JSON response and sets the HttpOnly session cookie.

## Project analysis workflow

```text
POST /api/v1/projects
POST /api/v1/analyze
GET  /api/v1/analysis/status?projectId=<id>
GET  /api/v1/analysis/history?projectId=<id>
GET  /api/v1/findings?projectId=<id>
GET  /api/v1/opportunities?projectId=<id>
```

Analysis requires a registered project ID. Remote repository URLs must match the registered project and an allowed Git host. Jobs are serialized so the status model matches actual worker ownership.

## Realtime updates

Request a short-lived one-use WebSocket ticket while authenticated:

```text
POST /api/v1/auth/ws-ticket
```

Then connect:

```text
wss://<api-origin>/ws?ticket=<ticket>
```

Tickets expire after 60 seconds, are stored only as hashes, and are consumed once. Events include `projectId` so clients can ignore unrelated project updates.

## Error model

Errors use an HTTP status plus a JSON body containing `error` and `message`. Validation failures return 400, missing/invalid credentials 401, insufficient roles 403, unknown records 404, conflicts 409, rate limits 429, and unexpected failures 500.

## Removed surfaces

Simulation, synthetic pull-request generation, what-if scoring, and non-isolated tenant APIs are not part of the production API. They were removed rather than advertised without real execution or isolation.

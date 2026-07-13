# Production Deployment

Recurrsive is self-hosted. The supported production topology uses PostgreSQL with Apache AGE, the API server, the dashboard, and optionally the public website.

## Required secrets and origins

Configure these in the deployment platform's secret manager:

| Variable | Service | Requirement |
|---|---|---|
| `DATABASE_URL` | server | PostgreSQL/AGE URL with a unique strong password |
| `JWT_SECRET` | server | unique random value, at least 32 characters |
| `SECRETS_ENCRYPTION_KEY` | server | distinct unique random value, at least 32 characters |
| `CORS_ORIGIN` | server | exact dashboard origin, no wildcard |
| `DASHBOARD_ORIGIN` | dashboard | exact public dashboard origin used for mutation-origin checks |
| `PUBLIC_API_URL` | dashboard | browser-reachable HTTPS API origin |
| `INTERNAL_API_URL` | dashboard | internal API service URL |
| `TRUST_PROXY` | server | `true` only behind the trusted EasyPanel proxy |
| `RATE_LIMIT_MAX` | server | authenticated requests per credential per minute; default `300` |
| `AUTH_RATE_LIMIT_MAX` | server | login attempts per source IP per minute; default `10` |
| `RECURRSIVE_ALLOW_PRIVATE_OUTBOUND` | server | opt in to private-network webhook and notification targets; default `false` for SSRF protection |

Production startup rejects known placeholders, weak database credentials, missing CORS, SQLite, and unavailable PostgreSQL/AGE.
General traffic is bucketed by authenticated credential so one busy user does not consume another user's allowance; unauthenticated traffic and login attempts remain IP-limited.

## Docker Compose

Review and replace every required variable, then run:

```bash
docker compose -f docker/docker-compose.yml config
docker compose -f docker/docker-compose.yml build
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

The database is internal-only. Containers run as non-root users and have health checks. Persistent volumes hold PostgreSQL and application data.

## EasyPanel

1. Connect the GitHub repository to EasyPanel.
2. Create or update the project from `easypanel.json`.
3. Set fresh database, JWT, and encryption secrets in EasyPanel. Do not leave schema placeholders in place.
4. Assign HTTPS domains to the API, dashboard, and optional website.
5. Set `CORS_ORIGIN` and `DASHBOARD_ORIGIN` to the dashboard origin, `PUBLIC_API_URL` to the public API origin, and `INTERNAL_API_URL` to the EasyPanel API service address.
6. Deploy PostgreSQL first, then the API, then dashboard and website.
7. Confirm `/health`, `/api/v1/setup/status`, dashboard setup/login, API session hydration, analysis, and WebSocket events.

The dashboard reads its public realtime API URL at runtime, so changing the public API domain does not require embedding a browser JWT or WebSocket token.

## Backup

Back up both PostgreSQL and any persistent application data volume. A database-only backup is insufficient if local repository workspaces or generated exports are stored outside PostgreSQL.

Example logical backup:

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" > recurrsive.dump
```

Encrypt backups, store them outside the host, and test restoration on a separate deployment.

## Restore

1. Stop API and worker traffic.
2. Provision the same or newer compatible PostgreSQL/AGE version.
3. Restore the database with `pg_restore`.
4. Restore application data volumes.
5. Start the API and verify health and schema access before starting the dashboard.
6. Run an authenticated read smoke test against projects, findings, and history.

## Upgrade and rollback

Before upgrading:

- create a database and volume backup
- record the currently deployed image/commit
- build and run CI gates for the target commit
- review configuration changes

If smoke tests fail, restore the prior image/commit. If the release changed stored data incompatibly, restore the matching backup. Never roll application code backward across an incompatible data migration without restoring its database state.

## Production smoke checks

```text
GET  /health
GET  /api/v1/setup/status
POST /api/v1/auth/login
GET  /api/v1/auth/me
GET  /api/v1/projects
POST /api/v1/auth/ws-ticket
```

Then register or select a project, start analysis, confirm project-scoped status/history, and observe the matching WebSocket event.

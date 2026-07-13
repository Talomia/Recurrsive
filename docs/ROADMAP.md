# Roadmap

## Production baseline

The current production baseline is a self-hosted, single-deployment platform with project-scoped analysis data, durable local accounts, role-based access, auditable configuration, PostgreSQL/AGE storage, encrypted secrets, generated API inventory, and container deployment support.

Completed hardening includes:

- default-deny HTTP authentication and least-privilege mutation rules
- HttpOnly dashboard sessions and one-use WebSocket tickets
- explicit project identity throughout analysis, batch, history, findings, and realtime events
- persisted per-project results and finding lifecycle state
- production startup validation for database, CORS, JWT, and encryption secrets
- non-root containers, health checks, CI, dependency audit, CodeQL, and Dependabot
- removal of synthetic simulation, pull-request generation, what-if scoring, and non-isolated tenant management
- truthful self-hosted website, pricing, and deployment documentation

## Next product work

Future capabilities must meet the same evidence standard before being exposed:

- cancellation and resumable execution for long analysis jobs
- horizontal worker coordination if analysis concurrency is introduced
- real source-control pull-request integration with explicit repository authorization
- real load-test or failure-injection adapters with captured execution evidence
- organization isolation only after tenant identity is enforced in every storage key and query
- managed hosting only after an operated control plane, support model, backups, monitoring, and isolation are live

No roadmap item should appear as an available product feature before its execution path, persistence, authorization, tests, and operational runbook exist.

# Changelog

## Unreleased

### Production hardening

- Made authentication default-deny and enforced role checks on administrative routes.
- Moved dashboard sessions to HttpOnly cookies through the server-side API proxy and added one-use WebSocket tickets.
- Required strong production JWT, encryption, database, AGE, and CORS configuration.
- Added durable SQLite development storage and PostgreSQL-backed production persistence.
- Serialized analysis per project and scoped caches, findings, history, comparisons, analytics, and opportunities to the selected project.
- Added persistent contact submissions, invite-token hashing, password validation, non-root containers, CI, CodeQL, Dependabot, and deployment documentation.
- Generated the OpenAPI inventory from registered runtime routes.

### Trust and product scope

- Persisted actual health scores in analysis history and based forecasting on recorded points with explicit insufficient-data behavior and regression intervals.
- Unified finding-based health calculations across server, CLI, and MCP.
- Removed fabricated dashboard metrics, silent empty-success API fallbacks, and ungrounded opportunity effort/risk estimates.
- Removed synthetic simulation and pull-request generation, arbitrary what-if scoring, non-isolated tenant management, false prediction calibration, runtime plugin installers, intelligence-pack installers, marketplace, and unimplemented partner-program surfaces.
- Reframed public documentation and product pages around the shipped self-hosted system.

The authoritative shipped route inventory is available from a running server at `/api/v1/openapi.json`.

# Product Requirements

## Purpose

Recurrsive helps a team turn repository evidence into prioritized, reviewable engineering work without presenting unsupported estimates as facts.

## Primary users

- engineers investigating code quality, security, reliability, architecture, data, AI, cost, performance, testing, and documentation
- technical leads reviewing findings across registered projects
- administrators operating a self-hosted deployment and its integrations

## Required workflow

1. An administrator completes one-time setup.
2. Authenticated users register projects.
3. An analyst starts an analysis for a specific project ID.
4. The platform collects and parses repository evidence.
5. Deterministic analyzers emit findings with severity and source locations.
6. Supported findings are promoted into opportunities that retain their evidence.
7. Users review, filter, update, export, schedule, or integrate results.
8. History and realtime events remain scoped to the project.

## Functional requirements

### Analysis

- accept local repositories for trusted local workflows and approved remote Git URLs for server workflows
- reject remote URLs with embedded credentials or hosts outside the configured allowlist
- serialize jobs until state is safe for concurrency
- persist status, results, history, health score, findings, and opportunities
- distinguish test/fixture evidence from production source where analyzer rules require it

### Findings and opportunities

- every finding must include an analyzer source, severity, description, and evidence location where available
- opportunity impact language must stay bounded to evidence from its source findings
- lifecycle changes must persist across restarts
- empty results must remain empty; clients must not replace errors with convincing placeholder data

### Identity and security

- require authentication unless a route is explicitly public
- enforce viewer, analyst, and admin permissions consistently
- keep dashboard tokens out of browser JavaScript
- use short-lived one-use tickets for WebSockets
- encrypt stored secret values
- reject weak or placeholder production secrets
- audit security-sensitive actions

### Operations

- expose liveness/readiness health checks
- run containers as non-root users
- require PostgreSQL/AGE in production
- document backup, restore, upgrade, and rollback
- run lint, typecheck, tests, builds, dependency audit, container builds, and static security analysis in CI

### Interfaces

- dashboard and website must show API failures rather than false empty success states
- CLI commands must call endpoints that exist in the generated route inventory
- MCP tools must map to live API endpoints
- API documentation must be generated from registered routes

## Non-goals for the current production release

- managed hosting operated by the project
- multiple customer tenants inside one deployment
- automatic code changes or GitHub pull-request creation
- load testing, chaos execution, traffic replay, or Monte Carlo simulation
- guaranteed health-score outcomes from hypothetical work

These are excluded until real integrations, authorization, durable execution state, observability, recovery, and operator runbooks exist.

## Acceptance criteria

- a fresh production deployment refuses unsafe configuration
- setup, login, invitation acceptance, logout, and session hydration work through the dashboard proxy
- direct JWT and API-key clients can use protected routes
- an analysis can be started for a registered project and its results survive restart
- one project's results never appear under another project ID
- viewers cannot mutate; analysts cannot perform administrator mutations
- removed synthetic and non-isolated endpoints return 404 and are absent from OpenAPI
- build, test, lint, typecheck, audit, and container gates pass
- EasyPanel deployment completes and health, setup/login, project, analysis, and realtime smoke tests pass

# Recurrsive CLI

The `recurrsive` command runs local analysis and operates a self-hosted Recurrsive server. It covers configuration, projects, findings, opportunities, graph queries, health, recorded timeline, reports, policies, webhooks, notifications, audit, batches, snapshots, exports, comparisons, secrets, and history-based health projection.

```bash
pnpm --filter @recurrsive/cli build
pnpm --filter @recurrsive/cli test
pnpm --filter @recurrsive/cli start -- --help
```

Server login stores the CLI bearer token in the user configuration file with restrictive permissions. The browser dashboard uses a separate HttpOnly-cookie session flow.

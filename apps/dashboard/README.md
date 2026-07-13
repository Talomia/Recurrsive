# Recurrsive Dashboard

The authenticated Next.js dashboard for a self-hosted Recurrsive deployment.

It provides project-scoped findings, opportunities, graph exploration, recorded health history, transparent linear projections, reports, policies, audit data, scheduling, notifications, administration, and live analysis progress. Browser sessions use an HttpOnly cookie through the dashboard API proxy; bearer tokens are not stored in browser JavaScript.

```bash
pnpm --filter @recurrsive/dashboard dev
pnpm --filter @recurrsive/dashboard test
pnpm --filter @recurrsive/dashboard build
```

The development server listens on port 3100. Configure `INTERNAL_API_URL` for the server-side API destination and `NEXT_PUBLIC_WS_URL` for WebSocket runtime discovery.

See the repository [deployment guide](../../docs/DEPLOYMENT.md) for production configuration.

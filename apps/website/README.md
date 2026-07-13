# Recurrsive Website

The public Next.js site documents the shipped self-hosted product, deployment workflow, API/CLI entry points, security boundary, pricing, and release history. The contact form forwards validated submissions to the server and does not expose server credentials to the browser.

```bash
pnpm --filter @recurrsive/website dev
pnpm --filter @recurrsive/website test
pnpm --filter @recurrsive/website build
```

The development server listens on port 3200. Configure `INTERNAL_API_URL` for server-side contact submission forwarding.

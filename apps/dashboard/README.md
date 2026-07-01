# Recurrsive Dashboard

**Engineering Intelligence Dashboard** — 40 pages, dark theme with glassmorphism design, built on Next.js App Router with real-time WebSocket updates.

## Overview

The Recurrsive Dashboard is the visual interface for the Engineering Intelligence Platform. It provides real-time visibility into project health, analysis results, improvement opportunities, and system intelligence — all in a modern dark-themed UI with glassmorphism design elements.

### Key Features

| Feature | Description |
|---------|-------------|
| 📊 **Analytics** | Health scores, trend charts, maturity radar, and comparative dashboards |
| 🔍 **Analysis Explorer** | Browse findings, filter by severity, drill into evidence |
| 💡 **Opportunities** | Prioritized improvements with impact estimates and action plans |
| 🗺️ **System Map** | Interactive knowledge graph visualization |
| 🧠 **Intelligence** | AI-powered insights, forecasting, and what-if analysis |
| ⚙️ **Settings** | Project configuration, notification preferences, API keys |
| 🔔 **Notifications** | Real-time alerts for analysis events and policy violations |
| 🛡️ **Policies** | Governance rule management and compliance tracking |
| 📋 **Batch Analysis** | Multi-project batch runs with progress tracking |
| 🧪 **Experiments** | Engineering experiment management and A/B test tracking |

### Tech Stack

- **Next.js 15** with App Router
- **React 19** with Server Components
- **TypeScript 5.7+**
- **Tailwind CSS** with custom dark theme and glassmorphism utilities
- **Real-time WebSocket** for live analysis progress and updates
- **Recharts** for data visualization

## Getting Started

```bash
# From the monorepo root
pnpm install
pnpm build

# Start the dashboard in development mode
pnpm --filter @recurrsive/dashboard dev
```

Open [http://localhost:3001](http://localhost:3001) to view the dashboard.

## Pages (40)

The dashboard includes 40 pages organized across these sections:

- **Dashboard** — Overview, health summary, recent activity
- **Analysis** — Run history, findings, detail views
- **Opportunities** — Prioritized list, detail, roadmap view
- **System Map** — Knowledge graph explorer, entity detail
- **Intelligence** — Insights, forecasting, evolution, what-if
- **Analytics** — Trends, comparisons, benchmarks
- **Batch** — Multi-project analysis runs, status, detail
- **Experiments** — Experiment list, detail, results
- **Policies** — Policy list, detail, compliance
- **Notifications** — Channels, history, detail
- **Settings** — General, appearance, API keys, integrations
- **Reports** — Generated reports, scheduling, export

## Design System

- **Dark theme** with CSS custom properties for consistent theming
- **Glassmorphism** — Frosted glass cards with `backdrop-filter: blur()` and subtle borders
- **Consistent spacing** using Tailwind's spacing scale
- **Accessible** — WCAG 2.1 AA contrast ratios maintained in dark mode

## License

[Apache-2.0](../../LICENSE)

# Recurrsive Website

**Marketing & Documentation Website** — 23 pages built on Next.js App Router with SEO optimization, covering product, docs, pricing, cloud, marketplace, and partner programs.

## Overview

The Recurrsive Website is the public-facing marketing and documentation site for the Engineering Intelligence Platform. It provides product information, getting-started guides, API references, pricing, cloud management, and partner program details — all with full SEO support including dynamic sitemap and robots configuration.

### Key Features

| Feature | Description |
|---------|-------------|
| 🏠 **Product** | Landing page, product overview, and about |
| 📖 **Documentation** | Getting started, architecture, CLI reference, API reference, plugin SDK, deployment |
| 💰 **Pricing** | Plan comparison and feature breakdown |
| ☁️ **Cloud** | Cloud overview, dashboard, and billing management |
| 🏪 **Marketplace** | Plugin marketplace and submission flow |
| 🤝 **Partners** | Partner directory, certification, and application |
| 📝 **Blog & Changelog** | Product updates and release notes |
| 📬 **Contact** | Contact form and support information |
| 🔍 **SEO** | Dynamic sitemap, robots.ts, OpenGraph metadata, and structured keywords |

### Tech Stack

- **Next.js 16** with App Router
- **React 19** with Server Components
- **TypeScript 5+**
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **clsx** for conditional class names

## Getting Started

```bash
# From the monorepo root
pnpm install
pnpm build

# Start the website in development mode
pnpm --filter @recurrsive/website dev
```

Open [http://localhost:3200](http://localhost:3200) to view the website.

## Pages (23)

The website includes 23 pages organized across these sections:

- **Home** — Landing page
- **Product** — Product overview, about
- **Docs** — Getting started, architecture, CLI reference, API reference, plugin SDK, deployment
- **Pricing** — Plan comparison
- **Cloud** — Overview, dashboard, billing
- **Marketplace** — Browse plugins, submit a plugin
- **Partners** — Directory, certification, apply
- **Blog** — Product updates
- **Changelog** — Release notes
- **Contact** — Support and inquiries

## Scripts

| Script | Description |
|--------|-------------|
| `dev` | Start Next.js dev server on port 3200 |
| `build` | Production build with `next build` |
| `start` | Start production server on port 3200 |
| `lint` | Lint source with ESLint |
| `test` | Run tests with Vitest |

## License

[Apache-2.0](../../LICENSE)

# @recurrsive/presentation

Reports, notifications, and terminal formatting for the Recurrsive platform.

## Installation

```bash
pnpm add @recurrsive/presentation
```

## Reports

| Format | Description |
|--------|-------------|
| Markdown | Health score, severity tables, maturity assessment |
| HTML | Self-contained dark theme with SVG health gauge |
| JSON | Machine-readable structured report |
| SARIF | SARIF v2.1.0 for CI/CD integration |

## Notifications

| Channel | Description |
|---------|-------------|
| Console | ANSI colors with severity icons (✘, ⚠, ●, ✔, ⓘ) |
| Webhook | Configurable URL/headers with retry + exponential backoff |
| Slack | Incoming webhook integration with rich formatting |
| HTTP | POST to any custom endpoint |

## Terminal Formatter

| Function | Description |
|----------|-------------|
| `formatTable()` | Aligned columns with box-drawing characters |
| `formatProgressBar()` | Percentage bar with color thresholds |
| `formatHealthScore()` | Health score with status labels |
| `formatOpportunities()` | Opportunity table with truncation |

## Development

```bash
# Run tests
pnpm test --filter @recurrsive/presentation

# Build
pnpm build --filter @recurrsive/presentation

# Lint
pnpm lint --filter @recurrsive/presentation
```

## License

[Apache-2.0](../../LICENSE)

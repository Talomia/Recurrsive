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

## Notifications

| Channel | Description |
|---------|-------------|
| Console | ANSI colors with severity icons (✘, ⚠, ●, ✔, ⓘ) |
| Webhook | Configurable URL/headers with retry + exponential backoff |

## Terminal Formatter

| Function | Description |
|----------|-------------|
| `formatTable()` | Aligned columns with box-drawing characters |
| `formatProgressBar()` | Percentage bar with color thresholds |
| `formatHealthScore()` | Health score with status labels |
| `formatOpportunities()` | Opportunity table with truncation |

## License

[Apache-2.0](../../LICENSE)

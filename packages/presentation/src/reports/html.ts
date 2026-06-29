/**
 * @module @recurrsive/presentation/reports/html
 *
 * Self-contained HTML report generator with embedded CSS.
 * Dark theme, modern design, SVG gauges and charts — no external deps.
 *
 * @packageDocumentation
 */

import type { Opportunity, Severity, MaturityScore } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Report options
// ---------------------------------------------------------------------------

/** Configuration options for HTML report generation. */
export interface HtmlReportOptions {
  /** Report title. */
  title?: string;
  /** Overall health score (0–100). */
  healthScore?: number;
  /** Maturity scores per dimension. */
  maturityScores?: MaturityScore[];
  /** Maximum number of detailed opportunity cards. */
  maxCards?: number;
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: '#ef4444',
  high: '#f97316',
  medium: '#eab308',
  low: '#22c55e',
  info: '#3b82f6',
};

const SEVERITY_ORDER: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

/**
 * Escape HTML special characters.
 *
 * @param str - Raw string
 * @returns HTML-safe string
 */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---------------------------------------------------------------------------
// SVG generators
// ---------------------------------------------------------------------------

/**
 * Generate a circular health-score gauge as inline SVG.
 *
 * @param score - Health score 0–100
 * @returns SVG string
 */
function healthGaugeSvg(score: number): string {
  const radius = 80;
  const stroke = 12;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';

  return `
    <svg width="200" height="200" viewBox="0 0 200 200">
      <circle cx="100" cy="100" r="${radius}" fill="none" stroke="var(--surface-2)" stroke-width="${stroke}" />
      <circle cx="100" cy="100" r="${radius}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${circumference - progress}"
        stroke-linecap="round" transform="rotate(-90 100 100)" />
      <text x="100" y="92" text-anchor="middle" fill="var(--text-primary)" font-size="36" font-weight="bold">${score}</text>
      <text x="100" y="115" text-anchor="middle" fill="var(--text-secondary)" font-size="14">/ 100</text>
    </svg>`;
}

/**
 * Generate a horizontal bar chart for category breakdown as inline SVG.
 *
 * @param categories - Array of [category, count] pairs
 * @param maxCount - Maximum count for bar scaling
 * @returns SVG string
 */
function categoryBarChartSvg(
  categories: Array<[string, number]>,
  maxCount: number,
): string {
  const barHeight = 28;
  const gap = 6;
  const labelWidth = 160;
  const chartWidth = 400;
  const totalHeight = categories.length * (barHeight + gap) + 10;
  const maxBarWidth = chartWidth - labelWidth - 60;

  const bars = categories
    .map(([cat, count], i) => {
      const y = i * (barHeight + gap) + 5;
      const barW = maxCount > 0 ? (count / maxCount) * maxBarWidth : 0;
      return `
        <text x="${labelWidth - 8}" y="${y + barHeight / 2 + 5}" text-anchor="end" fill="var(--text-secondary)" font-size="13">${esc(cat)}</text>
        <rect x="${labelWidth}" y="${y}" width="${barW}" height="${barHeight}" rx="4" fill="var(--accent)" opacity="0.85" />
        <text x="${labelWidth + barW + 8}" y="${y + barHeight / 2 + 5}" fill="var(--text-primary)" font-size="13">${count}</text>`;
    })
    .join('');

  return `<svg width="${chartWidth}" height="${totalHeight}" viewBox="0 0 ${chartWidth} ${totalHeight}">${bars}</svg>`;
}

// ---------------------------------------------------------------------------
// CSS
// ---------------------------------------------------------------------------

const CSS = `
:root {
  --bg: #0f172a;
  --surface-1: #1e293b;
  --surface-2: #334155;
  --text-primary: #f1f5f9;
  --text-secondary: #94a3b8;
  --accent: #6366f1;
  --accent-dim: #4f46e5;
  --border: #475569;
  --critical: #ef4444;
  --high: #f97316;
  --medium: #eab308;
  --low: #22c55e;
  --info: #3b82f6;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text-primary); line-height: 1.6; padding: 2rem; }
.container { max-width: 1200px; margin: 0 auto; }
h1 { font-size: 2rem; margin-bottom: 0.5rem; }
h2 { font-size: 1.4rem; color: var(--accent); margin: 2rem 0 1rem; border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
h3 { font-size: 1.1rem; margin-bottom: 0.5rem; }
.subtitle { color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 2rem; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
.card { background: var(--surface-1); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; }
.badge-critical { background: var(--critical); color: #fff; }
.badge-high { background: var(--high); color: #000; }
.badge-medium { background: var(--medium); color: #000; }
.badge-low { background: var(--low); color: #000; }
.badge-info { background: var(--info); color: #fff; }
.stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
.stat { background: var(--surface-1); border-radius: 8px; padding: 1rem; text-align: center; }
.stat-value { font-size: 2rem; font-weight: bold; }
.stat-label { color: var(--text-secondary); font-size: 0.85rem; }
.health-section { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
table { width: 100%; border-collapse: collapse; margin-bottom: 1rem; }
th, td { padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid var(--surface-2); }
th { color: var(--text-secondary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.05em; }
.problem { color: var(--text-secondary); font-size: 0.9rem; margin: 0.5rem 0; }
.rec { background: var(--surface-2); padding: 0.75rem; border-radius: 6px; font-size: 0.9rem; margin: 0.5rem 0; }
.meta { display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.8rem; color: var(--text-secondary); margin-top: 0.75rem; }
.meta span { background: var(--surface-2); padding: 2px 8px; border-radius: 4px; }
@media (max-width: 768px) { body { padding: 1rem; } .health-section { flex-direction: column; } }
`;

// ---------------------------------------------------------------------------
// HTML builder
// ---------------------------------------------------------------------------

/**
 * Generate a self-contained HTML report with embedded CSS.
 *
 * Features:
 * - Dark theme with CSS variables for theming
 * - SVG circular gauge for health score
 * - Opportunity cards with severity badges
 * - SVG horizontal bar chart for category breakdown
 * - Responsive layout, no external dependencies
 *
 * @param opportunities - Array of opportunities
 * @param options - Report configuration
 * @returns A complete, self-contained HTML string
 */
export function generateHtmlReport(
  opportunities: readonly Opportunity[],
  options: HtmlReportOptions = {},
): string {
  const {
    title = 'Recurrsive Analysis Report',
    healthScore,
    maturityScores,
    maxCards = 20,
  } = options;

  // Compute severity counts
  const sevCounts: Record<Severity, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  };
  for (const o of opportunities) {
    sevCounts[o.severity]++;
  }

  // Category counts
  const catCounts: Record<string, number> = {};
  for (const o of opportunities) {
    catCounts[o.category] = (catCounts[o.category] ?? 0) + 1;
  }
  const sortedCats = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);
  const maxCatCount = sortedCats.length > 0 ? sortedCats[0]![1] : 0;

  // Sort opportunities by severity then confidence
  const sorted = [...opportunities].sort((a, b) => {
    const sd = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (sd !== 0) return sd;
    return b.confidence - a.confidence;
  });

  const cards = sorted.slice(0, maxCards);

  // Build HTML
  const parts: string[] = [];

  parts.push(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="container">`);

  // Header
  parts.push(`<h1>${esc(title)}</h1>`);
  parts.push(`<p class="subtitle">Generated: ${new Date().toISOString()}</p>`);

  // Stats grid
  parts.push('<div class="stat-grid">');
  parts.push(`<div class="stat"><div class="stat-value">${opportunities.length}</div><div class="stat-label">Total Findings</div></div>`);
  for (const sev of SEVERITY_ORDER) {
    if (sevCounts[sev] > 0) {
      parts.push(`<div class="stat"><div class="stat-value" style="color:${SEVERITY_COLOR[sev]}">${sevCounts[sev]}</div><div class="stat-label">${sev}</div></div>`);
    }
  }
  parts.push('</div>');

  // Health score section
  if (healthScore !== undefined) {
    parts.push('<h2>Health Score</h2>');
    parts.push('<div class="health-section">');
    parts.push(`<div>${healthGaugeSvg(healthScore)}</div>`);
    parts.push('<div>');
    const label = healthScore >= 75 ? 'Good' : healthScore >= 50 ? 'Fair' : 'Needs Attention';
    parts.push(`<h3 style="font-size:1.3rem">${label}</h3>`);
    parts.push(`<p style="color:var(--text-secondary)">Your project health score is <strong>${healthScore}/100</strong>.</p>`);
    parts.push('</div></div>');
  }

  // Category breakdown chart
  if (sortedCats.length > 0) {
    parts.push('<h2>Category Breakdown</h2>');
    parts.push('<div class="card">');
    parts.push(categoryBarChartSvg(sortedCats, maxCatCount));
    parts.push('</div>');
  }

  // Maturity scores table
  if (maturityScores && maturityScores.length > 0) {
    parts.push('<h2>Maturity Assessment</h2>');
    parts.push('<table><thead><tr><th>Dimension</th><th>Level</th><th>Score</th><th>Trend</th></tr></thead><tbody>');
    for (const ms of maturityScores) {
      const trendIcon = ms.trend === 'improving' ? '📈' : ms.trend === 'declining' ? '📉' : '➡️';
      parts.push(`<tr><td>${esc(ms.dimension)}</td><td>${esc(ms.level)}</td><td>${ms.score}/100</td><td>${trendIcon} ${esc(ms.trend)}</td></tr>`);
    }
    parts.push('</tbody></table>');
  }

  // Opportunity cards
  if (cards.length > 0) {
    parts.push('<h2>Opportunities</h2>');
    parts.push('<div class="grid">');

    for (const opp of cards) {
      const badgeClass = `badge-${opp.severity}`;
      parts.push('<div class="card">');
      parts.push('<div class="card-header">');
      parts.push(`<h3>${esc(opp.title)}</h3>`);
      parts.push(`<span class="badge ${badgeClass}">${esc(opp.severity)}</span>`);
      parts.push('</div>');
      parts.push(`<p class="problem">${esc(opp.problem.slice(0, 200))}${opp.problem.length > 200 ? '…' : ''}</p>`);
      parts.push(`<div class="rec"><strong>Recommendation:</strong> ${esc(opp.recommendation.slice(0, 200))}${opp.recommendation.length > 200 ? '…' : ''}</div>`);
      parts.push('<div class="meta">');
      parts.push(`<span>${esc(opp.category)}</span>`);
      parts.push(`<span>${esc(opp.type)}</span>`);
      parts.push(`<span>${Math.round(opp.confidence * 100)}% confidence</span>`);
      parts.push(`<span>${opp.effort.t_shirt.toUpperCase()} effort</span>`);
      parts.push(`<span>${opp.evidence.length} evidence</span>`);
      parts.push('</div>');

      // Impact summary
      if (opp.expected_impact.summary) {
        parts.push(`<p style="margin-top:0.75rem;font-size:0.85rem;color:var(--text-secondary)"><em>Impact: ${esc(opp.expected_impact.summary.slice(0, 150))}${opp.expected_impact.summary.length > 150 ? '…' : ''}</em></p>`);
      }

      parts.push('</div>');
    }

    parts.push('</div>');
  }

  // Footer
  parts.push(`<p style="text-align:center;color:var(--text-secondary);margin-top:3rem;font-size:0.8rem">Generated by Recurrsive v0.1.0</p>`);
  parts.push('</div></body></html>');

  return parts.join('\n');
}

/**
 * @module @recurrsive/mcp/prompts/intelligence
 *
 * Intelligence-focused MCP prompt templates for Recurrsive.
 *
 * Prompts provide reusable templates that AI assistants can use to
 * guide conversations about predictive intelligence workflows:
 *
 * - `forecast_health` — Generate health forecast analysis
 * - `simulation_review` — Review simulation results and recommend actions
 * - `confidence_analysis` — Analyze prediction confidence calibration
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prompt Registration
// ---------------------------------------------------------------------------

/**
 * Register all intelligence prompt templates with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerIntelligencePrompts(server: McpServer): void {
  // ── forecast_health ─────────────────────────────────────────────────────

  server.prompt(
    'forecast_health',
    'Generate a health forecast analysis predicting future health scores ' +
    'based on current trends, open opportunities, and resolution velocity.',
    {
      horizon: z
        .enum(['week', 'month', 'quarter'])
        .describe('The forecast horizon: week, month, or quarter.'),
    },
    async ({ horizon }) => {
      const horizonLabels: Record<string, string> = {
        week: 'one week',
        month: 'one month',
        quarter: 'one quarter (3 months)',
      };

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please generate a health forecast for the next **${horizonLabels[horizon]}**.`,
                ``,
                `## 1. Current Baseline`,
                `Summarize the current health score and key dimension scores.`,
                `Identify the primary drivers of the current score.`,
                ``,
                `## 2. Trend Extrapolation`,
                `Based on the historical trend data:`,
                `- Project the health score trajectory`,
                `- Identify dimensions likely to improve or degrade`,
                `- Estimate opportunity resolution velocity`,
                ``,
                `## 3. Risk Factors`,
                `Identify factors that could negatively impact the forecast:`,
                `- Unresolved critical opportunities`,
                `- Increasing technical debt trends`,
                `- External dependency risks`,
                ``,
                `## 4. Forecast Summary`,
                `Provide a predicted health score range (optimistic/expected/pessimistic).`,
                `List the top 3 actions to improve the forecast outcome.`,
                ``,
                `Use the \`get_health_score\` and \`get_opportunities\` tools to `,
                `gather baseline data for this forecast.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── simulation_review ───────────────────────────────────────────────────

  server.prompt(
    'simulation_review',
    'Review simulation results from what-if scenarios and recommend ' +
    'concrete actions based on predicted outcomes.',
    {},
    async () => {
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please review the latest simulation results and provide recommendations.`,
                ``,
                `## 1. Scenario Summary`,
                `List each simulated scenario with its parameters and predicted outcome.`,
                ``,
                `## 2. Outcome Comparison`,
                `Compare predicted outcomes across scenarios:`,
                `- Health score impact for each scenario`,
                `- Resource cost vs. benefit analysis`,
                `- Time-to-effect estimates`,
                ``,
                `## 3. Recommended Actions`,
                `Based on the simulation results, recommend:`,
                `- Which scenario to pursue and why`,
                `- Implementation priority order`,
                `- Key risks and mitigation strategies`,
                ``,
                `Use the \`list_experiments\` tool to retrieve simulation data.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── confidence_analysis ─────────────────────────────────────────────────

  server.prompt(
    'confidence_analysis',
    'Analyze prediction confidence calibration to evaluate how well ' +
    'past predictions matched actual outcomes.',
    {
      lookback: z
        .string()
        .describe('Number of past predictions to analyze (e.g., "10" or "20").'),
    },
    async ({ lookback }) => {
      const count = parseInt(lookback, 10) || 10;

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please analyze confidence calibration for the last **${count} predictions**.`,
                ``,
                `## 1. Calibration Overview`,
                `For each past prediction, compare the predicted confidence level `,
                `against the actual outcome accuracy.`,
                ``,
                `## 2. Accuracy Metrics`,
                `Calculate key calibration metrics:`,
                `- Mean absolute error of confidence scores`,
                `- Overconfidence vs. underconfidence ratio`,
                `- Brier score for prediction quality`,
                ``,
                `## 3. Calibration Recommendations`,
                `Suggest adjustments to improve future prediction accuracy:`,
                `- Categories where confidence is systematically biased`,
                `- Recommended confidence thresholds for decision-making`,
                ``,
                `Use the \`get_opportunities\` and \`compare_analyses\` tools `,
                `to gather historical prediction data.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}

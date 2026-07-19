/**
 * @module @recurrsive/analyzers/ai
 *
 * AI-specific analyzer that inspects the knowledge graph for common
 * issues in AI/LLM integrations: hardcoded models, missing error
 * handling, prompt injection risks, missing output validation, and
 * more.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

/** File-name fragments identifying configuration files (never flagged as hardcoded). */
const CONFIG_FILE_FRAGMENTS = ['.config.', '.env', 'config/', '/config'];

/**
 * Whether an entity's source file looks like configuration — hardcoded
 * model/temperature values in config files are configuration, not a smell.
 */
function isConfigFile(file: string | undefined): boolean {
  if (!file) return false;
  const lower = file.toLowerCase();
  return CONFIG_FILE_FRAGMENTS.some((frag) => lower.includes(frag));
}

/**
 * Analyzes AI/LLM integration patterns for quality and resilience
 * issues.
 *
 * ### Rules
 * 1. Hardcoded model names
 * 2. Missing error handling on LLM calls
 * 3. No fallback provider
 * 4. Prompt injection risk
 * 5. Missing output validation
 * 6. Agent loop risk
 * 7. Token waste in prompts
 * 8. Missing evaluations
 * 9. Hardcoded temperature
 * 10. Missing system prompt
 */
export class AIAnalyzer implements Analyzer {
  readonly id = 'ai.quality';
  readonly name = 'AI Quality Analyzer';
  readonly description =
    'Detects AI/LLM integration issues such as hardcoded models, missing error handling, and prompt injection risks.';
  readonly version = '0.1.0';
  readonly categories = ['ai_quality' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      hardcodedModels,
      missingErrorHandling,
      noFallback,
      promptInjection,
      missingValidation,
      agentLoop,
      tokenWaste,
      missingEvals,
      hardcodedTemp,
      missingSystemPrompt,
    ] = await Promise.all([
      this.detectHardcodedModels(ctx),
      this.detectMissingErrorHandling(ctx),
      this.detectNoFallbackProvider(ctx),
      this.detectPromptInjectionRisk(ctx),
      this.detectMissingOutputValidation(ctx),
      this.detectAgentLoopRisk(ctx),
      this.detectTokenWaste(ctx),
      this.detectMissingEvaluations(ctx),
      this.detectHardcodedTemperature(ctx),
      this.detectMissingSystemPrompt(ctx),
    ]);

    findings.push(
      ...hardcodedModels,
      ...missingErrorHandling,
      ...noFallback,
      ...promptInjection,
      ...missingValidation,
      ...agentLoop,
      ...tokenWaste,
      ...missingEvals,
      ...hardcodedTemp,
      ...missingSystemPrompt,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // ── Cross-cutting: AI usage without evaluations ──────────────
    const [prompts, agents, models, evaluations, functions] = await Promise.all([
      ctx.graph.getEntities('prompt'),
      ctx.graph.getEntities('agent'),
      ctx.graph.getEntities('model'),
      ctx.graph.getEntities('evaluation'),
      ctx.graph.getEntities('function'),
    ]);

    const totalAiEntities = prompts.length + agents.length + models.length;

    if (totalAiEntities > 0 && evaluations.length === 0) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'AI usage detected with no evaluation pipeline',
          description: `Project uses ${totalAiEntities} AI entities (${models.length} models, ${prompts.length} prompts, ${agents.length} agents) but has zero evaluation entities. Without evaluations, there is no systematic way to measure quality, catch regressions, or validate prompt changes before deployment.`,
          severity: 'high',
          category: 'ai_quality',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${totalAiEntities} AI entities with 0 evaluations`,
              entity_ids: [
                ...models.map((m) => m.id),
                ...agents.map((a) => a.id),
                ...prompts.slice(0, 10).map((p) => p.id),
              ],
              confidence: 0.9,
              data: {
                model_count: models.length,
                prompt_count: prompts.length,
                agent_count: agents.length,
                evaluation_count: 0,
              },
            }),
          ],
          locations: [],
          suggested_fix:
            'Create evaluation datasets and automated eval pipelines using frameworks like promptfoo, deepeval, or custom harnesses. Add evals for each prompt and agent before deploying to production.',
          confidence: 0.85,
          tags: ['missing-evaluation', 'ai', 'cross-cutting', 'quality-assurance'],
        }),
      );
    }

    // ── Cross-cutting: AI-to-function modularity ratio ───────────
    const aiEntityCount = prompts.length + agents.length;
    if (aiEntityCount > 5 && functions.length > 0) {
      const ratio = aiEntityCount / functions.length;
      if (ratio > 0.5) {
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: 'Low function modularity relative to AI complexity',
            description: `Project has ${aiEntityCount} AI entities (${prompts.length} prompts, ${agents.length} agents) but only ${functions.length} functions (ratio: ${ratio.toFixed(2)}). High AI entity count with few functions suggests AI logic is concentrated in monolithic blocks instead of being decomposed into reusable, testable functions.`,
            severity: 'medium',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `AI-to-function ratio of ${ratio.toFixed(2)} exceeds 0.5 threshold`,
                entity_ids: [
                  ...agents.map((a) => a.id),
                  ...prompts.slice(0, 5).map((p) => p.id),
                ],
                confidence: 0.75,
                data: {
                  ai_entity_count: aiEntityCount,
                  function_count: functions.length,
                  ratio: ratio,
                },
              }),
            ],
            locations: [],
            suggested_fix:
              'Extract AI orchestration logic into smaller, focused functions. Each prompt/agent interaction should be wrapped in a dedicated function for testability, reuse, and independent error handling.',
            confidence: 0.7,
            tags: ['modularity', 'ai', 'cross-cutting', 'architecture'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 1: Hardcoded Models ───────────────────────────────────────

  /**
   * Detect hardcoded model name strings in source code instead of
   * config references.
   *
   * Reads the `model` entities the AI-pattern detector emits for
   * `model: 'gpt-…'`-style matches (with `hardcoded: true` and the real
   * `model_name`). The previous implementation read a file `content`
   * property that no producer sets — the git collector deliberately stores
   * no file content — so the rule was permanently dead.
   *
   * @param ctx - Analysis context.
   * @returns Findings for hardcoded model strings.
   */
  private async detectHardcodedModels(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const models = await ctx.graph.getEntities('model');

    // Group parser-detected hardcoded model configs by source file.
    const byFile = new Map<string, typeof models>();
    for (const model of models) {
      if (model.properties['hardcoded'] !== true) continue;
      const file = model.source_location?.file;
      if (isConfigFile(file)) continue;
      const key = file ?? model.qualified_name;
      const list = byFile.get(key) ?? [];
      list.push(model);
      byFile.set(key, list);
    }

    for (const [file, fileModels] of byFile) {
      const names = fileModels.map(
        (m) => (m.properties['model_name'] as string | undefined) ?? m.name,
      );
      const loc = locationFromEntity(fileModels[0]!);
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: `Hardcoded model name in ${file}`,
          description: `File '${file}' contains hardcoded model names: ${names.join(', ')}. Model names should come from configuration to enable easy switching and A/B testing.`,
          severity: 'medium',
          category: 'ai_quality',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `Found hardcoded model strings: ${names.join(', ')}`,
              entity_ids: fileModels.map((m) => m.id),
              confidence: 0.9,
              data: { matched_models: names },
            }),
          ],
          locations: loc ? [loc] : [],
          suggested_fix:
            'Move model names to environment variables or a configuration file. Use a model registry pattern for centralized management.',
          confidence: 0.85,
          tags: ['hardcoded-model', 'ai', 'configuration'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 2: Missing Error Handling ─────────────────────────────────

  /**
   * Detect LLM/AI service calls without proper error handling
   * (try/catch, timeout, or retry logic).
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing error handling.
   */
  private async detectMissingErrorHandling(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const callsModel = outRels.some(
        (r) => r.type === 'uses_model' || r.type === 'invokes_agent',
      );

      if (!callsModel) continue;

      const hasErrorHandling =
        fn.properties['has_try_catch'] === true ||
        fn.properties['has_error_handler'] === true ||
        fn.tags.includes('error-handled');
      const hasRetry =
        fn.properties['has_retry'] === true || fn.tags.includes('retry');
      const hasTimeout =
        fn.properties['has_timeout'] === true || fn.tags.includes('timeout');

      if (!hasErrorHandling) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `LLM call without error handling: ${fn.name}`,
            description: `Function '${fn.name}' makes LLM/AI calls without try/catch error handling. LLM APIs can fail due to rate limits, timeouts, or content policy violations.`,
            severity: 'high',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `LLM call without error handling${!hasRetry ? ', no retry' : ''}${!hasTimeout ? ', no timeout' : ''}`,
                entity_ids: [fn.id],
                confidence: 0.85,
                data: {
                  has_error_handling: hasErrorHandling,
                  has_retry: hasRetry,
                  has_timeout: hasTimeout,
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Wrap LLM calls in try/catch with specific error handling for rate limits (retry with backoff), timeouts, and content policy violations.',
            confidence: 0.8,
            tags: ['error-handling', 'ai', 'resilience'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: No Fallback Provider ───────────────────────────────────

  /**
   * Detect single AI provider usage without failover configuration.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing fallback providers.
   */
  private async detectNoFallbackProvider(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const models = await ctx.graph.getEntities('model');

    if (models.length === 0) return findings;

    // Group models by provider
    const providers = new Set<string>();
    for (const model of models) {
      const provider = (model.properties['provider'] as string | undefined) ??
        model.tags.find((t) =>
          ['openai', 'anthropic', 'google', 'mistral', 'cohere', 'azure'].includes(t.toLowerCase()),
        );
      if (provider) providers.add(provider.toLowerCase());
    }

    if (providers.size === 1) {
      const providerName = [...providers][0]!;
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: `Single AI provider without fallback: ${providerName}`,
          description: `All AI models use a single provider (${providerName}). If this provider experiences an outage, the entire AI pipeline will be unavailable. Configure at least one fallback provider.`,
          severity: 'medium',
          category: 'ai_quality',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `Only one AI provider detected: ${providerName}`,
              entity_ids: models.map((m) => m.id),
              confidence: 0.8,
              data: { provider: providerName, model_count: models.length },
            }),
          ],
          locations: [],
          suggested_fix:
            'Add a fallback provider configuration (e.g., OpenAI → Anthropic). Use a provider abstraction layer that can automatically route to the fallback on failure.',
          confidence: 0.75,
          tags: ['fallback', 'ai', 'resilience', 'single-provider'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 4: Prompt Injection Risk ──────────────────────────────────

  /**
   * Detect prompts that incorporate raw user input without sanitization.
   *
   * @param ctx - Analysis context.
   * @returns Findings for prompt injection risks.
   */
  private async detectPromptInjectionRisk(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const prompts = await ctx.graph.getEntities('prompt');

    for (const prompt of prompts) {
      const template = (prompt.properties['template'] as string | undefined) ?? '';
      const content = (prompt.properties['content'] as string | undefined) ?? '';
      // The Langfuse collector stores prompt text under `prompt`.
      const promptText = (prompt.properties['prompt'] as string | undefined) ?? '';
      const text = template || content || promptText;

      // Check for template variables that suggest user input
      const hasUserInput =
        /\{(user_input|user_message|query|question|input)\}/i.test(text) ||
        /\$\{(user_input|userInput|query|input)\}/i.test(text) ||
        prompt.tags.includes('user-input') ||
        prompt.properties['includes_user_input'] === true;

      // Check for sanitization markers
      const hasSanitization =
        prompt.properties['sanitized'] === true ||
        prompt.tags.includes('sanitized') ||
        prompt.tags.includes('input-validated');

      if (hasUserInput && !hasSanitization) {
        const loc = locationFromEntity(prompt);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Prompt injection risk: ${prompt.name}`,
            description: `Prompt '${prompt.name}' includes user-provided input without sanitization markers. Malicious users could manipulate the LLM's behavior through crafted inputs.`,
            severity: 'high',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Prompt template includes user input without sanitization',
                entity_ids: [prompt.id],
                confidence: 0.8,
                data: { has_user_input: hasUserInput, has_sanitization: hasSanitization },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Sanitize user input before inserting into prompts. Use input validation, length limits, and content filtering. Consider using delimiters (``` or XML tags) to separate user input from instructions.',
            confidence: 0.8,
            tags: ['prompt-injection', 'ai', 'security'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 5: Missing Output Validation ──────────────────────────────

  /**
   * Detect LLM responses used directly without schema validation.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing output validation.
   */
  private async detectMissingOutputValidation(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const outRels = await ctx.graph.getRelationships(fn.id, 'out');
      const usesModel = outRels.some((r) => r.type === 'uses_model');
      if (!usesModel) continue;

      const hasValidation =
        fn.properties['validates_output'] === true ||
        // Real, parser-observed flag: the function body contains schema/
        // validation calls (zod parse/safeParse, validate*, ajv/joi/yup).
        fn.properties['has_validation_call'] === true ||
        fn.tags.includes('output-validated') ||
        fn.tags.includes('schema-validated');

      // Check if the function uses Zod, JSON schema, etc.
      const usesValidationLib =
        fn.properties['uses_zod'] === true ||
        fn.properties['uses_json_schema'] === true ||
        fn.tags.includes('zod') ||
        fn.tags.includes('structured-output');

      if (!hasValidation && !usesValidationLib) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing LLM output validation: ${fn.name}`,
            description: `Function '${fn.name}' consumes LLM output without schema validation. LLM responses are non-deterministic and may not conform to expected formats, causing downstream runtime errors.`,
            severity: 'medium',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'LLM response consumed without validation',
                entity_ids: [fn.id],
                confidence: 0.75,
                data: { has_validation: hasValidation, uses_validation_lib: usesValidationLib },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Validate LLM outputs with a schema library (e.g., Zod). Use structured output modes when available (e.g., OpenAI function calling, tool_choice).',
            confidence: 0.75,
            tags: ['output-validation', 'ai', 'schema'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 6: Agent Loop Risk ────────────────────────────────────────

  /**
   * Detect agent patterns without termination conditions or max
   * iteration limits.
   *
   * @param ctx - Analysis context.
   * @returns Findings for agent loop risks.
   */
  private async detectAgentLoopRisk(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const agents = await ctx.graph.getEntities('agent');

    for (const agent of agents) {
      const hasMaxIterations =
        agent.properties['max_iterations'] != null ||
        agent.properties['max_steps'] != null ||
        agent.tags.includes('bounded-loop');

      const hasTerminationCondition =
        agent.properties['termination_condition'] != null ||
        agent.properties['stop_condition'] != null ||
        agent.tags.includes('termination-condition');

      if (!hasMaxIterations && !hasTerminationCondition) {
        const loc = locationFromEntity(agent);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Agent loop risk: ${agent.name}`,
            // Termination configuration (max_iterations, recursion_limit,
            // stop conditions) is NOT observable to this pipeline — no parser
            // or collector extracts it — so this can only say "not
            // detectable", never assert absence. Severity is medium
            // (informational nudge), not critical: a critical that fired on
            // every detected agent would dominate the severity-weighted
            // health score with an unverifiable claim.
            description: `Agent '${agent.name}' has no detectable max-iterations limit or termination condition. Termination settings are often configured at runtime and may not be visible to static analysis — verify this agent has bounded iterations and a stop condition, since unbounded loops consume unbounded tokens and cost.`,
            severity: 'medium',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'No termination configuration detectable for agent',
                entity_ids: [agent.id],
                confidence: 0.6,
                data: {
                  has_max_iterations: hasMaxIterations,
                  has_termination_condition: hasTerminationCondition,
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Add a max_iterations limit and explicit termination conditions. Include a budget cap and monitoring for runaway agent loops.',
            confidence: 0.6,
            tags: ['agent-loop', 'ai', 'runaway', 'cost'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 7: Token Waste ────────────────────────────────────────────

  /**
   * Detect prompts with excessive static context or repeated instructions.
   *
   * @param ctx - Analysis context.
   * @returns Findings for token waste.
   */
  private async detectTokenWaste(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const prompts = await ctx.graph.getEntities('prompt');

    const TOKEN_ESTIMATE_FACTOR = 4; // ~4 chars per token
    const LARGE_PROMPT_THRESHOLD = 2000; // tokens

    for (const prompt of prompts) {
      const content =
        (prompt.properties['template'] as string | undefined) ??
        (prompt.properties['content'] as string | undefined) ??
        // The Langfuse collector stores prompt text under `prompt`.
        (prompt.properties['prompt'] as string | undefined) ??
        '';
      const estimatedTokens = Math.ceil(content.length / TOKEN_ESTIMATE_FACTOR);

      if (estimatedTokens > LARGE_PROMPT_THRESHOLD) {
        const loc = locationFromEntity(prompt);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Large static prompt: ${prompt.name}`,
            description: `Prompt '${prompt.name}' has ~${estimatedTokens} estimated tokens of static content. Large static prompts waste tokens and cost on every invocation. Consider caching, summarization, or dynamic context injection.`,
            severity: 'low',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `Estimated ${estimatedTokens} tokens in static prompt content`,
                entity_ids: [prompt.id],
                confidence: 0.7,
                data: { estimated_tokens: estimatedTokens, char_count: content.length },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Reduce prompt size by extracting static instructions into system prompts, using few-shot examples selectively, or implementing dynamic context windowing.',
            confidence: 0.7,
            tags: ['token-waste', 'ai', 'cost', 'optimization'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 8: Missing Evaluations ────────────────────────────────────

  /**
   * Detect AI workflows without evaluation/testing pipelines.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing evaluations.
   */
  private async detectMissingEvaluations(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const agents = await ctx.graph.getEntities('agent');
    const workflows = await ctx.graph.getEntities('workflow');
    const evaluations = await ctx.graph.getEntities('evaluation');

    const evaluatedEntityIds = new Set<string>();
    for (const evalEntity of evaluations) {
      const rels = await ctx.graph.getRelationships(evalEntity.id, 'out');
      for (const rel of rels) {
        if (rel.type === 'evaluates_with') {
          evaluatedEntityIds.add(rel.target_id);
        }
      }
      // Also check incoming relationships
      const inRels = await ctx.graph.getRelationships(evalEntity.id, 'in');
      for (const rel of inRels) {
        evaluatedEntityIds.add(rel.source_id);
      }
    }

    const aiEntities = [...agents, ...workflows.filter((w) => w.tags.includes('ai') || w.tags.includes('llm'))];

    for (const entity of aiEntities) {
      if (evaluatedEntityIds.has(entity.id)) continue;

      const rels = await ctx.graph.getRelationships(entity.id, 'both');
      const hasEvaluation = rels.some((r) => r.type === 'evaluates_with');

      if (!hasEvaluation) {
        const loc = locationFromEntity(entity);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing evaluation: ${entity.name}`,
            description: `AI ${entity.type} '${entity.name}' has no associated evaluation or testing pipeline. Without evaluations, you cannot measure quality, catch regressions, or validate improvements.`,
            severity: 'medium',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'No evaluation relationship found',
                entity_ids: [entity.id],
                confidence: 0.75,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Create evaluation datasets and automated eval pipelines. Use frameworks like promptfoo, deepeval, or custom evaluation harnesses to measure quality metrics.',
            confidence: 0.7,
            tags: ['missing-evaluation', 'ai', 'testing', 'quality'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 9: Hardcoded Temperature ──────────────────────────────────

  /**
   * Detect temperature values hardcoded in source code instead of
   * being configurable.
   *
   * Reads the `config` entities the AI-pattern detector emits for
   * `temperature: 0.7`-style matches (`setting: 'temperature'`). The
   * previous implementation read a file `content` property no producer
   * sets, so the rule was permanently dead.
   *
   * @param ctx - Analysis context.
   * @returns Findings for hardcoded temperature values.
   */
  private async detectHardcodedTemperature(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const configs = await ctx.graph.getEntities('config');

    for (const config of configs) {
      if (config.properties['setting'] !== 'temperature') continue;
      if (config.properties['hardcoded'] !== true) continue;
      const file = config.source_location?.file;
      if (isConfigFile(file)) continue;

      const matched = (config.properties['pattern'] as string | undefined) ??
        `temperature=${String(config.properties['value'] ?? '?')}`;
      const fileName = file ?? config.qualified_name;
      const loc = locationFromEntity(config);
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: `Hardcoded temperature in ${fileName}`,
          description: `File '${fileName}' has hardcoded temperature values: ${matched}. Temperature should be configurable per-use-case for tuning and experimentation.`,
          severity: 'low',
          category: 'ai_quality',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `Hardcoded temperature: ${matched}`,
              entity_ids: [config.id],
              confidence: 0.7,
              data: { matched_patterns: [matched] },
            }),
          ],
          locations: loc ? [loc] : [],
          suggested_fix:
            'Move temperature values to configuration. Consider per-task temperature profiles (creative tasks: 0.7–1.0, deterministic tasks: 0–0.3).',
          confidence: 0.65,
          tags: ['hardcoded-temperature', 'ai', 'configuration'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 10: Missing System Prompt ─────────────────────────────────

  /**
   * Detect agent/assistant definitions without system messages.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing system prompts.
   */
  private async detectMissingSystemPrompt(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const agents = await ctx.graph.getEntities('agent');

    for (const agent of agents) {
      const hasSystemPrompt =
        agent.properties['system_prompt'] != null ||
        agent.properties['system_message'] != null ||
        agent.tags.includes('has-system-prompt');

      // Check for prompt relationships
      const outRels = await ctx.graph.getRelationships(agent.id, 'out');
      const hasPromptRel = outRels.some((r) => r.type === 'has_prompt');

      if (!hasSystemPrompt && !hasPromptRel) {
        const loc = locationFromEntity(agent);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Missing system prompt: ${agent.name}`,
            description: `Agent '${agent.name}' has no system prompt or system message. Without a system prompt, the agent's behavior is undefined and inconsistent across interactions.`,
            severity: 'medium',
            category: 'ai_quality',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'No system prompt or has_prompt relationship found',
                entity_ids: [agent.id],
                confidence: 0.8,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Define a clear system prompt that specifies the agent\'s role, capabilities, constraints, and output format expectations.',
            confidence: 0.75,
            tags: ['missing-system-prompt', 'ai', 'agent-design'],
          }),
        );
      }
    }

    return findings;
  }
}

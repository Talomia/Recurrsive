/**
 * @module @recurrsive/reasoning
 *
 * Multi-agent reasoning engine for the Recurrsive engineering intelligence platform.
 *
 * Transforms raw {@link Finding}s from analyzers into prioritized
 * {@link Opportunity} objects through specialist debate and consensus.
 *
 * ## Architecture
 *
 * The reasoning pipeline has four stages:
 *
 * 1. **Analysis** — Nineteen specialist agents analyse raw findings through
 *    their domain-specific cognitive frameworks and propose hypotheses.
 *
 * 2. **Debate** — Specialists challenge hypotheses outside their domain.
 *    Proposers defend. Confidence is revised. Debate continues until
 *    consensus or the maximum round count.
 *
 * 3. **Synthesis** — Findings are promoted one-to-one into evidence-bounded
 *    {@link Opportunity} objects. Debate adds provenance but never invents
 *    impact, effort, implementation risk, or delivery estimates.
 *
 * 4. **Ranking** — A weighted scoring model ranks opportunities by recorded
 *    evidence and confidence; unknown planning fields are treated neutrally.
 *
 * ## Quick Start
 *
 * ```ts
 * import { ReasoningEngine } from '@recurrsive/reasoning';
 *
 * const engine = new ReasoningEngine({
 *   llm_provider: 'openai',
 *   llm_model: 'gpt-4.1-mini',
 *   llm_api_key: process.env.OPENAI_API_KEY,
 *   max_debate_rounds: 3,
 *   min_consensus_score: 0.6,
 *   specialists: ['architecture_engineer', 'security_engineer'],
 *   temperature: 0.3,
 * });
 *
 * const result = await engine.process(findings, graphClient);
 * ```
 *
 * @packageDocumentation
 */

// ── Main engine ──────────────────────────────────────────────────────────────
export { ReasoningEngine } from './engine.js';

// ── LLM adapters ─────────────────────────────────────────────────────────────
export {
  createLLMAdapter,
  OpenAIAdapter,
  AnthropicAdapter,
} from './llm/index.js';
export type {
  LLMAdapter,
  LLMMessage,
  LLMOptions,
  LLMResponse,
  TokenUsage,
  OpenAIAdapterConfig,
  AnthropicAdapterConfig,
} from './llm/index.js';

// ── Specialist agents ────────────────────────────────────────────────────────
export {
  BaseSpecialist,
  createDefaultSpecialists,
  // 19 specialist classes
  ArchitectureEngineer,
  PerformanceEngineer,
  SecurityEngineer,
  CostOptimizer,
  AIQualityEngineer,
  ProductManager,
  ReliabilityEngineer,
  DeveloperExperienceEngineer,
  UXResearcher,
  AccessibilityExpert,
  PrivacyEngineer,
  ComplianceEngineer,
  BackendEngineer,
  FrontendEngineer,
  MLEngineer,
  PromptEngineer,
  DatabaseEngineer,
  DocumentationEngineer,
  ReleaseManager,
  // SDK
  createCustomSpecialist,
  SpecialistRegistry,
  SpecialistTemplate,
  validateConfig,
  validateSpecialist,
  getSDKInfo,
} from './specialists/index.js';
export type {
  Specialist,
  SpecialistConfig,
  CustomAnalysisFn,
  ValidationResult,
  SpecialistSDKInfoData,
} from './specialists/index.js';

// ── Debate protocol ──────────────────────────────────────────────────────────
export { DebateProtocol } from './debate/index.js';

// ── Synthesizer ──────────────────────────────────────────────────────────────
export { Synthesizer } from './synthesizer/index.js';

// ── Judge ────────────────────────────────────────────────────────────────────
export { Judge } from './judge/index.js';

// ── Memory ───────────────────────────────────────────────────────────────────
export { FileMemoryStore } from './memory/index.js';

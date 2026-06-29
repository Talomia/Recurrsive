/**
 * LLM module — adapter factory and re-exports.
 *
 * @module
 */

import type { ReasoningConfig } from '@recurrsive/core';
import type { LLMAdapter } from './adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';

export type { LLMAdapter, LLMMessage, LLMOptions, LLMResponse, TokenUsage } from './adapter.js';
export { OpenAIAdapter } from './openai-adapter.js';
export type { OpenAIAdapterConfig } from './openai-adapter.js';

/**
 * Create an {@link LLMAdapter} from a {@link ReasoningConfig}.
 *
 * Currently all providers are routed through the OpenAI-compatible
 * adapter since most local/remote LLM servers expose the same
 * `/v1/chat/completions` endpoint. The `provider` field is used
 * only for observability labeling and default base-URL selection.
 *
 * @param config - Reasoning engine configuration.
 * @returns A configured LLM adapter instance.
 */
export function createLLMAdapter(config: ReasoningConfig): LLMAdapter {
  const baseUrlMap: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    azure: config.llm_base_url ?? 'https://api.openai.com/v1',
    ollama: 'http://localhost:11434/v1',
    vllm: 'http://localhost:8000/v1',
    litellm: 'http://localhost:4000/v1',
    openrouter: 'https://openrouter.ai/api/v1',
  };

  const baseUrl =
    config.llm_base_url ??
    baseUrlMap[config.llm_provider] ??
    'https://api.openai.com/v1';

  return new OpenAIAdapter({
    apiKey: config.llm_api_key ?? '',
    model: config.llm_model,
    provider: config.llm_provider,
    baseUrl,
    defaultTemperature: config.temperature,
  });
}

/**
 * LLM module — adapter factory and re-exports.
 *
 * @module
 */

import type { ReasoningConfig } from '@recurrsive/core';
import type { LLMAdapter } from './adapter.js';
import { OpenAIAdapter } from './openai-adapter.js';
import { AnthropicAdapter } from './anthropic-adapter.js';

export type { LLMAdapter, LLMMessage, LLMOptions, LLMResponse, TokenUsage } from './adapter.js';
export { OpenAIAdapter } from './openai-adapter.js';
export type { OpenAIAdapterConfig } from './openai-adapter.js';
export { AnthropicAdapter } from './anthropic-adapter.js';
export type { AnthropicAdapterConfig } from './anthropic-adapter.js';

/**
 * Create an {@link LLMAdapter} from a {@link ReasoningConfig}.
 *
 * Routes Anthropic models to the native Anthropic Messages API adapter.
 * All other providers are routed through the OpenAI-compatible adapter
 * since most local/remote LLM servers expose the same
 * `/v1/chat/completions` endpoint.
 *
 * @param config - Reasoning engine configuration.
 * @returns A configured LLM adapter instance.
 */
export function createLLMAdapter(config: ReasoningConfig): LLMAdapter {
  // Anthropic uses a different API format — route to native adapter
  if (config.llm_provider === 'anthropic') {
    return new AnthropicAdapter({
      apiKey: config.llm_api_key ?? '',
      model: config.llm_model,
      baseUrl: config.llm_base_url,
      defaultTemperature: config.temperature,
    });
  }

  // All other providers use OpenAI-compatible endpoints
  const baseUrlMap: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    azure: config.llm_base_url ?? 'https://api.openai.com/v1',
    ollama: 'http://localhost:11434/v1',
    vllm: 'http://localhost:8000/v1',
    litellm: 'http://localhost:4000/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    google: config.llm_base_url ?? 'https://generativelanguage.googleapis.com/v1beta/openai',
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

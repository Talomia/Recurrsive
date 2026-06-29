/**
 * Anthropic Messages API adapter using native `fetch`.
 *
 * Works with the Anthropic Messages API (`/v1/messages`) which has a
 * different request/response format from OpenAI's chat completions.
 *
 * Features:
 * - Native Anthropic Messages API support
 * - System prompt handled as top-level `system` field (not a message)
 * - Retry with exponential backoff (3 attempts)
 * - Timeout handling via AbortController
 * - Token usage parsing (input_tokens / output_tokens)
 * - JSON mode via prefilled assistant response
 * - Error classification (rate-limit, auth, overloaded)
 *
 * @module
 */

import { ReasoningError } from '@recurrsive/core';
import type { LLMAdapter, LLMMessage, LLMOptions, LLMResponse, TokenUsage } from './adapter.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for the Anthropic Messages API adapter. */
export interface AnthropicAdapterConfig {
  /** API key for authentication. */
  apiKey: string;
  /** Model identifier (e.g. 'claude-sonnet-4-20250514', 'claude-haiku-4-20250414'). */
  model: string;
  /** Base URL for the API (default: 'https://api.anthropic.com'). */
  baseUrl?: string;
  /** Default sampling temperature (0–1). */
  defaultTemperature?: number;
  /** Default max tokens per response (Anthropic requires this). */
  defaultMaxTokens?: number;
  /** Default request timeout in milliseconds (default: 120_000). */
  defaultTimeoutMs?: number;
  /** Maximum retry attempts on transient errors (default: 3). */
  maxRetries?: number;
  /** Anthropic API version header (default: '2023-06-01'). */
  apiVersion?: string;
}

// ---------------------------------------------------------------------------
// Internal types matching the Anthropic Messages API response shape
// ---------------------------------------------------------------------------

interface AnthropicContentBlock {
  type: 'text';
  text: string;
}

interface AnthropicUsage {
  input_tokens: number;
  output_tokens: number;
}

interface AnthropicResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string | null;
  usage: AnthropicUsage;
}

interface AnthropicErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

/**
 * LLM adapter for the Anthropic Messages API.
 *
 * @example
 * ```ts
 * const adapter = new AnthropicAdapter({
 *   apiKey: process.env.ANTHROPIC_API_KEY ?? '',
 *   model: 'claude-sonnet-4-20250514',
 * });
 *
 * const response = await adapter.chat([
 *   { role: 'user', content: 'Hello!' },
 * ]);
 * ```
 */
export class AnthropicAdapter implements LLMAdapter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;
  private readonly defaultTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly apiVersion: string;

  /**
   * @param config - Adapter configuration.
   */
  constructor(config: AnthropicAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = (config.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
    this.defaultTemperature = config.defaultTemperature ?? 0.3;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 120_000;
    this.maxRetries = config.maxRetries ?? 3;
    this.apiVersion = config.apiVersion ?? '2023-06-01';
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** @inheritdoc */
  async chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const { systemPrompt, userMessages } = this.extractSystemPrompt(messages);
    const body = this.buildRequestBody(systemPrompt, userMessages, options);
    const raw = await this.executeWithRetry(body, options?.timeout_ms);
    return this.parseResponse(raw);
  }

  /** @inheritdoc */
  async chatJSON<T>(messages: LLMMessage[], schema: object, options?: LLMOptions): Promise<T> {
    // Append a system instruction asking for JSON conforming to the schema
    const augmentedMessages: LLMMessage[] = [
      ...messages,
      {
        role: 'user',
        content:
          `You MUST respond with valid JSON that conforms to this JSON Schema:\n` +
          `${JSON.stringify(schema, null, 2)}\n\n` +
          `Do NOT include any text outside the JSON object. ` +
          `Do NOT wrap the JSON in markdown code fences. ` +
          `Respond ONLY with the JSON object.`,
      },
    ];

    const response = await this.chat(augmentedMessages, options);

    // Anthropic sometimes wraps JSON in markdown — extract it
    let content = response.content.trim();
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      content = jsonMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(content) as T;
      return parsed;
    } catch (err) {
      throw new ReasoningError(
        `Failed to parse JSON from Anthropic response: ${err instanceof Error ? err.message : String(err)}`,
        'LLM_JSON_PARSE_ERROR',
        err,
      );
    }
  }

  /** @inheritdoc */
  getModel(): string {
    return this.model;
  }

  /** @inheritdoc */
  getProvider(): string {
    return 'anthropic';
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Extract system messages from the message array.
   *
   * Anthropic's API takes system prompts as a top-level `system` field,
   * not as a message with role 'system'. This method separates them.
   *
   * @param messages - Mixed messages including potential system messages.
   * @returns System prompt string and non-system messages.
   */
  private extractSystemPrompt(messages: LLMMessage[]): {
    systemPrompt: string | undefined;
    userMessages: LLMMessage[];
  } {
    const systemMessages: string[] = [];
    const userMessages: LLMMessage[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        systemMessages.push(msg.content);
      } else {
        userMessages.push(msg);
      }
    }

    return {
      systemPrompt: systemMessages.length > 0 ? systemMessages.join('\n\n') : undefined,
      userMessages,
    };
  }

  /**
   * Build the request body for the Anthropic Messages API.
   *
   * @param systemPrompt - Optional system prompt.
   * @param messages - User/assistant messages.
   * @param options - Generation options.
   * @returns Serializable request body object.
   */
  private buildRequestBody(
    systemPrompt: string | undefined,
    messages: LLMMessage[],
    options?: LLMOptions,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: options?.max_tokens ?? this.defaultMaxTokens,
      temperature: options?.temperature ?? this.defaultTemperature,
    };

    if (systemPrompt) {
      body['system'] = systemPrompt;
    }

    return body;
  }

  /**
   * Execute the HTTP request with exponential-backoff retry logic.
   *
   * Retries on:
   * - HTTP 429 (rate limit)
   * - HTTP 500/529 (server errors / overloaded)
   * - Network errors (fetch throws)
   *
   * Does NOT retry on:
   * - HTTP 400 (bad request / invalid_request_error)
   * - HTTP 401/403 (auth errors)
   * - Timeout (AbortError)
   *
   * @param body - Request body object.
   * @param timeoutMs - Per-request timeout in milliseconds.
   * @returns Parsed API response.
   * @throws {ReasoningError} After all retries are exhausted.
   */
  private async executeWithRetry(
    body: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<AnthropicResponse> {
    const timeout = timeoutMs ?? this.defaultTimeoutMs;
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const result = await this.doFetch(body, timeout);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry non-transient errors
        if (this.isNonRetryable(lastError)) {
          throw lastError;
        }

        // Exponential backoff: 1s, 2s, 4s …
        if (attempt < this.maxRetries - 1) {
          const delayMs = Math.pow(2, attempt) * 1000;
          await this.sleep(delayMs);
        }
      }
    }

    throw new ReasoningError(
      `Anthropic request failed after ${this.maxRetries} attempts: ${lastError?.message ?? 'unknown error'}`,
      'LLM_MAX_RETRIES_EXCEEDED',
      lastError,
    );
  }

  /**
   * Perform a single HTTP request to the Anthropic Messages API.
   *
   * @param body - Request body.
   * @param timeoutMs - Request timeout in ms.
   * @returns Parsed Anthropic response.
   * @throws {ReasoningError} On HTTP or network errors.
   */
  private async doFetch(
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<AnthropicResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': this.apiVersion,
        'x-api-key': this.apiKey,
      };

      const response = await fetch(`${this.baseUrl}/v1/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Anthropic API error (HTTP ${response.status})`;

        try {
          const parsed = JSON.parse(errorBody) as AnthropicErrorResponse;
          if (parsed.error) {
            errorMessage = `Anthropic API error: ${parsed.error.type} — ${parsed.error.message}`;
          }
        } catch { // fallback to raw
          errorMessage += `: ${errorBody.slice(0, 200)}`;
        }

        const errorCode = this.classifyHttpError(response.status);
        throw new ReasoningError(errorMessage, errorCode);
      }

      const data = (await response.json()) as AnthropicResponse;
      return data;
    } catch (err) {
      if (err instanceof ReasoningError) throw err;

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ReasoningError(
          `Anthropic request timed out after ${timeoutMs}ms`,
          'LLM_TIMEOUT',
        );
      }

      throw new ReasoningError(
        `Anthropic network error: ${err instanceof Error ? err.message : String(err)}`,
        'LLM_NETWORK_ERROR',
        err instanceof Error ? err : undefined,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Parse an Anthropic Messages API response into our standard LLMResponse.
   *
   * @param raw - Raw Anthropic response.
   * @returns Normalized LLM response.
   */
  private parseResponse(raw: AnthropicResponse): LLMResponse {
    const content = raw.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    const usage: TokenUsage = {
      prompt_tokens: raw.usage.input_tokens,
      completion_tokens: raw.usage.output_tokens,
      total_tokens: raw.usage.input_tokens + raw.usage.output_tokens,
    };

    return {
      content,
      usage,
      model: raw.model,
      finish_reason: raw.stop_reason ?? 'stop',
    };
  }

  /**
   * Classify an HTTP status code into a ReasoningError code.
   *
   * @param status - HTTP status code.
   * @returns Error code string.
   */
  private classifyHttpError(status: number): string {
    if (status === 401 || status === 403) return 'LLM_AUTH_ERROR';
    if (status === 429) return 'LLM_RATE_LIMIT';
    if (status === 400) return 'LLM_BAD_REQUEST';
    if (status === 529) return 'LLM_OVERLOADED';
    if (status >= 500) return 'LLM_SERVER_ERROR';
    return 'LLM_ERROR';
  }

  /**
   * Determine whether an error should NOT be retried.
   *
   * @param err - The error to classify.
   * @returns `true` if the error is non-retryable.
   */
  private isNonRetryable(err: Error): boolean {
    if (err instanceof ReasoningError) {
      const code = err.code;
      return (
        code === 'LLM_AUTH_ERROR' ||
        code === 'LLM_BAD_REQUEST' ||
        code === 'LLM_TIMEOUT' ||
        code === 'LLM_JSON_PARSE_ERROR'
      );
    }
    return false;
  }

  /**
   * Sleep for a given number of milliseconds.
   *
   * @param ms - Milliseconds to sleep.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

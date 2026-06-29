/**
 * OpenAI-compatible LLM adapter using native `fetch`.
 *
 * Works with any endpoint that implements the `/v1/chat/completions`
 * API contract: OpenAI, Azure OpenAI, LiteLLM, OpenRouter, Ollama,
 * vLLM, and others.
 *
 * Features:
 * - Custom base URL support
 * - Retry with exponential backoff (3 attempts)
 * - Timeout handling via AbortController
 * - Token usage parsing
 * - JSON mode for structured output
 * - Error classification (rate-limit, auth, network)
 *
 * @module
 */

import { ReasoningError } from '@recurrsive/core';
import type { LLMAdapter, LLMMessage, LLMOptions, LLMResponse, TokenUsage } from './adapter.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Configuration for the OpenAI-compatible adapter. */
export interface OpenAIAdapterConfig {
  /** API key for authentication. Empty string disables the Authorization header. */
  apiKey: string;
  /** Model identifier (e.g. 'gpt-4.1-mini', 'llama3', 'mistral'). */
  model: string;
  /** Provider label for observability (e.g. 'openai', 'ollama'). */
  provider: string;
  /** Base URL for the API (default: 'https://api.openai.com/v1'). */
  baseUrl?: string;
  /** Default sampling temperature (0–2). */
  defaultTemperature?: number;
  /** Default max tokens per response. */
  defaultMaxTokens?: number;
  /** Default request timeout in milliseconds (default: 60 000). */
  defaultTimeoutMs?: number;
  /** Maximum retry attempts on transient errors (default: 3). */
  maxRetries?: number;
}

// ---------------------------------------------------------------------------
// Internal types matching the OpenAI API response shape
// ---------------------------------------------------------------------------

interface OpenAIChatChoice {
  index: number;
  message: { role: string; content: string | null };
  finish_reason: string | null;
}

interface OpenAIChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenAIErrorResponse {
  error?: {
    message: string;
    type: string;
    code: string | null;
  };
}

// ---------------------------------------------------------------------------
// Adapter implementation
// ---------------------------------------------------------------------------

/**
 * LLM adapter for any OpenAI-compatible `/v1/chat/completions` endpoint.
 *
 * @example
 * ```ts
 * const adapter = new OpenAIAdapter({
 *   apiKey: process.env.OPENAI_API_KEY ?? '',
 *   model: 'gpt-4.1-mini',
 *   provider: 'openai',
 * });
 *
 * const response = await adapter.chat([
 *   { role: 'user', content: 'Hello!' },
 * ]);
 * ```
 */
export class OpenAIAdapter implements LLMAdapter {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly provider: string;
  private readonly baseUrl: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;
  private readonly defaultTimeoutMs: number;
  private readonly maxRetries: number;

  /**
   * @param config - Adapter configuration.
   */
  constructor(config: OpenAIAdapterConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.provider = config.provider;
    this.baseUrl = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
    this.defaultTemperature = config.defaultTemperature ?? 0.3;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;
    this.defaultTimeoutMs = config.defaultTimeoutMs ?? 60_000;
    this.maxRetries = config.maxRetries ?? 3;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /** @inheritdoc */
  async chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const body = this.buildRequestBody(messages, options);
    const raw = await this.executeWithRetry(body, options?.timeout_ms);
    return this.parseResponse(raw);
  }

  /** @inheritdoc */
  async chatJSON<T>(messages: LLMMessage[], schema: object, options?: LLMOptions): Promise<T> {
    // Append a system instruction asking for JSON conforming to the schema
    const augmentedMessages: LLMMessage[] = [
      ...messages,
      {
        role: 'system',
        content:
          `You MUST respond with valid JSON that conforms to this JSON Schema:\n` +
          `${JSON.stringify(schema, null, 2)}\n\n` +
          `Do NOT include any text outside the JSON object. ` +
          `Do NOT wrap the JSON in markdown code fences.`,
      },
    ];

    const mergedOptions: LLMOptions = {
      ...options,
      response_format: 'json',
    };

    const response = await this.chat(augmentedMessages, mergedOptions);

    try {
      const parsed = JSON.parse(response.content) as T;
      return parsed;
    } catch (err) {
      throw new ReasoningError(
        `Failed to parse JSON from LLM response: ${err instanceof Error ? err.message : String(err)}`,
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
    return this.provider;
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  /**
   * Build the request body for the chat completions endpoint.
   *
   * @param messages - Chat messages.
   * @param options - Generation options.
   * @returns Serializable request body object.
   */
  private buildRequestBody(
    messages: LLMMessage[],
    options?: LLMOptions,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      temperature: options?.temperature ?? this.defaultTemperature,
      max_tokens: options?.max_tokens ?? this.defaultMaxTokens,
    };

    if (options?.response_format === 'json') {
      body['response_format'] = { type: 'json_object' };
    }

    return body;
  }

  /**
   * Execute the HTTP request with exponential-backoff retry logic.
   *
   * Retries on:
   * - HTTP 429 (rate limit)
   * - HTTP 500/502/503/504 (server errors)
   * - Network errors (fetch throws)
   *
   * Does NOT retry on:
   * - HTTP 400 (bad request)
   * - HTTP 401/403 (auth errors)
   * - Timeout (AbortError)
   *
   * @param body - Request body object.
   * @param timeoutMs - Per-request timeout in milliseconds.
   * @returns Parsed API response.
   * @throws {ReasoningError} After all retries are exhausted or on non-retryable errors.
   */
  private async executeWithRetry(
    body: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<OpenAIChatResponse> {
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
      `LLM request failed after ${this.maxRetries} attempts: ${lastError?.message ?? 'unknown error'}`,
      'LLM_MAX_RETRIES_EXCEEDED',
      lastError,
    );
  }

  /**
   * Perform a single fetch request to the chat completions endpoint.
   *
   * @param body - Request body.
   * @param timeoutMs - Timeout in milliseconds.
   * @returns Parsed JSON response.
   */
  private async doFetch(
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<OpenAIChatResponse> {
    const url = `${this.baseUrl}/chat/completions`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ReasoningError(
          `LLM request timed out after ${timeoutMs}ms`,
          'LLM_TIMEOUT',
          err,
        );
      }

      throw new ReasoningError(
        `Network error connecting to LLM at ${url}: ${err instanceof Error ? err.message : String(err)}`,
        'LLM_NETWORK_ERROR',
        err,
      );
    } finally {
      clearTimeout(timer);
    }

    // Handle error responses
    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      let errorMessage = `LLM API returned HTTP ${response.status}`;

      try {
        const parsed = JSON.parse(errorBody) as OpenAIErrorResponse;
        if (parsed.error?.message) {
          errorMessage = `LLM API error: ${parsed.error.message}`;
        }
      } catch { // fallback to raw
        if (errorBody) {
          errorMessage = `LLM API error (HTTP ${response.status}): ${errorBody.slice(0, 500)}`;
        }
      }

      const code = this.classifyHttpError(response.status);
      const error = new ReasoningError(errorMessage, code);

      // Mark retryable errors so the retry loop can distinguish
      if (code === 'LLM_RATE_LIMIT' || code === 'LLM_SERVER_ERROR') {
        (error as unknown as Record<string, boolean>)['retryable'] = true;
      }

      throw error;
    }

    // Parse successful response
    const json = (await response.json()) as OpenAIChatResponse;
    return json;
  }

  /**
   * Parse the raw OpenAI-format response into our standard LLMResponse.
   *
   * @param raw - Raw API response.
   * @returns Normalized LLMResponse.
   * @throws {ReasoningError} If the response has no choices.
   */
  private parseResponse(raw: OpenAIChatResponse): LLMResponse {
    const firstChoice = raw.choices[0];
    if (!firstChoice) {
      throw new ReasoningError(
        'LLM response contained no choices',
        'LLM_EMPTY_RESPONSE',
      );
    }

    const usage: TokenUsage = raw.usage
      ? {
          prompt_tokens: raw.usage.prompt_tokens,
          completion_tokens: raw.usage.completion_tokens,
          total_tokens: raw.usage.total_tokens,
        }
      : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    return {
      content: firstChoice.message.content ?? '',
      usage,
      model: raw.model,
      finish_reason: firstChoice.finish_reason ?? 'unknown',
    };
  }

  /**
   * Classify an HTTP status code into a machine-readable error code.
   *
   * @param status - HTTP status code.
   * @returns Error code string.
   */
  private classifyHttpError(status: number): string {
    if (status === 401 || status === 403) return 'LLM_AUTH_ERROR';
    if (status === 429) return 'LLM_RATE_LIMIT';
    if (status === 400) return 'LLM_BAD_REQUEST';
    if (status >= 500) return 'LLM_SERVER_ERROR';
    return 'LLM_HTTP_ERROR';
  }

  /**
   * Check whether an error is non-retryable.
   *
   * @param err - The error to check.
   * @returns True if the error should NOT be retried.
   */
  private isNonRetryable(err: Error): boolean {
    if (err instanceof ReasoningError) {
      const nonRetryableCodes = ['LLM_AUTH_ERROR', 'LLM_BAD_REQUEST', 'LLM_TIMEOUT'];
      return nonRetryableCodes.includes(err.code);
    }
    return false;
  }

  /**
   * Sleep for the specified duration.
   *
   * @param ms - Milliseconds to sleep.
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

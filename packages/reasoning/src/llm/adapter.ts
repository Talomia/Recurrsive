/**
 * LLM abstraction layer — model and provider agnostic.
 *
 * Defines the core interfaces that all LLM adapters must implement.
 * This allows the reasoning engine to work with any LLM backend
 * (OpenAI, Anthropic, Ollama, vLLM, LiteLLM, etc.) via a single API.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/**
 * A single message in a chat conversation.
 */
export interface LLMMessage {
  /** The role of the message author. */
  role: 'system' | 'user' | 'assistant';
  /** The text content of the message. */
  content: string;
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/**
 * Token usage statistics returned by the LLM provider.
 */
export interface TokenUsage {
  /** Number of tokens in the prompt. */
  prompt_tokens: number;
  /** Number of tokens generated. */
  completion_tokens: number;
  /** Total tokens (prompt + completion). */
  total_tokens: number;
}

/**
 * A response from an LLM provider.
 */
export interface LLMResponse {
  /** The generated text content. */
  content: string;
  /** Token usage statistics. */
  usage: TokenUsage;
  /** Model identifier that produced the response. */
  model: string;
  /** Why the model stopped generating (e.g. 'stop', 'length'). */
  finish_reason: string;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Options that control LLM generation behaviour.
 */
export interface LLMOptions {
  /** Sampling temperature (0–2). Lower = more deterministic. */
  temperature?: number;
  /** Maximum number of tokens to generate. */
  max_tokens?: number;
  /** Response format: 'text' for free-form, 'json' for JSON mode. */
  response_format?: 'text' | 'json';
  /** Request timeout in milliseconds. */
  timeout_ms?: number;
}

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

/**
 * Interface that all LLM adapters must implement.
 *
 * Provides two methods for interacting with an LLM:
 * - `chat` — free-form text completion
 * - `chatJSON` — structured JSON output parsed into a typed object
 */
export interface LLMAdapter {
  /**
   * Send a chat completion request to the LLM.
   *
   * @param messages - Ordered list of conversation messages.
   * @param options - Optional generation parameters.
   * @returns The LLM response with content and usage stats.
   * @throws {ReasoningError} On network, auth, rate-limit, or timeout errors.
   */
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;

  /**
   * Send a chat completion request expecting structured JSON output.
   *
   * The response is parsed and validated against the provided JSON schema.
   *
   * @typeParam T - Expected shape of the parsed JSON response.
   * @param messages - Ordered list of conversation messages.
   * @param schema - JSON Schema describing the expected response shape.
   * @param options - Optional generation parameters.
   * @returns Parsed and typed JSON object.
   * @throws {ReasoningError} On parse failure, validation failure, or LLM errors.
   */
  chatJSON<T>(messages: LLMMessage[], schema: object, options?: LLMOptions): Promise<T>;

  /**
   * Get the model identifier this adapter is configured to use.
   * @returns Model name string (e.g. 'gpt-4.1-mini').
   */
  getModel(): string;

  /**
   * Get the provider name for this adapter.
   * @returns Provider string (e.g. 'openai', 'ollama').
   */
  getProvider(): string;
}

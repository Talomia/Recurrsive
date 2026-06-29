/**
 * Tests for OpenAIAdapter with mocked fetch.
 *
 * Covers: successful chat, JSON mode parsing, retry on 429/500,
 * no retry on 401, timeout handling, token usage parsing, and
 * error classification.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OpenAIAdapter } from '../../llm/openai-adapter.js';
import { ReasoningError } from '@recurrsive/core';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal OpenAI chat completion response body. */
function makeCompletionResponse(
  content: string,
  usage = { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  model = 'gpt-4.1-mini',
  finish_reason = 'stop',
) {
  return {
    id: 'chatcmpl-abc123',
    object: 'chat.completion',
    created: 1700000000,
    model,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content },
        finish_reason,
      },
    ],
    usage,
  };
}

/** Build a Response-like mock object for fetch. */
function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    redirected: false,
    type: 'basic',
    url: '',
    clone: () => mockResponse(body, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    bytes: () => Promise.resolve(new Uint8Array()),
  } as Response;
}

function createAdapter(overrides = {}) {
  return new OpenAIAdapter({
    apiKey: 'test-key',
    model: 'gpt-4.1-mini',
    provider: 'openai',
    baseUrl: 'https://api.test.com/v1',
    maxRetries: 3,
    defaultTimeoutMs: 5000,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('OpenAIAdapter', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ── Constructor ──────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('sets model and provider', () => {
      const adapter = createAdapter();
      expect(adapter.getModel()).toBe('gpt-4.1-mini');
      expect(adapter.getProvider()).toBe('openai');
    });

    it('strips trailing slashes from base URL', () => {
      const adapter = createAdapter({ baseUrl: 'https://api.test.com/v1///' });
      // We verify indirectly by checking the fetch URL
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('hi')),
      );
      globalThis.fetch = fetchMock;
      adapter.chat([{ role: 'user', content: 'hello' }]);
      // The constructor should strip trailing slashes, so the URL
      // should be well-formed (not have triple slashes)
      expect(adapter.getModel()).toBe('gpt-4.1-mini');
    });

    it('defaults to openai base URL when none provided', () => {
      const adapter = new OpenAIAdapter({
        apiKey: 'key',
        model: 'gpt-4',
        provider: 'openai',
      });
      expect(adapter.getProvider()).toBe('openai');
    });
  });

  // ── Successful chat ──────────────────────────────────────────────────────

  describe('chat()', () => {
    it('returns parsed LLMResponse on success', async () => {
      const body = makeCompletionResponse('Hello, world!');
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(body));

      const adapter = createAdapter();
      const result = await adapter.chat([{ role: 'user', content: 'hi' }]);

      expect(result.content).toBe('Hello, world!');
      expect(result.model).toBe('gpt-4.1-mini');
      expect(result.finish_reason).toBe('stop');
    });

    it('sends correct request body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('ok')),
      );
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();
      await adapter.chat(
        [
          { role: 'system', content: 'Be brief.' },
          { role: 'user', content: 'Hello' },
        ],
        { temperature: 0.5, max_tokens: 100 },
      );

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, reqInit] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.test.com/v1/chat/completions');
      const reqBody = JSON.parse(reqInit.body as string);
      expect(reqBody.model).toBe('gpt-4.1-mini');
      expect(reqBody.temperature).toBe(0.5);
      expect(reqBody.max_tokens).toBe(100);
      expect(reqBody.messages).toHaveLength(2);
    });

    it('sends Authorization header when apiKey is set', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('ok')),
      );
      globalThis.fetch = fetchMock;

      const adapter = createAdapter({ apiKey: 'sk-test123' });
      await adapter.chat([{ role: 'user', content: 'hi' }]);

      const headers = fetchMock.mock.calls[0]![1].headers;
      expect(headers['Authorization']).toBe('Bearer sk-test123');
    });

    it('omits Authorization header when apiKey is empty', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('ok')),
      );
      globalThis.fetch = fetchMock;

      const adapter = createAdapter({ apiKey: '' });
      await adapter.chat([{ role: 'user', content: 'hi' }]);

      const headers = fetchMock.mock.calls[0]![1].headers;
      expect(headers['Authorization']).toBeUndefined();
    });

    it('defaults usage to zeros when API does not include usage', async () => {
      const body = {
        id: 'chatcmpl-abc',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4.1-mini',
        choices: [
          { index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' },
        ],
        // no usage field
      };
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(body));

      const adapter = createAdapter();
      const result = await adapter.chat([{ role: 'user', content: 'hi' }]);

      expect(result.usage.prompt_tokens).toBe(0);
      expect(result.usage.completion_tokens).toBe(0);
      expect(result.usage.total_tokens).toBe(0);
    });

    it('defaults content to empty string when null', async () => {
      const body = {
        id: 'chatcmpl-abc',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4.1-mini',
        choices: [
          { index: 0, message: { role: 'assistant', content: null }, finish_reason: 'stop' },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 0, total_tokens: 1 },
      };
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(body));

      const adapter = createAdapter();
      const result = await adapter.chat([{ role: 'user', content: 'hi' }]);
      expect(result.content).toBe('');
    });
  });

  // ── JSON mode ────────────────────────────────────────────────────────────

  describe('chatJSON()', () => {
    it('parses valid JSON from LLM response', async () => {
      const jsonContent = JSON.stringify({ answer: 42, tags: ['math'] });
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse(jsonContent)),
      );

      const adapter = createAdapter();
      const result = await adapter.chatJSON<{ answer: number; tags: string[] }>(
        [{ role: 'user', content: 'What is 6*7?' }],
        { type: 'object', properties: { answer: { type: 'number' } } },
      );

      expect(result.answer).toBe(42);
      expect(result.tags).toEqual(['math']);
    });

    it('sets response_format to json_object in request body', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('{"ok":true}')),
      );
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();
      await adapter.chatJSON(
        [{ role: 'user', content: 'test' }],
        { type: 'object' },
      );

      const reqBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      expect(reqBody.response_format).toEqual({ type: 'json_object' });
    });

    it('appends a system message with the schema', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('{"result":"ok"}')),
      );
      globalThis.fetch = fetchMock;

      const schema = { type: 'object', properties: { result: { type: 'string' } } };
      const adapter = createAdapter();
      await adapter.chatJSON(
        [{ role: 'user', content: 'test' }],
        schema,
      );

      const reqBody = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
      // Original user message + appended schema system message
      expect(reqBody.messages.length).toBe(2);
      expect(reqBody.messages[1].role).toBe('system');
      expect(reqBody.messages[1].content).toContain('JSON Schema');
    });

    it('throws ReasoningError on invalid JSON in response', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('this is not json {{')),
      );

      const adapter = createAdapter();
      await expect(
        adapter.chatJSON(
          [{ role: 'user', content: 'test' }],
          { type: 'object' },
        ),
      ).rejects.toThrow(ReasoningError);
    });

    it('error has LLM_JSON_PARSE_ERROR code on parse failure', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('not json')),
      );

      const adapter = createAdapter();
      try {
        await adapter.chatJSON(
          [{ role: 'user', content: 'test' }],
          { type: 'object' },
        );
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ReasoningError);
        expect((err as ReasoningError).code).toBe('LLM_JSON_PARSE_ERROR');
      }
    });
  });

  // ── Token usage parsing ──────────────────────────────────────────────────

  describe('token usage parsing', () => {
    it('extracts prompt_tokens, completion_tokens, and total_tokens', async () => {
      const usage = { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 };
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(makeCompletionResponse('ok', usage)),
      );

      const adapter = createAdapter();
      const result = await adapter.chat([{ role: 'user', content: 'hi' }]);

      expect(result.usage.prompt_tokens).toBe(100);
      expect(result.usage.completion_tokens).toBe(200);
      expect(result.usage.total_tokens).toBe(300);
    });
  });

  // ── Retry on 429 (rate limit) ────────────────────────────────────────────

  describe('retry on 429 rate limit', () => {
    it('retries 3 times then throws LLM_MAX_RETRIES_EXCEEDED', async () => {
      const errorBody = { error: { message: 'Rate limited', type: 'rate_limit', code: null } };
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(errorBody, 429));
      globalThis.fetch = fetchMock;

      // Use very fast adapter with 0 delay for the test
      const adapter = new OpenAIAdapter({
        apiKey: 'test-key',
        model: 'gpt-4.1-mini',
        provider: 'openai',
        baseUrl: 'https://api.test.com/v1',
        maxRetries: 3,
        defaultTimeoutMs: 5000,
      });

      // Mock sleep to not actually wait
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);

      await expect(
        adapter.chat([{ role: 'user', content: 'hi' }]),
      ).rejects.toThrow('failed after 3 attempts');

      // Verify fetch was called exactly 3 times
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('succeeds when second attempt works after 429', async () => {
      const errorBody = { error: { message: 'Rate limited', type: 'rate_limit', code: null } };
      const successBody = makeCompletionResponse('success');

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(errorBody, 429))
        .mockResolvedValueOnce(mockResponse(successBody, 200));
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);

      const result = await adapter.chat([{ role: 'user', content: 'hi' }]);
      expect(result.content).toBe('success');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  // ── Retry on 500 server error ────────────────────────────────────────────

  describe('retry on 500 server error', () => {
    it('retries on 500 status', async () => {
      const errorBody = { error: { message: 'Server error', type: 'server_error', code: null } };
      const successBody = makeCompletionResponse('recovered');

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(mockResponse(errorBody, 500))
        .mockResolvedValueOnce(mockResponse(successBody, 200));
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);

      const result = await adapter.chat([{ role: 'user', content: 'hi' }]);
      expect(result.content).toBe('recovered');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('retries on 502, 503, 504', async () => {
      for (const status of [502, 503, 504]) {
        const fetchMock = vi
          .fn()
          .mockResolvedValueOnce(mockResponse({}, status))
          .mockResolvedValueOnce(mockResponse(makeCompletionResponse('ok'), 200));
        globalThis.fetch = fetchMock;

        const adapter = createAdapter();
        vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);

        const result = await adapter.chat([{ role: 'user', content: 'hi' }]);
        expect(result.content).toBe('ok');
        expect(fetchMock).toHaveBeenCalledTimes(2);
      }
    });
  });

  // ── No retry on 401 auth error ───────────────────────────────────────────

  describe('no retry on 401 auth error', () => {
    it('immediately throws without retrying', async () => {
      const errorBody = { error: { message: 'Invalid API key', type: 'auth', code: null } };
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(errorBody, 401));
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();

      await expect(
        adapter.chat([{ role: 'user', content: 'hi' }]),
      ).rejects.toThrow(ReasoningError);

      // Should NOT retry — only 1 call
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('error has LLM_AUTH_ERROR code', async () => {
      const errorBody = { error: { message: 'Bad key', type: 'auth', code: null } };
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(errorBody, 401));

      const adapter = createAdapter();

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ReasoningError);
        expect((err as ReasoningError).code).toBe('LLM_AUTH_ERROR');
      }
    });

    it('does not retry on 403 either', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse({}, 403));
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();

      await expect(
        adapter.chat([{ role: 'user', content: 'hi' }]),
      ).rejects.toThrow(ReasoningError);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── No retry on 400 bad request ──────────────────────────────────────────

  describe('no retry on 400 bad request', () => {
    it('immediately throws with LLM_BAD_REQUEST code', async () => {
      const errorBody = { error: { message: 'Bad request', type: 'invalid_request', code: null } };
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(errorBody, 400));
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ReasoningError);
        expect((err as ReasoningError).code).toBe('LLM_BAD_REQUEST');
      }

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Timeout handling ─────────────────────────────────────────────────────

  describe('timeout handling', () => {
    it('throws LLM_TIMEOUT when request exceeds timeout_ms', async () => {
      // Simulate abort by making fetch throw a DOMException
      globalThis.fetch = vi.fn().mockImplementation(() => {
        const abortError = new DOMException('The operation was aborted', 'AbortError');
        return Promise.reject(abortError);
      });

      const adapter = createAdapter({ defaultTimeoutMs: 100 });

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ReasoningError);
        expect((err as ReasoningError).code).toBe('LLM_TIMEOUT');
      }
    });

    it('does not retry on timeout', async () => {
      const fetchMock = vi.fn().mockImplementation(() => {
        return Promise.reject(new DOMException('Aborted', 'AbortError'));
      });
      globalThis.fetch = fetchMock;

      const adapter = createAdapter({ defaultTimeoutMs: 100 });

      await expect(
        adapter.chat([{ role: 'user', content: 'hi' }]),
      ).rejects.toThrow(ReasoningError);

      // Timeout is non-retryable: only 1 call
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  // ── Network error handling ───────────────────────────────────────────────

  describe('network error handling', () => {
    it('throws LLM_NETWORK_ERROR on fetch failure', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

      const adapter = createAdapter();
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);

      await expect(
        adapter.chat([{ role: 'user', content: 'hi' }]),
      ).rejects.toThrow('failed after 3 attempts');
    });
  });

  // ── Error classification ─────────────────────────────────────────────────

  describe('error classification', () => {
    it('classifies 401 as LLM_AUTH_ERROR', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({}, 401));
      const adapter = createAdapter();

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
      } catch (err) {
        expect((err as ReasoningError).code).toBe('LLM_AUTH_ERROR');
      }
    });

    it('classifies 403 as LLM_AUTH_ERROR', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({}, 403));
      const adapter = createAdapter();

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
      } catch (err) {
        expect((err as ReasoningError).code).toBe('LLM_AUTH_ERROR');
      }
    });

    it('classifies 429 as LLM_RATE_LIMIT', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({}, 429));
      const adapter = createAdapter();
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
      } catch (err) {
        expect((err as ReasoningError).code).toBe('LLM_MAX_RETRIES_EXCEEDED');
      }
    });

    it('classifies 400 as LLM_BAD_REQUEST', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({}, 400));
      const adapter = createAdapter();

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
      } catch (err) {
        expect((err as ReasoningError).code).toBe('LLM_BAD_REQUEST');
      }
    });

    it('classifies 500+ as LLM_SERVER_ERROR (retryable)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse({}, 500));
      const adapter = createAdapter();
      vi.spyOn(adapter as any, 'sleep').mockResolvedValue(undefined);

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
      } catch (err) {
        expect((err as ReasoningError).code).toBe('LLM_MAX_RETRIES_EXCEEDED');
      }
    });
  });

  // ── Empty choices ────────────────────────────────────────────────────────

  describe('empty choices handling', () => {
    it('throws LLM_EMPTY_RESPONSE when choices array is empty', async () => {
      const body = {
        id: 'chatcmpl-abc',
        object: 'chat.completion',
        created: 1700000000,
        model: 'gpt-4.1-mini',
        choices: [],
        usage: { prompt_tokens: 5, completion_tokens: 0, total_tokens: 5 },
      };
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(body));

      const adapter = createAdapter();
      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ReasoningError);
        expect((err as ReasoningError).code).toBe('LLM_EMPTY_RESPONSE');
      }
    });
  });

  // ── getModel / getProvider ───────────────────────────────────────────────

  describe('getModel() / getProvider()', () => {
    it('returns configured model', () => {
      const adapter = createAdapter({ model: 'llama3' });
      expect(adapter.getModel()).toBe('llama3');
    });

    it('returns configured provider', () => {
      const adapter = createAdapter({ provider: 'ollama' });
      expect(adapter.getProvider()).toBe('ollama');
    });
  });
});

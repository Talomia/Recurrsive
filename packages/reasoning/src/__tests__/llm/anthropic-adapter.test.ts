/**
 * Tests for AnthropicAdapter with mocked fetch.
 *
 * Covers: request shaping (endpoint, x-api-key/anthropic-version headers,
 * system-prompt extraction, max_tokens), response parsing, JSON mode with
 * markdown-fence extraction, retry/no-retry classification, the 529 overloaded
 * code, and timeout handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnthropicAdapter } from '../../llm/anthropic-adapter.js';
import { ReasoningError } from '@recurrsive/core';

/** Build a minimal Anthropic Messages API response body. */
function makeMessageResponse(
  text: string,
  usage = { input_tokens: 10, output_tokens: 20 },
  model = 'claude-sonnet-4-20250514',
  stop_reason: string | null = 'end_turn',
) {
  return {
    id: 'msg_abc123',
    type: 'message',
    role: 'assistant',
    content: [{ type: 'text', text }],
    model,
    stop_reason,
    usage,
  };
}

function mockResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
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
  return new AnthropicAdapter({
    apiKey: 'test-key',
    model: 'claude-sonnet-4-20250514',
    baseUrl: 'https://api.test.com',
    maxRetries: 3,
    defaultTimeoutMs: 5000,
    ...overrides,
  });
}

describe('AnthropicAdapter', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('reports model and anthropic provider', () => {
      const adapter = createAdapter();
      expect(adapter.getModel()).toBe('claude-sonnet-4-20250514');
      expect(adapter.getProvider()).toBe('anthropic');
    });
  });

  describe('chat()', () => {
    it('parses text blocks, usage, and stop_reason', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(makeMessageResponse('Hello!', { input_tokens: 12, output_tokens: 8 })),
      );

      const adapter = createAdapter();
      const result = await adapter.chat([{ role: 'user', content: 'hi' }]);

      expect(result.content).toBe('Hello!');
      expect(result.model).toBe('claude-sonnet-4-20250514');
      expect(result.finish_reason).toBe('end_turn');
      expect(result.usage.prompt_tokens).toBe(12);
      expect(result.usage.completion_tokens).toBe(8);
      expect(result.usage.total_tokens).toBe(20);
    });

    it('posts to /v1/messages with anthropic headers and extracted system prompt', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(makeMessageResponse('ok')));
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();
      await adapter.chat(
        [
          { role: 'system', content: 'Be terse.' },
          { role: 'user', content: 'Hello' },
        ],
        { max_tokens: 256 },
      );

      const [url, reqInit] = fetchMock.mock.calls[0]!;
      expect(url).toBe('https://api.test.com/v1/messages');
      expect(reqInit.headers['x-api-key']).toBe('test-key');
      expect(reqInit.headers['anthropic-version']).toBe('2023-06-01');

      const reqBody = JSON.parse(reqInit.body as string);
      expect(reqBody.model).toBe('claude-sonnet-4-20250514');
      expect(reqBody.max_tokens).toBe(256);
      // System messages are hoisted to the top-level `system` field, not sent
      // as a role in `messages`.
      expect(reqBody.system).toContain('Be terse.');
      expect(reqBody.messages.every((m: { role: string }) => m.role !== 'system')).toBe(true);
    });

    it('omits x-api-key header when apiKey is empty', async () => {
      const fetchMock = vi.fn().mockResolvedValue(mockResponse(makeMessageResponse('ok')));
      globalThis.fetch = fetchMock;

      const adapter = createAdapter({ apiKey: '' });
      await adapter.chat([{ role: 'user', content: 'hi' }]);

      expect(fetchMock.mock.calls[0]![1].headers['x-api-key']).toBeUndefined();
    });

    it('joins multiple text blocks', async () => {
      const body = {
        id: 'msg_1', type: 'message', role: 'assistant',
        content: [{ type: 'text', text: 'part one' }, { type: 'text', text: 'part two' }],
        model: 'claude-sonnet-4-20250514', stop_reason: 'end_turn',
        usage: { input_tokens: 1, output_tokens: 2 },
      };
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(body));

      const result = await createAdapter().chat([{ role: 'user', content: 'hi' }]);
      expect(result.content).toBe('part one\npart two');
    });
  });

  describe('chatJSON()', () => {
    it('parses valid JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        mockResponse(makeMessageResponse(JSON.stringify({ answer: 42 }))),
      );
      const result = await createAdapter().chatJSON<{ answer: number }>(
        [{ role: 'user', content: 'q' }],
        { type: 'object' },
      );
      expect(result.answer).toBe(42);
    });

    it('extracts JSON from a markdown code fence', async () => {
      const fenced = '```json\n{"ok":true}\n```';
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(makeMessageResponse(fenced)));

      const result = await createAdapter().chatJSON<{ ok: boolean }>(
        [{ role: 'user', content: 'q' }],
        { type: 'object' },
      );
      expect(result.ok).toBe(true);
    });

    it('throws LLM_JSON_PARSE_ERROR on invalid JSON', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(makeMessageResponse('not json {{')));
      try {
        await createAdapter().chatJSON([{ role: 'user', content: 'q' }], { type: 'object' });
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ReasoningError);
        expect((err as ReasoningError).code).toBe('LLM_JSON_PARSE_ERROR');
      }
    });
  });

  describe('retry classification', () => {
    it('retries on 429 then succeeds', async () => {
      const fetchMock = vi.fn()
        .mockResolvedValueOnce(mockResponse({ type: 'error', error: { type: 'rate_limit', message: 'slow down' } }, 429))
        .mockResolvedValueOnce(mockResponse(makeMessageResponse('recovered'), 200));
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();
      vi.spyOn(adapter as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(undefined);

      const result = await adapter.chat([{ role: 'user', content: 'hi' }]);
      expect(result.content).toBe('recovered');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry on 401 auth error', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse({ type: 'error', error: { type: 'authentication_error', message: 'bad key' } }, 401),
      );
      globalThis.fetch = fetchMock;

      try {
        await createAdapter().chat([{ role: 'user', content: 'hi' }]);
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as ReasoningError).code).toBe('LLM_AUTH_ERROR');
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does not retry on 400 bad request', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse({ type: 'error', error: { type: 'invalid_request_error', message: 'bad' } }, 400),
      );
      globalThis.fetch = fetchMock;

      try {
        await createAdapter().chat([{ role: 'user', content: 'hi' }]);
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as ReasoningError).code).toBe('LLM_BAD_REQUEST');
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('classifies 529 as LLM_OVERLOADED and retries', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        mockResponse({ type: 'error', error: { type: 'overloaded_error', message: 'busy' } }, 529),
      );
      globalThis.fetch = fetchMock;

      const adapter = createAdapter();
      vi.spyOn(adapter as unknown as { sleep: () => Promise<void> }, 'sleep').mockResolvedValue(undefined);

      try {
        await adapter.chat([{ role: 'user', content: 'hi' }]);
        expect.fail('should have thrown');
      } catch (err) {
        // Overloaded is retryable, so after exhausting retries the surfaced
        // error is the max-retries wrapper.
        expect((err as ReasoningError).code).toBe('LLM_MAX_RETRIES_EXCEEDED');
      }
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });
  });

  describe('timeout', () => {
    it('throws LLM_TIMEOUT and does not retry on abort', async () => {
      const fetchMock = vi.fn().mockImplementation(() =>
        Promise.reject(new DOMException('aborted', 'AbortError')),
      );
      globalThis.fetch = fetchMock;

      try {
        await createAdapter({ defaultTimeoutMs: 50 }).chat([{ role: 'user', content: 'hi' }]);
        expect.fail('should have thrown');
      } catch (err) {
        expect((err as ReasoningError).code).toBe('LLM_TIMEOUT');
      }
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

/**
 * Tests for the LLM adapter interfaces and types.
 *
 * Since these are pure TypeScript interfaces/types (no runtime code),
 * we test them by constructing conforming values and verifying
 * structural contracts at runtime.
 */

import { describe, it, expect } from 'vitest';
import type {
  LLMMessage,
  LLMResponse,
  LLMOptions,
  LLMAdapter,
  TokenUsage,
} from '../../llm/adapter.js';

describe('LLMMessage interface', () => {
  it('accepts a system role message', () => {
    const msg: LLMMessage = { role: 'system', content: 'You are helpful.' };
    expect(msg.role).toBe('system');
    expect(msg.content).toBe('You are helpful.');
  });

  it('accepts a user role message', () => {
    const msg: LLMMessage = { role: 'user', content: 'Hello' };
    expect(msg.role).toBe('user');
    expect(msg.content).toBe('Hello');
  });

  it('accepts an assistant role message', () => {
    const msg: LLMMessage = { role: 'assistant', content: 'Hi there!' };
    expect(msg.role).toBe('assistant');
    expect(msg.content).toBe('Hi there!');
  });

  it('requires both role and content fields', () => {
    const msg: LLMMessage = { role: 'user', content: '' };
    expect(msg).toHaveProperty('role');
    expect(msg).toHaveProperty('content');
  });

  it('allows empty string content', () => {
    const msg: LLMMessage = { role: 'assistant', content: '' };
    expect(msg.content).toBe('');
  });
});

describe('TokenUsage interface', () => {
  it('contains prompt_tokens, completion_tokens, and total_tokens', () => {
    const usage: TokenUsage = {
      prompt_tokens: 100,
      completion_tokens: 50,
      total_tokens: 150,
    };
    expect(usage.prompt_tokens).toBe(100);
    expect(usage.completion_tokens).toBe(50);
    expect(usage.total_tokens).toBe(150);
  });

  it('allows zero values', () => {
    const usage: TokenUsage = {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };
    expect(usage.total_tokens).toBe(0);
  });
});

describe('LLMResponse interface', () => {
  it('contains content, usage, model, and finish_reason', () => {
    const response: LLMResponse = {
      content: 'Hello world!',
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      model: 'gpt-4.1-mini',
      finish_reason: 'stop',
    };
    expect(response.content).toBe('Hello world!');
    expect(response.model).toBe('gpt-4.1-mini');
    expect(response.finish_reason).toBe('stop');
    expect(response.usage.total_tokens).toBe(15);
  });

  it('allows empty content string', () => {
    const response: LLMResponse = {
      content: '',
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      model: 'test-model',
      finish_reason: 'length',
    };
    expect(response.content).toBe('');
    expect(response.finish_reason).toBe('length');
  });
});

describe('LLMOptions interface', () => {
  it('all fields are optional', () => {
    const opts: LLMOptions = {};
    expect(opts.temperature).toBeUndefined();
    expect(opts.max_tokens).toBeUndefined();
    expect(opts.response_format).toBeUndefined();
    expect(opts.timeout_ms).toBeUndefined();
  });

  it('accepts all fields together', () => {
    const opts: LLMOptions = {
      temperature: 0.7,
      max_tokens: 2048,
      response_format: 'json',
      timeout_ms: 30000,
    };
    expect(opts.temperature).toBe(0.7);
    expect(opts.max_tokens).toBe(2048);
    expect(opts.response_format).toBe('json');
    expect(opts.timeout_ms).toBe(30000);
  });

  it('accepts text response format', () => {
    const opts: LLMOptions = { response_format: 'text' };
    expect(opts.response_format).toBe('text');
  });

  it('accepts json response format', () => {
    const opts: LLMOptions = { response_format: 'json' };
    expect(opts.response_format).toBe('json');
  });
});

describe('LLMAdapter interface', () => {
  it('can be satisfied by a mock implementation', () => {
    const mockAdapter: LLMAdapter = {
      async chat(_messages, _options) {
        return {
          content: 'mock response',
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
          model: 'mock-model',
          finish_reason: 'stop',
        };
      },
      async chatJSON<T>(_messages: LLMMessage[], _schema: object): Promise<T> {
        return { result: 'parsed' } as T;
      },
      getModel() {
        return 'mock-model';
      },
      getProvider() {
        return 'mock-provider';
      },
    };

    expect(mockAdapter.getModel()).toBe('mock-model');
    expect(mockAdapter.getProvider()).toBe('mock-provider');
  });

  it('chat returns a Promise<LLMResponse>', async () => {
    const mockAdapter: LLMAdapter = {
      async chat() {
        return {
          content: 'test',
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: 'test',
          finish_reason: 'stop',
        };
      },
      async chatJSON<T>(): Promise<T> {
        return {} as T;
      },
      getModel: () => 'test',
      getProvider: () => 'test',
    };

    const result = await mockAdapter.chat([{ role: 'user', content: 'hi' }]);
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('usage');
    expect(result).toHaveProperty('model');
    expect(result).toHaveProperty('finish_reason');
  });

  it('chatJSON returns a typed Promise<T>', async () => {
    interface TestSchema {
      name: string;
      value: number;
    }

    const mockAdapter: LLMAdapter = {
      async chat() {
        return {
          content: '',
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          model: 'test',
          finish_reason: 'stop',
        };
      },
      async chatJSON<T>(): Promise<T> {
        return { name: 'test', value: 42 } as T;
      },
      getModel: () => 'test',
      getProvider: () => 'test',
    };

    const result = await mockAdapter.chatJSON<TestSchema>(
      [{ role: 'user', content: 'hi' }],
      { type: 'object' },
    );
    expect(result.name).toBe('test');
    expect(result.value).toBe(42);
  });
});

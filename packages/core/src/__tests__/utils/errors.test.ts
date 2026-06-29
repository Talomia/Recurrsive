import { describe, it, expect } from 'vitest';
import {
  RecurrsiveError,
  CollectorError,
  AnalyzerError,
  ReasoningError,
  GraphError,
  ConfigError,
  ValidationError,
} from '../../utils/errors.js';

// ---------------------------------------------------------------------------
// RecurrsiveError (base class)
// ---------------------------------------------------------------------------
describe('RecurrsiveError', () => {
  it('constructs with message and code', () => {
    const err = new RecurrsiveError('Something failed', 'UNKNOWN');
    expect(err.message).toBe('Something failed');
    expect(err.code).toBe('UNKNOWN');
  });

  it('is an instance of Error', () => {
    const err = new RecurrsiveError('fail', 'ERR');
    expect(err).toBeInstanceOf(Error);
  });

  it('is an instance of RecurrsiveError', () => {
    const err = new RecurrsiveError('fail', 'ERR');
    expect(err).toBeInstanceOf(RecurrsiveError);
  });

  it('has name set to "RecurrsiveError"', () => {
    const err = new RecurrsiveError('fail', 'ERR');
    expect(err.name).toBe('RecurrsiveError');
  });

  it('has a stack trace', () => {
    const err = new RecurrsiveError('fail', 'ERR');
    expect(err.stack).toBeDefined();
    expect(typeof err.stack).toBe('string');
  });

  it('supports cause chaining with an Error', () => {
    const cause = new Error('root cause');
    const err = new RecurrsiveError('wrapper', 'WRAP', cause);
    expect(err.cause).toBe(cause);
  });

  it('supports cause chaining with a non-Error value', () => {
    const err = new RecurrsiveError('wrapper', 'WRAP', 'string cause');
    expect(err.cause).toBe('string cause');
  });

  it('has undefined cause when not provided', () => {
    const err = new RecurrsiveError('no cause', 'NC');
    expect(err.cause).toBeUndefined();
  });

  describe('toJSON', () => {
    it('serializes to a plain object with expected keys', () => {
      const err = new RecurrsiveError('fail', 'CODE');
      const json = err.toJSON();

      expect(json).toHaveProperty('name', 'RecurrsiveError');
      expect(json).toHaveProperty('code', 'CODE');
      expect(json).toHaveProperty('message', 'fail');
      expect(json).toHaveProperty('stack');
    });

    it('serializes Error cause with name, message, stack', () => {
      const cause = new TypeError('type fail');
      const err = new RecurrsiveError('wrap', 'W', cause);
      const json = err.toJSON();

      expect(json['cause']).toEqual(
        expect.objectContaining({
          name: 'TypeError',
          message: 'type fail',
        }),
      );
      expect((json['cause'] as Record<string, unknown>)['stack']).toBeDefined();
    });

    it('serializes non-Error cause as-is', () => {
      const err = new RecurrsiveError('wrap', 'W', { detail: 42 });
      const json = err.toJSON();
      expect(json['cause']).toEqual({ detail: 42 });
    });

    it('has undefined cause in JSON when no cause', () => {
      const err = new RecurrsiveError('no cause', 'NC');
      expect(err.toJSON()['cause']).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// CollectorError
// ---------------------------------------------------------------------------
describe('CollectorError', () => {
  it('constructs with message, code, and collectorId', () => {
    const err = new CollectorError('rate limited', 'RATE_LIMIT', 'github');
    expect(err.message).toBe('rate limited');
    expect(err.code).toBe('RATE_LIMIT');
    expect(err.collectorId).toBe('github');
  });

  it('has name "CollectorError"', () => {
    const err = new CollectorError('fail', 'ERR', 'git');
    expect(err.name).toBe('CollectorError');
  });

  it('is instanceof CollectorError, RecurrsiveError, and Error', () => {
    const err = new CollectorError('fail', 'ERR', 'git');
    expect(err).toBeInstanceOf(CollectorError);
    expect(err).toBeInstanceOf(RecurrsiveError);
    expect(err).toBeInstanceOf(Error);
  });

  it('supports cause chaining', () => {
    const cause = new Error('network');
    const err = new CollectorError('fail', 'NET', 'http', cause);
    expect(err.cause).toBe(cause);
  });

  it('toJSON includes collectorId', () => {
    const err = new CollectorError('fail', 'ERR', 'github');
    const json = err.toJSON();
    expect(json).toHaveProperty('collectorId', 'github');
    expect(json).toHaveProperty('name', 'CollectorError');
    expect(json).toHaveProperty('code', 'ERR');
    expect(json).toHaveProperty('message', 'fail');
  });
});

// ---------------------------------------------------------------------------
// AnalyzerError
// ---------------------------------------------------------------------------
describe('AnalyzerError', () => {
  it('constructs with message, code, and analyzerId', () => {
    const err = new AnalyzerError('parse error', 'PARSE_FAILURE', 'security.xss');
    expect(err.message).toBe('parse error');
    expect(err.code).toBe('PARSE_FAILURE');
    expect(err.analyzerId).toBe('security.xss');
  });

  it('has name "AnalyzerError"', () => {
    const err = new AnalyzerError('fail', 'ERR', 'a');
    expect(err.name).toBe('AnalyzerError');
  });

  it('is instanceof AnalyzerError, RecurrsiveError, and Error', () => {
    const err = new AnalyzerError('fail', 'ERR', 'a');
    expect(err).toBeInstanceOf(AnalyzerError);
    expect(err).toBeInstanceOf(RecurrsiveError);
    expect(err).toBeInstanceOf(Error);
  });

  it('supports cause chaining', () => {
    const cause = new SyntaxError('unexpected token');
    const err = new AnalyzerError('parse fail', 'PARSE', 'ast', cause);
    expect(err.cause).toBe(cause);
  });

  it('toJSON includes analyzerId', () => {
    const err = new AnalyzerError('fail', 'ERR', 'complexity');
    const json = err.toJSON();
    expect(json).toHaveProperty('analyzerId', 'complexity');
    expect(json).toHaveProperty('name', 'AnalyzerError');
  });
});

// ---------------------------------------------------------------------------
// ReasoningError
// ---------------------------------------------------------------------------
describe('ReasoningError', () => {
  it('constructs with message and code', () => {
    const err = new ReasoningError('context overflow', 'CONTEXT_OVERFLOW');
    expect(err.message).toBe('context overflow');
    expect(err.code).toBe('CONTEXT_OVERFLOW');
  });

  it('has name "ReasoningError"', () => {
    const err = new ReasoningError('fail', 'ERR');
    expect(err.name).toBe('ReasoningError');
  });

  it('is instanceof ReasoningError, RecurrsiveError, and Error', () => {
    const err = new ReasoningError('fail', 'ERR');
    expect(err).toBeInstanceOf(ReasoningError);
    expect(err).toBeInstanceOf(RecurrsiveError);
    expect(err).toBeInstanceOf(Error);
  });

  it('supports cause chaining', () => {
    const cause = new Error('llm timeout');
    const err = new ReasoningError('debate fail', 'TIMEOUT', cause);
    expect(err.cause).toBe(cause);
  });

  it('toJSON works (inherits base)', () => {
    const err = new ReasoningError('fail', 'R_ERR');
    const json = err.toJSON();
    expect(json).toHaveProperty('name', 'ReasoningError');
    expect(json).toHaveProperty('code', 'R_ERR');
  });
});

// ---------------------------------------------------------------------------
// GraphError
// ---------------------------------------------------------------------------
describe('GraphError', () => {
  it('constructs with message and code', () => {
    const err = new GraphError('connection lost', 'CONNECTION_LOST');
    expect(err.message).toBe('connection lost');
    expect(err.code).toBe('CONNECTION_LOST');
  });

  it('has name "GraphError"', () => {
    const err = new GraphError('fail', 'ERR');
    expect(err.name).toBe('GraphError');
  });

  it('is instanceof GraphError, RecurrsiveError, and Error', () => {
    const err = new GraphError('fail', 'ERR');
    expect(err).toBeInstanceOf(GraphError);
    expect(err).toBeInstanceOf(RecurrsiveError);
    expect(err).toBeInstanceOf(Error);
  });

  it('supports cause chaining', () => {
    const cause = new Error('pg connection refused');
    const err = new GraphError('graph down', 'CONN_ERR', cause);
    expect(err.cause).toBe(cause);
  });

  it('toJSON works (inherits base)', () => {
    const err = new GraphError('fail', 'G_ERR');
    const json = err.toJSON();
    expect(json).toHaveProperty('name', 'GraphError');
    expect(json).toHaveProperty('code', 'G_ERR');
  });
});

// ---------------------------------------------------------------------------
// ConfigError
// ---------------------------------------------------------------------------
describe('ConfigError', () => {
  it('constructs with message and code', () => {
    const err = new ConfigError('missing field', 'MISSING_FIELD');
    expect(err.message).toBe('missing field');
    expect(err.code).toBe('MISSING_FIELD');
  });

  it('has name "ConfigError"', () => {
    const err = new ConfigError('fail', 'ERR');
    expect(err.name).toBe('ConfigError');
  });

  it('is instanceof ConfigError, RecurrsiveError, and Error', () => {
    const err = new ConfigError('fail', 'ERR');
    expect(err).toBeInstanceOf(ConfigError);
    expect(err).toBeInstanceOf(RecurrsiveError);
    expect(err).toBeInstanceOf(Error);
  });

  it('supports cause chaining', () => {
    const cause = new Error('file not found');
    const err = new ConfigError('config load fail', 'LOAD', cause);
    expect(err.cause).toBe(cause);
  });

  it('toJSON works (inherits base)', () => {
    const err = new ConfigError('fail', 'C_ERR');
    const json = err.toJSON();
    expect(json).toHaveProperty('name', 'ConfigError');
    expect(json).toHaveProperty('code', 'C_ERR');
  });
});

// ---------------------------------------------------------------------------
// ValidationError
// ---------------------------------------------------------------------------
describe('ValidationError', () => {
  it('constructs with message and validation errors', () => {
    const validationErrors = [{ path: ['name'], message: 'required' }];
    const err = new ValidationError('validation failed', validationErrors);
    expect(err.message).toBe('validation failed');
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.validationErrors).toEqual(validationErrors);
  });

  it('has name "ValidationError"', () => {
    const err = new ValidationError('fail', {});
    expect(err.name).toBe('ValidationError');
  });

  it('always has code "VALIDATION_ERROR"', () => {
    const err = new ValidationError('fail', null);
    expect(err.code).toBe('VALIDATION_ERROR');
  });

  it('is instanceof ValidationError, RecurrsiveError, and Error', () => {
    const err = new ValidationError('fail', {});
    expect(err).toBeInstanceOf(ValidationError);
    expect(err).toBeInstanceOf(RecurrsiveError);
    expect(err).toBeInstanceOf(Error);
  });

  it('supports cause chaining', () => {
    const cause = new Error('zod error');
    const err = new ValidationError('validation', {}, cause);
    expect(err.cause).toBe(cause);
  });

  it('toJSON includes validationErrors', () => {
    const details = { issues: ['a', 'b'] };
    const err = new ValidationError('fail', details);
    const json = err.toJSON();
    expect(json).toHaveProperty('validationErrors', details);
    expect(json).toHaveProperty('name', 'ValidationError');
    expect(json).toHaveProperty('code', 'VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting: hierarchy checks
// ---------------------------------------------------------------------------
describe('Error hierarchy cross-checks', () => {
  it('all subclasses are instances of RecurrsiveError', () => {
    const errors = [
      new CollectorError('m', 'c', 'id'),
      new AnalyzerError('m', 'c', 'id'),
      new ReasoningError('m', 'c'),
      new GraphError('m', 'c'),
      new ConfigError('m', 'c'),
      new ValidationError('m', {}),
    ];

    for (const err of errors) {
      expect(err).toBeInstanceOf(RecurrsiveError);
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('CollectorError is not instanceof AnalyzerError', () => {
    const err = new CollectorError('m', 'c', 'id');
    expect(err).not.toBeInstanceOf(AnalyzerError);
  });

  it('AnalyzerError is not instanceof GraphError', () => {
    const err = new AnalyzerError('m', 'c', 'id');
    expect(err).not.toBeInstanceOf(GraphError);
  });

  it('can be caught by catching RecurrsiveError', () => {
    let caught = false;
    try {
      throw new GraphError('test', 'TEST');
    } catch (e) {
      if (e instanceof RecurrsiveError) {
        caught = true;
      }
    }
    expect(caught).toBe(true);
  });
});

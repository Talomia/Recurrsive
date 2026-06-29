import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLogger, Logger, type LogEntry, type LogLevel } from '../../utils/logger.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Capture structured log entries emitted by the logger. */
function captureOutput() {
  const entries: { method: string; entry: LogEntry }[] = [];

  const logSpy = vi.spyOn(console, 'log').mockImplementation((json: string) => {
    entries.push({ method: 'log', entry: JSON.parse(json) as LogEntry });
  });
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation((json: string) => {
    entries.push({ method: 'warn', entry: JSON.parse(json) as LogEntry });
  });
  const errorSpy = vi.spyOn(console, 'error').mockImplementation((json: string) => {
    entries.push({ method: 'error', entry: JSON.parse(json) as LogEntry });
  });

  return { entries, logSpy, warnSpy, errorSpy };
}

// ---------------------------------------------------------------------------
// createLogger factory
// ---------------------------------------------------------------------------
describe('createLogger', () => {
  it('returns a Logger instance', () => {
    const log = createLogger();
    expect(log).toBeInstanceOf(Logger);
  });

  it('accepts no arguments (uses defaults)', () => {
    expect(() => createLogger()).not.toThrow();
  });

  it('accepts options', () => {
    const log = createLogger({ level: 'debug', context: { service: 'test' } });
    expect(log).toBeInstanceOf(Logger);
  });
});

// ---------------------------------------------------------------------------
// Logger – construction
// ---------------------------------------------------------------------------
describe('Logger construction', () => {
  it('creates with default options', () => {
    const logger = new Logger();
    expect(logger).toBeInstanceOf(Logger);
  });

  it('creates with explicit level and context', () => {
    const logger = new Logger({ level: 'warn', context: { env: 'test' } });
    expect(logger).toBeInstanceOf(Logger);
  });
});

// ---------------------------------------------------------------------------
// Logger – level filtering
// ---------------------------------------------------------------------------
describe('Logger level filtering', () => {
  let cleanup: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    cleanup = captureOutput();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits info and above at default level (info)', () => {
    const log = new Logger();
    log.debug('should not appear');
    log.info('should appear');
    log.warn('should appear');
    log.error('should appear');

    expect(cleanup.entries).toHaveLength(3);
    expect(cleanup.entries.map((e) => e.entry.level)).toEqual(['info', 'warn', 'error']);
  });

  it('does not emit debug messages when level is info', () => {
    const log = new Logger({ level: 'info' });
    log.debug('hidden');

    expect(cleanup.entries).toHaveLength(0);
  });

  it('emits all levels when level is debug', () => {
    const log = new Logger({ level: 'debug' });
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(cleanup.entries).toHaveLength(4);
    expect(cleanup.entries.map((e) => e.entry.level)).toEqual([
      'debug',
      'info',
      'warn',
      'error',
    ]);
  });

  it('only emits warn and error when level is warn', () => {
    const log = new Logger({ level: 'warn' });
    log.debug('no');
    log.info('no');
    log.warn('yes');
    log.error('yes');

    expect(cleanup.entries).toHaveLength(2);
    expect(cleanup.entries.map((e) => e.entry.level)).toEqual(['warn', 'error']);
  });

  it('only emits error when level is error', () => {
    const log = new Logger({ level: 'error' });
    log.debug('no');
    log.info('no');
    log.warn('no');
    log.error('yes');

    expect(cleanup.entries).toHaveLength(1);
    expect(cleanup.entries[0]!.entry.level).toBe('error');
  });
});

// ---------------------------------------------------------------------------
// Logger – output routing
// ---------------------------------------------------------------------------
describe('Logger output routing', () => {
  let cleanup: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    cleanup = captureOutput();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes debug to console.log', () => {
    const log = new Logger({ level: 'debug' });
    log.debug('test');
    expect(cleanup.logSpy).toHaveBeenCalledTimes(1);
  });

  it('routes info to console.log', () => {
    const log = new Logger({ level: 'debug' });
    log.info('test');
    expect(cleanup.logSpy).toHaveBeenCalledTimes(1);
  });

  it('routes warn to console.warn', () => {
    const log = new Logger({ level: 'debug' });
    log.warn('test');
    expect(cleanup.warnSpy).toHaveBeenCalledTimes(1);
  });

  it('routes error to console.error', () => {
    const log = new Logger({ level: 'debug' });
    log.error('test');
    expect(cleanup.errorSpy).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Logger – log entry structure
// ---------------------------------------------------------------------------
describe('Logger log entry structure', () => {
  let cleanup: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    cleanup = captureOutput();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('includes timestamp, level, message, and context', () => {
    const log = new Logger({ level: 'debug' });
    log.info('hello');

    const entry = cleanup.entries[0]!.entry;
    expect(entry).toHaveProperty('timestamp');
    expect(entry).toHaveProperty('level', 'info');
    expect(entry).toHaveProperty('message', 'hello');
    expect(entry).toHaveProperty('context');
  });

  it('timestamp is a valid ISO string', () => {
    const log = new Logger({ level: 'debug' });
    log.info('ts-check');

    const entry = cleanup.entries[0]!.entry;
    expect(entry.timestamp).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it('includes static context in every entry', () => {
    const log = new Logger({ context: { service: 'core', version: 1 } });
    log.info('msg');

    const ctx = cleanup.entries[0]!.entry.context;
    expect(ctx).toMatchObject({ service: 'core', version: 1 });
  });

  it('merges extra context into entry context', () => {
    const log = new Logger({ context: { service: 'core' } });
    log.info('msg', { target: 'github' });

    const ctx = cleanup.entries[0]!.entry.context;
    expect(ctx).toMatchObject({ service: 'core', target: 'github' });
  });

  it('extra context overrides static context for same key', () => {
    const log = new Logger({ context: { a: 'static' } });
    log.info('msg', { a: 'extra' });

    const ctx = cleanup.entries[0]!.entry.context;
    expect(ctx['a']).toBe('extra');
  });

  it('context is empty object when no context is provided', () => {
    const log = new Logger();
    log.info('msg');

    expect(cleanup.entries[0]!.entry.context).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// Logger – Error serialization in metadata
// ---------------------------------------------------------------------------
describe('Logger Error serialization', () => {
  let cleanup: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    cleanup = captureOutput();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('serializes Error objects in the "error" key', () => {
    const log = new Logger();
    const err = new Error('boom');
    log.error('Something failed', { error: err });

    const ctx = cleanup.entries[0]!.entry.context;
    const serializedError = ctx['error'] as Record<string, unknown>;
    expect(serializedError).toHaveProperty('name', 'Error');
    expect(serializedError).toHaveProperty('message', 'boom');
    expect(serializedError).toHaveProperty('stack');
    expect(typeof serializedError['stack']).toBe('string');
  });

  it('preserves non-Error values in the "error" key', () => {
    const log = new Logger();
    log.error('fail', { error: 'string-error' });

    const ctx = cleanup.entries[0]!.entry.context;
    expect(ctx['error']).toBe('string-error');
  });

  it('serializes TypeError instances', () => {
    const log = new Logger();
    const err = new TypeError('type issue');
    log.error('type fail', { error: err });

    const ctx = cleanup.entries[0]!.entry.context;
    const serializedError = ctx['error'] as Record<string, unknown>;
    expect(serializedError['name']).toBe('TypeError');
    expect(serializedError['message']).toBe('type issue');
  });

  it('does not mutate the original extra object', () => {
    const log = new Logger();
    const err = new Error('oops');
    const extra = { error: err, other: 'data' };
    log.error('fail', extra);

    // Original extra should still have the Error instance
    expect(extra.error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// Logger – child loggers
// ---------------------------------------------------------------------------
describe('Logger child', () => {
  let cleanup: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    cleanup = captureOutput();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a child logger that is a Logger instance', () => {
    const parent = new Logger({ context: { service: 'core' } });
    const child = parent.child({ component: 'graph' });
    expect(child).toBeInstanceOf(Logger);
  });

  it('child inherits parent context', () => {
    const parent = new Logger({ context: { service: 'core' } });
    const child = parent.child({ component: 'graph' });
    child.info('child msg');

    const ctx = cleanup.entries[0]!.entry.context;
    expect(ctx).toMatchObject({ service: 'core', component: 'graph' });
  });

  it('child inherits parent log level', () => {
    const parent = new Logger({ level: 'warn', context: {} });
    const child = parent.child({ c: true });
    child.info('should not appear');
    child.warn('should appear');

    expect(cleanup.entries).toHaveLength(1);
    expect(cleanup.entries[0]!.entry.level).toBe('warn');
  });

  it('child context overrides parent context for same key', () => {
    const parent = new Logger({ context: { a: 'parent' } });
    const child = parent.child({ a: 'child' });
    child.info('test');

    expect(cleanup.entries[0]!.entry.context['a']).toBe('child');
  });
});

// ---------------------------------------------------------------------------
// Logger – all four levels emit correct level string
// ---------------------------------------------------------------------------
describe('Logger logs at all 4 levels', () => {
  let cleanup: ReturnType<typeof captureOutput>;

  beforeEach(() => {
    cleanup = captureOutput();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];

  for (const level of levels) {
    it(`emits a log entry with level "${level}"`, () => {
      const log = new Logger({ level: 'debug' });
      log[level](`${level} message`);

      expect(cleanup.entries).toHaveLength(1);
      expect(cleanup.entries[0]!.entry.level).toBe(level);
      expect(cleanup.entries[0]!.entry.message).toBe(`${level} message`);
    });
  }
});

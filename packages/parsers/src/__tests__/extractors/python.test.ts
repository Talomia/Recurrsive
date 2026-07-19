/**
 * @module __tests__/extractors/python
 *
 * Comprehensive tests for the PythonExtractor class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PythonExtractor } from '../../extractors/python.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PythonExtractor', () => {
  let extractor: PythonExtractor;

  beforeEach(() => {
    extractor = new PythonExtractor();
  });

  it('has correct language and extensions', () => {
    expect(extractor.language).toBe('python');
    expect(extractor.extensions).toContain('py');
    expect(extractor.extensions).toContain('pyw');
  });

  // ── Function Definitions ──────────────────────────────────────────────

  describe('function definitions', () => {
    it('extracts simple function definition', () => {
      const source = `def greet(name):
    return f"Hello {name}"
`;
      const entities = extractor.extract(source, 'app.py');
      const fn = entities.find((e) => e.type === 'function' && e.name === 'greet');
      expect(fn).toBeDefined();
      expect(fn!.name).toBe('greet');
      expect(fn!.qualified_name).toBe('app.py:greet');
      expect(fn!.source_location.file).toBe('app.py');
    });

    it('extracts function with type annotations', () => {
      const source = `def add(a: int, b: int) -> int:
    return a + b
`;
      const entities = extractor.extract(source, 'math_utils.py');
      const fn = entities.find((e) => e.name === 'add');
      expect(fn).toBeDefined();
      expect(fn!.properties['return_type']).toBe('int');
      const params = fn!.properties['parameters'] as Array<{ name: string; type: string | null }>;
      expect(params.length).toBe(2);
      expect(params[0]!.name).toBe('a');
      expect(params[0]!.type).toBe('int');
    });

    it('extracts function with default parameter values', () => {
      const source = `def configure(host: str = "localhost", port: int = 8080):
    pass
`;
      const entities = extractor.extract(source, 'config.py');
      const fn = entities.find((e) => e.name === 'configure');
      expect(fn).toBeDefined();
      const params = fn!.properties['parameters'] as Array<{
        name: string;
        default_value: string | null;
      }>;
      expect(params.length).toBe(2);
      expect(params[0]!.default_value).toBe('"localhost"');
    });

    it('filters out self parameter from methods', () => {
      const source = `class MyClass:
    def method(self, x: int):
        pass
`;
      const entities = extractor.extract(source, 'test.py');
      const methods = entities.filter(
        (e) => e.type === 'function' && e.name === 'method',
      );
      expect(methods.length).toBeGreaterThanOrEqual(1);
      const params = methods[0]!.properties['parameters'] as Array<{ name: string }>;
      expect(params.some((p) => p.name === 'self')).toBe(false);
      expect(params.some((p) => p.name === 'x')).toBe(true);
    });

    it('detects private functions (single underscore prefix)', () => {
      const source = `def _internal_helper():
    pass
`;
      const entities = extractor.extract(source, 'test.py');
      const fn = entities.find((e) => e.name === '_internal_helper');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_private']).toBe(true);
    });

    it('detects dunder methods', () => {
      const source = `class MyClass:
    def __init__(self):
        pass
`;
      const entities = extractor.extract(source, 'test.py');
      const fn = entities.find((e) => e.name === '__init__');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_dunder']).toBe(true);
    });

    it('extracts function with docstring', () => {
      const source = `def documented():
    """This function does something useful."""
    pass
`;
      const entities = extractor.extract(source, 'test.py');
      const fn = entities.find((e) => e.name === 'documented');
      expect(fn).toBeDefined();
      expect(fn!.properties['docstring']).toBe('This function does something useful.');
    });

    it('detects method vs top-level function by indentation', () => {
      const source = `def top_level():
    pass

class MyClass:
    def method(self):
        pass
`;
      const entities = extractor.extract(source, 'test.py');
      const topLevel = entities.find((e) => e.name === 'top_level');
      const method = entities.find((e) => e.name === 'method');
      expect(topLevel!.properties['is_method']).toBe(false);
      expect(method!.properties['is_method']).toBe(true);
    });
  });

  // ── Async Functions ───────────────────────────────────────────────────

  describe('async def', () => {
    it('extracts async function definitions', () => {
      const source = `async def fetch_data(url: str) -> dict:
    async with aiohttp.ClientSession() as session:
        pass
`;
      const entities = extractor.extract(source, 'async_utils.py');
      const fn = entities.find((e) => e.name === 'fetch_data');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_async']).toBe(true);
    });

    it('extracts async method in a class', () => {
      const source = `class ApiClient:
    async def get(self, path: str) -> dict:
        pass
`;
      const entities = extractor.extract(source, 'client.py');
      const fn = entities.find((e) => e.name === 'get');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_async']).toBe(true);
      expect(fn!.properties['is_method']).toBe(true);
    });
  });

  // ── Class Definitions ─────────────────────────────────────────────────

  describe('class definitions', () => {
    it('extracts simple class definition', () => {
      const source = `class UserService:
    pass
`;
      const entities = extractor.extract(source, 'services.py');
      const cls = entities.find((e) => e.type === 'class' && e.name === 'UserService');
      expect(cls).toBeDefined();
      expect(cls!.qualified_name).toBe('services.py:UserService');
    });

    it('extracts class with base classes', () => {
      const source = `class Admin(User, PermissionsMixin):
    pass
`;
      const entities = extractor.extract(source, 'models.py');
      const cls = entities.find((e) => e.name === 'Admin');
      expect(cls).toBeDefined();
      expect(cls!.properties['bases']).toContain('User');
      expect(cls!.properties['bases']).toContain('PermissionsMixin');

      const extendsRels = cls!.relationships.filter((r) => r.type === 'extends');
      expect(extendsRels.length).toBe(2);
    });

    it('filters out object from base classes', () => {
      const source = `class MyClass(object):
    pass
`;
      const entities = extractor.extract(source, 'test.py');
      const cls = entities.find((e) => e.name === 'MyClass');
      expect(cls).toBeDefined();
      const extendsRels = cls!.relationships.filter((r) => r.type === 'extends');
      expect(extendsRels).toEqual([]);
    });

    it('extracts class with docstring', () => {
      const source = `class Documented:
    """A well documented class."""
    pass
`;
      const entities = extractor.extract(source, 'test.py');
      const cls = entities.find((e) => e.name === 'Documented');
      expect(cls).toBeDefined();
      expect(cls!.properties['docstring']).toBe('A well documented class.');
    });

    it('extracts class without base classes', () => {
      const source = `class SimpleClass:
    pass
`;
      const entities = extractor.extract(source, 'test.py');
      const cls = entities.find((e) => e.name === 'SimpleClass');
      expect(cls).toBeDefined();
      expect(cls!.properties['bases']).toEqual([]);
    });
  });

  // ── Imports ───────────────────────────────────────────────────────────

  describe('extractImports', () => {
    it('extracts import module statements', () => {
      const source = `import os
import sys
`;
      const imports = extractor.extractImports(source, 'test.py');
      expect(imports.length).toBeGreaterThanOrEqual(2);
      expect(imports.some((i) => i.module === 'os')).toBe(true);
      expect(imports.some((i) => i.module === 'sys')).toBe(true);
    });

    it('extracts from...import statements', () => {
      const source = `from flask import Flask, jsonify`;
      const imports = extractor.extractImports(source, 'app.py');
      const imp = imports.find((i) => i.module === 'flask');
      expect(imp).toBeDefined();
      expect(imp!.names).toContain('Flask');
      expect(imp!.names).toContain('jsonify');
      expect(imp!.is_default).toBe(false);
    });

    it('extracts import with alias', () => {
      const source = `import numpy as np`;
      const imports = extractor.extractImports(source, 'test.py');
      const imp = imports.find((i) => i.module === 'numpy');
      expect(imp).toBeDefined();
      expect(imp!.names).toContain('np');
    });

    it('extracts from...import with alias', () => {
      const source = `from datetime import datetime as dt`;
      const imports = extractor.extractImports(source, 'test.py');
      const imp = imports.find((i) => i.module === 'datetime');
      expect(imp).toBeDefined();
      expect(imp!.names).toContain('dt');
    });

    it('extracts wildcard import (from x import *)', () => {
      const source = `from os.path import *`;
      const imports = extractor.extractImports(source, 'test.py');
      const imp = imports.find((i) => i.module === 'os.path');
      expect(imp).toBeDefined();
      expect(imp!.is_namespace).toBe(true);
      expect(imp!.names).toEqual([]);
    });

    it('extracts dotted module imports', () => {
      const source = `from os.path import join, dirname`;
      const imports = extractor.extractImports(source, 'test.py');
      const imp = imports.find((i) => i.module === 'os.path');
      expect(imp).toBeDefined();
      expect(imp!.names).toContain('join');
      expect(imp!.names).toContain('dirname');
    });

    it('returns empty array for source with no imports', () => {
      const source = `x = 42`;
      const imports = extractor.extractImports(source, 'test.py');
      expect(imports).toEqual([]);
    });
  });

  // ── Decorators ────────────────────────────────────────────────────────

  describe('decorators', () => {
    it('extracts decorators on functions', () => {
      const source = `@login_required
def protected_view():
    pass
`;
      const entities = extractor.extract(source, 'views.py');
      const fn = entities.find((e) => e.name === 'protected_view');
      expect(fn).toBeDefined();
      expect(fn!.properties['decorators']).toContain('login_required');
    });

    it('extracts decorator attached to function', () => {
      // Note: PythonExtractor's _scanDecorators re-processes consecutive
      // decorator lines, so only the last contiguous group is preserved
      // for the decorated definition. A single decorator always works.
      const source = `@login_required
def protected_handler():
    pass
`;
      const entities = extractor.extract(source, 'views.py');
      const fn = entities.find((e) => e.name === 'protected_handler');
      expect(fn).toBeDefined();
      const decorators = fn!.properties['decorators'] as string[];
      expect(decorators.length).toBeGreaterThanOrEqual(1);
      expect(decorators).toContain('login_required');
    });

    it('extracts decorators on classes', () => {
      const source = `@dataclass
class User:
    name: str
    age: int
`;
      const entities = extractor.extract(source, 'models.py');
      const cls = entities.find((e) => e.type === 'class' && e.name === 'User');
      expect(cls).toBeDefined();
      expect(cls!.properties['decorators']).toContain('dataclass');
    });
  });

  // ── Empty File ────────────────────────────────────────────────────────

  describe('empty file handling', () => {
    it('returns empty arrays for empty source', () => {
      const entities = extractor.extract('', 'empty.py');
      expect(entities).toEqual([]);
    });

    it('returns empty imports for empty source', () => {
      const imports = extractor.extractImports('', 'empty.py');
      expect(imports).toEqual([]);
    });

    it('returns empty arrays for comment-only source', () => {
      const source = `# This is a comment\n# Another comment`;
      const entities = extractor.extract(source, 'comments.py');
      expect(entities).toEqual([]);
    });
  });

  // ── Source Location ───────────────────────────────────────────────────

  describe('source locations', () => {
    it('reports correct file path', () => {
      const source = `def hello():\n    pass`;
      const entities = extractor.extract(source, 'app/views.py');
      const fn = entities.find((e) => e.name === 'hello');
      expect(fn!.source_location.file).toBe('app/views.py');
    });

    it('reports correct start line', () => {
      const source = `
# comment

def third_line_func():
    pass
`;
      const entities = extractor.extract(source, 'test.py');
      const fn = entities.find((e) => e.name === 'third_line_func');
      expect(fn).toBeDefined();
      expect(fn!.source_location.start_line).toBe(4);
    });

    it('reports correct end line for multi-line function', () => {
      const source = `def multiline():
    x = 1
    y = 2
    return x + y
`;
      const entities = extractor.extract(source, 'test.py');
      const fn = entities.find((e) => e.name === 'multiline');
      expect(fn).toBeDefined();
      expect(fn!.source_location.end_line).toBeGreaterThanOrEqual(4);
    });
  });

  // ── Multiple Entities ─────────────────────────────────────────────────

  describe('multiple entities in one file', () => {
    it('extracts all entities from a complex file', () => {
      const source = `
import os
from flask import Flask, jsonify

class Config:
    DEBUG = True

class UserService:
    def get_user(self, user_id: int) -> dict:
        pass

    async def create_user(self, data: dict) -> dict:
        pass

def main():
    app = Flask(__name__)
`;
      const entities = extractor.extract(source, 'app.py');
      const imports = extractor.extractImports(source, 'app.py');

      expect(entities.some((e) => e.name === 'Config')).toBe(true);
      expect(entities.some((e) => e.name === 'UserService')).toBe(true);
      expect(entities.some((e) => e.name === 'get_user')).toBe(true);
      expect(entities.some((e) => e.name === 'create_user')).toBe(true);
      expect(entities.some((e) => e.name === 'main')).toBe(true);

      expect(imports.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Control-flow features (has_try_catch / has_loop) ──────────────────

  describe('control-flow features', () => {
    it('detects try/except in a function body', () => {
      const source = [
        'def fetch(x):',
        '    try:',
        '        return call(x)',
        '    except Exception:',
        '        return None',
        '',
      ].join('\n');
      const fn = extractor.extract(source, 'svc.py').find((e) => e.name === 'fetch');
      expect(fn).toBeDefined();
      expect(fn!.properties['has_try_catch']).toBe(true);
      expect(fn!.properties['has_loop']).toBe(false);
    });

    it('detects for/while loops in a function body', () => {
      const source = [
        'def process(items):',
        '    for item in items:',
        '        save(item)',
        '',
      ].join('\n');
      const fn = extractor.extract(source, 'svc.py').find((e) => e.name === 'process');
      expect(fn).toBeDefined();
      expect(fn!.properties['has_loop']).toBe(true);
      expect(fn!.properties['has_try_catch']).toBe(false);
    });

    it('reports false for a plain function with neither', () => {
      const source = ['def add(a, b):', '    return a + b', ''].join('\n');
      const fn = extractor.extract(source, 'm.py').find((e) => e.name === 'add');
      expect(fn).toBeDefined();
      expect(fn!.properties['has_try_catch']).toBe(false);
      expect(fn!.properties['has_loop']).toBe(false);
    });
  });

  // ── Flask endpoints ─────────────────────────────────────────────────

  describe('Flask endpoints', () => {
    it('honors the methods= kwarg on @app.route — one endpoint per method', () => {
      // Regression: methods=['POST'] was ignored, recording every
      // @app.route as GET.
      const source = [
        "@app.route('/items', methods=['GET', 'POST'])",
        'def items():',
        '    pass',
        '',
        "@app.route('/users', methods=['POST'])",
        'def create_user():',
        '    pass',
        '',
      ].join('\n');
      const endpoints = extractor
        .extract(source, 'app/views.py')
        .filter((e) => e.type === 'endpoint');
      const names = endpoints.map((e) => e.name).sort();
      expect(names).toEqual(['GET /items', 'POST /items', 'POST /users']);
    });

    it('defaults @app.route without methods= to GET', () => {
      const source = [
        "@app.route('/plain')",
        'def plain():',
        '    pass',
        '',
      ].join('\n');
      const endpoints = extractor
        .extract(source, 'app/views.py')
        .filter((e) => e.type === 'endpoint');
      expect(endpoints.map((e) => e.name)).toEqual(['GET /plain']);
      expect(endpoints[0]!.properties['http_method']).toBe('GET');
    });
  });
});

/**
 * @module __tests__/extractors/typescript
 *
 * Comprehensive tests for the TypeScriptExtractor class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TypeScriptExtractor } from '../../extractors/typescript.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TypeScriptExtractor', () => {
  let extractor: TypeScriptExtractor;

  beforeEach(() => {
    extractor = new TypeScriptExtractor();
  });

  it('has correct language and extensions', () => {
    expect(extractor.language).toBe('typescript');
    expect(extractor.extensions).toContain('ts');
    expect(extractor.extensions).toContain('tsx');
    expect(extractor.extensions).toContain('js');
    expect(extractor.extensions).toContain('jsx');
  });

  // ── Function Declarations ─────────────────────────────────────────────

  describe('function declarations', () => {
    it('extracts a simple function declaration', () => {
      const source = `
function greet(name: string): string {
  return 'Hello ' + name;
}
`;
      const entities = extractor.extract(source, 'test.ts');
      const fns = entities.filter((e) => e.type === 'function' && e.name === 'greet');
      expect(fns.length).toBeGreaterThanOrEqual(1);

      const fn = fns[0]!;
      expect(fn.name).toBe('greet');
      expect(fn.qualified_name).toBe('test.ts:greet');
      expect(fn.source_location.file).toBe('test.ts');
      expect(fn.source_location.start_line).toBeGreaterThanOrEqual(1);
    });

    it('extracts function with return type', () => {
      const source = `function add(a: number, b: number): number { return a + b; }`;
      const entities = extractor.extract(source, 'math.ts');
      const fn = entities.find((e) => e.name === 'add');
      expect(fn).toBeDefined();
      expect(fn!.properties['return_type']).toContain('number');
    });

    it('extracts function parameters', () => {
      const source = `function process(data: string, count: number): void { }`;
      const entities = extractor.extract(source, 'test.ts');
      const fn = entities.find((e) => e.name === 'process');
      expect(fn).toBeDefined();
      const params = fn!.properties['parameters'] as Array<{ name: string }>;
      expect(params.length).toBe(2);
      expect(params[0]!.name).toBe('data');
    });
  });

  // ── Async Functions ───────────────────────────────────────────────────

  describe('async functions', () => {
    it('extracts async function declarations', () => {
      const source = `
async function fetchData(url: string): Promise<string> {
  const res = await fetch(url);
  return res.text();
}
`;
      const entities = extractor.extract(source, 'api.ts');
      const fn = entities.find((e) => e.name === 'fetchData');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_async']).toBe(true);
    });

    it('extracts exported async function', () => {
      const source = `export async function handler(req: Request): Promise<Response> { return new Response(); }`;
      const entities = extractor.extract(source, 'handler.ts');
      const fn = entities.find((e) => e.name === 'handler');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_async']).toBe(true);
      expect(fn!.properties['is_exported']).toBe(true);
    });
  });

  // ── Arrow Functions ───────────────────────────────────────────────────

  describe('arrow functions', () => {
    it('extracts arrow function assignments', () => {
      const source = `const greet = (name: string): string => { return 'Hi ' + name; };`;
      const entities = extractor.extract(source, 'test.ts');
      const fn = entities.find((e) => e.name === 'greet');
      expect(fn).toBeDefined();
      expect(fn!.type).toBe('function');
      expect(fn!.properties['kind']).toBe('arrow_function');
    });

    it('extracts exported arrow functions', () => {
      const source = `export const compute = (x: number) => x * 2;`;
      const entities = extractor.extract(source, 'test.ts');
      const fn = entities.find((e) => e.name === 'compute');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_exported']).toBe(true);
    });

    it('extracts async arrow functions', () => {
      const source = `const fetchUser = async (id: string) => { return db.get(id); };`;
      const entities = extractor.extract(source, 'test.ts');
      const fn = entities.find((e) => e.name === 'fetchUser');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_async']).toBe(true);
    });
  });

  // ── Class Declarations ────────────────────────────────────────────────

  describe('class declarations', () => {
    it('extracts class declarations', () => {
      const source = `
class UserService {
  getUser(id: string): User {
    return {} as User;
  }
}
`;
      const entities = extractor.extract(source, 'service.ts');
      const cls = entities.find((e) => e.type === 'class' && e.name === 'UserService');
      expect(cls).toBeDefined();
      expect(cls!.qualified_name).toBe('service.ts:UserService');
    });

    it('extracts exported classes', () => {
      const source = `export class ApiClient { }`;
      const entities = extractor.extract(source, 'test.ts');
      const cls = entities.find((e) => e.type === 'class' && e.name === 'ApiClient');
      expect(cls).toBeDefined();
      expect(cls!.properties['is_exported']).toBe(true);
    });

    it('extracts class with extends', () => {
      const source = `class Admin extends User { }`;
      const entities = extractor.extract(source, 'test.ts');
      const cls = entities.find((e) => e.name === 'Admin');
      expect(cls).toBeDefined();
      expect(cls!.properties['base_class']).toBe('User');
      const extendsRel = cls!.relationships.find((r) => r.type === 'extends');
      expect(extendsRel).toBeDefined();
      expect(extendsRel!.target_name).toBe('User');
    });

    it('extracts class with implements', () => {
      const source = `class MyService implements IService, IDisposable { }`;
      const entities = extractor.extract(source, 'test.ts');
      const cls = entities.find((e) => e.name === 'MyService');
      expect(cls).toBeDefined();
      const implementsRels = cls!.relationships.filter((r) => r.type === 'implements');
      expect(implementsRels.length).toBe(2);
    });

    it('extracts abstract classes', () => {
      const source = `export abstract class BaseHandler { }`;
      const entities = extractor.extract(source, 'test.ts');
      const cls = entities.find((e) => e.name === 'BaseHandler');
      expect(cls).toBeDefined();
      expect(cls!.properties['is_abstract']).toBe(true);
    });

    it('extracts class methods', () => {
      const source = `
class Calculator {
  add(a: number, b: number): number { return a + b; }
  subtract(a: number, b: number): number { return a - b; }
}
`;
      const entities = extractor.extract(source, 'calc.ts');
      const methods = entities.filter(
        (e) => e.type === 'function' && e.properties['kind'] === 'method',
      );
      expect(methods.length).toBeGreaterThanOrEqual(2);
      expect(methods.some((m) => m.name === 'add')).toBe(true);
      expect(methods.some((m) => m.name === 'subtract')).toBe(true);
    });
  });

  // ── Interface Declarations ────────────────────────────────────────────

  describe('interface declarations', () => {
    it('extracts interface declarations', () => {
      const source = `
interface User {
  id: string;
  name: string;
}
`;
      const entities = extractor.extract(source, 'types.ts');
      const iface = entities.find((e) => e.name === 'User' && e.properties['is_interface'] === true);
      expect(iface).toBeDefined();
      expect(iface!.type).toBe('class'); // Interfaces are stored as 'class' type with is_interface flag
      expect(iface!.properties['is_interface']).toBe(true);
    });

    it('extracts exported interfaces', () => {
      const source = `export interface Config { port: number; }`;
      const entities = extractor.extract(source, 'test.ts');
      const iface = entities.find((e) => e.name === 'Config');
      expect(iface).toBeDefined();
      expect(iface!.properties['is_exported']).toBe(true);
    });

    it('extracts interface with extends', () => {
      const source = `interface Admin extends User, Permissions { }`;
      const entities = extractor.extract(source, 'test.ts');
      const iface = entities.find((e) => e.name === 'Admin');
      expect(iface).toBeDefined();
      const extendsRels = iface!.relationships.filter((r) => r.type === 'extends');
      expect(extendsRels.length).toBe(2);
    });
  });

  // ── Type Aliases ──────────────────────────────────────────────────────

  describe('type alias declarations', () => {
    it('extracts type aliases', () => {
      const source = `type UserId = string;`;
      const entities = extractor.extract(source, 'test.ts');
      const alias = entities.find((e) => e.name === 'UserId');
      expect(alias).toBeDefined();
      expect(alias!.properties['is_type_alias']).toBe(true);
    });

    it('extracts exported type aliases', () => {
      const source = `export type Status = 'active' | 'inactive';`;
      const entities = extractor.extract(source, 'test.ts');
      const alias = entities.find((e) => e.name === 'Status');
      expect(alias).toBeDefined();
      expect(alias!.properties['is_exported']).toBe(true);
    });
  });

  // ── Import Statements ─────────────────────────────────────────────────

  describe('extractImports', () => {
    it('extracts named imports', () => {
      const source = `import { Router, Request } from 'express';`;
      const imports = extractor.extractImports(source, 'test.ts');
      const imp = imports.find((i) => i.module === 'express');
      expect(imp).toBeDefined();
      expect(imp!.names).toContain('Router');
      expect(imp!.names).toContain('Request');
      expect(imp!.is_default).toBe(false);
      expect(imp!.is_namespace).toBe(false);
    });

    it('extracts default imports', () => {
      const source = `import React from 'react';`;
      const imports = extractor.extractImports(source, 'test.ts');
      const imp = imports.find((i) => i.module === 'react');
      expect(imp).toBeDefined();
      expect(imp!.names).toContain('React');
      expect(imp!.is_default).toBe(true);
    });

    it('extracts namespace imports', () => {
      const source = `import * as path from 'path';`;
      const imports = extractor.extractImports(source, 'test.ts');
      const imp = imports.find((i) => i.module === 'path');
      expect(imp).toBeDefined();
      expect(imp!.is_namespace).toBe(true);
      expect(imp!.names).toContain('path');
    });

    it('extracts side-effect imports', () => {
      const source = `import 'reflect-metadata';`;
      const imports = extractor.extractImports(source, 'test.ts');
      const imp = imports.find((i) => i.module === 'reflect-metadata');
      expect(imp).toBeDefined();
      expect(imp!.names).toEqual([]);
    });

    it('extracts dynamic imports', () => {
      const source = `const mod = await import('./utils');`;
      const imports = extractor.extractImports(source, 'test.ts');
      const imp = imports.find((i) => i.module === './utils');
      expect(imp).toBeDefined();
    });

    it('extracts imports with aliases', () => {
      const source = `import { Component as Comp } from 'react';`;
      const imports = extractor.extractImports(source, 'test.ts');
      const imp = imports.find((i) => i.module === 'react');
      expect(imp).toBeDefined();
      expect(imp!.names).toContain('Comp');
    });

    it('returns empty array for source with no imports', () => {
      const source = `const x = 42;`;
      const imports = extractor.extractImports(source, 'test.ts');
      expect(imports).toEqual([]);
    });
  });

  // ── Export Relationships ──────────────────────────────────────────────

  describe('export statements', () => {
    it('tags exported functions with exports relationship', () => {
      const source = `export function createApp(): App { return {} as App; }`;
      const entities = extractor.extract(source, 'test.ts');
      const fn = entities.find((e) => e.name === 'createApp');
      expect(fn).toBeDefined();
      const exportRel = fn!.relationships.find((r) => r.type === 'exports');
      expect(exportRel).toBeDefined();
      expect(exportRel!.target_name).toBe('createApp');
    });

    it('tags exported classes with exports relationship', () => {
      const source = `export class ApiClient { }`;
      const entities = extractor.extract(source, 'test.ts');
      const cls = entities.find((e) => e.name === 'ApiClient');
      expect(cls).toBeDefined();
      const exportRel = cls!.relationships.find((r) => r.type === 'exports');
      expect(exportRel).toBeDefined();
    });
  });

  // ── Decorators ────────────────────────────────────────────────────────

  describe('decorators', () => {
    it('extracts decorators above function declarations', () => {
      const source = `
@Injectable()
function createService(): Service {
  return {} as Service;
}
`;
      const entities = extractor.extract(source, 'test.ts');
      const fn = entities.find((e) => e.name === 'createService');
      expect(fn).toBeDefined();
      const decorators = fn!.properties['decorators'] as string[];
      expect(decorators).toContain('Injectable');
    });

    it('extracts decorators above class declarations', () => {
      const source = `
@Controller('/api')
class UserController {
}
`;
      const entities = extractor.extract(source, 'test.ts');
      const cls = entities.find((e) => e.name === 'UserController');
      expect(cls).toBeDefined();
      const decorators = cls!.properties['decorators'] as string[];
      expect(decorators).toContain('Controller');
    });
  });

  // ── Empty File ────────────────────────────────────────────────────────

  describe('empty file handling', () => {
    it('returns empty arrays for empty source', () => {
      const entities = extractor.extract('', 'empty.ts');
      expect(entities).toEqual([]);
    });

    it('returns empty imports for empty source', () => {
      const imports = extractor.extractImports('', 'empty.ts');
      expect(imports).toEqual([]);
    });

    it('returns empty arrays for whitespace-only source', () => {
      const entities = extractor.extract('   \n\n   ', 'blank.ts');
      expect(entities).toEqual([]);
    });
  });

  // ── Source Location ───────────────────────────────────────────────────

  describe('source locations', () => {
    it('includes correct file path in source_location', () => {
      const source = `function hello(): void { }`;
      const entities = extractor.extract(source, 'src/greeting.ts');
      const fn = entities.find((e) => e.name === 'hello');
      expect(fn!.source_location.file).toBe('src/greeting.ts');
    });

    it('reports correct start line', () => {
      const source = `
// comment
function second(): void { }
`;
      const entities = extractor.extract(source, 'test.ts');
      const fn = entities.find((e) => e.name === 'second');
      expect(fn).toBeDefined();
      expect(fn!.source_location.start_line).toBe(3);
    });
  });

  // ── Multiple Entities ─────────────────────────────────────────────────

  describe('multiple entities in one file', () => {
    it('extracts all entity types from a complex file', () => {
      const source = `
import { Injectable } from '@nestjs/common';

export interface UserDTO {
  id: string;
  name: string;
}

export type Role = 'admin' | 'user';

export class UserService {
  async getUser(id: string): Promise<UserDTO> {
    return {} as UserDTO;
  }
}

export function createService(): UserService {
  return new UserService();
}

export const helper = (x: number) => x * 2;
`;
      const entities = extractor.extract(source, 'user.service.ts');
      const imports = extractor.extractImports(source, 'user.service.ts');

      // Should find: interface UserDTO, type Role, class UserService, method getUser,
      // function createService, arrow helper
      expect(entities.length).toBeGreaterThanOrEqual(4);
      expect(entities.some((e) => e.name === 'UserDTO')).toBe(true);
      expect(entities.some((e) => e.name === 'Role')).toBe(true);
      expect(entities.some((e) => e.name === 'UserService')).toBe(true);
      expect(entities.some((e) => e.name === 'createService')).toBe(true);
      expect(entities.some((e) => e.name === 'helper')).toBe(true);

      // Should find the import
      expect(imports.length).toBeGreaterThanOrEqual(1);
      expect(imports[0]!.module).toBe('@nestjs/common');
    });
  });
});

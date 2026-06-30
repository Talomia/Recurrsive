/**
 * @module __tests__/extractors/go
 *
 * Comprehensive tests for the GoExtractor class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GoExtractor } from '../../extractors/go.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GoExtractor', () => {
  let extractor: GoExtractor;

  beforeEach(() => {
    extractor = new GoExtractor();
  });

  it('has correct language and extensions', () => {
    expect(extractor.language).toBe('go');
    expect(extractor.extensions).toContain('go');
  });

  // ── Package Declarations ──────────────────────────────────────────────

  describe('package declarations', () => {
    it('extracts main package', () => {
      const source = `package main

func main() {
	fmt.Println("hello")
}
`;
      const entities = extractor.extract(source, 'main.go');
      const pkg = entities.find((e) => e.type === 'module' && e.name === 'main');
      expect(pkg).toBeDefined();
      expect(pkg!.qualified_name).toBe('main.go:main');
      expect(pkg!.properties['language']).toBe('go');
      expect(pkg!.properties['declaration']).toBe('package');
    });

    it('extracts named package', () => {
      const source = `package api
`;
      const entities = extractor.extract(source, 'api/handler.go');
      const pkg = entities.find((e) => e.type === 'module');
      expect(pkg).toBeDefined();
      expect(pkg!.name).toBe('api');
    });
  });

  // ── Function Definitions ──────────────────────────────────────────────

  describe('function definitions', () => {
    it('extracts simple function', () => {
      const source = `package main

func greet(name string) {
	fmt.Println("Hello, " + name)
}
`;
      const entities = extractor.extract(source, 'main.go');
      const fn = entities.find((e) => e.type === 'function' && e.name === 'greet');
      expect(fn).toBeDefined();
      expect(fn!.qualified_name).toBe('main.go:greet');
      expect(fn!.properties['parameters']).toBe('name string');
      expect(fn!.properties['is_method']).toBe(false);
    });

    it('detects exported functions (capitalized)', () => {
      const source = `package handlers

func HandleRequest(w http.ResponseWriter, r *http.Request) {
	w.Write([]byte("ok"))
}
`;
      const entities = extractor.extract(source, 'handlers.go');
      const fn = entities.find((e) => e.name === 'HandleRequest');
      expect(fn).toBeDefined();
      expect(fn!.properties['exported']).toBe(true);
    });

    it('detects unexported functions (lowercase)', () => {
      const source = `package utils

func helperFunc() {
	// internal
}
`;
      const entities = extractor.extract(source, 'utils.go');
      const fn = entities.find((e) => e.name === 'helperFunc');
      expect(fn).toBeDefined();
      expect(fn!.properties['exported']).toBe(false);
    });

    it('extracts function with return type', () => {
      const source = `package math

func Add(a int, b int) int {
	return a + b
}
`;
      const entities = extractor.extract(source, 'math.go');
      const fn = entities.find((e) => e.name === 'Add');
      expect(fn).toBeDefined();
      expect(fn!.properties['return_type']).toBe('int');
    });

    it('extracts function with multiple return types', () => {
      const source = `package io

func ReadFile(path string) ([]byte, error) {
	return nil, nil
}
`;
      const entities = extractor.extract(source, 'io.go');
      const fn = entities.find((e) => e.name === 'ReadFile');
      expect(fn).toBeDefined();
      expect(fn!.properties['return_type']).toBe('([]byte, error)');
    });

    it('detects init functions', () => {
      const source = `package db

func init() {
	connect()
}
`;
      const entities = extractor.extract(source, 'db.go');
      const fn = entities.find((e) => e.name === 'init');
      expect(fn).toBeDefined();
      expect(fn!.properties['is_init']).toBe(true);
    });
  });

  // ── Method Definitions ────────────────────────────────────────────────

  describe('method definitions', () => {
    it('extracts method with pointer receiver', () => {
      const source = `package models

func (u *User) Validate() error {
	if u.Name == "" {
		return errors.New("name required")
	}
	return nil
}
`;
      const entities = extractor.extract(source, 'models/user.go');
      const method = entities.find((e) => e.type === 'function' && e.name === 'Validate');
      expect(method).toBeDefined();
      expect(method!.properties['is_method']).toBe(true);
      expect(method!.properties['receiver']).toBe('u *User');
      expect(method!.properties['receiver_type']).toBe('User');
      expect(method!.properties['return_type']).toBe('error');
      expect(method!.qualified_name).toBe('models/user.go:User.Validate');
    });

    it('extracts method with value receiver', () => {
      const source = `package models

func (u User) String() string {
	return u.Name
}
`;
      const entities = extractor.extract(source, 'models/user.go');
      const method = entities.find((e) => e.name === 'String');
      expect(method).toBeDefined();
      expect(method!.properties['is_method']).toBe(true);
      expect(method!.properties['receiver']).toBe('u User');
      expect(method!.properties['receiver_type']).toBe('User');
    });

    it('creates implements relationship to receiver type', () => {
      const source = `package models

func (s *Server) Start() {
	s.running = true
}
`;
      const entities = extractor.extract(source, 'server.go');
      const method = entities.find((e) => e.name === 'Start');
      expect(method).toBeDefined();
      const implRel = method!.relationships.find((r) => r.type === 'implements');
      expect(implRel).toBeDefined();
      expect(implRel!.target_name).toBe('Server');
    });
  });

  // ── Struct Definitions ────────────────────────────────────────────────

  describe('struct definitions', () => {
    it('extracts struct with fields', () => {
      const source = `package models

type User struct {
	Name  string
	Email string
	Age   int
}
`;
      const entities = extractor.extract(source, 'models.go');
      const s = entities.find((e) => e.type === 'class' && e.name === 'User');
      expect(s).toBeDefined();
      expect(s!.properties['kind']).toBe('struct');
      expect(s!.properties['exported']).toBe(true);
      expect(s!.properties['field_count']).toBe(3);
    });

    it('extracts unexported struct', () => {
      const source = `package internal

type config struct {
	host string
	port int
}
`;
      const entities = extractor.extract(source, 'internal.go');
      const s = entities.find((e) => e.name === 'config');
      expect(s).toBeDefined();
      expect(s!.properties['exported']).toBe(false);
    });

    it('detects embedded types in structs', () => {
      const source = `package models

type Admin struct {
	User
	Level int
}
`;
      const entities = extractor.extract(source, 'models.go');
      const s = entities.find((e) => e.name === 'Admin');
      expect(s).toBeDefined();
      const extendsRel = s!.relationships.find((r) => r.type === 'extends');
      expect(extendsRel).toBeDefined();
      expect(extendsRel!.target_name).toBe('User');
    });

    it('extracts empty struct', () => {
      const source = `package sync

type Mutex struct {
}
`;
      const entities = extractor.extract(source, 'sync.go');
      const s = entities.find((e) => e.name === 'Mutex');
      expect(s).toBeDefined();
      expect(s!.properties['field_count']).toBe(0);
    });
  });

  // ── Interface Definitions ─────────────────────────────────────────────

  describe('interface definitions', () => {
    it('extracts interface with method signatures', () => {
      const source = `package io

type Reader interface {
	Read(p []byte) (n int, err error)
}
`;
      const entities = extractor.extract(source, 'io.go');
      const iface = entities.find((e) => e.type === 'class' && e.name === 'Reader');
      expect(iface).toBeDefined();
      expect(iface!.properties['kind']).toBe('interface');
      expect(iface!.properties['exported']).toBe(true);
      const methods = iface!.properties['method_signatures'] as string[];
      expect(methods.length).toBe(1);
      expect(methods[0]).toContain('Read');
    });

    it('detects embedded interfaces', () => {
      const source = `package io

type ReadWriter interface {
	Reader
	Writer
}
`;
      const entities = extractor.extract(source, 'io.go');
      const iface = entities.find((e) => e.name === 'ReadWriter');
      expect(iface).toBeDefined();
      const extendsRels = iface!.relationships.filter((r) => r.type === 'extends');
      expect(extendsRels.length).toBe(2);
      expect(extendsRels.map((r) => r.target_name)).toContain('Reader');
      expect(extendsRels.map((r) => r.target_name)).toContain('Writer');
    });

    it('extracts empty interface', () => {
      const source = `package types

type Any interface {
}
`;
      const entities = extractor.extract(source, 'types.go');
      const iface = entities.find((e) => e.name === 'Any');
      expect(iface).toBeDefined();
      expect(iface!.properties['kind']).toBe('interface');
    });
  });

  // ── Import Extraction ─────────────────────────────────────────────────

  describe('import extraction', () => {
    it('extracts single import', () => {
      const source = `package main

import "fmt"
`;
      const imports = extractor.extractImports(source, 'main.go');
      expect(imports.length).toBe(1);
      expect(imports[0]!.module).toBe('fmt');
      expect(imports[0]!.names).toContain('fmt');
    });

    it('extracts grouped imports', () => {
      const source = `package main

import (
	"fmt"
	"net/http"
	"os"
)
`;
      const imports = extractor.extractImports(source, 'main.go');
      expect(imports.length).toBe(3);
      const modules = imports.map((i) => i.module);
      expect(modules).toContain('fmt');
      expect(modules).toContain('net/http');
      expect(modules).toContain('os');
    });

    it('extracts aliased import', () => {
      const source = `package main

import myhttp "net/http"
`;
      const imports = extractor.extractImports(source, 'main.go');
      expect(imports.length).toBe(1);
      expect(imports[0]!.module).toBe('net/http');
      expect(imports[0]!.names).toContain('myhttp');
    });

    it('extracts dot import as namespace', () => {
      const source = `package test

import . "testing"
`;
      const imports = extractor.extractImports(source, 'test.go');
      expect(imports.length).toBe(1);
      expect(imports[0]!.is_namespace).toBe(true);
    });

    it('extracts aliased imports in grouped block', () => {
      const source = `package main

import (
	"fmt"
	log "github.com/sirupsen/logrus"
)
`;
      const imports = extractor.extractImports(source, 'main.go');
      expect(imports.length).toBe(2);
      const logImport = imports.find((i) => i.module === 'github.com/sirupsen/logrus');
      expect(logImport).toBeDefined();
      expect(logImport!.names).toContain('log');
    });

    it('returns short package name from path', () => {
      const source = `package main

import "github.com/gorilla/mux"
`;
      const imports = extractor.extractImports(source, 'main.go');
      expect(imports.length).toBe(1);
      expect(imports[0]!.names).toContain('mux');
    });
  });

  // ── Constants and Variables ───────────────────────────────────────────

  describe('constants and variables', () => {
    it('extracts single constant', () => {
      const source = `package config

const MaxRetries = 3
`;
      const entities = extractor.extract(source, 'config.go');
      const c = entities.find((e) => e.type === 'variable' && e.name === 'MaxRetries');
      expect(c).toBeDefined();
      expect(c!.properties['kind']).toBe('constant');
      expect(c!.properties['exported']).toBe(true);
      expect(c!.properties['value']).toBe('3');
    });

    it('extracts typed constant', () => {
      const source = `package config

const DefaultHost string = "localhost"
`;
      const entities = extractor.extract(source, 'config.go');
      const c = entities.find((e) => e.name === 'DefaultHost');
      expect(c).toBeDefined();
      expect(c!.properties['const_type']).toBe('string');
    });

    it('extracts grouped constants', () => {
      const source = `package status

const (
	StatusOK    = 200
	StatusError = 500
)
`;
      const entities = extractor.extract(source, 'status.go');
      const consts = entities.filter(
        (e) => e.type === 'variable' && e.properties['kind'] === 'constant',
      );
      expect(consts.length).toBe(2);
      expect(consts.map((c) => c.name)).toContain('StatusOK');
      expect(consts.map((c) => c.name)).toContain('StatusError');
    });

    it('extracts single variable', () => {
      const source = `package db

var connection *sql.DB
`;
      const entities = extractor.extract(source, 'db.go');
      const v = entities.find((e) => e.type === 'variable' && e.name === 'connection');
      expect(v).toBeDefined();
      expect(v!.properties['kind']).toBe('variable');
      expect(v!.properties['exported']).toBe(false);
    });
  });

  // ── Type Aliases ──────────────────────────────────────────────────────

  describe('type aliases', () => {
    it('extracts type alias', () => {
      const source = `package types

type UserID string
`;
      const entities = extractor.extract(source, 'types.go');
      const t = entities.find((e) => e.name === 'UserID');
      expect(t).toBeDefined();
      expect(t!.properties['kind']).toBe('type_alias');
      expect(t!.properties['underlying_type']).toBe('string');
      expect(t!.properties['exported']).toBe(true);
    });
  });

  // ── Edge Cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty file', () => {
      const entities = extractor.extract('', 'empty.go');
      expect(entities).toEqual([]);
    });

    it('handles file with only package declaration', () => {
      const source = `package main
`;
      const entities = extractor.extract(source, 'main.go');
      expect(entities.length).toBe(1);
      expect(entities[0]!.type).toBe('module');
    });

    it('handles file with no imports', () => {
      const imports = extractor.extractImports('package main\n', 'main.go');
      expect(imports).toEqual([]);
    });

    it('handles complex Go file with multiple constructs', () => {
      const source = `package server

import (
	"fmt"
	"net/http"
)

const DefaultPort = 8080

type Server struct {
	Port int
	Host string
}

type Handler interface {
	ServeHTTP(w http.ResponseWriter, r *http.Request)
}

func NewServer(host string, port int) *Server {
	return &Server{Host: host, Port: port}
}

func (s *Server) Start() error {
	addr := fmt.Sprintf("%s:%d", s.Host, s.Port)
	return http.ListenAndServe(addr, nil)
}

func init() {
	fmt.Println("server package initialized")
}
`;
      const entities = extractor.extract(source, 'server.go');
      const imports = extractor.extractImports(source, 'server.go');

      // Package
      expect(entities.find((e) => e.type === 'module')).toBeDefined();
      // Constant
      expect(entities.find((e) => e.name === 'DefaultPort')).toBeDefined();
      // Struct
      expect(entities.find((e) => e.name === 'Server' && e.properties['kind'] === 'struct')).toBeDefined();
      // Interface
      expect(entities.find((e) => e.name === 'Handler' && e.properties['kind'] === 'interface')).toBeDefined();
      // Function
      expect(entities.find((e) => e.name === 'NewServer')).toBeDefined();
      // Method
      const start = entities.find((e) => e.name === 'Start');
      expect(start).toBeDefined();
      expect(start!.properties['is_method']).toBe(true);
      // Init
      expect(entities.find((e) => e.name === 'init' && e.properties['is_init'] === true)).toBeDefined();
      // Imports
      expect(imports.length).toBe(2);
    });
  });
});

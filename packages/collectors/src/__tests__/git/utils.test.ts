/**
 * @module __tests__/git/utils
 *
 * Comprehensive tests for Git collector utility functions:
 * detectLanguage, isBinaryFile, isSourceFile, parsePackageJson,
 * parsePyprojectToml, parseGoMod, detectFrameworks, detectAIProviders.
 */

import { describe, it, expect } from 'vitest';
import {
  detectLanguage,
  isBinaryFile,
  isSourceFile,
  isLockfile,
  parsePackageJson,
  parsePyprojectToml,
  parseGoMod,
  detectFrameworks,
  detectAIProviders,
} from '../../git/utils.js';
import type { DependencyInfo, FileInfo } from '../../git/utils.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Git Utils', () => {
  // ── detectLanguage ────────────────────────────────────────────────────

  describe('detectLanguage', () => {
    it('maps .ts to TypeScript', () => {
      expect(detectLanguage('src/index.ts')).toBe('TypeScript');
    });

    it('maps .tsx to TypeScript', () => {
      expect(detectLanguage('App.tsx')).toBe('TypeScript');
    });

    it('maps .js to JavaScript', () => {
      expect(detectLanguage('utils.js')).toBe('JavaScript');
    });

    it('maps .jsx to JavaScript', () => {
      expect(detectLanguage('Component.jsx')).toBe('JavaScript');
    });

    it('maps .py to Python', () => {
      expect(detectLanguage('main.py')).toBe('Python');
    });

    it('maps .go to Go', () => {
      expect(detectLanguage('main.go')).toBe('Go');
    });

    it('maps .rs to Rust', () => {
      expect(detectLanguage('lib.rs')).toBe('Rust');
    });

    it('maps .java to Java', () => {
      expect(detectLanguage('Main.java')).toBe('Java');
    });

    it('maps .cs to C#', () => {
      expect(detectLanguage('Program.cs')).toBe('C#');
    });

    it('maps .rb to Ruby', () => {
      expect(detectLanguage('server.rb')).toBe('Ruby');
    });

    it('maps .php to PHP', () => {
      expect(detectLanguage('index.php')).toBe('PHP');
    });

    it('maps .swift to Swift', () => {
      expect(detectLanguage('App.swift')).toBe('Swift');
    });

    it('maps .kt to Kotlin', () => {
      expect(detectLanguage('Main.kt')).toBe('Kotlin');
    });

    it('maps .dart to Dart', () => {
      expect(detectLanguage('main.dart')).toBe('Dart');
    });

    it('maps .sql to SQL', () => {
      expect(detectLanguage('schema.sql')).toBe('SQL');
    });

    it('maps .yaml to YAML', () => {
      expect(detectLanguage('config.yaml')).toBe('YAML');
    });

    it('maps .yml to YAML', () => {
      expect(detectLanguage('docker-compose.yml')).toBe('YAML');
    });

    it('maps .json to JSON', () => {
      expect(detectLanguage('package.json')).toBe('JSON');
    });

    it('maps .md to Markdown', () => {
      expect(detectLanguage('README.md')).toBe('Markdown');
    });

    it('maps .graphql to GraphQL', () => {
      expect(detectLanguage('schema.graphql')).toBe('GraphQL');
    });

    it('maps .sh to Shell', () => {
      expect(detectLanguage('deploy.sh')).toBe('Shell');
    });

    it('maps .html to HTML', () => {
      expect(detectLanguage('index.html')).toBe('HTML');
    });

    it('maps .css to CSS', () => {
      expect(detectLanguage('style.css')).toBe('CSS');
    });

    it('maps .vue to Vue', () => {
      expect(detectLanguage('App.vue')).toBe('Vue');
    });

    it('maps .svelte to Svelte', () => {
      expect(detectLanguage('Page.svelte')).toBe('Svelte');
    });

    it('maps .tf to Terraform', () => {
      expect(detectLanguage('main.tf')).toBe('Terraform');
    });

    it('maps .scala to Scala', () => {
      expect(detectLanguage('Main.scala')).toBe('Scala');
    });

    it('detects Dockerfile by name', () => {
      expect(detectLanguage('Dockerfile')).toBe('Dockerfile');
    });

    it('detects Dockerfile variants (e.g. Dockerfile.prod)', () => {
      expect(detectLanguage('Dockerfile.prod')).toBe('Dockerfile');
    });

    it('detects Makefile by name', () => {
      expect(detectLanguage('Makefile')).toBe('Makefile');
    });

    it('detects Gemfile by name', () => {
      expect(detectLanguage('Gemfile')).toBe('Ruby');
    });

    it('detects .gitignore', () => {
      expect(detectLanguage('.gitignore')).toBe('Git Config');
    });

    it('detects .env files', () => {
      expect(detectLanguage('.env')).toBe('Environment');
    });

    it('returns Unknown for unrecognized extensions', () => {
      expect(detectLanguage('data.parquet')).toBe('Unknown');
    });

    it('returns Unknown for files without extension', () => {
      expect(detectLanguage('some_binary')).toBe('Unknown');
    });

    it('handles paths with directories', () => {
      expect(detectLanguage('src/utils/helpers.ts')).toBe('TypeScript');
    });

    it('is case-insensitive for extensions', () => {
      expect(detectLanguage('file.PY')).toBe('Python');
      expect(detectLanguage('file.TS')).toBe('TypeScript');
    });
  });

  // ── isBinaryFile ──────────────────────────────────────────────────────

  describe('isBinaryFile', () => {
    it('detects image files as binary', () => {
      expect(isBinaryFile('photo.png')).toBe(true);
      expect(isBinaryFile('logo.jpg')).toBe(true);
      expect(isBinaryFile('icon.gif')).toBe(true);
      expect(isBinaryFile('image.webp')).toBe(true);
      expect(isBinaryFile('pic.svg')).toBe(true);
    });

    it('detects archive files as binary', () => {
      expect(isBinaryFile('archive.zip')).toBe(true);
      expect(isBinaryFile('release.tar')).toBe(true);
      expect(isBinaryFile('pkg.gz')).toBe(true);
    });

    it('detects executable files as binary', () => {
      expect(isBinaryFile('app.exe')).toBe(true);
      expect(isBinaryFile('lib.dll')).toBe(true);
      expect(isBinaryFile('lib.so')).toBe(true);
      expect(isBinaryFile('module.wasm')).toBe(true);
    });

    it('detects font files as binary', () => {
      expect(isBinaryFile('font.woff')).toBe(true);
      expect(isBinaryFile('font.woff2')).toBe(true);
      expect(isBinaryFile('font.ttf')).toBe(true);
    });

    it('detects document files as binary', () => {
      expect(isBinaryFile('report.pdf')).toBe(true);
      expect(isBinaryFile('sheet.xlsx')).toBe(true);
    });

    it('detects database files as binary', () => {
      expect(isBinaryFile('data.sqlite')).toBe(true);
      expect(isBinaryFile('data.db')).toBe(true);
    });

    it('detects lock files as binary', () => {
      expect(isBinaryFile('pnpm-lock.lock')).toBe(true);
    });

    it('returns false for source code files', () => {
      expect(isBinaryFile('index.ts')).toBe(false);
      expect(isBinaryFile('main.py')).toBe(false);
      expect(isBinaryFile('app.go')).toBe(false);
    });

    it('returns false for files without extension', () => {
      expect(isBinaryFile('Makefile')).toBe(false);
    });

    it('handles paths with directories', () => {
      expect(isBinaryFile('assets/images/logo.png')).toBe(true);
    });
  });

  // ── isLockfile ────────────────────────────────────────────────────────

  describe('isLockfile', () => {
    it('recognizes JS/TS lockfiles', () => {
      expect(isLockfile('package-lock.json')).toBe(true);
      expect(isLockfile('yarn.lock')).toBe(true);
      expect(isLockfile('pnpm-lock.yaml')).toBe(true);
      expect(isLockfile('bun.lockb')).toBe(true);
    });

    it('recognizes lockfiles from other ecosystems', () => {
      expect(isLockfile('Gemfile.lock')).toBe(true);
      expect(isLockfile('poetry.lock')).toBe(true);
      expect(isLockfile('composer.lock')).toBe(true);
      expect(isLockfile('Cargo.lock')).toBe(true);
      expect(isLockfile('go.sum')).toBe(true);
    });

    it('matches case-insensitively and handles directories', () => {
      expect(isLockfile('nested/dir/YARN.LOCK')).toBe(true);
      expect(isLockfile('backend/poetry.lock')).toBe(true);
    });

    it('returns false for non-lockfiles', () => {
      expect(isLockfile('package.json')).toBe(false);
      expect(isLockfile('index.ts')).toBe(false);
      expect(isLockfile('some.lock')).toBe(false);
    });
  });

  // ── isSourceFile ──────────────────────────────────────────────────────

  describe('isSourceFile', () => {
    it('recognizes TypeScript files as source', () => {
      expect(isSourceFile('index.ts')).toBe(true);
      expect(isSourceFile('App.tsx')).toBe(true);
    });

    it('recognizes JavaScript files as source', () => {
      expect(isSourceFile('index.js')).toBe(true);
      expect(isSourceFile('App.jsx')).toBe(true);
    });

    it('recognizes Python files as source', () => {
      expect(isSourceFile('main.py')).toBe(true);
    });

    it('recognizes Go files as source', () => {
      expect(isSourceFile('main.go')).toBe(true);
    });

    it('recognizes Dockerfile as source', () => {
      expect(isSourceFile('Dockerfile')).toBe(true);
      expect(isSourceFile('Dockerfile.prod')).toBe(true);
    });

    it('recognizes Makefile as source', () => {
      expect(isSourceFile('Makefile')).toBe(true);
    });

    it('returns false for binary files', () => {
      expect(isSourceFile('image.png')).toBe(false);
    });

    it('returns false for files without extension', () => {
      expect(isSourceFile('README')).toBe(false);
    });
  });

  // ── parsePackageJson ──────────────────────────────────────────────────

  describe('parsePackageJson', () => {
    it('extracts production dependencies', () => {
      const content = JSON.stringify({
        dependencies: {
          express: '^4.18.0',
          zod: '^3.21.0',
        },
      });

      const deps = parsePackageJson(content);
      expect(deps).toHaveLength(2);
      expect(deps.find((d) => d.name === 'express')).toEqual({
        name: 'express',
        version: '^4.18.0',
        dev: false,
        source: 'package.json',
      });
    });

    it('extracts dev dependencies', () => {
      const content = JSON.stringify({
        devDependencies: {
          vitest: '^2.0.0',
          typescript: '^5.5.0',
        },
      });

      const deps = parsePackageJson(content);
      expect(deps).toHaveLength(2);
      expect(deps.every((d) => d.dev === true)).toBe(true);
    });

    it('extracts both production and dev dependencies', () => {
      const content = JSON.stringify({
        dependencies: { express: '^4.0.0' },
        devDependencies: { vitest: '^2.0.0' },
      });

      const deps = parsePackageJson(content);
      expect(deps).toHaveLength(2);
      const prod = deps.find((d) => d.name === 'express');
      const dev = deps.find((d) => d.name === 'vitest');
      expect(prod!.dev).toBe(false);
      expect(dev!.dev).toBe(true);
    });

    it('returns empty array for package.json without dependencies', () => {
      const content = JSON.stringify({ name: 'my-package', version: '1.0.0' });
      const deps = parsePackageJson(content);
      expect(deps).toEqual([]);
    });

    it('throws on invalid JSON', () => {
      expect(() => parsePackageJson('not json')).toThrow();
    });
  });

  // ── parsePyprojectToml ────────────────────────────────────────────────

  describe('parsePyprojectToml', () => {
    it('extracts Poetry-style dependencies', () => {
      const content = `
[tool.poetry.dependencies]
python = "^3.11"
requests = "^2.28.0"
fastapi = "^0.100.0"

[tool.poetry.dev-dependencies]
pytest = "^7.0.0"
`;
      const deps = parsePyprojectToml(content);
      // python is filtered out
      const nonPython = deps.filter((d) => d.name !== 'python');
      expect(nonPython.length).toBeGreaterThanOrEqual(2);

      const requests = nonPython.find((d) => d.name === 'requests');
      expect(requests).toBeDefined();
      expect(requests!.version).toBe('^2.28.0');
      expect(requests!.dev).toBe(false);

      const pytest = nonPython.find((d) => d.name === 'pytest');
      expect(pytest).toBeDefined();
      expect(pytest!.dev).toBe(true);
    });

    it('extracts PEP 621 dependencies from the dependencies array', () => {
      const content = `
[project]
name = "my-app"
version = "1.0.0"
dependencies = [
  "requests>=2.28.0",
  "fastapi==0.100.0",
  "uvicorn[standard]>=0.23",
]
`;
      const deps = parsePyprojectToml(content);
      expect(deps.map((d) => d.name).sort()).toEqual(['fastapi', 'requests', 'uvicorn']);
      const requests = deps.find((d) => d.name === 'requests');
      expect(requests!.version).toBe('>=2.28.0');
      expect(requests!.dev).toBe(false);
    });

    it('extracts PEP 621 inline dependency arrays', () => {
      const content = `
[project]
dependencies = ["requests>=2.28", "httpx"]
`;
      const deps = parsePyprojectToml(content);
      expect(deps.map((d) => d.name).sort()).toEqual(['httpx', 'requests']);
    });

    it('does NOT treat other [project] arrays (keywords, classifiers, authors) as dependencies', () => {
      const content = `
[project]
name = "my-app"
keywords = ["ai", "openai", "agents"]
classifiers = [
  "Programming Language :: Python :: 3",
  "License :: OSI Approved :: MIT License",
]
authors = [
  { name = "Someone", email = "someone@example.com" },
]
dependencies = [
  "requests>=2.28.0",
]
`;
      const deps = parsePyprojectToml(content);
      // Only the real dependency — "ai"/"openai" keywords must never
      // become fake dependencies (which would fabricate AI providers).
      expect(deps.map((d) => d.name)).toEqual(['requests']);
    });

    it('extracts PEP 621 optional-dependency groups', () => {
      const content = `
[project.optional-dependencies]
dev = [
  "pytest>=7.0",
]
aws = ["boto3>=1.28"]
`;
      const deps = parsePyprojectToml(content);
      const pytest = deps.find((d) => d.name === 'pytest');
      const boto3 = deps.find((d) => d.name === 'boto3');
      expect(pytest).toBeDefined();
      expect(pytest!.dev).toBe(true);
      expect(boto3).toBeDefined();
      expect(boto3!.dev).toBe(false);
    });

    it('returns empty array for empty toml', () => {
      const deps = parsePyprojectToml('');
      expect(deps).toEqual([]);
    });

    it('skips comment lines', () => {
      const content = `
[tool.poetry.dependencies]
# This is a comment
requests = "^2.28.0"
`;
      const deps = parsePyprojectToml(content);
      expect(deps.some((d) => d.name === 'requests')).toBe(true);
    });
  });

  // ── parseGoMod ────────────────────────────────────────────────────────

  describe('parseGoMod', () => {
    it('extracts dependencies from require block', () => {
      const content = `
module github.com/example/myapp

go 1.21

require (
	github.com/gin-gonic/gin v1.9.1
	github.com/go-sql-driver/mysql v1.7.1
)
`;
      const deps = parseGoMod(content);
      expect(deps).toHaveLength(2);
      expect(deps[0]!.name).toBe('github.com/gin-gonic/gin');
      expect(deps[0]!.version).toBe('v1.9.1');
      expect(deps[0]!.source).toBe('go.mod');
    });

    it('extracts single-line require directives', () => {
      const content = `
module github.com/example/myapp

require github.com/some/pkg v1.0.0
`;
      const deps = parseGoMod(content);
      expect(deps).toHaveLength(1);
      expect(deps[0]!.name).toBe('github.com/some/pkg');
    });

    it('marks indirect dependencies', () => {
      const content = `
module github.com/example/myapp

require (
	github.com/pkg/errors v0.9.1 // indirect
)
`;
      const deps = parseGoMod(content);
      expect(deps).toHaveLength(1);
      expect(deps[0]!.dev).toBe(true); // indirect → dev
    });

    it('returns empty array for empty content', () => {
      const deps = parseGoMod('');
      expect(deps).toEqual([]);
    });
  });

  // ── detectFrameworks ──────────────────────────────────────────────────

  describe('detectFrameworks', () => {
    it('detects React from dependencies', () => {
      const deps: DependencyInfo[] = [
        { name: 'react', version: '^18.0.0', dev: false, source: 'package.json' },
      ];
      const frameworks = detectFrameworks([], deps);
      expect(frameworks).toContain('React');
    });

    it('detects Next.js from dependencies', () => {
      const deps: DependencyInfo[] = [
        { name: 'next', version: '^14.0.0', dev: false, source: 'package.json' },
      ];
      const frameworks = detectFrameworks([], deps);
      expect(frameworks).toContain('Next.js');
    });

    it('detects Express from dependencies', () => {
      const deps: DependencyInfo[] = [
        { name: 'express', version: '^4.18.0', dev: false, source: 'package.json' },
      ];
      const frameworks = detectFrameworks([], deps);
      expect(frameworks).toContain('Express');
    });

    it('detects frameworks from config file names', () => {
      const files: FileInfo[] = [
        { path: 'next.config.js', name: 'next.config.js', extension: '.js', sizeBytes: 100 },
      ];
      const frameworks = detectFrameworks(files, []);
      expect(frameworks).toContain('Next.js');
    });

    it('detects Django from config files', () => {
      const files: FileInfo[] = [
        { path: 'manage.py', name: 'manage.py', extension: '.py', sizeBytes: 200 },
      ];
      const frameworks = detectFrameworks(files, []);
      expect(frameworks).toContain('Django');
    });

    it('deduplicates frameworks', () => {
      const deps: DependencyInfo[] = [
        { name: 'next', version: '^14.0.0', dev: false, source: 'package.json' },
      ];
      const files: FileInfo[] = [
        { path: 'next.config.js', name: 'next.config.js', extension: '.js', sizeBytes: 100 },
      ];
      const frameworks = detectFrameworks(files, deps);
      const nextJsCount = frameworks.filter((f) => f === 'Next.js').length;
      expect(nextJsCount).toBe(1);
    });

    it('returns sorted array', () => {
      const deps: DependencyInfo[] = [
        { name: 'express', version: '^4.0.0', dev: false, source: 'package.json' },
        { name: 'react', version: '^18.0.0', dev: false, source: 'package.json' },
      ];
      const frameworks = detectFrameworks([], deps);
      expect(frameworks).toEqual([...frameworks].sort());
    });

    it('returns empty array when no frameworks detected', () => {
      const deps: DependencyInfo[] = [
        { name: 'lodash', version: '^4.0.0', dev: false, source: 'package.json' },
      ];
      const frameworks = detectFrameworks([], deps);
      expect(frameworks).toEqual([]);
    });
  });

  // ── detectAIProviders ─────────────────────────────────────────────────

  describe('detectAIProviders', () => {
    it('detects OpenAI from dependencies', () => {
      const deps: DependencyInfo[] = [
        { name: 'openai', version: '^4.0.0', dev: false, source: 'package.json' },
      ];
      const providers = detectAIProviders([], deps);
      expect(providers).toContain('OpenAI');
    });

    it('detects Anthropic from dependencies', () => {
      const deps: DependencyInfo[] = [
        { name: '@anthropic-ai/sdk', version: '^0.10.0', dev: false, source: 'package.json' },
      ];
      const providers = detectAIProviders([], deps);
      expect(providers).toContain('Anthropic');
    });

    it('detects LangChain from dependencies', () => {
      const deps: DependencyInfo[] = [
        { name: 'langchain', version: '^0.1.0', dev: false, source: 'package.json' },
      ];
      const providers = detectAIProviders([], deps);
      expect(providers).toContain('LangChain');
    });

    it('detects Google AI from dependencies', () => {
      const deps: DependencyInfo[] = [
        { name: '@google/generative-ai', version: '^0.1.0', dev: false, source: 'package.json' },
      ];
      const providers = detectAIProviders([], deps);
      expect(providers).toContain('Google AI');
    });

    it('detects HuggingFace from Python dependencies', () => {
      const deps: DependencyInfo[] = [
        { name: 'transformers', version: '^4.30.0', dev: false, source: 'pyproject.toml' },
      ];
      const providers = detectAIProviders([], deps);
      expect(providers).toContain('HuggingFace');
    });

    it('detects vector database providers', () => {
      const deps: DependencyInfo[] = [
        { name: '@pinecone-database/pinecone', version: '^1.0.0', dev: false, source: 'package.json' },
      ];
      const providers = detectAIProviders([], deps);
      expect(providers).toContain('Pinecone');
    });

    it('returns sorted array', () => {
      const deps: DependencyInfo[] = [
        { name: 'openai', version: '^4.0.0', dev: false, source: 'package.json' },
        { name: 'anthropic', version: '^0.1.0', dev: false, source: 'pyproject.toml' },
      ];
      const providers = detectAIProviders([], deps);
      expect(providers).toEqual([...providers].sort());
    });

    it('returns empty array when no AI providers detected', () => {
      const deps: DependencyInfo[] = [
        { name: 'express', version: '^4.0.0', dev: false, source: 'package.json' },
      ];
      const providers = detectAIProviders([], deps);
      expect(providers).toEqual([]);
    });

    it('deduplicates providers', () => {
      const deps: DependencyInfo[] = [
        { name: 'openai', version: '^4.0.0', dev: false, source: 'package.json' },
        { name: '@openai/api', version: '^1.0.0', dev: false, source: 'package.json' },
      ];
      const providers = detectAIProviders([], deps);
      const openaiCount = providers.filter((p) => p === 'OpenAI').length;
      expect(openaiCount).toBe(1);
    });
  });
});

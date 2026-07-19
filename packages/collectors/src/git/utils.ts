/**
 * @module @recurrsive/collectors/git/utils
 *
 * Utility functions for the Git collector — language detection,
 * file classification, dependency parsing, and framework/AI provider
 * detection.
 *
 * @packageDocumentation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Information about a single dependency extracted from a manifest file. */
export interface DependencyInfo {
  /** Package / module name. */
  name: string;
  /** Version constraint string (e.g. `'^3.24.0'`, `'v1.21'`). */
  version: string;
  /** Whether this is a development-only dependency. */
  dev: boolean;
  /** The source manifest file this was extracted from. */
  source: string;
}

/** Minimal file info used by detection utilities. */
export interface FileInfo {
  /** Absolute or repo-relative file path. */
  path: string;
  /** File name (basename). */
  name: string;
  /** File extension including the leading dot, or empty string. */
  extension: string;
  /** File size in bytes. */
  sizeBytes: number;
}

// ---------------------------------------------------------------------------
// Language Detection
// ---------------------------------------------------------------------------

/**
 * Map of file extensions to language names.
 * Covers the 20+ languages specified in the requirements.
 */
const EXTENSION_LANGUAGE_MAP: Readonly<Record<string, string>> = {
  // TypeScript / JavaScript
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.mts': 'TypeScript',
  '.cts': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  // Python
  '.py': 'Python',
  '.pyi': 'Python',
  '.pyw': 'Python',
  // Go
  '.go': 'Go',
  // Rust
  '.rs': 'Rust',
  // Java
  '.java': 'Java',
  // C#
  '.cs': 'C#',
  // C / C++
  '.c': 'C',
  '.h': 'C',
  '.cpp': 'C++',
  '.cxx': 'C++',
  '.cc': 'C++',
  '.hpp': 'C++',
  '.hxx': 'C++',
  // Ruby
  '.rb': 'Ruby',
  '.rake': 'Ruby',
  '.gemspec': 'Ruby',
  // PHP
  '.php': 'PHP',
  // Swift
  '.swift': 'Swift',
  // Kotlin
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  // Dart
  '.dart': 'Dart',
  // YAML
  '.yaml': 'YAML',
  '.yml': 'YAML',
  // JSON
  '.json': 'JSON',
  '.jsonc': 'JSON',
  '.json5': 'JSON',
  // Markdown
  '.md': 'Markdown',
  '.mdx': 'Markdown',
  '.markdown': 'Markdown',
  // SQL
  '.sql': 'SQL',
  // GraphQL
  '.graphql': 'GraphQL',
  '.gql': 'GraphQL',
  // Docker
  // note: Dockerfile is handled by name, not extension
  // Shell
  '.sh': 'Shell',
  '.bash': 'Shell',
  '.zsh': 'Shell',
  '.fish': 'Shell',
  // Other common
  '.toml': 'TOML',
  '.xml': 'XML',
  '.html': 'HTML',
  '.htm': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.sass': 'Sass',
  '.less': 'Less',
  '.vue': 'Vue',
  '.svelte': 'Svelte',
  '.proto': 'Protocol Buffers',
  '.tf': 'Terraform',
  '.hcl': 'HCL',
  '.r': 'R',
  '.R': 'R',
  '.lua': 'Lua',
  '.ex': 'Elixir',
  '.exs': 'Elixir',
  '.erl': 'Erlang',
  '.zig': 'Zig',
  '.nim': 'Nim',
  '.jl': 'Julia',
  '.scala': 'Scala',
  '.clj': 'Clojure',
  '.cljs': 'Clojure',
};

/**
 * Map of special filenames (no extension) to their language.
 */
const FILENAME_LANGUAGE_MAP: Readonly<Record<string, string>> = {
  Dockerfile: 'Dockerfile',
  Makefile: 'Makefile',
  Rakefile: 'Ruby',
  Gemfile: 'Ruby',
  Vagrantfile: 'Ruby',
  Justfile: 'Just',
  Containerfile: 'Dockerfile',
  '.gitignore': 'Git Config',
  '.dockerignore': 'Docker Config',
  '.editorconfig': 'EditorConfig',
  '.env': 'Environment',
  '.env.local': 'Environment',
  '.env.example': 'Environment',
};

/**
 * Detect the programming language of a file based on its extension
 * or filename.
 *
 * @param filePath - The file path (absolute or relative).
 * @returns The detected language name, or `'Unknown'` if unrecognised.
 *
 * @example
 * ```ts
 * detectLanguage('src/index.ts');       // 'TypeScript'
 * detectLanguage('Dockerfile');          // 'Dockerfile'
 * detectLanguage('data.parquet');        // 'Unknown'
 * ```
 */
export function detectLanguage(filePath: string): string {
  const basename = filePath.split('/').pop() ?? filePath;

  // Check exact filename first
  const byName = FILENAME_LANGUAGE_MAP[basename];
  if (byName) {
    return byName;
  }

  // Handle Dockerfile variants like "Dockerfile.prod"
  if (basename.startsWith('Dockerfile')) {
    return 'Dockerfile';
  }

  // Check extension
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex !== -1) {
    const ext = basename.slice(dotIndex).toLowerCase();
    const byExt = EXTENSION_LANGUAGE_MAP[ext];
    if (byExt) {
      return byExt;
    }
  }

  return 'Unknown';
}

// ---------------------------------------------------------------------------
// File Classification
// ---------------------------------------------------------------------------

/** Extensions that are typically source code and should be analyzed. */
const SOURCE_EXTENSIONS = new Set<string>([
  '.ts', '.tsx', '.mts', '.cts',
  '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.pyi',
  '.go',
  '.rs',
  '.java',
  '.cs',
  '.c', '.h', '.cpp', '.cxx', '.cc', '.hpp', '.hxx',
  '.rb', '.rake',
  '.php',
  '.swift',
  '.kt', '.kts',
  '.dart',
  '.sql',
  '.graphql', '.gql',
  '.sh', '.bash', '.zsh',
  '.vue', '.svelte',
  '.ex', '.exs',
  '.erl',
  '.scala',
  '.clj', '.cljs',
  '.r',
  '.lua',
  '.zig',
  '.nim',
  '.jl',
  '.proto',
  '.tf', '.hcl',
]);

/** Extensions that represent binary (non-text) files. */
const BINARY_EXTENSIONS = new Set<string>([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp', '.avif', '.tiff',
  // Audio / Video
  '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv', '.flac', '.ogg', '.webm',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar', '.xz', '.zst',
  // Executables / Libraries
  '.exe', '.dll', '.so', '.dylib', '.a', '.o', '.obj', '.lib',
  '.class', '.pyc', '.pyo', '.wasm',
  // Fonts
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  // Documents
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Data
  '.sqlite', '.db', '.parquet', '.arrow', '.feather',
  // Misc
  '.lock', '.DS_Store',
]);

/**
 * Check whether a file is analyzable source code.
 *
 * @param filePath - The file path to check.
 * @returns `true` if the file is a source code file.
 */
export function isSourceFile(filePath: string): boolean {
  const basename = filePath.split('/').pop() ?? filePath;

  // Special filenames that are source
  if (basename === 'Dockerfile' || basename.startsWith('Dockerfile.')) {
    return true;
  }
  if (basename === 'Makefile' || basename === 'Rakefile' || basename === 'Gemfile') {
    return true;
  }

  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex === -1) {
    return false;
  }

  const ext = basename.slice(dotIndex).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

/**
 * Dependency lockfiles that pin exact resolved versions. These are worth
 * tracking as `file` entities so analyzers can reason about lockfile presence
 * (e.g. the "missing lockfile" supply-chain check), even though some of them
 * (`*.lock`, `bun.lockb`) are otherwise classified as binary/non-source.
 */
const LOCKFILE_NAMES: ReadonlySet<string> = new Set<string>([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
  'gemfile.lock',
  'poetry.lock',
  'pdm.lock',
  'pipfile.lock',
  'composer.lock',
  'cargo.lock',
  'go.sum',
]);

/**
 * Check whether a file is a dependency lockfile.
 *
 * Matching is case-insensitive on the basename so `Gemfile.lock` and
 * `Cargo.lock` are recognised regardless of platform casing.
 *
 * @param filePath - The file path to check.
 * @returns `true` if the file is a recognised dependency lockfile.
 */
export function isLockfile(filePath: string): boolean {
  const basename = (filePath.split('/').pop() ?? filePath).toLowerCase();
  return LOCKFILE_NAMES.has(basename);
}

/**
 * Check whether a file is a binary (non-text) file.
 *
 * @param filePath - The file path to check.
 * @returns `true` if the file extension indicates binary content.
 */
export function isBinaryFile(filePath: string): boolean {
  const basename = filePath.split('/').pop() ?? filePath;
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex === -1) {
    return false;
  }

  const ext = basename.slice(dotIndex).toLowerCase();
  return BINARY_EXTENSIONS.has(ext);
}

// ---------------------------------------------------------------------------
// Dependency Parsing
// ---------------------------------------------------------------------------

/**
 * Extract dependency information from a `package.json` file's content.
 *
 * Parses both `dependencies` and `devDependencies` fields.
 *
 * @param content - Raw JSON string of a package.json file.
 * @returns Array of extracted dependencies.
 * @throws {Error} If the content is not valid JSON.
 */
export function parsePackageJson(content: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch (err) {
    throw new Error(`Failed to parse package.json: ${err instanceof Error ? err.message : String(err)}`);
  }

  const prodDeps = parsed['dependencies'];
  if (prodDeps && typeof prodDeps === 'object' && !Array.isArray(prodDeps)) {
    for (const [name, version] of Object.entries(prodDeps as Record<string, unknown>)) {
      deps.push({
        name,
        version: typeof version === 'string' ? version : String(version),
        dev: false,
        source: 'package.json',
      });
    }
  }

  const devDeps = parsed['devDependencies'];
  if (devDeps && typeof devDeps === 'object' && !Array.isArray(devDeps)) {
    for (const [name, version] of Object.entries(devDeps as Record<string, unknown>)) {
      deps.push({
        name,
        version: typeof version === 'string' ? version : String(version),
        dev: true,
        source: 'package.json',
      });
    }
  }

  return deps;
}

/**
 * Extract dependency information from a `pyproject.toml` file's content.
 *
 * Uses simple line-by-line parsing for the PEP 621 `dependencies = [...]`
 * array under `[project]`, the group arrays under
 * `[project.optional-dependencies]`, and Poetry's
 * `[tool.poetry.dependencies]` format.
 *
 * Only items inside an actual dependency array are collected — quoted
 * strings in other `[project]` arrays (keywords, classifiers, authors, …)
 * are never treated as dependencies.
 *
 * @param content - Raw string content of pyproject.toml.
 * @returns Array of extracted dependencies.
 */
export function parsePyprojectToml(content: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const lines = content.split('\n');

  let currentSection = '';
  /**
   * Non-null while inside a multi-line PEP 621 dependency array
   * (`dependencies = [` under `[project]`, or a group array under
   * `[project.optional-dependencies]`).
   */
  let pep621Array: { dev: boolean } | null = null;

  /** Extract all quoted string items from a line fragment. */
  const extractQuoted = (s: string): string[] =>
    [...s.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? '');

  /** Parse a PEP 508 requirement string like `requests>=2.28.0`. */
  const pushRequirement = (raw: string, dev: boolean): void => {
    const m = /^([A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?)\s*(\[[^\]]*\])?\s*(.*)$/.exec(raw.trim());
    if (!m || !m[1]) {
      return;
    }
    deps.push({
      name: m[1],
      version: m[3]?.trim() || '*',
      dev,
      source: 'pyproject.toml',
    });
  };

  /** Does this line fragment close the current array? (a `]` outside quotes at the end) */
  const closesArray = (s: string): boolean => {
    const withoutStrings = s.replace(/"[^"]*"|'[^']*'/g, '');
    const withoutComment = withoutStrings.split('#')[0] ?? '';
    return withoutComment.includes(']');
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Detect section headers
    const sectionMatch = /^\[([^\]]+)\]\s*(#.*)?$/.exec(trimmed);
    if (sectionMatch) {
      currentSection = sectionMatch[1] ?? '';
      pep621Array = null;
      continue;
    }

    // Skip empty / comment lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Continuation of a multi-line PEP 621 dependency array
    if (pep621Array) {
      for (const item of extractQuoted(trimmed)) {
        if (item) {
          pushRequirement(item, pep621Array.dev);
        }
      }
      if (closesArray(trimmed)) {
        pep621Array = null;
      }
      continue;
    }

    // PEP 621: `dependencies = [...]` under [project] — the ONLY key in
    // [project] whose array items are dependencies.
    if (currentSection === 'project') {
      const depsStart = /^dependencies\s*=\s*\[(.*)$/.exec(trimmed);
      if (depsStart) {
        const rest = depsStart[1] ?? '';
        for (const item of extractQuoted(rest)) {
          if (item) {
            pushRequirement(item, false);
          }
        }
        if (!closesArray(rest)) {
          pep621Array = { dev: false };
        }
      }
      continue;
    }

    // PEP 621 optional dependency groups: `group = [...]`
    if (currentSection === 'project.optional-dependencies') {
      const groupStart = /^([A-Za-z0-9._-]+)\s*=\s*\[(.*)$/.exec(trimmed);
      if (groupStart) {
        const groupName = groupStart[1] ?? '';
        const dev = /^(dev|develop|development|test|tests|testing|lint|docs?|typing)$/i.test(groupName);
        const rest = groupStart[2] ?? '';
        for (const item of extractQuoted(rest)) {
          if (item) {
            pushRequirement(item, dev);
          }
        }
        if (!closesArray(rest)) {
          pep621Array = { dev };
        }
      }
      continue;
    }

    // Parse Poetry-style: package = "^1.0"  or  package = {version = "^1.0"}
    if (currentSection.includes('poetry.dependencies') ||
        currentSection.includes('poetry.dev-dependencies') ||
        currentSection.includes('poetry.group')) {
      const isDev = currentSection.includes('dev');
      const kvMatch = /^([a-zA-Z0-9_-]+)\s*=\s*"([^"]*)"/.exec(trimmed);
      if (kvMatch && kvMatch[1] !== 'python') {
        deps.push({
          name: kvMatch[1]!,
          version: kvMatch[2] ?? '*',
          dev: isDev,
          source: 'pyproject.toml',
        });
        continue;
      }

      // Table-style: package = {version = "^1.0", optional = true}
      const tableMatch = /^([a-zA-Z0-9_-]+)\s*=\s*\{.*version\s*=\s*"([^"]*)"/.exec(trimmed);
      if (tableMatch && tableMatch[1] !== 'python') {
        deps.push({
          name: tableMatch[1]!,
          version: tableMatch[2] ?? '*',
          dev: isDev,
          source: 'pyproject.toml',
        });
      }
    }
  }

  return deps;
}

/**
 * Extract dependency information from a `go.mod` file's content.
 *
 * Parses `require` blocks and single `require` directives.
 *
 * @param content - Raw string content of go.mod.
 * @returns Array of extracted dependencies.
 */
export function parseGoMod(content: string): DependencyInfo[] {
  const deps: DependencyInfo[] = [];
  const lines = content.split('\n');

  let inRequireBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Start of require block
    if (trimmed.startsWith('require (') || trimmed === 'require (') {
      inRequireBlock = true;
      continue;
    }

    // End of require block
    if (inRequireBlock && trimmed === ')') {
      inRequireBlock = false;
      continue;
    }

    // Single-line require: require github.com/foo/bar v1.2.3
    if (trimmed.startsWith('require ') && !trimmed.includes('(')) {
      const parts = trimmed.slice('require '.length).trim().split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        deps.push({
          name: parts[0],
          version: parts[1],
          dev: false,
          source: 'go.mod',
        });
      }
      continue;
    }

    // Lines inside require block: github.com/foo/bar v1.2.3
    if (inRequireBlock) {
      // Skip comments and indirect markers
      const cleaned = trimmed.replace(/\/\/.*$/, '').trim();
      if (!cleaned) {
        continue;
      }
      const parts = cleaned.split(/\s+/);
      if (parts.length >= 2 && parts[0] && parts[1]) {
        deps.push({
          name: parts[0],
          version: parts[1],
          dev: trimmed.includes('// indirect'),
          source: 'go.mod',
        });
      }
    }
  }

  return deps;
}

// ---------------------------------------------------------------------------
// Framework & AI Provider Detection
// ---------------------------------------------------------------------------

/** Known framework markers: package names → framework label. */
const FRAMEWORK_MARKERS: Readonly<Record<string, string>> = {
  // JavaScript / TypeScript
  'next': 'Next.js',
  'react': 'React',
  'react-dom': 'React',
  'vue': 'Vue.js',
  '@angular/core': 'Angular',
  'svelte': 'Svelte',
  '@sveltejs/kit': 'SvelteKit',
  'express': 'Express',
  'fastify': 'Fastify',
  'hono': 'Hono',
  'nestjs': 'NestJS',
  '@nestjs/core': 'NestJS',
  'nuxt': 'Nuxt',
  'gatsby': 'Gatsby',
  'remix': 'Remix',
  '@remix-run/react': 'Remix',
  'astro': 'Astro',
  'electron': 'Electron',
  'tauri': 'Tauri',
  // Python
  'django': 'Django',
  'flask': 'Flask',
  'fastapi': 'FastAPI',
  'starlette': 'Starlette',
  'tornado': 'Tornado',
  'pyramid': 'Pyramid',
  'streamlit': 'Streamlit',
  'gradio': 'Gradio',
  // Go
  'github.com/gin-gonic/gin': 'Gin',
  'github.com/gofiber/fiber': 'Fiber',
  'github.com/labstack/echo': 'Echo',
  // Rust
  'actix-web': 'Actix Web',
  'axum': 'Axum',
  'rocket': 'Rocket',
  // Ruby
  'rails': 'Ruby on Rails',
  // PHP
  'laravel/framework': 'Laravel',
  'symfony/framework-bundle': 'Symfony',
  // Java / Kotlin
  'spring-boot': 'Spring Boot',
  // Mobile
  'react-native': 'React Native',
  'flutter': 'Flutter',
  'expo': 'Expo',
};

/** Known AI / ML provider markers: package names → provider label. */
const AI_PROVIDER_MARKERS: Readonly<Record<string, string>> = {
  // OpenAI
  'openai': 'OpenAI',
  '@openai/api': 'OpenAI',
  // Anthropic
  '@anthropic-ai/sdk': 'Anthropic',
  'anthropic': 'Anthropic',
  // Google
  '@google/generative-ai': 'Google AI',
  'google-generativeai': 'Google AI',
  '@google-cloud/aiplatform': 'Google Cloud AI',
  // AWS
  '@aws-sdk/client-bedrock': 'AWS Bedrock',
  '@aws-sdk/client-bedrock-runtime': 'AWS Bedrock',
  'boto3': 'AWS (boto3)',
  // Azure
  '@azure/openai': 'Azure OpenAI',
  'azure-ai-openai': 'Azure OpenAI',
  // Cohere
  'cohere-ai': 'Cohere',
  'cohere': 'Cohere',
  // LangChain
  'langchain': 'LangChain',
  '@langchain/core': 'LangChain',
  // LlamaIndex
  'llama-index': 'LlamaIndex',
  'llamaindex': 'LlamaIndex',
  // Vector DBs
  '@pinecone-database/pinecone': 'Pinecone',
  'chromadb': 'ChromaDB',
  'weaviate-client': 'Weaviate',
  'qdrant-client': 'Qdrant',
  // HuggingFace
  'transformers': 'HuggingFace',
  '@huggingface/inference': 'HuggingFace',
  // ML frameworks
  'tensorflow': 'TensorFlow',
  '@tensorflow/tfjs': 'TensorFlow',
  'torch': 'PyTorch',
  'pytorch': 'PyTorch',
  // Misc
  'replicate': 'Replicate',
  'together-ai': 'Together AI',
  '@vercel/ai': 'Vercel AI SDK',
  'ai': 'Vercel AI SDK',
  'ollama': 'Ollama',
};

/** File markers that indicate specific frameworks even without dependencies. */
const FILE_FRAMEWORK_MARKERS: Readonly<Record<string, string>> = {
  'next.config.js': 'Next.js',
  'next.config.mjs': 'Next.js',
  'next.config.ts': 'Next.js',
  'nuxt.config.ts': 'Nuxt',
  'nuxt.config.js': 'Nuxt',
  'angular.json': 'Angular',
  'svelte.config.js': 'Svelte',
  'svelte.config.ts': 'SvelteKit',
  'astro.config.mjs': 'Astro',
  'astro.config.ts': 'Astro',
  'vite.config.ts': 'Vite',
  'vite.config.js': 'Vite',
  'webpack.config.js': 'Webpack',
  'tailwind.config.js': 'Tailwind CSS',
  'tailwind.config.ts': 'Tailwind CSS',
  'postcss.config.js': 'PostCSS',
  'remix.config.js': 'Remix',
  'gatsby-config.js': 'Gatsby',
  'gatsby-config.ts': 'Gatsby',
  'manage.py': 'Django',
  'settings.py': 'Django',
  'Cargo.toml': 'Rust (Cargo)',
  'go.mod': 'Go Modules',
  'build.gradle': 'Gradle',
  'build.gradle.kts': 'Gradle',
  'pom.xml': 'Maven',
  'Gemfile': 'Ruby (Bundler)',
  'composer.json': 'PHP (Composer)',
  'pubspec.yaml': 'Dart (Pub)',
};

/**
 * Detect frameworks used in a project by examining dependency names
 * and well-known config files.
 *
 * @param files - List of files in the project.
 * @param dependencies - Parsed dependency list.
 * @returns Deduplicated array of detected framework names.
 */
export function detectFrameworks(files: FileInfo[], dependencies: DependencyInfo[]): string[] {
  const frameworks = new Set<string>();

  // Check dependencies
  for (const dep of dependencies) {
    const framework = FRAMEWORK_MARKERS[dep.name];
    if (framework) {
      frameworks.add(framework);
    }
  }

  // Check file markers
  for (const file of files) {
    const framework = FILE_FRAMEWORK_MARKERS[file.name];
    if (framework) {
      frameworks.add(framework);
    }
  }

  return [...frameworks].sort();
}

/**
 * Detect AI / ML providers used in a project by examining dependency
 * names and well-known import patterns.
 *
 * @param files - List of files in the project.
 * @param dependencies - Parsed dependency list.
 * @returns Deduplicated array of detected AI provider names.
 */
export function detectAIProviders(files: FileInfo[], dependencies: DependencyInfo[]): string[] {
  const providers = new Set<string>();

  // Check dependencies
  for (const dep of dependencies) {
    const provider = AI_PROVIDER_MARKERS[dep.name];
    if (provider) {
      providers.add(provider);
    }
  }

  // Check for .env files with known API key patterns (just by filename)
  const envFiles = files.filter(
    (f) => f.name === '.env' || f.name === '.env.local' || f.name === '.env.example',
  );
  if (envFiles.length > 0) {
    // We can't read .env content here — that's handled by the collector
    // which passes content through governance. Mark as potential.
  }

  return [...providers].sort();
}

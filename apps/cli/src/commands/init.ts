/**
 * @module @recurrsive/cli/commands/init
 *
 * `recurrsive init` — Initialize Recurrsive in a project directory.
 *
 * Detects the project type by scanning for marker files, creates the
 * `.recurrsive/` data directory and `config.json`, and prints a
 * welcome message with next steps.
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve, basename } from 'node:path';
import type { Command } from 'commander';
import { RecurrsiveConfigSchema, type RecurrsiveConfig } from '@recurrsive/core';
import {
  banner,
  success,
  info,
  warning,
  bold,
  cyan,
  green,
  dim,
  magenta,
  header,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Project Type Detection
// ---------------------------------------------------------------------------

/** Marker files that indicate a specific project type. */
const PROJECT_MARKERS: Array<{ file: string; type: string; language: string; frameworks?: string[] }> = [
  { file: 'package.json', type: 'node', language: 'typescript' },
  { file: 'tsconfig.json', type: 'node', language: 'typescript' },
  { file: 'pyproject.toml', type: 'python', language: 'python' },
  { file: 'setup.py', type: 'python', language: 'python' },
  { file: 'requirements.txt', type: 'python', language: 'python' },
  { file: 'go.mod', type: 'go', language: 'go' },
  { file: 'Cargo.toml', type: 'rust', language: 'rust' },
  { file: 'pom.xml', type: 'java', language: 'java' },
  { file: 'build.gradle', type: 'java', language: 'java' },
  { file: 'Gemfile', type: 'ruby', language: 'ruby' },
  { file: 'mix.exs', type: 'elixir', language: 'elixir' },
  { file: 'pubspec.yaml', type: 'dart', language: 'dart' },
  { file: 'Package.swift', type: 'swift', language: 'swift' },
  { file: 'composer.json', type: 'php', language: 'php' },
];

/** Framework-detection heuristics within package.json. */
const FRAMEWORK_KEYWORDS: Array<{ keyword: string; framework: string }> = [
  { keyword: 'next', framework: 'next.js' },
  { keyword: 'react', framework: 'react' },
  { keyword: 'vue', framework: 'vue' },
  { keyword: 'angular', framework: 'angular' },
  { keyword: 'express', framework: 'express' },
  { keyword: 'fastify', framework: 'fastify' },
  { keyword: 'nest', framework: 'nestjs' },
  { keyword: 'svelte', framework: 'svelte' },
  { keyword: 'nuxt', framework: 'nuxt' },
  { keyword: 'remix', framework: 'remix' },
  { keyword: 'astro', framework: 'astro' },
];

/** AI provider detection keywords in package.json. */
const AI_PROVIDER_KEYWORDS: Array<{ keyword: string; provider: string }> = [
  { keyword: 'openai', provider: 'openai' },
  { keyword: 'anthropic', provider: 'anthropic' },
  { keyword: 'langchain', provider: 'langchain' },
  { keyword: 'cohere', provider: 'cohere' },
  { keyword: '@google/generative-ai', provider: 'google' },
  { keyword: '@ai-sdk', provider: 'vercel-ai' },
  { keyword: 'ollama', provider: 'ollama' },
  { keyword: 'huggingface', provider: 'huggingface' },
];

interface DetectedProject {
  type: string;
  languages: string[];
  frameworks: string[];
  aiProviders: string[];
  name: string;
}

/**
 * Detect project characteristics by scanning the directory for marker files.
 *
 * @param dir - The project root directory.
 * @returns Detected project information.
 */
async function detectProject(dir: string): Promise<DetectedProject> {
  const languages = new Set<string>();
  const frameworks = new Set<string>();
  const aiProviders = new Set<string>();
  let type = 'unknown';
  let name = basename(dir);

  // Scan for marker files
  for (const marker of PROJECT_MARKERS) {
    if (existsSync(join(dir, marker.file))) {
      type = marker.type;
      languages.add(marker.language);
    }
  }

  // Deep-scan package.json for frameworks and AI providers
  const pkgPath = join(dir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const raw = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(raw) as Record<string, unknown>;

      if (typeof pkg['name'] === 'string') {
        name = pkg['name'];
      }

      const allDeps = {
        ...(pkg['dependencies'] as Record<string, string> | undefined),
        ...(pkg['devDependencies'] as Record<string, string> | undefined),
      };

      const depKeys = Object.keys(allDeps);
      for (const { keyword, framework } of FRAMEWORK_KEYWORDS) {
        if (depKeys.some((k) => k.includes(keyword))) {
          frameworks.add(framework);
        }
      }
      for (const { keyword, provider } of AI_PROVIDER_KEYWORDS) {
        if (depKeys.some((k) => k.includes(keyword))) {
          aiProviders.add(provider);
        }
      }

      // Detect TypeScript vs JavaScript
      if (depKeys.includes('typescript') || existsSync(join(dir, 'tsconfig.json'))) {
        languages.add('typescript');
      } else {
        languages.add('javascript');
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Python framework detection
  const pyprojectPath = join(dir, 'pyproject.toml');
  if (existsSync(pyprojectPath)) {
    try {
      const content = await readFile(pyprojectPath, 'utf-8');
      if (content.includes('fastapi')) frameworks.add('fastapi');
      if (content.includes('django')) frameworks.add('django');
      if (content.includes('flask')) frameworks.add('flask');
      if (content.includes('openai')) aiProviders.add('openai');
      if (content.includes('anthropic')) aiProviders.add('anthropic');
      if (content.includes('langchain')) aiProviders.add('langchain');
    } catch {
      // Ignore
    }
  }

  if (languages.size === 0) {
    languages.add('unknown');
  }

  return {
    type,
    languages: [...languages],
    frameworks: [...frameworks],
    aiProviders: [...aiProviders],
    name,
  };
}

// ---------------------------------------------------------------------------
// Config Generation
// ---------------------------------------------------------------------------

/**
 * Create a default configuration for the detected project.
 *
 * @param project - Detected project information.
 * @returns A valid {@link RecurrsiveConfig}.
 */
function buildConfig(project: DetectedProject): RecurrsiveConfig {
  return RecurrsiveConfigSchema.parse({
    version: '1',
    project: {
      name: project.name,
      description: `Recurrsive analysis for ${project.name}`,
    },
    graph: {
      provider: 'sqlite',
    },
    collectors: [
      { type: 'git', enabled: true, config: {} },
      { type: 'documentation', enabled: true, config: {} },
    ],
    analyzers: {
      enabled: ['*'],
      disabled: [],
      config: {},
    },
    governance: {
      pii_detection: true,
      masked_fields: [],
      excluded_patterns: ['node_modules/**', 'dist/**', '.git/**', 'coverage/**', '__pycache__/**'],
      audit_log: true,
      retention_days: 90,
    },
    policies: [],
    output: {
      format: 'markdown',
      directory: '.recurrsive',
    },
  });
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `init` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize Recurrsive in a project')
    .argument('[path]', 'Path to the project root', '.')
    .option('-f, --force', 'Overwrite existing configuration')
    .action(async (pathArg: string, opts: { force?: boolean }) => {
      const projectDir = resolve(pathArg);
      const recurrsiveDir = join(projectDir, '.recurrsive');
      const configPath = join(recurrsiveDir, 'config.json');

      banner();

      // Check for existing config
      if (existsSync(configPath) && !opts.force) {
        warning(
          `Recurrsive is already initialized in ${cyan(projectDir)}`,
        );
        info(`Use ${bold('--force')} to reinitialize.`);
        return;
      }

      // Detect project type
      info(`Scanning ${cyan(projectDir)} for project markers...`);
      const project = await detectProject(projectDir);

      console.log('');
      console.log(`  ${bold('Project:')}     ${cyan(project.name)}`);
      console.log(`  ${bold('Type:')}        ${project.type}`);
      console.log(`  ${bold('Languages:')}   ${project.languages.join(', ')}`);
      if (project.frameworks.length > 0) {
        console.log(`  ${bold('Frameworks:')}  ${project.frameworks.join(', ')}`);
      }
      if (project.aiProviders.length > 0) {
        console.log(`  ${bold('AI Providers:')} ${magenta(project.aiProviders.join(', '))}`);
      }
      console.log('');

      // Create .recurrsive directory
      await mkdir(recurrsiveDir, { recursive: true });
      await mkdir(join(recurrsiveDir, 'snapshots'), { recursive: true });
      await mkdir(join(recurrsiveDir, 'reports'), { recursive: true });

      // Generate and write config
      const config = buildConfig(project);
      await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
      success(`Created ${dim(configPath)}`);

      // Write .gitignore for .recurrsive
      const gitignorePath = join(recurrsiveDir, '.gitignore');
      if (!existsSync(gitignorePath)) {
        const gitignoreContent = [
          '# Recurrsive runtime data',
          'graph.db',
          'graph.db-wal',
          'graph.db-shm',
          'snapshots/',
          'reports/',
          '*.log',
          '',
        ].join('\n');
        await writeFile(gitignorePath, gitignoreContent, 'utf-8');
        success(`Created ${dim(gitignorePath)}`);
      }

      // Print next steps
      header('Next Steps');

      console.log(`  ${green('1.')} Run your first analysis:`);
      console.log(`     ${bold(cyan('recurrsive analyze'))}`);
      console.log('');
      console.log(`  ${green('2.')} Review prioritized opportunities:`);
      console.log(`     ${bold(cyan('recurrsive opportunities'))}`);
      console.log(
        `     ${dim('or')} ${cyan('recurrsive report')} ${dim('to generate a shareable report')}`,
      );
      console.log('');
      console.log(`  ${green('3.')} Check project health:`);
      console.log(`     ${bold(cyan('recurrsive health'))}`);
      console.log('');
      console.log(`  ${green('4.')} Explore the knowledge graph:`);
      console.log(`     ${bold(cyan('recurrsive graph --stats'))}`);
      console.log('');
      console.log(
        dim('  Edit .recurrsive/config.json to customize analyzers, ') +
          dim('governance, and LLM settings.'),
      );
      console.log('');

      // Opportunities come from the reasoning engine, which needs an LLM key.
      // Call this out so the user is not surprised by a findings-only run.
      info(
        `Prioritized opportunities require an LLM key — set ${bold('RECURRSIVE_LLM_API_KEY')} ` +
          `before ${cyan('analyze')} to enable multi-agent reasoning. ` +
          `Without it you still get findings and a report.`,
      );
      if (project.aiProviders.length > 0) {
        info(
          `AI providers detected in this project (${magenta(project.aiProviders.join(', '))}) — ` +
            `reasoning will pay special attention to them.`,
        );
      }
      console.log('');
      console.log(
        dim('  Using the hosted platform or a team server? Run ') +
          cyan(bold('recurrsive setup')) +
          dim(' (first run) or ') +
          cyan(bold('recurrsive login')) +
          dim(' to unlock projects, analytics, and forecasting.'),
      );
      console.log('');

      success('Recurrsive initialized successfully! 🚀');
    });
}

/**
 * @module @recurrsive/cli/commands/analyze
 *
 * `recurrsive analyze [path]` — Full analysis pipeline.
 *
 * Orchestrates the entire Recurrsive analysis workflow:
 * 1. Load config
 * 2. Create graph client
 * 3. Run git + docs + environment + ci/cd + database collectors
 * 4. Run parsing pipeline
 * 5. Populate knowledge graph
 * 6. Run all enabled analyzers
 * 7. (Optional) Run reasoning engine
 * 8. Generate opportunities
 * 9. Save results
 * 10. Display summary
 *
 * @packageDocumentation
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { Command } from 'commander';
import type { Finding, Opportunity, Entity, Relationship } from '@recurrsive/core';
import { formatDuration } from '@recurrsive/core';
import { createGraphClient, type ExtendedGraphClient } from '@recurrsive/graph';
import { GitCollector, DocumentationCollector, EnvironmentCollector, CICDCollector, DatabaseCollector } from '@recurrsive/collectors';
import { ParsingPipeline } from '@recurrsive/parsers';
import {
  AnalyzerRegistry,
  AnalyzerRunner,
  createDefaultAnalyzers,
  type AnalysisResult,
} from '@recurrsive/analyzers';
import { OpportunityManager } from '@recurrsive/opportunities';
import { loadConfig } from '../config/loader.js';
import {
  banner,
  Spinner,
  success,
  error,
  warning,
  info,
  step,
  header,
  bold,
  cyan,
  dim,
  table,
  severityColor,
  severityBadge,
} from '../output/terminal.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal AnalysisContext for the analyzer runner.
 *
 * @param graph - The graph client.
 * @param projectRoot - Absolute path to the project root.
 * @param projectName - Project display name.
 * @param languages - Detected languages.
 * @param frameworks - Detected frameworks.
 * @param aiProviders - Detected AI providers.
 * @returns An AnalysisContext suitable for passing to analyzers.
 */
function buildAnalysisContext(
  graph: ExtendedGraphClient,
  projectRoot: string,
  projectName: string,
  languages: string[],
  frameworks: string[],
  aiProviders: string[],
) {
  const findings: Finding[] = [];

  return {
    graph,
    config: {
      enabled: true,
      severity_threshold: 'info' as const,
      custom: {},
    },
    history: {
      async getPreviousFindings(_analyzerId: string) {
        return [];
      },
      async getAcceptedOpportunities() {
        return [];
      },
      async getRejectedOpportunities() {
        return [];
      },
    },
    project: {
      name: projectName,
      root_path: projectRoot,
      languages,
      frameworks,
      ai_providers: aiProviders,
    },
    emit: (finding: Finding) => {
      findings.push(finding);
    },
    /** Retrieve emitted findings for post-analysis processing. */
    getEmitted: () => findings,
  };
}

/**
 * Read all source files from the collector's file entities for parsing.
 *
 * @param entities - All entities from the collector.
 * @param projectRoot - Project root for resolving paths.
 * @returns Array of file descriptors for the parser pipeline.
 */
async function readSourceFiles(
  entities: Entity[],
  projectRoot: string,
): Promise<Array<{ path: string; content: string; language: string }>> {
  const files: Array<{ path: string; content: string; language: string }> = [];
  const fileEntities = entities.filter(
    (e) => e.type === 'file' && e.properties['is_source'] === true,
  );

  for (const entity of fileEntities) {
    const filePath = entity.properties['absolute_path'];
    if (typeof filePath !== 'string') continue;
    const language = entity.properties['language'];
    if (typeof language !== 'string') continue;

    try {
      const content = await readFile(filePath, 'utf-8');
      const relativePath = filePath.startsWith(projectRoot)
        ? filePath.slice(projectRoot.length + 1)
        : filePath;
      files.push({ path: relativePath, content, language });
    } catch {
      // Skip unreadable files
    }
  }

  return files;
}

// ---------------------------------------------------------------------------
// Command Registration
// ---------------------------------------------------------------------------

/**
 * Register the `analyze` command on the Commander program.
 *
 * @param program - The Commander program instance.
 */
export function registerAnalyzeCommand(program: Command): void {
  program
    .command('analyze')
    .description('Run the full Recurrsive analysis pipeline')
    .argument('[path]', 'Path to analyze', '.')
    .option('--format <format>', 'Output format: markdown, json, sarif', 'markdown')
    .option('--analyzers <list>', 'Comma-separated analyzer IDs to run')
    .option('--output <path>', 'Output file path')
    .option('--no-reasoning', 'Skip LLM-based reasoning')
    .option('--verbose', 'Verbose output')
    .action(
      async (
        pathArg: string,
        opts: {
          format: string;
          analyzers?: string;
          output?: string;
          reasoning: boolean;
          verbose?: boolean;
        },
      ) => {
        const startTime = Date.now();
        const projectPath = resolve(pathArg);
        const totalSteps = opts.reasoning ? 13 : 11;

        banner();

        if (!existsSync(projectPath)) {
          error(`Path does not exist: ${projectPath}`);
          process.exit(1);
        }

        // ── Step 1: Load config ────────────────────────────────────────
        step(1, totalSteps, 'Loading configuration...');
        const { config, projectRoot } = await loadConfig({ cwd: projectPath });
        const projectName = config.project.name;
        success(`Project: ${cyan(bold(projectName))}`);

        // ── Step 2: Create graph client ────────────────────────────────
        step(2, totalSteps, 'Initializing knowledge graph...');
        const dbPath = config.graph.connection_string ??
          resolve(projectRoot, '.recurrsive', 'graph.db');

        // Ensure .recurrsive directory exists
        await mkdir(resolve(projectRoot, '.recurrsive'), { recursive: true });

        let graphClient: ExtendedGraphClient;
        try {
          graphClient = await createGraphClient({
            provider: config.graph.provider,
            sqlitePath: config.graph.provider === 'sqlite' ? dbPath : undefined,
            connectionString:
              config.graph.provider === 'postgresql_age'
                ? config.graph.connection_string
                : undefined,
          });
          success(`Graph initialized (${config.graph.provider})`);
        } catch (err: unknown) {
          error(`Failed to create graph client: ${err instanceof Error ? err.message : String(err)}`);
          process.exit(1);
        }

        try {
          // ── Step 3: Run git collector ───────────────────────────────
          step(3, totalSteps, 'Collecting repository data...');
          const spinner = new Spinner('Scanning files and git history...').start();

          const gitCollector = new GitCollector(projectRoot);
          await gitCollector.initialize({
            governance: {
              masked_fields: config.governance.masked_fields,
              excluded_patterns: config.governance.excluded_patterns,
              pii_detection: config.governance.pii_detection,
              audit_log: config.governance.audit_log,
              retention_days: config.governance.retention_days,
            },
            custom: {},
          });

          const validation = await gitCollector.validate();
          if (!validation.valid) {
            spinner.fail('Git validation failed');
            for (const e of validation.errors) {
              warning(e);
            }
            // Continue without git — might be a non-git project
          }

          const gitResult = await gitCollector.collect();
          spinner.succeed(
            `Collected ${bold(String(gitResult.entities.length))} entities, ` +
              `${bold(String(gitResult.relationships.length))} relationships ` +
              dim(`(${formatDuration(gitResult.metadata.duration_ms)})`),
          );

          // ── Step 4: Run documentation collector ────────────────────
          step(4, totalSteps, 'Collecting documentation...');
          const docSpinner = new Spinner('Scanning documentation files...').start();

          const docsCollector = new DocumentationCollector(projectRoot);
          await docsCollector.initialize({
            governance: {
              masked_fields: config.governance.masked_fields,
              excluded_patterns: config.governance.excluded_patterns,
              pii_detection: config.governance.pii_detection,
              audit_log: config.governance.audit_log,
              retention_days: config.governance.retention_days,
            },
            custom: {},
          });

          const docsResult = await docsCollector.collect();
          docSpinner.succeed(
            `Collected ${bold(String(docsResult.entities.length))} documentation entities`,
          );

          // ── Step 5: Run environment collector ────────────────────
          step(5, totalSteps, 'Collecting infrastructure data...');
          const envSpinner = new Spinner('Scanning Docker, Compose, K8s files...').start();

          const envCollector = new EnvironmentCollector(projectRoot);
          await envCollector.initialize({
            governance: {
              masked_fields: config.governance.masked_fields,
              excluded_patterns: config.governance.excluded_patterns,
              pii_detection: config.governance.pii_detection,
              audit_log: config.governance.audit_log,
              retention_days: config.governance.retention_days,
            },
            custom: {},
          });
          const envResult = await envCollector.collect();
          envSpinner.succeed(
            `Collected ${bold(String(envResult.entities.length))} infrastructure entities`,
          );

          // ── Step 6: Run CI/CD collector ──────────────────────────
          step(6, totalSteps, 'Collecting CI/CD pipelines...');
          const ciSpinner = new Spinner('Scanning GitHub Actions, GitLab CI...').start();

          const cicdCollector = new CICDCollector(projectRoot);
          await cicdCollector.initialize({
            governance: {
              masked_fields: config.governance.masked_fields,
              excluded_patterns: config.governance.excluded_patterns,
              pii_detection: config.governance.pii_detection,
              audit_log: config.governance.audit_log,
              retention_days: config.governance.retention_days,
            },
            custom: {},
          });
          const cicdResult = await cicdCollector.collect();
          ciSpinner.succeed(
            `Collected ${bold(String(cicdResult.entities.length))} CI/CD entities`,
          );

          // ── Step 7: Run database collector ───────────────────────
          step(7, totalSteps, 'Collecting database schemas...');
          const dbSpinner = new Spinner('Scanning SQL, Prisma, Drizzle schemas...').start();

          const dbCollector = new DatabaseCollector(projectRoot);
          await dbCollector.initialize({
            governance: {
              masked_fields: config.governance.masked_fields,
              excluded_patterns: config.governance.excluded_patterns,
              pii_detection: config.governance.pii_detection,
              audit_log: config.governance.audit_log,
              retention_days: config.governance.retention_days,
            },
            custom: {},
          });
          const dbResult = await dbCollector.collect();
          dbSpinner.succeed(
            `Collected ${bold(String(dbResult.entities.length))} database entities`,
          );

          // ── Step 8: Run parsing pipeline ─────────────────────────
          step(8, totalSteps, 'Parsing source code...');
          const parseSpinner = new Spinner('Extracting entities and AI patterns...').start();

          // Detect languages from collected data
          const detectedLanguages = new Set<string>();
          for (const entity of gitResult.entities) {
            if (entity.type === 'file') {
              const lang = entity.properties['language'];
              if (typeof lang === 'string' && lang !== 'unknown') {
                detectedLanguages.add(lang);
              }
            }
          }

          const pipeline = new ParsingPipeline();
          await pipeline.initialize([...detectedLanguages]);

          const sourceFiles = await readSourceFiles(gitResult.entities, projectRoot);
          let parseEntities: Entity[] = [];
          let parseRelationships: Relationship[] = [];

          if (sourceFiles.length > 0) {
            const parseResult = await pipeline.parseProject(sourceFiles);
            parseEntities = parseResult.entities;
            parseRelationships = parseResult.relationships;
          }

          parseSpinner.succeed(
            `Parsed ${bold(String(sourceFiles.length))} files → ` +
              `${bold(String(parseEntities.length))} code entities`,
          );

          // ── Step 9: Populate knowledge graph ───────────────────────
          step(9, totalSteps, 'Populating knowledge graph...');
          const graphSpinner = new Spinner('Ingesting entities and relationships...').start();

          const allEntities = [
            ...gitResult.entities,
            ...docsResult.entities,
            ...envResult.entities,
            ...cicdResult.entities,
            ...dbResult.entities,
            ...parseEntities,
          ];
          const allRelationships = [
            ...gitResult.relationships,
            ...docsResult.relationships,
            ...envResult.relationships,
            ...cicdResult.relationships,
            ...dbResult.relationships,
            ...parseRelationships,
          ];

          let ingested = 0;
          for (const entity of allEntities) {
            await graphClient.upsertEntity(entity);
            ingested++;
          }
          let relIngested = 0;
          let relSkipped = 0;
          for (const rel of allRelationships) {
            try {
              await graphClient.upsertRelationship(rel);
              relIngested++;
            } catch {
              // Skip relationships that reference missing entities
              // (common when parser generates refs to unresolvable symbols)
              relSkipped++;
            }
          }

          graphSpinner.succeed(
            `Ingested ${bold(String(ingested))} entities, ` +
              `${bold(String(relIngested))} relationships` +
              (relSkipped > 0 ? ` (${relSkipped} skipped)` : ''),
          );

          // ── Step 10: Run analyzers ──────────────────────────────────
          step(10, totalSteps, 'Running analyzers...');
          const analyzerSpinner = new Spinner('Analyzing knowledge graph...').start();

          // Detect AI providers and frameworks for analysis context
          const aiProviders: string[] = [];
          const frameworks: string[] = [];
          for (const entity of gitResult.entities) {
            if (entity.type === 'repository') {
              const providers = entity.properties['ai_providers'];
              if (Array.isArray(providers)) {
                aiProviders.push(...(providers as string[]));
              }
              const fws = entity.properties['frameworks'];
              if (Array.isArray(fws)) {
                frameworks.push(...(fws as string[]));
              }
            }
          }

          const registry = new AnalyzerRegistry();
          const allAnalyzers = createDefaultAnalyzers();

          // Filter analyzers if --analyzers specified
          const analyzerIds = opts.analyzers?.split(',').map((s) => s.trim());
          for (const analyzer of allAnalyzers) {
            if (!analyzerIds || analyzerIds.includes(analyzer.id)) {
              registry.register(analyzer);
            }
          }

          const runner = new AnalyzerRunner(registry);
          const ctx = buildAnalysisContext(
            graphClient,
            projectRoot,
            projectName,
            [...detectedLanguages],
            frameworks,
            aiProviders,
          );

          const analysisResult: AnalysisResult = await runner.run(
            analyzerIds ?? '*',
            ctx,
            {
              parallel: true,
              timeout_ms: 60_000,
              on_progress: (id, status) => {
                if (opts.verbose) {
                  analyzerSpinner.update(`${id}: ${status}`);
                }
              },
            },
          );

          analyzerSpinner.succeed(
            `${bold(String(analysisResult.analyzers_run.length))} analyzers ran, ` +
              `${bold(String(analysisResult.findings.length))} findings discovered ` +
              dim(`(${formatDuration(analysisResult.duration_ms)})`),
          );

          if (analysisResult.analyzers_failed.length > 0) {
            warning(
              `${analysisResult.analyzers_failed.length} analyzers failed: ` +
                analysisResult.analyzers_failed.join(', '),
            );
          }

          // Combine emitted findings with returned findings
          const allFindings = [...analysisResult.findings, ...ctx.getEmitted()];
          // ── Step 11 (optional): Reasoning ───────────────────────────
          let opportunities: Opportunity[] = [];
          const reasoningStep = 11;

          // Build reasoning config — prefer config file, fall back to env var
          const llmApiKey =
            config.reasoning?.api_key ?? process.env['RECURRSIVE_LLM_API_KEY'];
          const reasoningConfig = config.reasoning ?? (llmApiKey ? {
            provider: 'openai' as const,
            model: 'gpt-4.1-mini',
            api_key: llmApiKey,
          } : null);

          if (opts.reasoning && reasoningConfig && llmApiKey) {
            step(reasoningStep, totalSteps, 'Running reasoning engine...');
            const reasonSpinner = new Spinner('Multi-agent debate in progress...').start();

            try {
              const { ReasoningEngine } = await import('@recurrsive/reasoning');
              const engine = new ReasoningEngine({
                llm_provider: reasoningConfig.provider,
                llm_model: reasoningConfig.model,
                llm_api_key: llmApiKey,
                llm_base_url: 'base_url' in reasoningConfig ? reasoningConfig.base_url : undefined,
                max_debate_rounds: 'max_debate_rounds' in reasoningConfig ? reasoningConfig.max_debate_rounds : 3,
                min_consensus_score: 0.6,
                specialists: [
                  'architecture_engineer',
                  'security_engineer',
                  'performance_engineer',
                  'cost_optimizer',
                ],
                temperature: 'temperature' in reasoningConfig ? reasoningConfig.temperature : 0.3,
              });

              const consensusResult = await engine.process(allFindings, graphClient);
              opportunities = consensusResult.opportunities;
              reasonSpinner.succeed(
                `Reasoning complete: ${bold(String(opportunities.length))} opportunities promoted`,
              );
            } catch (err: unknown) {
              reasonSpinner.fail('Reasoning engine failed');
              warning(
                `Reasoning error: ${err instanceof Error ? err.message : String(err)}`,
              );
              info('Falling back to analyzer findings only.');
            }
          } else if (opts.reasoning && !llmApiKey) {
            info(
              'Reasoning skipped — no LLM configured. ' +
                `Set ${bold('reasoning')} in config or ${bold('RECURRSIVE_LLM_API_KEY')} env var.`,
            );
          }

          // ── Step: Generate opportunities from findings ─────────────
          const oppsStep = opts.reasoning ? 12 : 11;
          step(oppsStep, totalSteps, 'Generating opportunity reports...');

          // If no reasoning, create basic opportunities from findings
          if (opportunities.length === 0 && allFindings.length > 0) {
            info(
              `Converting ${bold(String(allFindings.length))} findings to opportunities...`,
            );
          }

          const manager = new OpportunityManager(opportunities);

          // ── Step: Save results ─────────────────────────────────────
          const saveStep = opts.reasoning ? 13 : 11;
          step(saveStep, totalSteps, 'Saving results...');

          const outputDir = resolve(projectRoot, config.output.directory);
          await mkdir(join(outputDir, 'reports'), { recursive: true });

          // Save findings
          const findingsPath = join(outputDir, 'findings.json');
          await writeFile(findingsPath, JSON.stringify(allFindings, null, 2), 'utf-8');

          // Save opportunities
          const oppsPath = join(outputDir, 'opportunities.json');
          await manager.save(oppsPath);

          // Export in requested format
          const format = opts.format as 'markdown' | 'json' | 'sarif';
          let exportContent: string;
          if (opportunities.length > 0) {
            exportContent = manager.export(format === 'sarif' ? 'sarif' : format === 'json' ? 'json' : 'markdown');
          } else {
            exportContent = format === 'json'
              ? JSON.stringify(allFindings, null, 2)
              : `# Recurrsive Analysis Report\n\n` +
                `**Project:** ${projectName}\n` +
                `**Date:** ${new Date().toISOString()}\n` +
                `**Findings:** ${allFindings.length}\n\n` +
                allFindings
                  .map(
                    (f) =>
                      `## ${f.title}\n\n` +
                      `**Severity:** ${f.severity} | **Category:** ${f.category} | **Confidence:** ${Math.round(f.confidence * 100)}%\n\n` +
                      `${f.description}\n\n` +
                      (f.suggested_fix ? `**Suggested fix:** ${f.suggested_fix}\n\n` : ''),
                  )
                  .join('---\n\n');
          }

          let outputPath: string;
          if (opts.output) {
            outputPath = resolve(opts.output);
          } else {
            const ext = format === 'json' ? 'json' : format === 'sarif' ? 'sarif.json' : 'md';
            outputPath = join(outputDir, 'reports', `analysis-report.${ext}`);
          }

          await writeFile(outputPath, exportContent, 'utf-8');
          success(`Report saved to ${dim(outputPath)}`);

          // ── Summary ────────────────────────────────────────────────
          const elapsed = Date.now() - startTime;

          header('Analysis Summary');

          const stats = await graphClient.getStats();
          console.log(`  ${bold('Project:')}          ${cyan(projectName)}`);
          console.log(`  ${bold('Duration:')}         ${formatDuration(elapsed)}`);
          console.log(`  ${bold('Graph entities:')}   ${bold(String(stats.totalEntities))}`);
          console.log(`  ${bold('Relationships:')}    ${bold(String(stats.totalRelationships))}`);
          console.log(`  ${bold('Findings:')}         ${bold(String(allFindings.length))}`);
          console.log(
            `  ${bold('Opportunities:')}    ${bold(String(opportunities.length))}`,
          );
          console.log('');

          // Findings by severity
          if (allFindings.length > 0) {
            const bySeverity = new Map<string, number>();
            for (const f of allFindings) {
              bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
            }

            const severityRows: string[][] = [];
            for (const sev of ['critical', 'high', 'medium', 'low', 'info'] as const) {
              const count = bySeverity.get(sev);
              if (count !== undefined && count > 0) {
                severityRows.push([severityColor(sev), String(count)]);
              }
            }

            if (severityRows.length > 0) {
              console.log(table(['Severity', 'Count'], severityRows));
              console.log('');
            }
          }

          // Findings by category
          if (allFindings.length > 0) {
            const byCategory = new Map<string, number>();
            for (const f of allFindings) {
              byCategory.set(f.category, (byCategory.get(f.category) ?? 0) + 1);
            }

            const categoryRows = [...byCategory.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([cat, count]) => [cat, String(count)]);

            if (categoryRows.length > 0) {
              console.log(table(['Category', 'Findings'], categoryRows));
              console.log('');
            }
          }

          // Top findings preview
          if (allFindings.length > 0) {
            header('Top Findings');
            const topFindings = allFindings
              .sort((a, b) => {
                const sevOrder = ['critical', 'high', 'medium', 'low', 'info'];
                return sevOrder.indexOf(a.severity) - sevOrder.indexOf(b.severity);
              })
              .slice(0, 5);

            for (const finding of topFindings) {
              console.log(
                `  ${severityBadge(finding.severity)} ${bold(finding.title)}`,
              );
              console.log(
                `    ${dim(finding.category)} · ${dim(`${Math.round(finding.confidence * 100)}% confidence`)}`,
              );
              if (finding.locations.length > 0) {
                const loc = finding.locations[0]!;
                console.log(
                  `    ${dim('→')} ${dim(loc.file)}${loc.start_line ? dim(`:${loc.start_line}`) : ''}`,
                );
              }
              console.log('');
            }
          }

          console.log(
            dim('  Run ') +
              cyan(bold('recurrsive opportunities')) +
              dim(' to view and manage opportunities.'),
          );
          console.log('');

          // Cleanup
          await gitCollector.dispose();
          await docsCollector.dispose();
          await envCollector.dispose();
          await cicdCollector.dispose();
          await dbCollector.dispose();
          await graphClient.dispose();

          success(
            `Analysis complete in ${bold(formatDuration(elapsed))} ✨`,
          );
        } catch (err: unknown) {
          await graphClient.dispose();
          throw err;
        }
      },
    );
}

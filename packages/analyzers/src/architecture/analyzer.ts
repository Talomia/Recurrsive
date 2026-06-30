/**
 * @module @recurrsive/analyzers/architecture
 *
 * Analyzes the knowledge graph for architectural issues such as
 * circular dependencies, god modules, dead code, tight coupling,
 * missing abstractions, layer violations, and duplicate functionality.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
  Entity,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

/** Coupling metrics for a single module. */
interface CouplingMetrics {
  entity: Entity;
  afferent: number;
  efferent: number;
  instability: number;
}

/**
 * Architecture analyzer that detects structural issues across the
 * codebase by inspecting module-level entities and their
 * relationships.
 *
 * ### Rules
 * 1. Circular dependencies between modules
 * 2. God modules with excessive outgoing dependencies
 * 3. Dead code — functions with zero callers and no exports
 * 4. Tight coupling — high instability ratios
 * 5. Missing abstractions — concrete implementations without shared interfaces
 * 6. Layer violations — imports crossing architectural boundaries
 * 7. Duplicate functionality — similar function signatures
 */
export class ArchitectureAnalyzer implements Analyzer {
  readonly id = 'architecture.structural';
  readonly name = 'Architecture Analyzer';
  readonly description =
    'Detects structural architecture issues such as circular dependencies, god modules, and layer violations.';
  readonly version = '0.1.0';
  readonly categories = ['architecture' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {
    // No initialization required
  }

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [circularFindings, godModuleFindings, deadCodeFindings, couplingFindings, abstractionFindings, layerFindings, duplicateFindings] =
      await Promise.all([
        this.detectCircularDependencies(ctx),
        this.detectGodModules(ctx),
        this.detectDeadCode(ctx),
        this.detectTightCoupling(ctx),
        this.detectMissingAbstractions(ctx),
        this.detectLayerViolations(ctx),
        this.detectDuplicateFunctionality(ctx),
      ]);

    findings.push(
      ...circularFindings,
      ...godModuleFindings,
      ...deadCodeFindings,
      ...couplingFindings,
      ...abstractionFindings,
      ...layerFindings,
      ...duplicateFindings,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Cross-cutting check: low abstraction ratio
    // Note: We use tags to detect interfaces since 'class' entities with
    // 'interface' or 'abstract' tags represent abstractions.
    const classes = await ctx.graph.getEntities('class');
    const abstractions = classes.filter(
      (e) => (e.tags ?? []).some((t) => t === 'interface' || t === 'abstract' || t === 'trait'),
    );
    const concretes = classes.filter(
      (e) => !(e.tags ?? []).some((t) => t === 'interface' || t === 'abstract' || t === 'trait'),
    );

    if (concretes.length >= 10 && abstractions.length === 0) {
      findings.push(
        createFinding({
          title: 'No abstractions in a large codebase',
          description:
            `The project has ${concretes.length} concrete types (classes/structs) but no ` +
            `interfaces or abstract contracts. This makes the codebase rigid and hard to ` +
            `test in isolation. Consider extracting interfaces for key collaborators.`,
          severity: 'medium',
          category: 'architecture',
          analyzer_id: this.id,
          evidence: [
            createEvidence({
              type: 'metric',
              source: 'architecture.structural',
              description: `${concretes.length} classes/structs, 0 abstractions`,
              entity_ids: [],
              confidence: 0.9,
              data: { classes: concretes.length, abstractions: 0 },
            }),
          ],
          locations: [],
          confidence: 0.85,
          tags: ['abstraction', 'architecture', 'design'],
        }),
      );
    } else if (concretes.length >= 5 && abstractions.length > 0) {
      const ratio = abstractions.length / concretes.length;
      if (ratio < 0.1) {
        findings.push(
          createFinding({
            title: 'Low abstraction ratio',
            description:
              `Only ${Math.round(ratio * 100)}% of concrete types have corresponding abstractions ` +
              `(${abstractions.length} abstractions to ${concretes.length} classes). ` +
              `A ratio below 10% suggests key boundaries lack contracts.`,
            severity: 'low',
            category: 'architecture',
            analyzer_id: this.id,
            evidence: [
              createEvidence({
                type: 'metric',
                source: 'architecture.structural',
                description: `Abstraction ratio: ${abstractions.length}/${concretes.length} = ${Math.round(ratio * 100)}%`,
                entity_ids: [],
                confidence: 0.85,
                data: { ratio, abstractions: abstractions.length, concretes: concretes.length },
              }),
            ],
            locations: [],
            confidence: 0.8,
            tags: ['abstraction-ratio', 'architecture', 'design'],
          }),
        );
      }
    }

    // Cross-cutting check: module spread (too many tiny modules)
    const modules = await ctx.graph.getEntities('module');
    const functions = await ctx.graph.getEntities('function');

    if (modules.length > 0 && functions.length > 0) {
      const avgFunctions = functions.length / modules.length;
      if (modules.length >= 20 && avgFunctions < 2) {
        findings.push(
          createFinding({
            title: 'Excessive module fragmentation',
            description:
              `The project has ${modules.length} modules averaging only ${avgFunctions.toFixed(1)} ` +
              `functions each. This can make navigation difficult and increase import complexity. ` +
              `Consider consolidating closely related modules.`,
            severity: 'low',
            category: 'architecture',
            analyzer_id: this.id,
            evidence: [
              createEvidence({
                type: 'metric',
                source: 'architecture.structural',
                description: `${modules.length} modules, ${functions.length} functions, avg ${avgFunctions.toFixed(1)} per module`,
                entity_ids: [],
                confidence: 0.8,
                data: { modules: modules.length, functions: functions.length, average: avgFunctions },
              }),
            ],
            locations: [],
            confidence: 0.75,
            tags: ['fragmentation', 'architecture', 'modules'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 1: Circular Dependencies ──────────────────────────────────

  /**
   * Detect import cycles between modules by walking the dependency
   * graph and performing cycle detection via DFS.
   *
   * @param ctx - Analysis context.
   * @returns Findings for each detected cycle.
   */
  private async detectCircularDependencies(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const modules = await ctx.graph.getEntities('module');
    if (modules.length === 0) return findings;

    // Build adjacency list: module → modules it imports
    const adjacency = new Map<string, string[]>();
    for (const mod of modules) {
      const rels = await ctx.graph.getRelationships(mod.id, 'out');
      const imports = rels
        .filter((r) => r.type === 'imports')
        .map((r) => r.target_id);
      adjacency.set(mod.id, imports);
    }

    const moduleMap = new Map(modules.map((m) => [m.id, m]));
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path]);
        } else if (recStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart >= 0) {
            cycles.push(path.slice(cycleStart));
          }
        }
      }
      recStack.delete(nodeId);
    };

    for (const mod of modules) {
      if (!visited.has(mod.id)) {
        dfs(mod.id, []);
      }
    }

    // Deduplicate cycles by sorting and stringifying
    const seen = new Set<string>();
    for (const cycle of cycles) {
      const key = [...cycle].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);

      const names = cycle
        .map((id) => moduleMap.get(id)?.name ?? id)
        .join(' → ');
      const locations = cycle
        .map((id) => locationFromEntity(moduleMap.get(id)!))
        .filter((l): l is NonNullable<typeof l> => l != null);

      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Circular dependency detected',
          description: `Modules form an import cycle: ${names}. Circular dependencies make the codebase harder to understand, test, and refactor.`,
          severity: 'high',
          category: 'architecture',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `Import cycle: ${names}`,
              entity_ids: cycle,
              confidence: 0.95,
              data: { cycle_modules: cycle.map((id) => moduleMap.get(id)?.name ?? id) },
            }),
          ],
          locations,
          suggested_fix:
            'Break the cycle by extracting shared types/interfaces into a separate module, using dependency inversion, or restructuring the import graph.',
          confidence: 0.9,
          tags: ['circular-dependency', 'architecture', 'imports'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 2: God Modules ────────────────────────────────────────────

  /**
   * Find files or modules with an excessive number of outgoing
   * relationships (> 15 dependencies).
   *
   * @param ctx - Analysis context.
   * @returns Findings for each god module detected.
   */
  private async detectGodModules(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const threshold = (ctx.config.custom['god_module_threshold'] as number | undefined) ?? 15;

    const entities = [
      ...(await ctx.graph.getEntities('file')),
      ...(await ctx.graph.getEntities('class')),
      ...(await ctx.graph.getEntities('module')),
    ];

    for (const entity of entities) {
      const outRels = await ctx.graph.getRelationships(entity.id, 'out');
      const depCount = outRels.filter(
        (r) => r.type === 'imports' || r.type === 'depends_on' || r.type === 'calls',
      ).length;

      if (depCount > threshold) {
        const loc = locationFromEntity(entity);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `God module detected: ${entity.name}`,
            description: `'${entity.name}' has ${depCount} outgoing dependencies (threshold: ${threshold}). This indicates the module has too many responsibilities and should be decomposed.`,
            severity: depCount > threshold * 2 ? 'high' : 'medium',
            category: 'architecture',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `${depCount} outgoing dependencies found`,
                entity_ids: [entity.id],
                confidence: 1.0,
                data: { dependency_count: depCount, threshold },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Decompose '${entity.name}' using the Single Responsibility Principle. Extract cohesive groups of functionality into separate modules.`,
            confidence: 0.85,
            tags: ['god-module', 'architecture', 'srp'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 3: Dead Code ──────────────────────────────────────────────

  /**
   * Find functions with zero incoming `calls` relationships and no
   * `exports` relationship, suggesting they are dead code.
   *
   * @param ctx - Analysis context.
   * @returns Findings for each dead code candidate.
   */
  private async detectDeadCode(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');

    for (const fn of functions) {
      const inRels = await ctx.graph.getRelationships(fn.id, 'in');
      const hasCaller = inRels.some((r) => r.type === 'calls');
      const isExported = inRels.some((r) => r.type === 'exports') ||
        (await ctx.graph.getRelationships(fn.id, 'out')).some((r) => r.type === 'exports');

      // Also check entity tags/properties for export markers
      const hasExportTag = fn.tags.includes('exported') || fn.properties['exported'] === true;

      if (!hasCaller && !isExported && !hasExportTag) {
        const loc = locationFromEntity(fn);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Potentially dead code: ${fn.name}`,
            description: `Function '${fn.name}' has no callers and is not exported. It may be dead code that can be safely removed.`,
            severity: 'low',
            category: 'architecture',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `No incoming 'calls' relationships and no export found`,
                entity_ids: [fn.id],
                confidence: 0.7,
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix: `Verify that '${fn.name}' is truly unused (it may be invoked dynamically), then remove it to reduce maintenance burden.`,
            confidence: 0.7,
            tags: ['dead-code', 'architecture', 'cleanup'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 4: Tight Coupling ─────────────────────────────────────────

  /**
   * Calculate afferent/efferent coupling ratios per module and flag
   * modules with excessive instability (I > 0.8) or complete
   * stability (I = 0) with high afferent coupling (rigid core).
   *
   * @param ctx - Analysis context.
   * @returns Findings for tightly coupled modules.
   */
  private async detectTightCoupling(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const modules = await ctx.graph.getEntities('module');

    const metrics: CouplingMetrics[] = [];
    for (const mod of modules) {
      const inRels = await ctx.graph.getRelationships(mod.id, 'in');
      const outRels = await ctx.graph.getRelationships(mod.id, 'out');

      const afferent = inRels.filter(
        (r) => r.type === 'imports' || r.type === 'depends_on',
      ).length;
      const efferent = outRels.filter(
        (r) => r.type === 'imports' || r.type === 'depends_on',
      ).length;
      const total = afferent + efferent;
      const instability = total === 0 ? 0 : efferent / total;

      metrics.push({ entity: mod, afferent, efferent, instability });
    }

    for (const m of metrics) {
      // Highly unstable modules with many dependencies
      if (m.instability > 0.8 && m.efferent > 5) {
        const loc = locationFromEntity(m.entity);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Highly unstable module: ${m.entity.name}`,
            description: `Module '${m.entity.name}' has an instability ratio of ${m.instability.toFixed(2)} (Ce=${m.efferent}, Ca=${m.afferent}). It depends on many modules but is depended on by few, making it prone to cascading changes.`,
            severity: 'medium',
            category: 'architecture',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `Instability: ${m.instability.toFixed(2)}, Efferent: ${m.efferent}, Afferent: ${m.afferent}`,
                entity_ids: [m.entity.id],
                confidence: 0.9,
                data: { instability: m.instability, afferent: m.afferent, efferent: m.efferent },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Reduce outgoing dependencies by introducing abstractions (interfaces) or extracting shared functionality into stable utility modules.',
            confidence: 0.8,
            tags: ['coupling', 'instability', 'architecture'],
          }),
        );
      }

      // Rigid core modules with extremely high afferent coupling
      if (m.afferent > 10 && m.instability === 0) {
        const loc = locationFromEntity(m.entity);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Rigid core module: ${m.entity.name}`,
            description: `Module '${m.entity.name}' has ${m.afferent} dependents but no outgoing dependencies. Changes to this module will require updating many consumers.`,
            severity: 'medium',
            category: 'architecture',
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `Afferent coupling: ${m.afferent}, zero efferent coupling`,
                entity_ids: [m.entity.id],
                confidence: 0.85,
                data: { afferent: m.afferent, efferent: m.efferent },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              'Ensure the module has a stable, well-defined API. Consider versioning or adding an interface layer to buffer consumers from internal changes.',
            confidence: 0.75,
            tags: ['coupling', 'rigid-core', 'architecture'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 5: Missing Abstractions ───────────────────────────────────

  /**
   * Detect multiple concrete class implementations that share the
   * same relationship patterns (e.g. they all `implement` nothing)
   * suggesting they should share a common interface.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing abstractions.
   */
  private async detectMissingAbstractions(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const classes = await ctx.graph.getEntities('class');

    // Group classes by module (via containing file or module)
    const classesByModule = new Map<string, Entity[]>();
    for (const cls of classes) {
      const inRels = await ctx.graph.getRelationships(cls.id, 'in');
      const containedBy = inRels.find((r) => r.type === 'contains');
      const moduleId = containedBy?.source_id ?? 'unknown';
      const existing = classesByModule.get(moduleId) ?? [];
      existing.push(cls);
      classesByModule.set(moduleId, existing);
    }

    // For each group of classes in the same module, check if they
    // implement any interface
    for (const [_moduleId, classGroup] of classesByModule) {
      if (classGroup.length < 3) continue;

      const withoutInterface: Entity[] = [];
      for (const cls of classGroup) {
        const outRels = await ctx.graph.getRelationships(cls.id, 'out');
        const hasInterface = outRels.some(
          (r) => r.type === 'implements' || r.type === 'extends',
        );
        if (!hasInterface) {
          withoutInterface.push(cls);
        }
      }

      if (withoutInterface.length >= 3) {
        const names = withoutInterface.map((c) => c.name).join(', ');
        const entityIds = withoutInterface.map((c) => c.id);
        const locations = withoutInterface
          .map((c) => locationFromEntity(c))
          .filter((l): l is NonNullable<typeof l> => l != null);

        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: 'Missing shared abstraction',
            description: `Classes ${names} coexist without a common interface or base class. Consider extracting a shared abstraction to enable polymorphism and reduce duplication.`,
            severity: 'medium',
            category: 'architecture',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `${withoutInterface.length} concrete classes without shared interface`,
                entity_ids: entityIds,
                confidence: 0.7,
                data: { class_names: withoutInterface.map((c) => c.name) },
              }),
            ],
            locations,
            suggested_fix:
              'Extract a shared interface or abstract base class that captures the common contract between these implementations.',
            confidence: 0.65,
            tags: ['missing-abstraction', 'architecture', 'design-pattern'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 6: Layer Violations ───────────────────────────────────────

  /** Layer ordering from highest to lowest. */
  private static readonly LAYER_ORDER: Record<string, number> = {
    presentation: 0,
    ui: 0,
    controller: 1,
    api: 1,
    service: 2,
    business: 2,
    domain: 3,
    data: 4,
    infrastructure: 5,
    infra: 5,
  };

  /**
   * Detect imports that cross architectural layer boundaries in the
   * wrong direction (lower layers importing from higher layers).
   *
   * Layers are inferred from directory names or entity tags.
   *
   * @param ctx - Analysis context.
   * @returns Findings for layer violations.
   */
  private async detectLayerViolations(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const files = await ctx.graph.getEntities('file');
    const modules = await ctx.graph.getEntities('module');
    const entities = [...files, ...modules];

    const getLayer = (entity: Entity): string | undefined => {
      // Check tags first
      for (const tag of entity.tags) {
        if (ArchitectureAnalyzer.LAYER_ORDER[tag.toLowerCase()] !== undefined) {
          return tag.toLowerCase();
        }
      }
      // Check path segments
      const path = entity.source_location?.file ?? entity.qualified_name;
      for (const layerName of Object.keys(ArchitectureAnalyzer.LAYER_ORDER)) {
        if (path.toLowerCase().includes(`/${layerName}/`) || path.toLowerCase().includes(`\\${layerName}\\`)) {
          return layerName;
        }
      }
      return undefined;
    };

    const entityMap = new Map(entities.map((e) => [e.id, e]));

    for (const entity of entities) {
      const sourceLayer = getLayer(entity);
      if (sourceLayer === undefined) continue;
      const sourceOrder = ArchitectureAnalyzer.LAYER_ORDER[sourceLayer]!;

      const outRels = await ctx.graph.getRelationships(entity.id, 'out');
      for (const rel of outRels) {
        if (rel.type !== 'imports' && rel.type !== 'depends_on') continue;
        const target = entityMap.get(rel.target_id);
        if (!target) continue;

        const targetLayer = getLayer(target);
        if (targetLayer === undefined) continue;
        const targetOrder = ArchitectureAnalyzer.LAYER_ORDER[targetLayer]!;

        // Violation: lower layer (higher number) importing from upper layer (lower number)
        if (sourceOrder > targetOrder) {
          const sourceLoc = locationFromEntity(entity);
          findings.push(
            createFinding({
              analyzer_id: this.id,
              title: `Layer violation: ${sourceLayer} → ${targetLayer}`,
              description: `'${entity.name}' in the '${sourceLayer}' layer imports '${target.name}' from the '${targetLayer}' layer. Dependencies should flow downward (presentation → service → domain → data), not upward.`,
              severity: 'high',
              category: 'architecture',
              evidence: [
                createEvidence({
                  type: 'code',
                  source: this.id,
                  description: `Import from ${sourceLayer} (layer ${sourceOrder}) to ${targetLayer} (layer ${targetOrder})`,
                  entity_ids: [entity.id, target.id],
                  confidence: 0.85,
                  data: {
                    source_layer: sourceLayer,
                    target_layer: targetLayer,
                    source_order: sourceOrder,
                    target_order: targetOrder,
                  },
                }),
              ],
              locations: sourceLoc ? [sourceLoc] : [],
              suggested_fix:
                'Use dependency inversion: define an interface in the lower layer and have the upper layer implement it. Or move the shared code into a layer accessible to both.',
              confidence: 0.8,
              tags: ['layer-violation', 'architecture', 'dependency-inversion'],
            }),
          );
        }
      }
    }

    return findings;
  }

  // ── Rule 7: Duplicate Functionality ────────────────────────────────

  /**
   * Find functions with very similar names and parameter signatures,
   * suggesting duplicated functionality that should be consolidated.
   *
   * @param ctx - Analysis context.
   * @returns Findings for duplicate functionality.
   */
  private async detectDuplicateFunctionality(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const functions = await ctx.graph.getEntities('function');
    if (functions.length < 2) return findings;

    // Normalize function names for comparison
    const normalize = (name: string): string =>
      name.toLowerCase().replace(/[_-]/g, '').replace(/\d+/g, '');

    // Group by normalized name
    const groups = new Map<string, Entity[]>();
    for (const fn of functions) {
      const key = normalize(fn.name);
      if (key.length < 3) continue; // skip tiny names
      const existing = groups.get(key) ?? [];
      existing.push(fn);
      groups.set(key, existing);
    }

    const reported = new Set<string>();
    for (const [normalizedName, group] of groups) {
      if (group.length < 2) continue;
      const key = group.map((f) => f.id).sort().join(',');
      if (reported.has(key)) continue;
      reported.add(key);

      // Additional check: compare parameter counts if available
      const paramCounts = group.map((f) => {
        const params = f.properties['parameter_count'] ?? f.properties['params'];
        return typeof params === 'number' ? params : -1;
      });
      const sameParams = paramCounts.every((p) => p === paramCounts[0]);

      const names = group.map((f) => f.name).join(', ');
      const entityIds = group.map((f) => f.id);
      const locations = group
        .map((f) => locationFromEntity(f))
        .filter((l): l is NonNullable<typeof l> => l != null);

      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: `Possible duplicate functionality: ${normalizedName}`,
          description: `Functions ${names} have very similar names${sameParams ? ' and the same parameter count' : ''}. They may represent duplicated logic that should be consolidated.`,
          severity: 'low',
          category: 'architecture',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `${group.length} functions with similar name '${normalizedName}'`,
              entity_ids: entityIds,
              confidence: sameParams ? 0.8 : 0.6,
              data: { normalized_name: normalizedName, function_names: group.map((f) => f.name) },
            }),
          ],
          locations,
          suggested_fix:
            'Review these functions for duplication. If they perform the same task, consolidate into a single parameterized function.',
          confidence: sameParams ? 0.7 : 0.5,
          tags: ['duplicate-code', 'architecture', 'dry'],
        }),
      );
    }

    return findings;
  }
}

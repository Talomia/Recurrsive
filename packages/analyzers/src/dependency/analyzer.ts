/**
 * @module @recurrsive/analyzers/dependency
 *
 * Dependency vulnerability analyzer that detects supply-chain risks
 * such as outdated dependencies, unpinned versions, missing lockfiles,
 * known vulnerable packages, and deprecated dependency usage.
 *
 * @packageDocumentation
 */

import type {
  Analyzer,
  AnalysisContext,
  Finding,
} from '@recurrsive/core';
import { createFinding, createEvidence, locationFromEntity } from '../base/helpers.js';

/** Packages with well-known CVEs at specific versions. */
const KNOWN_VULNERABLE_PACKAGES: Array<{
  name: string;
  safeVersion: string;
  description: string;
}> = [
  { name: 'lodash', safeVersion: '4.17.21', description: 'Prototype pollution (CVE-2021-23337)' },
  { name: 'minimist', safeVersion: '1.2.6', description: 'Prototype pollution (CVE-2021-44906)' },
  { name: 'node-fetch', safeVersion: '2.6.7', description: 'Exposure of sensitive information (CVE-2022-0235)' },
  { name: 'glob-parent', safeVersion: '5.1.2', description: 'Regular expression DoS (CVE-2020-28469)' },
  { name: 'trim-newlines', safeVersion: '3.0.1', description: 'Regular expression DoS (CVE-2021-33623)' },
  { name: 'path-parse', safeVersion: '1.0.7', description: 'Regular expression DoS (CVE-2021-23343)' },
  { name: 'axios', safeVersion: '0.21.2', description: 'Server-Side Request Forgery (CVE-2021-3749)' },
  { name: 'json5', safeVersion: '2.2.2', description: 'Prototype pollution (CVE-2022-46175)' },
  { name: 'semver', safeVersion: '7.5.2', description: 'Regular expression DoS (CVE-2022-25883)' },
  { name: 'log4j', safeVersion: '2.17.1', description: 'Remote code execution (CVE-2021-44228)' },
  { name: 'log4j-core', safeVersion: '2.17.1', description: 'Remote code execution (CVE-2021-44228)' },
];

/**
 * Packages that are GENUINELY deprecated (archived/unmaintained, deprecation
 * announced by their authors). Only these may be reported as "deprecated" —
 * actively maintained packages (uuid, mkdirp, rimraf, moment, …) must never
 * be labeled deprecated; asserting so would be false.
 */
const DEPRECATED_PACKAGES: Array<{ name: string; replacement: string }> = [
  { name: 'request', replacement: 'node-fetch, axios, or undici' },
  { name: 'tslint', replacement: 'eslint with @typescript-eslint' },
  { name: 'nomnom', replacement: 'commander or yargs' },
  { name: 'istanbul', replacement: 'nyc or c8' },
  { name: 'jade', replacement: 'pug' },
  { name: 'popper.js', replacement: '@popperjs/core' },
];

/**
 * Actively maintained packages whose functionality now has a built-in or
 * broadly preferred alternative. These are informational suggestions only —
 * NOT deprecations — and are reported at `info` severity.
 */
const BUILTIN_ALTERNATIVE_PACKAGES: Array<{ name: string; alternative: string }> = [
  { name: 'moment', alternative: 'date-fns, dayjs, or the Temporal API' },
  { name: 'consolidate', alternative: 'direct template engine usage' },
  { name: 'querystring', alternative: 'URLSearchParams (built-in)' },
  { name: 'mkdirp', alternative: 'fs.mkdirSync with { recursive: true } (built-in)' },
  { name: 'rimraf', alternative: 'fs.rmSync with { recursive: true } (built-in)' },
  { name: 'uuid', alternative: 'crypto.randomUUID() (built-in, Node 19+)' },
];

/**
 * Analyzes the knowledge graph for dependency-related vulnerabilities
 * and supply-chain risks.
 *
 * ### Rules
 * 1. Outdated dependencies — detect deps with major version gaps
 * 2. Missing lockfile — check if lockfile entity exists
 * 3. Known vulnerable patterns — detect deps known to have CVE patterns
 * 4. Unpinned dependencies — deps using `*` or `latest`
 * 5. Excessive dependencies — too many direct deps (>50)
 * 6. Dev dependency in production — devDeps used in production code
 * 7. Missing security policy — no SECURITY.md file
 * 8. Deprecated dependency usage — detect commonly deprecated packages
 */
export class DependencyAnalyzer implements Analyzer {
  readonly id = 'dependency.vulnerabilities';
  readonly name = 'Dependency Vulnerability Analyzer';
  readonly description =
    'Detects dependency vulnerabilities including outdated packages, unpinned versions, missing lockfiles, and known CVE patterns.';
  readonly version = '0.1.0';
  readonly categories = ['security' as const];

  /** @inheritdoc */
  async initialize(_ctx: AnalysisContext): Promise<void> {}

  /** @inheritdoc */
  async analyze(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    const [
      outdated,
      lockfile,
      knownVulns,
      unpinned,
      excessive,
      devInProd,
      securityPolicy,
      deprecated,
    ] = await Promise.all([
      this.detectOutdatedDependencies(ctx),
      this.detectMissingLockfile(ctx),
      this.detectKnownVulnerablePatterns(ctx),
      this.detectUnpinnedDependencies(ctx),
      this.detectExcessiveDependencies(ctx),
      this.detectDevDependencyInProduction(ctx),
      this.detectMissingSecurityPolicy(ctx),
      this.detectDeprecatedDependencies(ctx),
    ]);

    findings.push(
      ...outdated,
      ...lockfile,
      ...knownVulns,
      ...unpinned,
      ...excessive,
      ...devInProd,
      ...securityPolicy,
      ...deprecated,
    );

    return findings;
  }

  /** @inheritdoc */
  async finalize(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Systemic check: high ratio of vulnerable dependencies
    const dependencies = await ctx.graph.getEntities('dependency');
    if (dependencies.length >= 5) {
      const vulnerable = dependencies.filter(
        (d) =>
          d.properties['has_vulnerability'] === true ||
          d.tags.includes('vulnerable') ||
          d.tags.includes('cve'),
      );
      const ratio = vulnerable.length / dependencies.length;
      if (ratio > 0.3) {
        findings.push(
          createFinding({
            title: 'High proportion of vulnerable dependencies',
            description:
              `${vulnerable.length} out of ${dependencies.length} dependencies (${Math.round(ratio * 100)}%) ` +
              `have known vulnerabilities. This indicates systemic supply-chain risk. ` +
              `Consider running a comprehensive audit and upgrading dependencies.`,
            severity: 'critical',
            category: 'security',
            analyzer_id: this.id,
            evidence: [
              createEvidence({
                type: 'metric',
                source: this.id,
                description: `${vulnerable.length}/${dependencies.length} dependencies are vulnerable`,
                entity_ids: [],
                confidence: 0.9,
                data: { total: dependencies.length, vulnerable: vulnerable.length, ratio },
              }),
            ],
            locations: [],
            confidence: 0.9,
            tags: ['supply-chain', 'security', 'dependencies'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 1: Outdated Dependencies ──────────────────────────────────

  /**
   * Detect dependencies with major version gaps or marked as outdated.
   *
   * @param ctx - Analysis context.
   * @returns Findings for outdated dependencies.
   */
  private async detectOutdatedDependencies(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dependencies = await ctx.graph.getEntities('dependency');

    for (const dep of dependencies) {
      const currentVersion = (dep.properties['version'] as string | undefined) ?? '';
      const latestVersion = (dep.properties['latest_version'] as string | undefined) ?? '';

      const isOutdated =
        dep.properties['is_outdated'] === true ||
        dep.tags.includes('outdated') ||
        dep.properties['major_version_behind'] === true;

      // Check for major version gap via version properties
      let hasMajorGap = false;
      if (currentVersion && latestVersion) {
        const currentMajor = parseInt(currentVersion.replace(/^[^0-9]*/, '').split('.')[0] ?? '0', 10);
        const latestMajor = parseInt(latestVersion.replace(/^[^0-9]*/, '').split('.')[0] ?? '0', 10);
        hasMajorGap = latestMajor - currentMajor >= 2;
      }

      if (isOutdated || hasMajorGap) {
        const loc = locationFromEntity(dep);
        const severity = hasMajorGap ? 'high' : 'medium';
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Outdated dependency: ${dep.name}`,
            description:
              `Dependency '${dep.name}'${currentVersion ? ` (${currentVersion})` : ''} is outdated` +
              `${latestVersion ? `, latest is ${latestVersion}` : ''}. ` +
              `Outdated dependencies may contain unpatched security vulnerabilities and miss important bug fixes.`,
            severity,
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `Dependency is outdated${hasMajorGap ? ' with major version gap' : ''}`,
                entity_ids: [dep.id],
                confidence: 0.8,
                data: { current_version: currentVersion, latest_version: latestVersion },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              `Update '${dep.name}' to the latest stable version. Review the changelog for breaking changes before upgrading.`,
            confidence: 0.8,
            tags: ['outdated-dependency', 'security', 'supply-chain'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 2: Missing Lockfile ───────────────────────────────────────

  /**
   * Check if a lockfile entity exists in the project.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing lockfile.
   */
  private async detectMissingLockfile(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const files = await ctx.graph.getEntities('file');

    const lockfilePatterns = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'bun.lockb',
      'Gemfile.lock',
      'Cargo.lock',
      'poetry.lock',
      'composer.lock',
      'go.sum',
    ];

    const hasLockfile = files.some(
      (f) =>
        lockfilePatterns.some((p) => f.name.toLowerCase() === p.toLowerCase()) ||
        f.tags.includes('lockfile'),
    );

    // Only flag if there are dependencies but no lockfile
    const dependencies = await ctx.graph.getEntities('dependency');
    if (dependencies.length > 0 && !hasLockfile) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Missing dependency lockfile',
          description:
            `No lockfile (package-lock.json, yarn.lock, pnpm-lock.yaml, etc.) was detected ` +
            `despite ${dependencies.length} dependencies being present. Without a lockfile, builds are ` +
            `non-deterministic and vulnerable to supply-chain attacks via version drift.`,
          severity: 'high',
          category: 'security',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: `${dependencies.length} dependencies found, no lockfile`,
              entity_ids: [],
              confidence: 0.9,
              data: { dependency_count: dependencies.length },
            }),
          ],
          locations: [],
          suggested_fix:
            'Generate a lockfile by running `npm install`, `yarn install`, or `pnpm install`. Commit the lockfile to version control.',
          confidence: 0.85,
          tags: ['lockfile', 'security', 'supply-chain'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 3: Known Vulnerable Patterns ──────────────────────────────

  /**
   * Detect dependencies known to have CVE patterns at common versions.
   *
   * @param ctx - Analysis context.
   * @returns Findings for known vulnerable dependencies.
   */
  private async detectKnownVulnerablePatterns(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dependencies = await ctx.graph.getEntities('dependency');

    for (const dep of dependencies) {
      const depName = dep.name.toLowerCase();
      const version = (dep.properties['version'] as string | undefined) ?? '';

      for (const vuln of KNOWN_VULNERABLE_PACKAGES) {
        if (depName !== vuln.name.toLowerCase()) continue;

        // If we have version info, compare; otherwise flag if tagged
        const hasVulnTag =
          dep.tags.includes('vulnerable') ||
          dep.tags.includes('cve') ||
          dep.properties['has_vulnerability'] === true;

        let isVulnerable = hasVulnTag;

        if (version && !isVulnerable) {
          // Simple version comparison: check if current < safe
          isVulnerable = this.isVersionLessThan(version, vuln.safeVersion);
        }

        // If no version info at all, flag with lower confidence as a warning
        if (!version && !hasVulnTag) {
          isVulnerable = false; // Don't flag without evidence
        }

        if (isVulnerable) {
          const loc = locationFromEntity(dep);
          findings.push(
            createFinding({
              analyzer_id: this.id,
              title: `Known vulnerability: ${dep.name}`,
              description:
                `Dependency '${dep.name}'${version ? ` (${version})` : ''} has a known vulnerability: ` +
                `${vuln.description}. Update to version ${vuln.safeVersion} or later.`,
              severity: 'critical',
              category: 'security',
              evidence: [
                createEvidence({
                  type: 'code',
                  source: this.id,
                  description: vuln.description,
                  entity_ids: [dep.id],
                  confidence: 0.9,
                  data: {
                    package: dep.name,
                    current_version: version,
                    safe_version: vuln.safeVersion,
                  },
                }),
              ],
              locations: loc ? [loc] : [],
              suggested_fix:
                `Update '${dep.name}' to at least version ${vuln.safeVersion}. Run 'npm audit fix' or manually update the dependency.`,
              confidence: 0.9,
              tags: ['known-cve', 'security', 'supply-chain', dep.name.toLowerCase()],
            }),
          );
        }
      }
    }

    return findings;
  }

  // ── Rule 4: Unpinned Dependencies ──────────────────────────────────

  /**
   * Detect dependencies using `*`, `latest`, or overly broad version
   * ranges.
   *
   * @param ctx - Analysis context.
   * @returns Findings for unpinned dependencies.
   */
  private async detectUnpinnedDependencies(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dependencies = await ctx.graph.getEntities('dependency');

    for (const dep of dependencies) {
      const version = (dep.properties['version'] as string | undefined) ?? '';
      const versionRange = (dep.properties['version_range'] as string | undefined) ?? version;

      const isUnpinned =
        versionRange === '*' ||
        versionRange.toLowerCase() === 'latest' ||
        dep.tags.includes('unpinned') ||
        dep.properties['unpinned'] === true;

      if (isUnpinned) {
        const loc = locationFromEntity(dep);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Unpinned dependency: ${dep.name}`,
            description:
              `Dependency '${dep.name}' uses version '${versionRange}' which is not pinned. ` +
              `Unpinned dependencies can silently upgrade to versions with breaking changes or ` +
              `vulnerabilities.`,
            severity: 'high',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `Version specifier: ${versionRange}`,
                entity_ids: [dep.id],
                confidence: 0.95,
                data: { version_range: versionRange },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              `Pin '${dep.name}' to a specific version (e.g., "1.2.3") or use a caret range ("^1.2.3"). Ensure a lockfile is committed.`,
            confidence: 0.9,
            tags: ['unpinned-dependency', 'security', 'supply-chain'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 5: Excessive Dependencies ─────────────────────────────────

  /**
   * Detect projects with too many direct dependencies (>50).
   *
   * @param ctx - Analysis context.
   * @returns Findings for excessive dependencies.
   */
  private async detectExcessiveDependencies(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dependencies = await ctx.graph.getEntities('dependency');

    const threshold =
      (ctx.config.custom['excessive_deps_threshold'] as number | undefined) ?? 50;

    // Filter to direct (non-dev) dependencies
    const directDeps = dependencies.filter(
      (d) =>
        d.properties['dev'] !== true &&
        !d.tags.includes('dev') &&
        !d.tags.includes('devDependency'),
    );

    if (directDeps.length > threshold) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Excessive number of dependencies',
          description:
            `The project has ${directDeps.length} direct production dependencies (threshold: ${threshold}). ` +
            `A large dependency tree increases attack surface, slows installs, and makes auditing harder.`,
          severity: 'medium',
          category: 'security',
          evidence: [
            createEvidence({
              type: 'metric',
              source: this.id,
              description: `${directDeps.length} direct production dependencies`,
              entity_ids: [],
              confidence: 1.0,
              data: { count: directDeps.length, threshold },
            }),
          ],
          locations: [],
          suggested_fix:
            'Audit your dependencies and remove unused packages. Consider using built-in Node.js APIs where possible and consolidating overlapping libraries.',
          confidence: 0.85,
          tags: ['excessive-dependencies', 'security', 'supply-chain'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 6: Dev Dependency in Production ───────────────────────────

  /**
   * Detect devDependencies used in production source code.
   *
   * @param ctx - Analysis context.
   * @returns Findings for dev dependencies in production.
   */
  private async detectDevDependencyInProduction(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dependencies = await ctx.graph.getEntities('dependency');

    for (const dep of dependencies) {
      const isDev =
        dep.properties['dev'] === true ||
        dep.tags.includes('dev') ||
        dep.tags.includes('devDependency');

      const usedInProd =
        dep.properties['used_in_production'] === true ||
        dep.tags.includes('production-import') ||
        dep.tags.includes('used-in-production');

      if (isDev && usedInProd) {
        const loc = locationFromEntity(dep);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Dev dependency used in production: ${dep.name}`,
            description:
              `Dependency '${dep.name}' is listed as a devDependency but is imported in production code. ` +
              `This will cause runtime failures in production builds where devDependencies are not installed.`,
            severity: 'high',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: 'Dev dependency imported in production source',
                entity_ids: [dep.id],
                confidence: 0.85,
                data: { is_dev: true, used_in_production: true },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              `Move '${dep.name}' from devDependencies to dependencies if it is needed at runtime, or remove the production import.`,
            confidence: 0.8,
            tags: ['dev-in-production', 'security', 'dependencies'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Rule 7: Missing Security Policy ────────────────────────────────

  /**
   * Check if SECURITY.md file exists in the project.
   *
   * @param ctx - Analysis context.
   * @returns Findings for missing security policy.
   */
  private async detectMissingSecurityPolicy(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const files = await ctx.graph.getEntities('file');

    const hasSecurityPolicy = files.some(
      (f) =>
        f.name.toLowerCase() === 'security.md' ||
        f.name.toLowerCase() === '.github/security.md' ||
        f.tags.includes('security-policy'),
    );

    // Only flag for projects that appear to be published/shared
    const dependencies = await ctx.graph.getEntities('dependency');
    if (dependencies.length > 0 && !hasSecurityPolicy) {
      findings.push(
        createFinding({
          analyzer_id: this.id,
          title: 'Missing security policy (SECURITY.md)',
          description:
            'No SECURITY.md file was found in the project. A security policy helps users and ' +
            'researchers report vulnerabilities responsibly. Without one, security issues may ' +
            'be reported publicly or not reported at all.',
          severity: 'low',
          category: 'security',
          evidence: [
            createEvidence({
              type: 'code',
              source: this.id,
              description: 'No SECURITY.md file found in project files',
              entity_ids: [],
              confidence: 0.9,
              data: { files_scanned: files.length },
            }),
          ],
          locations: [],
          suggested_fix:
            'Create a SECURITY.md file in the project root documenting how to report security vulnerabilities, expected response times, and supported versions.',
          confidence: 0.85,
          tags: ['security-policy', 'security', 'governance'],
        }),
      );
    }

    return findings;
  }

  // ── Rule 8: Deprecated Dependency Usage ────────────────────────────

  /**
   * Detect commonly deprecated packages that have well-known
   * replacements.
   *
   * @param ctx - Analysis context.
   * @returns Findings for deprecated dependencies.
   */
  private async detectDeprecatedDependencies(ctx: AnalysisContext): Promise<Finding[]> {
    const findings: Finding[] = [];
    const dependencies = await ctx.graph.getEntities('dependency');

    for (const dep of dependencies) {
      const depName = dep.name.toLowerCase();

      // Check explicit deprecation markers
      const isMarkedDeprecated =
        dep.properties['deprecated'] === true ||
        dep.tags.includes('deprecated');

      // Check against known deprecated packages
      const knownDeprecated = DEPRECATED_PACKAGES.find(
        (d) => d.name.toLowerCase() === depName,
      );

      if (isMarkedDeprecated || knownDeprecated) {
        const replacement = knownDeprecated?.replacement ?? 'a modern alternative';
        const loc = locationFromEntity(dep);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Deprecated dependency: ${dep.name}`,
            description:
              `Dependency '${dep.name}' is deprecated. Deprecated packages no longer receive ` +
              `security updates or bug fixes. Consider migrating to ${replacement}.`,
            severity: 'medium',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `Package is deprecated, recommended replacement: ${replacement}`,
                entity_ids: [dep.id],
                confidence: 0.85,
                data: {
                  package: dep.name,
                  replacement,
                  known_deprecated: !!knownDeprecated,
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              `Replace '${dep.name}' with ${replacement}. Check the migration guide if available.`,
            confidence: 0.8,
            tags: ['deprecated-dependency', 'security', 'maintenance'],
          }),
        );
        continue;
      }

      // Maintained packages with a built-in/preferred alternative: an
      // informational suggestion, never a (false) deprecation claim.
      const builtinAlternative = BUILTIN_ALTERNATIVE_PACKAGES.find(
        (d) => d.name.toLowerCase() === depName,
      );
      if (builtinAlternative) {
        const loc = locationFromEntity(dep);
        findings.push(
          createFinding({
            analyzer_id: this.id,
            title: `Consider built-in alternative to ${dep.name}`,
            description:
              `Dependency '${dep.name}' is still maintained, but its functionality is now ` +
              `available via ${builtinAlternative.alternative}. Switching can reduce the ` +
              `dependency footprint. This is a suggestion, not a deprecation.`,
            severity: 'info',
            category: 'security',
            evidence: [
              createEvidence({
                type: 'code',
                source: this.id,
                description: `Built-in/preferred alternative available: ${builtinAlternative.alternative}`,
                entity_ids: [dep.id],
                confidence: 0.8,
                data: {
                  package: dep.name,
                  alternative: builtinAlternative.alternative,
                },
              }),
            ],
            locations: loc ? [loc] : [],
            suggested_fix:
              `If convenient, replace '${dep.name}' with ${builtinAlternative.alternative}.`,
            confidence: 0.75,
            tags: ['builtin-alternative', 'maintenance', 'dependencies'],
          }),
        );
      }
    }

    return findings;
  }

  // ── Utility ────────────────────────────────────────────────────────

  /**
   * Simple semver comparison: returns true if `a < b`.
   * Handles basic `x.y.z` versions.
   */
  private isVersionLessThan(a: string, b: string): boolean {
    const parse = (v: string): number[] =>
      v.replace(/^[^0-9]*/, '').split('.').map((s) => parseInt(s, 10) || 0);

    const aParts = parse(a);
    const bParts = parse(b);
    const len = Math.max(aParts.length, bParts.length);

    for (let i = 0; i < len; i++) {
      const av = aParts[i] ?? 0;
      const bv = bParts[i] ?? 0;
      if (av < bv) return true;
      if (av > bv) return false;
    }
    return false;
  }
}

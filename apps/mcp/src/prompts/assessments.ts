/**
 * @module @recurrsive/mcp/prompts/assessments
 *
 * Additional MCP prompt templates for Recurrsive.
 *
 * Prompts provide reusable templates that AI assistants can use to
 * guide conversations about analysis results:
 *
 * - `architecture_review` — Structured prompt for reviewing system architecture
 * - `security_assessment` — Structured prompt for security assessment
 * - `cost_analysis` — Structured prompt for cost optimization analysis
 *
 * @packageDocumentation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prompt Registration
// ---------------------------------------------------------------------------

/**
 * Register all assessment prompt templates with the server.
 *
 * @param server - The MCP server instance to register prompts on.
 */
export function registerAssessmentPrompts(server: McpServer): void {
  // ── architecture_review ────────────────────────────────────────────────

  server.prompt(
    'architecture_review',
    'Provides a structured prompt template for reviewing system architecture. ' +
    'Guides the AI through analyzing coupling, modularity, dependency patterns, ' +
    'and architectural anti-patterns using the knowledge graph.',
    {
      focus_area: z
        .string()
        .optional()
        .describe(
          'Optional focus area for the review: coupling, modularity, ' +
          'dependencies, patterns. Defaults to a comprehensive review.',
        ),
    },
    async ({ focus_area }) => {
      let focusGuidance: string;
      switch (focus_area) {
        case 'coupling':
          focusGuidance = [
            'Focus specifically on **coupling analysis**:',
            '- Identify tightly coupled components that change together frequently',
            '- Find entities with high fan-in or fan-out counts',
            '- Look for circular dependencies between modules',
            '- Measure afferent and efferent coupling per module',
            '- Suggest decoupling strategies (interfaces, events, dependency injection)',
          ].join('\n');
          break;
        case 'modularity':
          focusGuidance = [
            'Focus specifically on **modularity assessment**:',
            '- Evaluate the cohesion of each module (are related things grouped together?)',
            '- Identify God classes/modules that handle too many responsibilities',
            '- Check for proper separation of concerns across layers',
            '- Assess package/module boundary clarity',
            '- Suggest module decomposition or consolidation where appropriate',
          ].join('\n');
          break;
        case 'dependencies':
          focusGuidance = [
            'Focus specifically on **dependency analysis**:',
            '- Map the full dependency tree of the project',
            '- Identify deeply nested dependency chains',
            '- Find circular or diamond dependency patterns',
            '- Check for unnecessary transitive dependencies',
            '- Assess dependency freshness and security posture',
            '- Use the `trace_dependency` tool to examine specific chains',
          ].join('\n');
          break;
        case 'patterns':
          focusGuidance = [
            'Focus specifically on **architectural patterns**:',
            '- Identify the dominant architectural pattern(s) in use',
            '- Check for consistency in pattern application across the codebase',
            '- Detect anti-patterns (e.g., big ball of mud, spaghetti architecture)',
            '- Evaluate adherence to SOLID principles',
            '- Assess the maturity of the service/module boundaries',
          ].join('\n');
          break;
        default:
          focusGuidance = [
            'Perform a **comprehensive architecture review** covering:',
            '- Overall architectural style and patterns',
            '- Component coupling and cohesion',
            '- Dependency structure and health',
            '- Modularity and separation of concerns',
          ].join('\n');
          break;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please perform an architecture review of the analyzed project.`,
                ``,
                focusGuidance,
                ``,
                `Structure your review as follows:`,
                ``,
                `## 1. Architecture Overview`,
                `Describe the current architecture style (monolith, microservices, ` +
                `modular monolith, etc.) and the key structural patterns observed.`,
                `Use the \`query_graph\` tool to explore entity types and relationships.`,
                ``,
                `## 2. Component Analysis`,
                `For each major component/module:`,
                `- Responsibilities and role`,
                `- Fan-in / fan-out (coupling metrics)`,
                `- Cohesion assessment`,
                `Use the \`get_entity\` and \`trace_dependency\` tools for detailed inspection.`,
                ``,
                `## 3. Dependency Health`,
                `Analyze the dependency graph for:`,
                `- Circular dependencies`,
                `- Deep dependency chains`,
                `- Highly coupled clusters`,
                `Use the \`trace_dependency\` and \`analyze_impact\` tools.`,
                ``,
                `## 4. Strengths`,
                `Identify 2-3 architectural strengths and well-designed areas.`,
                ``,
                `## 5. Concerns`,
                `Identify 3-5 architectural concerns, ranked by severity.`,
                `Reference specific opportunities from the analysis where applicable.`,
                `Use the \`get_opportunities\` tool filtered to category "architecture".`,
                ``,
                `## 6. Recommendations`,
                `Provide prioritized recommendations with effort estimates.`,
                `For each recommendation, explain the expected improvement.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── security_assessment ────────────────────────────────────────────────

  server.prompt(
    'security_assessment',
    'Provides a structured prompt template for performing a security ' +
    'assessment of the analyzed project. Covers API security, data ' +
    'protection, authentication, and common vulnerability patterns.',
    {
      scope: z
        .string()
        .optional()
        .describe(
          'Optional scope for the assessment: full, api, data, auth. ' +
          'Defaults to a full assessment.',
        ),
    },
    async ({ scope }) => {
      let scopeGuidance: string;
      switch (scope) {
        case 'api':
          scopeGuidance = [
            'Focus specifically on **API security**:',
            '- Authentication and authorization mechanisms on API endpoints',
            '- Input validation and sanitization',
            '- Rate limiting and abuse protection',
            '- API versioning and deprecation handling',
            '- CORS configuration and header security',
            '- Error handling and information leakage',
          ].join('\n');
          break;
        case 'data':
          scopeGuidance = [
            'Focus specifically on **data security**:',
            '- Data encryption at rest and in transit',
            '- PII handling and data classification',
            '- Database access patterns and SQL injection risks',
            '- Data retention and deletion policies',
            '- Backup and recovery security',
            '- Secrets management and environment variable handling',
          ].join('\n');
          break;
        case 'auth':
          scopeGuidance = [
            'Focus specifically on **authentication and authorization**:',
            '- Authentication mechanism strength (OAuth, JWT, sessions, etc.)',
            '- Password hashing and credential storage',
            '- Session management and token lifecycle',
            '- Role-based or attribute-based access control',
            '- Privilege escalation vectors',
            '- Multi-factor authentication support',
          ].join('\n');
          break;
        case 'full':
        default:
          scopeGuidance = [
            'Perform a **comprehensive security assessment** covering:',
            '- Authentication and authorization',
            '- API security posture',
            '- Data protection and privacy',
            '- Dependency vulnerabilities',
            '- Common vulnerability patterns (OWASP Top 10)',
          ].join('\n');
          break;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please perform a security assessment of the analyzed project.`,
                ``,
                scopeGuidance,
                ``,
                `Structure your assessment as follows:`,
                ``,
                `## 1. Security Posture Overview`,
                `Summarize the overall security posture based on analysis results.`,
                `Use the \`get_health_score\` tool and filter opportunities by ` +
                `category "security" using \`get_opportunities\`.`,
                ``,
                `## 2. Vulnerability Findings`,
                `List all security-related findings from the analysis.`,
                `Use the \`list_findings\` tool filtered to category "security".`,
                `For each finding, explain:`,
                `- The vulnerability type and severity`,
                `- Potential exploit scenarios`,
                `- Affected components (use \`get_entity\` for details)`,
                ``,
                `## 3. Attack Surface Analysis`,
                `Map the attack surface by identifying:`,
                `- External-facing endpoints and APIs`,
                `- Data ingestion points`,
                `- Third-party integrations`,
                `Use \`query_graph\` to find endpoints and external service entities.`,
                ``,
                `## 4. Dependency Security`,
                `Assess the security of dependencies:`,
                `- Known vulnerable packages`,
                `- Outdated dependencies with security patches available`,
                `- Transitive dependency risks`,
                ``,
                `## 5. Risk Matrix`,
                `Create a risk matrix table:`,
                ``,
                `| Risk | Likelihood | Impact | Severity | Mitigation |`,
                `| --- | --- | --- | --- | --- |`,
                ``,
                `## 6. Remediation Plan`,
                `Provide prioritized remediation steps:`,
                `- **Immediate** (< 1 day): Critical vulnerabilities`,
                `- **Short-term** (< 1 week): High-severity issues`,
                `- **Medium-term** (< 1 month): Hardening measures`,
                ``,
                `## 7. Security Best Practices`,
                `List 3-5 security best practices not yet adopted by the project.`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );

  // ── cost_analysis ──────────────────────────────────────────────────────

  server.prompt(
    'cost_analysis',
    'Provides a structured prompt template for analyzing and optimizing ' +
    'costs across infrastructure, AI/LLM usage, database operations, ' +
    'and compute resources.',
    {
      focus: z
        .string()
        .optional()
        .describe(
          'Optional focus area: infrastructure, ai, database, compute. ' +
          'Defaults to a comprehensive cost analysis.',
        ),
    },
    async ({ focus }) => {
      let focusGuidance: string;
      switch (focus) {
        case 'infrastructure':
          focusGuidance = [
            'Focus specifically on **infrastructure costs**:',
            '- Cloud resource provisioning and utilization rates',
            '- Over-provisioned or idle resources',
            '- Network transfer costs and optimization',
            '- Storage tiering and lifecycle policies',
            '- Reserved vs. on-demand pricing optimization',
          ].join('\n');
          break;
        case 'ai':
          focusGuidance = [
            'Focus specifically on **AI/LLM costs**:',
            '- Model selection efficiency (are expensive models used where cheaper ones suffice?)',
            '- Token usage patterns and optimization opportunities',
            '- Caching strategies for repeated LLM calls',
            '- Prompt engineering for cost reduction (shorter prompts, fewer rounds)',
            '- Model routing (use small models for simple tasks)',
            'Use `query_graph` with entity_type "model" to find all model usage.',
          ].join('\n');
          break;
        case 'database':
          focusGuidance = [
            'Focus specifically on **database costs**:',
            '- Query efficiency and N+1 query patterns',
            '- Index coverage and missing indexes',
            '- Storage growth projections',
            '- Read/write ratio optimization (caching, read replicas)',
            '- Connection pooling and resource utilization',
          ].join('\n');
          break;
        case 'compute':
          focusGuidance = [
            'Focus specifically on **compute costs**:',
            '- Function/service execution efficiency',
            '- Cold start impact and warm-up strategies',
            '- Memory allocation vs. actual usage',
            '- Batch processing vs. real-time trade-offs',
            '- Auto-scaling configuration optimization',
          ].join('\n');
          break;
        default:
          focusGuidance = [
            'Perform a **comprehensive cost analysis** covering:',
            '- Infrastructure and cloud resource costs',
            '- AI/LLM usage and model costs',
            '- Database operation costs',
            '- Compute and execution costs',
          ].join('\n');
          break;
      }

      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: [
                `Please analyze the cost profile and optimization opportunities ` +
                `for the analyzed project.`,
                ``,
                focusGuidance,
                ``,
                `Structure your analysis as follows:`,
                ``,
                `## 1. Cost Profile Overview`,
                `Summarize the current cost structure based on the project's architecture.`,
                `Use \`query_graph\` to understand the system's components and their types.`,
                `Use \`get_opportunities\` filtered to category "cost" for existing findings.`,
                ``,
                `## 2. AI/LLM Cost Analysis`,
                `If the project uses AI models:`,
                `- Map all model usage with \`query_graph\` (entity_type "model")`,
                `- Analyze model selection appropriateness`,
                `- Identify token optimization opportunities`,
                `- Estimate potential savings from model swaps or caching`,
                ``,
                `## 3. Infrastructure Cost Drivers`,
                `Identify the top cost drivers:`,
                `- Services with highest resource consumption`,
                `- Components with poor resource utilization`,
                `- Opportunities for right-sizing`,
                `Use \`analyze_impact\` on key infrastructure entities to understand coupling.`,
                ``,
                `## 4. Optimization Opportunities`,
                `For each optimization opportunity, provide:`,
                ``,
                `| Optimization | Category | Estimated Savings | Effort | Risk |`,
                `| --- | --- | --- | --- | --- |`,
                ``,
                `## 5. Quick Wins`,
                `List 3-5 immediate cost reductions that require minimal effort:`,
                `- Estimated savings for each`,
                `- Implementation steps`,
                `- Time to realize savings`,
                ``,
                `## 6. Strategic Cost Recommendations`,
                `Provide 2-3 longer-term architectural changes that would ` +
                `significantly reduce costs:`,
                `- Current cost impact estimate`,
                `- Expected savings after implementation`,
                `- Migration effort and timeline`,
                `- Risk assessment`,
              ].join('\n'),
            },
          },
        ],
      };
    },
  );
}

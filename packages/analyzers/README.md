# @recurrsive/analyzers

13 built-in analyzers with 89+ analysis rules for comprehensive software system evaluation.

## Installation

```bash
pnpm add @recurrsive/analyzers
```

## Usage

```typescript
import { createDefaultAnalyzers, AnalyzerRegistry, AnalyzerRunner } from '@recurrsive/analyzers';

const registry = new AnalyzerRegistry();
for (const analyzer of createDefaultAnalyzers()) {
  registry.register(analyzer);
}

const runner = new AnalyzerRunner(registry);
const findings = await runner.run(analysisContext);
```

## Analyzers

| Analyzer | Rules | Focus |
|----------|-------|-------|
| Architecture | 7 | Circular deps, god modules, dead code, tight coupling |
| AI | 10 | Hardcoded models, prompt injection, agent loops |
| Performance | 7 | Sequential LLM calls, N+1 queries, caching |
| Cost | 6 | Expensive models, token tracking, batching |
| Reliability | 7 | Single points of failure, retries, circuit breakers |
| Security | 8 | Hardcoded secrets, PII exposure, SQL injection |
| Data | 6 | Missing indexes, schema anti-patterns |
| Documentation | 6 | Missing docs, stale content, API drift |
| UX | 5 | Missing loading/error/empty states |
| Product | 5 | Dead feature flags, missing analytics |
| Dependency | 8 | Dependency health, version staleness, license compliance |
| API Contract | 7 | API versioning, breaking changes, OpenAPI compliance |
| AI Runtime | 8 | Model monitoring, prompt injection, LLM cost optimization |

## License

[Apache-2.0](../../LICENSE)

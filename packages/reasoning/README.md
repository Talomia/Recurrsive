# @recurrsive/reasoning

Multi-agent reasoning engine with 19 specialist AI agents, debate protocol, and decision memory.

## Installation

```bash
pnpm add @recurrsive/reasoning
```

## Architecture

```
Findings → 19 Specialists → Debate Protocol → Synthesizer → Judge → Opportunities
                                                              ↕
                                                         Memory Store
```

## Specialists

| Specialist | Cognitive Framework |
|------------|-------------------|
| Architecture | System design, modularity, coupling analysis |
| Performance | Latency, throughput, resource optimization |
| Security | Threat modeling, attack surface analysis |
| Cost | Resource economics, ROI estimation |
| AI Quality | Model selection, prompt engineering, evaluation |
| Product | Feature impact, user value, business alignment |
| Reliability | Failure modes, resilience patterns |
| Developer Experience | API ergonomics, tooling, documentation |
| Backend | API design, microservices, distributed systems |
| Frontend | UI/UX implementation, component architecture |
| ML | Machine learning pipelines, model quality |
| Prompt | Prompt engineering, LLM integration patterns |
| Database | Schema design, query optimization |
| Documentation | Documentation quality, API docs coverage |
| Release Manager | Release processes, versioning strategy |
| Accessibility | WCAG compliance, a11y patterns |
| Privacy | Data privacy, GDPR, PII handling |
| Compliance | Regulatory compliance, audit requirements |
| UX Research | Usability patterns, user journey analysis |

## LLM Adapters

Provider-agnostic with support for: OpenAI, Anthropic, Ollama, vLLM, LiteLLM, OpenRouter.

## Development

```bash
# Run tests
pnpm test --filter @recurrsive/reasoning

# Build
pnpm build --filter @recurrsive/reasoning

# Lint
pnpm lint --filter @recurrsive/reasoning
```

## License

[Apache-2.0](../../LICENSE)

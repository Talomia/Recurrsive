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
| `ArchitectureEngineer` | System design, modularity, coupling analysis |
| `PerformanceEngineer` | Latency, throughput, resource optimization |
| `SecurityEngineer` | Threat modeling, attack surface analysis |
| `CostOptimizer` | Resource economics, ROI estimation |
| `AIQualityEngineer` | Model selection, prompt engineering, evaluation |
| `ProductManager` | Feature impact, user value, business alignment |
| `ReliabilityEngineer` | Failure modes, resilience patterns |
| `DeveloperExperienceEngineer` | API ergonomics, tooling, documentation |
| `BackendEngineer` | API design, microservices, distributed systems |
| `FrontendEngineer` | UI/UX implementation, component architecture |
| `MLEngineer` | Machine learning pipelines, model quality |
| `PromptEngineer` | Prompt engineering, LLM integration patterns |
| `DatabaseEngineer` | Schema design, query optimization |
| `DocumentationEngineer` | Documentation quality, API docs coverage |
| `ReleaseManager` | Release processes, versioning strategy |
| `AccessibilityExpert` | WCAG compliance, a11y patterns |
| `PrivacyEngineer` | Data privacy, GDPR, PII handling |
| `ComplianceEngineer` | Regulatory compliance, audit requirements |
| `UXResearcher` | Usability patterns, user journey analysis |

## API

### Core Engine

| Export | Description |
|--------|-------------|
| `ReasoningEngine` | Main orchestrator — runs specialists, debates, and synthesis |
| `DebateProtocol` | Multi-round debate with scoring and consensus detection |

### LLM Adapters

| Export | Description |
|--------|-------------|
| `createLLMAdapter(config)` | Factory for provider-agnostic LLM access |
| `OpenAIAdapter` | OpenAI / OpenRouter / vLLM adapter |
| `AnthropicAdapter` | Anthropic Claude adapter |

Supports: OpenAI, Anthropic, Ollama, vLLM, LiteLLM, OpenRouter.

### Specialist SDK

Build custom specialists with the SDK:

| Export | Description |
|--------|-------------|
| `createCustomSpecialist(config)` | Create a custom specialist from a template |
| `SpecialistRegistry` | Registry for managing specialist instances |
| `SpecialistTemplate` | Base template for defining specialist behavior |
| `BaseSpecialist` | Base class all specialists extend |
| `createDefaultSpecialists()` | Factory for the 19 built-in specialists |
| `validateSpecialist(config)` | Validate a specialist configuration |
| `validateConfig(config)` | Validate reasoning engine configuration |
| `getSDKInfo()` | Get SDK version and metadata |

### Memory

| Export | Description |
|--------|-------------|
| `FileMemoryStore` | File-based persistent memory for decisions and debates |

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

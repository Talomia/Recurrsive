# @recurrsive/reasoning

Multi-agent reasoning engine with 8 specialist AI agents, debate protocol, and decision memory.

## Installation

```bash
pnpm add @recurrsive/reasoning
```

## Architecture

```
Findings → 8 Specialists → Debate Protocol → Synthesizer → Judge → Opportunities
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

## LLM Adapters

Provider-agnostic with support for: OpenAI, Anthropic, Ollama, vLLM, LiteLLM, OpenRouter.

## License

[Apache-2.0](../../LICENSE)

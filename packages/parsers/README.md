# @recurrsive/parsers

Multi-language code analysis and AI pattern detection. Extracts functions, classes, imports, and AI-specific patterns from source code.

## Installation

```bash
pnpm add @recurrsive/parsers
```

## Extractors

| Extractor | Languages | Extracts |
|-----------|-----------|----------|
| `TypeScriptExtractor` | TypeScript, JavaScript | Functions, classes, interfaces, imports, exports, decorators |
| `PythonExtractor` | Python | Functions, classes, imports, decorators, async functions |
| `GoExtractor` | Go | Functions, structs, interfaces, imports, methods |

## AI Pattern Detection

Detects **13 AI pattern types**:

| Pattern | Examples |
|---------|----------|
| LLM Calls | `openai.chat.completions.create()`, `anthropic.messages.create()` |
| Prompt Templates | Template strings, LangChain prompts |
| Agent Definitions | LangGraph StateGraph, CrewAI, AutoGen |
| Tool Definitions | `@tool` decorators, MCP tools |
| RAG Pipelines | Vector stores, embeddings, retrievers |
| MCP Servers | Server creation, tool registration |
| Model Config | Model names, temperature, max_tokens |
| Chains | LLMChain, LCEL pipe operators |
| Evaluations | `evaluate()` calls |
| Guardrails | NeMo, safety_settings |

## Development

```bash
# Run tests
pnpm test --filter @recurrsive/parsers

# Build
pnpm build --filter @recurrsive/parsers

# Lint
pnpm lint --filter @recurrsive/parsers
```

## License

[Apache-2.0](../../LICENSE)

/**
 * @module @recurrsive/parsers/ai-patterns/detector
 *
 * AI-specific pattern detection — the differentiating capability of
 * Recurrsive.  Scans source code for LLM calls, prompt templates,
 * agent definitions, tool registrations, RAG pipelines, MCP patterns,
 * and more.
 *
 * All detection is regex-based so it works without Tree-sitter and
 * across every supported language.
 *
 * @packageDocumentation
 */

import type { EntityType, RelationType } from '@recurrsive/core';
import type { ExtractedEntity, SourceLocation } from '../extractors/base.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Discriminated union of AI-specific pattern categories.
 */
export type AIPatternType =
  | 'llm_call'
  | 'prompt_template'
  | 'agent_definition'
  | 'tool_definition'
  | 'rag_pipeline'
  | 'mcp_server'
  | 'mcp_tool'
  | 'model_config'
  | 'embedding_call'
  | 'vector_search'
  | 'chain_definition'
  | 'evaluation'
  | 'guardrail';

/**
 * A detected AI pattern with the entities and relationships it
 * implies in the knowledge graph.
 */
export interface AIPattern {
  /** Pattern category. */
  type: AIPatternType;
  /** Human-readable name for the detected pattern. */
  name: string;
  /** Explanation of what was detected. */
  description: string;
  /** Source location of the matched code. */
  source_location: SourceLocation;
  /** Pattern-specific properties. */
  properties: Record<string, unknown>;
  /** Entities to create from this pattern. */
  entities: ExtractedEntity[];
  /** Relationships implied by this pattern. */
  relationships: Array<{ type: RelationType; source: string; target: string }>;
}

// ─── Shared Helpers ───────────────────────────────────────────────────────────

/**
 * 1-based line number at character index.
 *
 * @param source - Full source text.
 * @param index  - Character offset.
 * @returns 1-based line number.
 */
function lineAt(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < source.length; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

/**
 * 0-based column at character index.
 *
 * @param source - Full source text.
 * @param index  - Character offset.
 * @returns 0-based column.
 */
function columnAt(source: string, index: number): number {
  let col = 0;
  for (let i = index - 1; i >= 0; i--) {
    if (source[i] === '\n') break;
    col++;
  }
  return col;
}

/**
 * Build a {@link SourceLocation} from a regex match.
 *
 * @param source   - Full source text.
 * @param match    - Regex match.
 * @param filePath - File path.
 * @returns Source location record.
 */
function loc(source: string, match: RegExpExecArray, filePath: string): SourceLocation {
  const s = match.index;
  const e = s + match[0].length;
  return {
    file: filePath,
    start_line: lineAt(source, s),
    end_line: lineAt(source, e),
    start_column: columnAt(source, s),
    end_column: columnAt(source, e),
  };
}

/**
 * Qualified name helper.
 *
 * @param filePath - File path.
 * @param parts    - Name segments.
 * @returns Colon-joined qualified name.
 */
function qname(filePath: string, ...parts: string[]): string {
  return [filePath, ...parts].join(':');
}

// ─── Regex Pattern Banks ──────────────────────────────────────────────────────

// -- LLM Calls --
const LLM_CALL_PATTERNS: Array<{ re: RegExp; provider: string; label: string }> = [
  // OpenAI
  { re: /openai\.chat\.completions\.create\s*\(/g, provider: 'openai', label: 'OpenAI Chat Completion' },
  { re: /openai\.responses\.create\s*\(/g, provider: 'openai', label: 'OpenAI Responses API' },
  { re: /OpenAI\s*\(\s*\)/g, provider: 'openai', label: 'OpenAI Client Init' },
  { re: /ChatOpenAI\s*\(/g, provider: 'openai', label: 'LangChain ChatOpenAI' },
  // Anthropic
  { re: /anthropic\.messages\.create\s*\(/g, provider: 'anthropic', label: 'Anthropic Messages' },
  { re: /anthropic\.beta\.messages/g, provider: 'anthropic', label: 'Anthropic Beta Messages' },
  { re: /Anthropic\s*\(\s*\)/g, provider: 'anthropic', label: 'Anthropic Client Init' },
  { re: /ChatAnthropic\s*\(/g, provider: 'anthropic', label: 'LangChain ChatAnthropic' },
  // Google
  { re: /google\.generativeai/gi, provider: 'google', label: 'Google Generative AI' },
  { re: /genai\.GenerativeModel\s*\(/g, provider: 'google', label: 'Google GenAI Model' },
  { re: /ChatGoogleGenerativeAI\s*\(/g, provider: 'google', label: 'LangChain ChatGoogle' },
  // Generic / LangChain
  { re: /client\.chat\s*\(/g, provider: 'generic', label: 'Generic Chat Call' },
  { re: /client\.complete\s*\(/g, provider: 'generic', label: 'Generic Complete Call' },
  { re: /llm\.invoke\s*\(/g, provider: 'langchain', label: 'LangChain LLM Invoke' },
  { re: /llm\.call\s*\(/g, provider: 'langchain', label: 'LangChain LLM Call' },
  { re: /\.ainvoke\s*\(/g, provider: 'langchain', label: 'LangChain Async Invoke' },
  // LiteLLM
  { re: /litellm\.completion\s*\(/g, provider: 'litellm', label: 'LiteLLM Completion' },
  { re: /litellm\.acompletion\s*\(/g, provider: 'litellm', label: 'LiteLLM Async Completion' },
  // Ollama
  { re: /ollama\.chat\s*\(/g, provider: 'ollama', label: 'Ollama Chat' },
  { re: /ollama\.generate\s*\(/g, provider: 'ollama', label: 'Ollama Generate' },
];

// -- Prompt Templates --
const PROMPT_TEMPLATE_PATTERNS: Array<{ re: RegExp; framework: string; label: string }> = [
  { re: /ChatPromptTemplate\.from_messages\s*\(/g, framework: 'langchain', label: 'LangChain ChatPromptTemplate' },
  { re: /PromptTemplate\s*\(/g, framework: 'langchain', label: 'LangChain PromptTemplate' },
  { re: /FewShotPromptTemplate\s*\(/g, framework: 'langchain', label: 'LangChain FewShotPromptTemplate' },
  { re: /SystemMessagePromptTemplate/g, framework: 'langchain', label: 'LangChain SystemMessage Template' },
  { re: /HumanMessagePromptTemplate/g, framework: 'langchain', label: 'LangChain HumanMessage Template' },
  // Role-based message objects
  { re: /\{\s*role\s*:\s*['"]system['"]/g, framework: 'openai', label: 'System Message Object' },
  { re: /\{\s*role\s*:\s*['"]user['"]/g, framework: 'openai', label: 'User Message Object' },
  { re: /\{\s*role\s*:\s*['"]assistant['"]/g, framework: 'openai', label: 'Assistant Message Object' },
  { re: /\{\s*"role"\s*:\s*"system"/g, framework: 'openai', label: 'System Message (JSON)' },
  // Template strings with prompt markers
  { re: /system_prompt\s*[=:]/g, framework: 'generic', label: 'System Prompt Variable' },
  { re: /SYSTEM_PROMPT\s*[=:]/g, framework: 'generic', label: 'System Prompt Constant' },
  { re: /prompt_template\s*[=:]/g, framework: 'generic', label: 'Prompt Template Variable' },
];

// -- Agent Definitions --
const AGENT_PATTERNS: Array<{ re: RegExp; framework: string; label: string }> = [
  // LangGraph
  { re: /StateGraph\s*\(/g, framework: 'langgraph', label: 'LangGraph StateGraph' },
  { re: /MessageGraph\s*\(/g, framework: 'langgraph', label: 'LangGraph MessageGraph' },
  { re: /\.add_node\s*\(/g, framework: 'langgraph', label: 'LangGraph Add Node' },
  { re: /\.add_edge\s*\(/g, framework: 'langgraph', label: 'LangGraph Add Edge' },
  { re: /\.add_conditional_edges\s*\(/g, framework: 'langgraph', label: 'LangGraph Conditional Edge' },
  // CrewAI
  { re: /Agent\s*\(\s*(?:role|goal|backstory)\s*=/g, framework: 'crewai', label: 'CrewAI Agent' },
  { re: /Task\s*\(\s*(?:description|agent)\s*=/g, framework: 'crewai', label: 'CrewAI Task' },
  { re: /Crew\s*\(\s*(?:agents|tasks)\s*=/g, framework: 'crewai', label: 'CrewAI Crew' },
  // AutoGen
  { re: /AssistantAgent\s*\(/g, framework: 'autogen', label: 'AutoGen AssistantAgent' },
  { re: /UserProxyAgent\s*\(/g, framework: 'autogen', label: 'AutoGen UserProxyAgent' },
  { re: /GroupChat\s*\(/g, framework: 'autogen', label: 'AutoGen GroupChat' },
  // Generic
  { re: /@agent\b/g, framework: 'generic', label: 'Agent Decorator' },
  { re: /class\s+\w+Agent\s/g, framework: 'generic', label: 'Agent Class' },
  { re: /create_agent\s*\(/g, framework: 'generic', label: 'Create Agent Call' },
];

// -- Tool Definitions --
const TOOL_PATTERNS: Array<{ re: RegExp; framework: string; label: string }> = [
  { re: /@tool\b/g, framework: 'langchain', label: 'LangChain @tool Decorator' },
  { re: /StructuredTool\s*\(/g, framework: 'langchain', label: 'LangChain StructuredTool' },
  { re: /DynamicTool\s*\(/g, framework: 'langchain', label: 'LangChain DynamicTool' },
  { re: /DynamicStructuredTool\s*\(/g, framework: 'langchain', label: 'LangChain DynamicStructuredTool' },
  { re: /BaseTool\b/g, framework: 'langchain', label: 'LangChain BaseTool' },
  // Function-calling schemas
  { re: /function_calling\b/g, framework: 'openai', label: 'Function Calling Schema' },
  { re: /tools\s*[=:]\s*\[/g, framework: 'generic', label: 'Tools Array Definition' },
  { re: /tool_choice\s*[=:]/g, framework: 'generic', label: 'Tool Choice Config' },
  { re: /bind_tools\s*\(/g, framework: 'langchain', label: 'LangChain Bind Tools' },
];

// -- RAG Patterns --
const RAG_PATTERNS: Array<{ re: RegExp; component: string; label: string }> = [
  // Vector stores
  { re: /Pinecone\s*\(/g, component: 'vector_store', label: 'Pinecone Init' },
  { re: /pinecone\.Index\s*\(/g, component: 'vector_store', label: 'Pinecone Index' },
  { re: /Weaviate\s*\(/g, component: 'vector_store', label: 'Weaviate Init' },
  { re: /weaviate\.Client\s*\(/g, component: 'vector_store', label: 'Weaviate Client' },
  { re: /Chroma\s*\(/g, component: 'vector_store', label: 'ChromaDB Init' },
  { re: /chromadb\.Client\s*\(/g, component: 'vector_store', label: 'ChromaDB Client' },
  { re: /QdrantClient\s*\(/g, component: 'vector_store', label: 'Qdrant Client' },
  { re: /pgvector/gi, component: 'vector_store', label: 'pgvector Reference' },
  { re: /FAISS\s*\./g, component: 'vector_store', label: 'FAISS Vector Store' },
  { re: /Milvus\s*\(/g, component: 'vector_store', label: 'Milvus Init' },
  // Embedding calls
  { re: /OpenAIEmbeddings\s*\(/g, component: 'embeddings', label: 'OpenAI Embeddings' },
  { re: /openai\.embeddings\.create\s*\(/g, component: 'embeddings', label: 'OpenAI Embeddings API' },
  { re: /SentenceTransformer\s*\(/g, component: 'embeddings', label: 'SentenceTransformer' },
  { re: /HuggingFaceEmbeddings\s*\(/g, component: 'embeddings', label: 'HuggingFace Embeddings' },
  { re: /CohereEmbeddings\s*\(/g, component: 'embeddings', label: 'Cohere Embeddings' },
  // Retriever patterns
  { re: /\.as_retriever\s*\(/g, component: 'retriever', label: 'LangChain as_retriever' },
  { re: /VectorStoreRetriever/g, component: 'retriever', label: 'VectorStore Retriever' },
  { re: /SelfQueryRetriever/g, component: 'retriever', label: 'SelfQuery Retriever' },
  { re: /ContextualCompressionRetriever/g, component: 'retriever', label: 'ContextualCompression Retriever' },
  { re: /MultiQueryRetriever/g, component: 'retriever', label: 'MultiQuery Retriever' },
  // Chains
  { re: /RetrievalQA\s*\(/g, component: 'chain', label: 'RetrievalQA Chain' },
  { re: /ConversationalRetrievalChain/g, component: 'chain', label: 'ConversationalRetrieval Chain' },
  { re: /create_retrieval_chain\s*\(/g, component: 'chain', label: 'Create Retrieval Chain' },
  // Text splitters
  { re: /RecursiveCharacterTextSplitter\s*\(/g, component: 'splitter', label: 'Recursive Text Splitter' },
  { re: /CharacterTextSplitter\s*\(/g, component: 'splitter', label: 'Character Text Splitter' },
  { re: /TokenTextSplitter\s*\(/g, component: 'splitter', label: 'Token Text Splitter' },
  // Document loaders
  { re: /DirectoryLoader\s*\(/g, component: 'loader', label: 'Directory Loader' },
  { re: /PDFLoader\s*\(/g, component: 'loader', label: 'PDF Loader' },
  { re: /WebBaseLoader\s*\(/g, component: 'loader', label: 'Web Loader' },
];

// -- MCP Patterns --
const MCP_PATTERNS: Array<{ re: RegExp; component: string; label: string }> = [
  { re: /McpServer\s*\(/g, component: 'server', label: 'MCP Server Init' },
  { re: /new\s+Server\s*\(\s*\{[^}]*name/g, component: 'server', label: 'MCP SDK Server' },
  { re: /server\.tool\s*\(/g, component: 'tool', label: 'MCP Tool Registration' },
  { re: /server\.resource\s*\(/g, component: 'resource', label: 'MCP Resource Registration' },
  { re: /server\.prompt\s*\(/g, component: 'prompt', label: 'MCP Prompt Registration' },
  { re: /StdioServerTransport/g, component: 'transport', label: 'MCP Stdio Transport' },
  { re: /SSEServerTransport/g, component: 'transport', label: 'MCP SSE Transport' },
  { re: /StreamableHTTPServerTransport/g, component: 'transport', label: 'MCP HTTP Transport' },
  { re: /MCPClient\s*\(/g, component: 'client', label: 'MCP Client Init' },
  { re: /StdioClientTransport/g, component: 'transport', label: 'MCP Stdio Client Transport' },
  { re: /@modelcontextprotocol\/sdk/g, component: 'sdk', label: 'MCP SDK Import' },
];

// -- Chain Definitions --
const CHAIN_PATTERNS: Array<{ re: RegExp; framework: string; label: string }> = [
  { re: /LLMChain\s*\(/g, framework: 'langchain', label: 'LangChain LLMChain' },
  { re: /SequentialChain\s*\(/g, framework: 'langchain', label: 'LangChain SequentialChain' },
  { re: /SimpleSequentialChain\s*\(/g, framework: 'langchain', label: 'LangChain SimpleSequentialChain' },
  { re: /RunnableSequence/g, framework: 'langchain', label: 'LangChain RunnableSequence' },
  { re: /RunnablePassthrough/g, framework: 'langchain', label: 'LangChain RunnablePassthrough' },
  { re: /RunnableParallel/g, framework: 'langchain', label: 'LangChain RunnableParallel' },
  { re: /\.pipe\s*\(/g, framework: 'langchain', label: 'LangChain LCEL Pipe' },
  { re: /VectorstoreIndexCreator/g, framework: 'llamaindex', label: 'LlamaIndex VectorstoreIndex' },
  { re: /GPTVectorStoreIndex/g, framework: 'llamaindex', label: 'LlamaIndex GPTVectorStore' },
  { re: /ServiceContext/g, framework: 'llamaindex', label: 'LlamaIndex ServiceContext' },
];

// -- Model Config --
const MODEL_CONFIG_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /model\s*[=:]\s*['"]gpt-/g, label: 'GPT Model Config' },
  { re: /model\s*[=:]\s*['"]claude-/g, label: 'Claude Model Config' },
  { re: /model\s*[=:]\s*['"]gemini-/g, label: 'Gemini Model Config' },
  { re: /model\s*[=:]\s*['"]llama/gi, label: 'Llama Model Config' },
  { re: /model\s*[=:]\s*['"]mistral/gi, label: 'Mistral Model Config' },
  { re: /temperature\s*[=:]\s*[\d.]+/g, label: 'Temperature Setting' },
  { re: /max_tokens\s*[=:]\s*\d+/g, label: 'Max Tokens Setting' },
  { re: /top_p\s*[=:]\s*[\d.]+/g, label: 'Top-P Setting' },
];

// -- Evaluation --
const EVAL_PATTERNS: Array<{ re: RegExp; framework: string; label: string }> = [
  { re: /ragas\./g, framework: 'ragas', label: 'RAGAS Evaluation' },
  { re: /evaluate\s*\(/g, framework: 'generic', label: 'Evaluate Call' },
  { re: /LangSmithClient/g, framework: 'langsmith', label: 'LangSmith Client' },
  { re: /RunEvalConfig/g, framework: 'langsmith', label: 'LangSmith RunEvalConfig' },
  { re: /faithfulness/g, framework: 'generic', label: 'Faithfulness Metric' },
  { re: /answer_relevancy/g, framework: 'generic', label: 'Answer Relevancy Metric' },
  { re: /context_precision/g, framework: 'generic', label: 'Context Precision Metric' },
];

// -- Guardrails --
const GUARDRAIL_PATTERNS: Array<{ re: RegExp; framework: string; label: string }> = [
  { re: /NeMoGuardrails/g, framework: 'nemo', label: 'NeMo Guardrails' },
  { re: /RailsConfig/g, framework: 'nemo', label: 'NeMo RailsConfig' },
  { re: /guardrails\./g, framework: 'generic', label: 'Guardrails Reference' },
  { re: /content_filter/g, framework: 'generic', label: 'Content Filter' },
  { re: /safety_settings/g, framework: 'generic', label: 'Safety Settings' },
  { re: /moderation/gi, framework: 'openai', label: 'Moderation Check' },
  { re: /OpenAIModeration/g, framework: 'openai', label: 'OpenAI Moderation' },
];

// ─── Detector ─────────────────────────────────────────────────────────────────

/**
 * Detects AI-specific code patterns that distinguish Recurrsive from
 * generic code analysis tools.
 *
 * Scans source text with curated regex pattern banks to identify LLM
 * calls, prompt templates, agent definitions, tool registrations, RAG
 * pipelines, MCP servers/tools, chain definitions, model configuration,
 * evaluation setups, and guardrails.
 *
 * @example
 * ```ts
 * const detector = new AIPatternDetector();
 * const patterns = detector.detect(source, 'agents/planner.ts', 'typescript');
 * ```
 */
export class AIPatternDetector {
  /**
   * Detect all AI patterns in source code.
   *
   * @param source   - Full source text.
   * @param filePath - Project-relative file path.
   * @param _language - Canonical language name (reserved for future
   *                    language-specific heuristics).
   * @returns Array of detected {@link AIPattern} instances.
   */
  detect(source: string, filePath: string, _language: string): AIPattern[] {
    const patterns: AIPattern[] = [];

    patterns.push(...this.detectLLMCalls(source, filePath, _language));
    patterns.push(...this.detectPromptTemplates(source, filePath, _language));
    patterns.push(...this.detectAgentDefinitions(source, filePath, _language));
    patterns.push(...this.detectToolDefinitions(source, filePath, _language));
    patterns.push(...this.detectRAGPatterns(source, filePath, _language));
    patterns.push(...this.detectMCPPatterns(source, filePath, _language));
    patterns.push(...this.detectChainDefinitions(source, filePath, _language));
    patterns.push(...this.detectModelConfigs(source, filePath, _language));
    patterns.push(...this.detectEvaluations(source, filePath, _language));
    patterns.push(...this.detectGuardrails(source, filePath, _language));

    return patterns;
  }

  // ── Detection methods ───────────────────────────────────────────────────

  /**
   * Detect direct LLM API calls.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected LLM call patterns.
   */
  private detectLLMCalls(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, LLM_CALL_PATTERNS, (match, p, location) => {
      const entity: ExtractedEntity = {
        type: 'model' as EntityType,
        name: p.label,
        qualified_name: qname(filePath, 'llm_call', p.label),
        properties: { provider: p.provider, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      return {
        type: 'llm_call' as AIPatternType,
        name: p.label,
        description: `LLM API call via ${p.provider}: ${match[0].trim()}`,
        source_location: location,
        properties: { provider: p.provider, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [
          { type: 'uses_model' as RelationType, source: filePath, target: p.label },
        ],
      };
    });
  }

  /**
   * Detect prompt template definitions.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected prompt template patterns.
   */
  private detectPromptTemplates(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, PROMPT_TEMPLATE_PATTERNS, (match, p, location) => {
      const entity: ExtractedEntity = {
        type: 'prompt' as EntityType,
        name: p.label,
        qualified_name: qname(filePath, 'prompt', p.label),
        properties: { framework: p.framework, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      return {
        type: 'prompt_template' as AIPatternType,
        name: p.label,
        description: `Prompt template (${p.framework}): ${match[0].trim()}`,
        source_location: location,
        properties: { framework: p.framework, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [
          { type: 'has_prompt' as RelationType, source: filePath, target: p.label },
        ],
      };
    });
  }

  /**
   * Detect agent definitions (LangGraph, CrewAI, AutoGen, etc.).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected agent definition patterns.
   */
  private detectAgentDefinitions(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, AGENT_PATTERNS, (match, p, location) => {
      const entity: ExtractedEntity = {
        type: 'agent' as EntityType,
        name: p.label,
        qualified_name: qname(filePath, 'agent', p.label),
        properties: { framework: p.framework, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      return {
        type: 'agent_definition' as AIPatternType,
        name: p.label,
        description: `Agent definition (${p.framework}): ${match[0].trim()}`,
        source_location: location,
        properties: { framework: p.framework, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [
          { type: 'invokes_agent' as RelationType, source: filePath, target: p.label },
        ],
      };
    });
  }

  /**
   * Detect tool definitions and registrations.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected tool definition patterns.
   */
  private detectToolDefinitions(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, TOOL_PATTERNS, (match, p, location) => {
      const entity: ExtractedEntity = {
        type: 'tool' as EntityType,
        name: p.label,
        qualified_name: qname(filePath, 'tool', p.label),
        properties: { framework: p.framework, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      return {
        type: 'tool_definition' as AIPatternType,
        name: p.label,
        description: `Tool definition (${p.framework}): ${match[0].trim()}`,
        source_location: location,
        properties: { framework: p.framework, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [
          { type: 'uses_tool' as RelationType, source: filePath, target: p.label },
        ],
      };
    });
  }

  /**
   * Detect RAG pipeline components (vector stores, embeddings,
   * retrievers, loaders, splitters).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected RAG patterns.
   */
  private detectRAGPatterns(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, RAG_PATTERNS, (match, p, location) => {
      // Map component type to an entity type
      const entityType: EntityType =
        p.component === 'embeddings' ? 'model' :
        p.component === 'vector_store' ? 'collection' :
        p.component === 'retriever' ? 'pipeline' :
        p.component === 'chain' ? 'pipeline' :
        p.component === 'splitter' ? 'pipeline' :
        p.component === 'loader' ? 'pipeline' :
        'pipeline';

      const entity: ExtractedEntity = {
        type: entityType,
        name: p.label,
        qualified_name: qname(filePath, 'rag', p.label),
        properties: { component: p.component, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      const relType: RelationType =
        p.component === 'embeddings' ? 'embeds_with' :
        p.component === 'vector_store' ? 'retrieves_from' :
        p.component === 'retriever' ? 'retrieves_from' :
        'references';

      return {
        type: 'rag_pipeline' as AIPatternType,
        name: p.label,
        description: `RAG component (${p.component}): ${match[0].trim()}`,
        source_location: location,
        properties: { component: p.component, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [
          { type: relType, source: filePath, target: p.label },
        ],
      };
    });
  }

  /**
   * Detect MCP server/tool/resource patterns.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected MCP patterns.
   */
  private detectMCPPatterns(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, MCP_PATTERNS, (match, p, location) => {
      const patternType: AIPatternType =
        p.component === 'server' ? 'mcp_server' :
        p.component === 'tool' ? 'mcp_tool' :
        'mcp_server';

      const entityType: EntityType =
        p.component === 'server' ? 'mcp_server' :
        p.component === 'tool' ? 'mcp_tool' :
        p.component === 'resource' ? 'mcp_resource' :
        p.component === 'prompt' ? 'prompt' :
        'mcp_server';

      const entity: ExtractedEntity = {
        type: entityType,
        name: p.label,
        qualified_name: qname(filePath, 'mcp', p.label),
        properties: { component: p.component, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      return {
        type: patternType,
        name: p.label,
        description: `MCP ${p.component}: ${match[0].trim()}`,
        source_location: location,
        properties: { component: p.component, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [],
      };
    });
  }

  /**
   * Detect chain definitions (LangChain, LlamaIndex).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected chain patterns.
   */
  private detectChainDefinitions(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, CHAIN_PATTERNS, (match, p, location) => {
      const entity: ExtractedEntity = {
        type: 'pipeline' as EntityType,
        name: p.label,
        qualified_name: qname(filePath, 'chain', p.label),
        properties: { framework: p.framework, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      return {
        type: 'chain_definition' as AIPatternType,
        name: p.label,
        description: `Chain definition (${p.framework}): ${match[0].trim()}`,
        source_location: location,
        properties: { framework: p.framework, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [],
      };
    });
  }

  /**
   * Detect model configuration patterns (model names, temperature, etc.).
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected model config patterns.
   */
  private detectModelConfigs(source: string, filePath: string, _language: string): AIPattern[] {
    const patterns: AIPattern[] = [];
    for (const p of MODEL_CONFIG_PATTERNS) {
      const re = new RegExp(p.re.source, p.re.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(source)) !== null) {
        const location = loc(source, match, filePath);
        patterns.push({
          type: 'model_config' as AIPatternType,
          name: p.label,
          description: `Model configuration: ${match[0].trim()}`,
          source_location: location,
          properties: { matched_text: match[0].trim() },
          entities: [],
          relationships: [],
        });
      }
    }
    return patterns;
  }

  /**
   * Detect AI evaluation setups.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected evaluation patterns.
   */
  private detectEvaluations(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, EVAL_PATTERNS, (match, p, location) => {
      const entity: ExtractedEntity = {
        type: 'evaluation' as EntityType,
        name: p.label,
        qualified_name: qname(filePath, 'eval', p.label),
        properties: { framework: p.framework, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      return {
        type: 'evaluation' as AIPatternType,
        name: p.label,
        description: `AI evaluation (${p.framework}): ${match[0].trim()}`,
        source_location: location,
        properties: { framework: p.framework, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [
          { type: 'evaluates_with' as RelationType, source: filePath, target: p.label },
        ],
      };
    });
  }

  /**
   * Detect AI guardrail / safety patterns.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param _language - Language name.
   * @returns Detected guardrail patterns.
   */
  private detectGuardrails(source: string, filePath: string, _language: string): AIPattern[] {
    return this._scan(source, filePath, GUARDRAIL_PATTERNS, (match, p, location) => {
      const entity: ExtractedEntity = {
        type: 'config' as EntityType,
        name: p.label,
        qualified_name: qname(filePath, 'guardrail', p.label),
        properties: { framework: p.framework, pattern: match[0] },
        source_location: location,
        relationships: [],
      };

      return {
        type: 'guardrail' as AIPatternType,
        name: p.label,
        description: `AI guardrail (${p.framework}): ${match[0].trim()}`,
        source_location: location,
        properties: { framework: p.framework, matched_text: match[0].trim() },
        entities: [entity],
        relationships: [],
      };
    });
  }

  // ── Generic scanner ─────────────────────────────────────────────────────

  /**
   * Scan `source` with a bank of regex patterns and build
   * {@link AIPattern} instances using a builder callback.
   *
   * @param source   - Full source text.
   * @param filePath - File path.
   * @param bank     - Array of `{ re, ...metadata }` pattern specs.
   * @param builder  - Callback that constructs an AIPattern from a match.
   * @returns Array of detected patterns.
   */
  private _scan<T extends { re: RegExp }>(
    source: string,
    filePath: string,
    bank: T[],
    builder: (match: RegExpExecArray, pattern: T, location: SourceLocation) => AIPattern,
  ): AIPattern[] {
    const results: AIPattern[] = [];
    for (const p of bank) {
      // Always create a fresh regex so lastIndex starts at 0
      const re = new RegExp(p.re.source, p.re.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(source)) !== null) {
        const location = loc(source, match, filePath);
        const pattern = builder(match, p, location);
        // Surface the matched source text as `content` (and `template` on
        // prompt entities) so content-scanning analyzers — prompt-injection,
        // secret-in-prompt, oversized-prompt checks — operate on the real
        // matched text instead of an empty string. The entities otherwise
        // carried only an opaque `pattern` field the analyzers never read.
        const matchedText = match[0];
        for (const entity of pattern.entities) {
          if (entity.properties['content'] === undefined) {
            entity.properties['content'] = matchedText;
          }
          if (entity.type === 'prompt' && entity.properties['template'] === undefined) {
            entity.properties['template'] = matchedText;
          }
        }
        results.push(pattern);
      }
    }
    return results;
  }
}

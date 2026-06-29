/**
 * @module __tests__/ai-patterns/detector
 *
 * Comprehensive tests for the AIPatternDetector class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { AIPatternDetector } from '../../ai-patterns/detector.js';
import type { AIPattern } from '../../ai-patterns/detector.js';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AIPatternDetector', () => {
  let detector: AIPatternDetector;

  beforeEach(() => {
    detector = new AIPatternDetector();
  });

  // ── LLM API Calls ─────────────────────────────────────────────────────

  describe('LLM call detection', () => {
    it('detects OpenAI chat completion calls', () => {
      const source = `
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello' }],
});
`;
      const patterns = detector.detect(source, 'agent.ts', 'typescript');
      const llmCalls = patterns.filter((p) => p.type === 'llm_call');
      expect(llmCalls.length).toBeGreaterThanOrEqual(1);
      expect(llmCalls.some((p) => p.properties['provider'] === 'openai')).toBe(true);
    });

    it('detects Anthropic messages calls', () => {
      const source = `
const message = await anthropic.messages.create({
  model: 'claude-3-sonnet',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hi' }],
});
`;
      const patterns = detector.detect(source, 'agent.ts', 'typescript');
      const llmCalls = patterns.filter((p) => p.type === 'llm_call');
      expect(llmCalls.some((p) => p.properties['provider'] === 'anthropic')).toBe(true);
    });

    it('detects OpenAI client initialization', () => {
      const source = `const client = new OpenAI();`;
      const patterns = detector.detect(source, 'init.ts', 'typescript');
      const llmCalls = patterns.filter((p) => p.type === 'llm_call');
      expect(llmCalls.some((p) => p.name === 'OpenAI Client Init')).toBe(true);
    });

    it('detects LangChain ChatOpenAI usage', () => {
      const source = `const model = new ChatOpenAI({ temperature: 0 });`;
      const patterns = detector.detect(source, 'chain.ts', 'typescript');
      const llmCalls = patterns.filter((p) => p.type === 'llm_call');
      expect(llmCalls.some((p) => p.properties['provider'] === 'openai')).toBe(true);
    });

    it('detects LangChain ChatAnthropic usage', () => {
      const source = `const model = new ChatAnthropic({ model: "claude-3-haiku" });`;
      const patterns = detector.detect(source, 'chain.ts', 'typescript');
      const llmCalls = patterns.filter((p) => p.type === 'llm_call');
      expect(llmCalls.some((p) => p.properties['provider'] === 'anthropic')).toBe(true);
    });

    it('detects Ollama calls', () => {
      const source = `const response = await ollama.chat({ model: "llama3" });`;
      const patterns = detector.detect(source, 'local.ts', 'typescript');
      const llmCalls = patterns.filter((p) => p.type === 'llm_call');
      expect(llmCalls.some((p) => p.properties['provider'] === 'ollama')).toBe(true);
    });

    it('creates entities for detected LLM calls', () => {
      const source = `const res = await openai.chat.completions.create({});`;
      const patterns = detector.detect(source, 'agent.ts', 'typescript');
      const llmCall = patterns.find((p) => p.type === 'llm_call');
      expect(llmCall).toBeDefined();
      expect(llmCall!.entities.length).toBeGreaterThanOrEqual(1);
      expect(llmCall!.entities[0]!.type).toBe('model');
    });
  });

  // ── Prompt Templates ──────────────────────────────────────────────────

  describe('prompt template detection', () => {
    it('detects LangChain ChatPromptTemplate', () => {
      const source = `
const prompt = ChatPromptTemplate.from_messages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"],
]);
`;
      const patterns = detector.detect(source, 'prompts.ts', 'typescript');
      const prompts = patterns.filter((p) => p.type === 'prompt_template');
      expect(prompts.length).toBeGreaterThanOrEqual(1);
      expect(prompts.some((p) => p.properties['framework'] === 'langchain')).toBe(true);
    });

    it('detects system message objects', () => {
      const source = `
const messages = [
  { role: "system", content: "You are a coding assistant" },
  { role: "user", content: userInput },
];
`;
      const patterns = detector.detect(source, 'chat.ts', 'typescript');
      const prompts = patterns.filter((p) => p.type === 'prompt_template');
      expect(prompts.length).toBeGreaterThanOrEqual(1);
    });

    it('detects system_prompt variable assignments', () => {
      const source = `const system_prompt = "You are a helpful AI assistant";`;
      const patterns = detector.detect(source, 'config.ts', 'typescript');
      const prompts = patterns.filter((p) => p.type === 'prompt_template');
      expect(prompts.some((p) => p.name.includes('System Prompt'))).toBe(true);
    });

    it('detects SYSTEM_PROMPT constant assignments', () => {
      const source = `SYSTEM_PROMPT = "You are a data analyst"`;
      const patterns = detector.detect(source, 'constants.py', 'python');
      const prompts = patterns.filter((p) => p.type === 'prompt_template');
      expect(prompts.some((p) => p.name.includes('System Prompt Constant'))).toBe(true);
    });

    it('creates prompt entities', () => {
      const source = `const template = new PromptTemplate({ template: "Hello {name}" });`;
      const patterns = detector.detect(source, 'prompts.ts', 'typescript');
      const prompt = patterns.find((p) => p.type === 'prompt_template');
      expect(prompt).toBeDefined();
      expect(prompt!.entities[0]!.type).toBe('prompt');
    });
  });

  // ── Model Configuration ───────────────────────────────────────────────

  describe('model configuration detection', () => {
    it('detects GPT model name strings', () => {
      const source = `model = "gpt-4-turbo"`;
      const patterns = detector.detect(source, 'config.py', 'python');
      const configs = patterns.filter((p) => p.type === 'model_config');
      expect(configs.some((p) => p.name.includes('GPT'))).toBe(true);
    });

    it('detects Claude model name strings', () => {
      const source = `model: "claude-3-sonnet-20240229"`;
      const patterns = detector.detect(source, 'config.ts', 'typescript');
      const configs = patterns.filter((p) => p.type === 'model_config');
      expect(configs.some((p) => p.name.includes('Claude'))).toBe(true);
    });

    it('detects Gemini model name strings', () => {
      const source = `model = "gemini-1.5-pro"`;
      const patterns = detector.detect(source, 'config.py', 'python');
      const configs = patterns.filter((p) => p.type === 'model_config');
      expect(configs.some((p) => p.name.includes('Gemini'))).toBe(true);
    });

    it('detects temperature setting', () => {
      const source = `temperature = 0.7`;
      const patterns = detector.detect(source, 'config.py', 'python');
      const configs = patterns.filter((p) => p.type === 'model_config');
      expect(configs.some((p) => p.name === 'Temperature Setting')).toBe(true);
    });

    it('detects max_tokens setting', () => {
      const source = `max_tokens = 4096`;
      const patterns = detector.detect(source, 'config.py', 'python');
      const configs = patterns.filter((p) => p.type === 'model_config');
      expect(configs.some((p) => p.name === 'Max Tokens Setting')).toBe(true);
    });
  });

  // ── Agent Definitions ─────────────────────────────────────────────────

  describe('agent definition detection', () => {
    it('detects LangGraph StateGraph', () => {
      const source = `
const workflow = new StateGraph({
  channels: { messages: [] },
});
`;
      const patterns = detector.detect(source, 'agent.ts', 'typescript');
      const agents = patterns.filter((p) => p.type === 'agent_definition');
      expect(agents.some((p) => p.properties['framework'] === 'langgraph')).toBe(true);
    });

    it('detects CrewAI agent definitions', () => {
      const source = `
researcher = Agent(
    role="Senior Research Analyst",
    goal="Uncover cutting-edge developments",
    backstory="You are an expert researcher",
)
`;
      const patterns = detector.detect(source, 'crew.py', 'python');
      const agents = patterns.filter((p) => p.type === 'agent_definition');
      expect(agents.some((p) => p.properties['framework'] === 'crewai')).toBe(true);
    });

    it('detects AutoGen agents', () => {
      const source = `assistant = AssistantAgent("assistant", llm_config=config)`;
      const patterns = detector.detect(source, 'autogen_agent.py', 'python');
      const agents = patterns.filter((p) => p.type === 'agent_definition');
      expect(agents.some((p) => p.properties['framework'] === 'autogen')).toBe(true);
    });

    it('detects generic agent class pattern', () => {
      const source = `class PlannerAgent {
  constructor() {}
}`;
      const patterns = detector.detect(source, 'planner.ts', 'typescript');
      const agents = patterns.filter((p) => p.type === 'agent_definition');
      expect(agents.length).toBeGreaterThanOrEqual(1);
    });

    it('creates agent entities', () => {
      const source = `const graph = new StateGraph({});`;
      const patterns = detector.detect(source, 'agent.ts', 'typescript');
      const agent = patterns.find((p) => p.type === 'agent_definition');
      expect(agent).toBeDefined();
      expect(agent!.entities[0]!.type).toBe('agent');
    });
  });

  // ── Tool Definitions ──────────────────────────────────────────────────

  describe('tool definition detection', () => {
    it('detects LangChain @tool decorator', () => {
      const source = `
@tool
def search(query: str) -> str:
    """Search the web."""
    return results
`;
      const patterns = detector.detect(source, 'tools.py', 'python');
      const tools = patterns.filter((p) => p.type === 'tool_definition');
      expect(tools.some((p) => p.name.includes('@tool'))).toBe(true);
    });

    it('detects LangChain StructuredTool', () => {
      const source = `const tool = new StructuredTool({ name: "calculator" });`;
      const patterns = detector.detect(source, 'tools.ts', 'typescript');
      const tools = patterns.filter((p) => p.type === 'tool_definition');
      expect(tools.length).toBeGreaterThanOrEqual(1);
    });

    it('detects tools array definition', () => {
      const source = `
tools = [
  { name: "search", description: "Search the web" },
  { name: "calculator", description: "Do math" },
];
`;
      const patterns = detector.detect(source, 'config.ts', 'typescript');
      const tools = patterns.filter((p) => p.type === 'tool_definition');
      expect(tools.length).toBeGreaterThanOrEqual(1);
    });

    it('creates tool entities', () => {
      const source = `const t = new DynamicTool({ name: "search" });`;
      const patterns = detector.detect(source, 'tools.ts', 'typescript');
      const tool = patterns.find((p) => p.type === 'tool_definition');
      expect(tool).toBeDefined();
      expect(tool!.entities[0]!.type).toBe('tool');
    });
  });

  // ── MCP Patterns ──────────────────────────────────────────────────────

  describe('MCP pattern detection', () => {
    it('detects MCP Server initialization', () => {
      const source = `const server = new McpServer({ name: "my-server" });`;
      const patterns = detector.detect(source, 'server.ts', 'typescript');
      const mcp = patterns.filter((p) => p.type === 'mcp_server' || p.type === 'mcp_tool');
      expect(mcp.length).toBeGreaterThanOrEqual(1);
    });

    it('detects MCP tool registration', () => {
      const source = `
server.tool("search", { query: z.string() }, async (args) => {
  return { content: [{ type: "text", text: "result" }] };
});
`;
      const patterns = detector.detect(source, 'server.ts', 'typescript');
      const tools = patterns.filter((p) => p.type === 'mcp_tool');
      expect(tools.length).toBeGreaterThanOrEqual(1);
    });

    it('detects MCP SDK import', () => {
      const source = `import { McpServer } from "@modelcontextprotocol/sdk";`;
      const patterns = detector.detect(source, 'server.ts', 'typescript');
      const mcp = patterns.filter((p) => p.type === 'mcp_server' || p.type === 'mcp_tool');
      expect(mcp.length).toBeGreaterThanOrEqual(1);
    });

    it('detects MCP transport patterns', () => {
      const source = `const transport = new StdioServerTransport();`;
      const patterns = detector.detect(source, 'server.ts', 'typescript');
      const mcp = patterns.filter((p) => p.type === 'mcp_server' || p.type === 'mcp_tool');
      expect(mcp.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── RAG Pipeline Detection ────────────────────────────────────────────

  describe('RAG pipeline detection', () => {
    it('detects vector store patterns', () => {
      const source = `const index = new Pinecone({ apiKey: key });`;
      const patterns = detector.detect(source, 'rag.ts', 'typescript');
      const rag = patterns.filter((p) => p.type === 'rag_pipeline');
      expect(rag.length).toBeGreaterThanOrEqual(1);
    });

    it('detects embedding patterns', () => {
      const source = `const embeddings = new OpenAIEmbeddings({ modelName: "text-embedding-ada-002" });`;
      const patterns = detector.detect(source, 'rag.ts', 'typescript');
      const rag = patterns.filter((p) => p.type === 'rag_pipeline');
      expect(rag.some((p) => p.properties['component'] === 'embeddings')).toBe(true);
    });

    it('detects retriever patterns', () => {
      const source = `const retriever = vectorStore.as_retriever({ searchKwargs: { k: 5 } });`;
      const patterns = detector.detect(source, 'rag.ts', 'typescript');
      const rag = patterns.filter((p) => p.type === 'rag_pipeline');
      expect(rag.some((p) => p.properties['component'] === 'retriever')).toBe(true);
    });

    it('detects text splitter patterns', () => {
      const source = `const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000 });`;
      const patterns = detector.detect(source, 'rag.ts', 'typescript');
      const rag = patterns.filter((p) => p.type === 'rag_pipeline');
      expect(rag.some((p) => p.properties['component'] === 'splitter')).toBe(true);
    });
  });

  // ── No False Positives ────────────────────────────────────────────────

  describe('no false positives on regular code', () => {
    it('does not flag regular code as AI patterns', () => {
      const source = `
export class UserController {
  async getUser(id: string): Promise<User> {
    const user = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return user;
  }

  async createUser(data: CreateUserDTO): Promise<User> {
    const result = await db.insert('users', data);
    return result;
  }
}

const config = {
  port: 3000,
  host: 'localhost',
};

function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0);
}
`;
      const patterns = detector.detect(source, 'controller.ts', 'typescript');
      const llmCalls = patterns.filter((p) => p.type === 'llm_call');
      const promptTemplates = patterns.filter((p) => p.type === 'prompt_template');
      const agents = patterns.filter((p) => p.type === 'agent_definition');
      const tools = patterns.filter((p) => p.type === 'tool_definition');
      const mcpPatterns = patterns.filter(
        (p) => p.type === 'mcp_server' || p.type === 'mcp_tool',
      );

      expect(llmCalls).toHaveLength(0);
      expect(promptTemplates).toHaveLength(0);
      expect(agents).toHaveLength(0);
      expect(tools).toHaveLength(0);
      expect(mcpPatterns).toHaveLength(0);
    });

    it('does not flag simple config objects as model configs', () => {
      const source = `
const serverConfig = {
  port: 3000,
  debug: true,
  host: "0.0.0.0",
};

function startup(): void {
  console.log("Starting server...");
}
`;
      const patterns = detector.detect(source, 'server.ts', 'typescript');
      const modelConfigs = patterns.filter((p) => p.type === 'model_config');
      expect(modelConfigs).toHaveLength(0);
    });
  });

  // ── Multiple Patterns in Same File ────────────────────────────────────

  describe('multiple patterns in same file', () => {
    it('detects multiple different AI patterns', () => {
      const source = `
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";

const model = new ChatOpenAI({ temperature: 0.7 });
model = "gpt-4-turbo"

const prompt = ChatPromptTemplate.from_messages([
  ["system", "You are a helpful assistant"],
  ["human", "{input}"],
]);

const tools = [
  { name: "search", description: "Search the web" },
];

const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [],
});
`;
      const patterns = detector.detect(source, 'agent.ts', 'typescript');

      const llmCalls = patterns.filter((p) => p.type === 'llm_call');
      const promptTemplates = patterns.filter((p) => p.type === 'prompt_template');
      const modelConfigs = patterns.filter((p) => p.type === 'model_config');
      const toolDefs = patterns.filter((p) => p.type === 'tool_definition');

      expect(llmCalls.length).toBeGreaterThanOrEqual(1);
      expect(promptTemplates.length).toBeGreaterThanOrEqual(1);
      expect(modelConfigs.length).toBeGreaterThanOrEqual(1);
      expect(toolDefs.length).toBeGreaterThanOrEqual(1);
    });

    it('assigns correct source locations to each pattern', () => {
      const source = `const a = new OpenAI();\nconst b = new ChatAnthropic({});\n`;
      const patterns = detector.detect(source, 'multi.ts', 'typescript');
      for (const pattern of patterns) {
        expect(pattern.source_location.file).toBe('multi.ts');
        expect(pattern.source_location.start_line).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // ── Chain Definitions ─────────────────────────────────────────────────

  describe('chain definition detection', () => {
    it('detects LangChain LLMChain', () => {
      const source = `const chain = new LLMChain({ llm: model, prompt: template });`;
      const patterns = detector.detect(source, 'chain.ts', 'typescript');
      const chains = patterns.filter((p) => p.type === 'chain_definition');
      expect(chains.length).toBeGreaterThanOrEqual(1);
    });

    it('detects LangChain LCEL pipe', () => {
      const source = `const chain = prompt.pipe(model).pipe(parser);`;
      const patterns = detector.detect(source, 'chain.ts', 'typescript');
      const chains = patterns.filter((p) => p.type === 'chain_definition');
      expect(chains.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Evaluation Detection ──────────────────────────────────────────────

  describe('evaluation detection', () => {
    it('detects evaluate() calls', () => {
      const source = `results = evaluate(dataset, metrics=[faithfulness])`;
      const patterns = detector.detect(source, 'eval.py', 'python');
      const evals = patterns.filter((p) => p.type === 'evaluation');
      expect(evals.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Guardrail Detection ───────────────────────────────────────────────

  describe('guardrail detection', () => {
    it('detects NeMo guardrails', () => {
      const source = `const rails = new NeMoGuardrails(config);`;
      const patterns = detector.detect(source, 'safety.ts', 'typescript');
      const guardrails = patterns.filter((p) => p.type === 'guardrail');
      expect(guardrails.length).toBeGreaterThanOrEqual(1);
    });

    it('detects safety_settings references', () => {
      const source = `safety_settings = { block_threshold: "HIGH" }`;
      const patterns = detector.detect(source, 'config.py', 'python');
      const guardrails = patterns.filter((p) => p.type === 'guardrail');
      expect(guardrails.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Empty Source ──────────────────────────────────────────────────────

  describe('empty source handling', () => {
    it('returns empty array for empty source', () => {
      const patterns = detector.detect('', 'empty.ts', 'typescript');
      expect(patterns).toEqual([]);
    });

    it('returns empty array for whitespace-only source', () => {
      const patterns = detector.detect('   \n\n   ', 'blank.ts', 'typescript');
      expect(patterns).toEqual([]);
    });
  });
});

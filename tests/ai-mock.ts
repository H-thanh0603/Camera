/**
 * Scripted stand-in provider for unit tests (mirrors the commerce-agents
 * `testing.py` idea): deterministic, credential-free, records requests and
 * replays scripted chat/stream responses. Import only from tests/.
 */

import type {
  AIChatMessage,
  AIChatResult,
  AIProvider,
  AIRequestOptions,
  AIStreamEvent,
  AIToolCall,
  AIProviderMeta,
  AICapabilities,
} from "@/lib/ai/types";

export interface ScriptedTurn {
  content?: string;
  toolCalls?: AIToolCall[];
  usage?: AIChatResult["usage"];
}

export class MockAIProvider implements AIProvider {
  readonly meta: AIProviderMeta;
  requests: { messages: AIChatMessage[]; opts: AIRequestOptions }[] = [];
  private turns: ScriptedTurn[];
  private idx = 0;

  constructor(script: ScriptedTurn[], caps: Partial<AICapabilities> = {}) {
    this.turns = script;
    this.meta = {
      provider: "mock",
      model: "mock-model",
      capabilities: {
        chat: true,
        streaming: true,
        toolCalls: true,
        structuredOutput: true,
        vision: false,
        reasoning: false,
        ...caps,
      },
    };
  }

  private next(): ScriptedTurn {
    const t = this.turns[this.idx] ?? { content: "done" };
    if (this.idx < this.turns.length) this.idx++;
    return t;
  }

  async chat(messages: AIChatMessage[], opts: AIRequestOptions = {}): Promise<AIChatResult> {
    this.requests.push({ messages, opts });
    const t = this.next();
    return {
      content: t.content ?? "",
      toolCalls: t.toolCalls ?? [],
      usage: t.usage,
      model: this.meta.model,
    };
  }

  async *stream(messages: AIChatMessage[], opts: AIRequestOptions = {}): AsyncGenerator<AIStreamEvent> {
    this.requests.push({ messages, opts });
    const t = this.next();
    if (t.content) yield { type: "text", text: t.content };
    yield { type: "done", toolCalls: t.toolCalls ?? [], usage: t.usage, model: this.meta.model };
  }
}

export function toolCall(id: string, name: string, args: Record<string, unknown> = {}): AIToolCall {
  return { id, name, arguments: args };
}
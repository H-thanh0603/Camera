/**
 * Anthropic Messages API adapter (tool_use + SSE streaming).
 *
 * Isolated behind the AIProvider interface so nothing upstream imports the
 * Anthropic SDK or depends on Anthropic types — switch AI_PROVIDER and the
 * same agent/tool code runs against a different provider unmodified.
 */

import type {
  AICapabilities,
  AIChatMessage,
  AIChatResult,
  AIProvider,
  AIStreamEvent,
  AIToolCall,
  AIProviderMeta,
  AIRequestOptions,
} from "../types";
import { rawRequest, errorMessageOf, classifyHttpError } from "./fetch-client";
import { newToolCallId } from "../schema";

interface AnthropicDeps {
  apiKey: string;
  model: string;
  defaultTimeoutMs?: number;
  defaultMaxTokens?: number;
  capabilities?: Partial<AICapabilities>;
}

type AnBlock = Record<string, unknown>;

/** Anthropic requires one <system> param; tool results are `user` blocks. */
function toAnthropicMessages(messages: AIChatMessage[]): { system: string; messages: AnBlock[] } {
  const system: string[] = [];
  const api: AnBlock[] = [];

  const pushUser = (blocks: AnBlock[]) => {
    if (blocks.length === 0) return;
    const last = api[api.length - 1];
    if (last && last.role === "user" && Array.isArray(last.content)) {
      (last.content as AnBlock[]).push(...blocks);
    } else {
      api.push({ role: "user", content: blocks });
    }
  };

  for (const m of messages) {
    if (m.role === "system") {
      if (m.content) system.push(m.content);
      continue;
    }
    if (m.role === "tool") {
      pushUser([
        {
          type: "tool_result",
          tool_use_id: m.toolCallId,
          content: m.content || "",
        },
      ]);
      continue;
    }
    if (m.role === "assistant") {
      const content: AnBlock[] = [];
      if (m.content) content.push({ type: "text", text: m.content });
      for (const tc of m.toolCalls ?? []) {
        content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.arguments });
      }
      if (content.length) api.push({ role: "assistant", content });
      else api.push({ role: "assistant", content: "" });
      continue;
    }
    // user
    pushUser([{ type: "text", text: m.content }]);
  }

  return { system: system.join("\n\n"), messages: api };
}

function fromToolUse(content: unknown): AIToolCall[] {
  if (!Array.isArray(content)) return [];
  return content.flatMap((b) => {
    if (!b || typeof b !== "object") return [];
    const blk = b as { type?: string; id?: string; name?: string; input?: unknown };
    if (blk.type !== "tool_use" || !blk.name) return [];
    return [{ id: blk.id || newToolCallId(), name: blk.name, arguments: (blk.input as Record<string, unknown> | null) ?? {} }];
  });
}

function toTools(tools: AIRequestOptions["tools"]) {
  return tools?.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  message?: { usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { output_tokens?: number };
  delta?: { stop_reason?: string; text?: string; partial_json?: string; type?: string };
  content_block?: { type?: string; id?: string; name?: string };
}
export class AnthropicProvider implements AIProvider {
  readonly meta: AIProviderMeta;
  private apiKey: string;
  private defaultTimeoutMs: number;
  private defaultMaxTokens: number;

  constructor(deps: AnthropicDeps) {
    const caps: AICapabilities = {
      chat: true,
      streaming: true,
      toolCalls: true,
      structuredOutput: true,
      vision: true,
      reasoning: true,
      ...(deps.capabilities ?? {}),
    };
    this.meta = { provider: "anthropic", model: deps.model, capabilities: caps };
    this.apiKey = deps.apiKey;
    this.defaultTimeoutMs = deps.defaultTimeoutMs ?? 30_000;
    this.defaultMaxTokens = deps.defaultMaxTokens ?? 1024;
  }

  private headers() {
    return {
      "x-api-key": this.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    };
  }

  async chat(messages: AIChatMessage[], opts: AIRequestOptions = {}): Promise<AIChatResult> {
    const { system, messages: api } = toAnthropicMessages(messages);
    const body: Record<string, unknown> = {
      model: opts.model ?? this.meta.model,
      max_tokens: opts.maxTokens ?? this.defaultMaxTokens,
      messages: api,
    };
    if (system) body.system = system;
    const tools = toTools(opts.tools);
    if (tools?.length) body.tools = tools;
    if (opts.temperature != null) body.temperature = opts.temperature;

    const { status, json } = await rawRequest("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      timeoutMs: opts.timeoutMs ?? this.defaultTimeoutMs,
      signal: opts.signal,
    });
    if (status !== 200) classifyHttpError(status, this.meta.provider, this.meta.model, errorMessageOf(json));

    const data = json as {
      content?: unknown;
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    };
    const text = Array.isArray(data.content)
      ? (data.content as Array<{ type?: string; text?: string }>)
          .filter((b) => b.type === "text" && b.text)
          .map((b) => b.text)
          .join("")
      : "";
    return {
      content: text,
      toolCalls: fromToolUse(data.content),
      finishReason: data.stop_reason,
      usage: {
        inputTokens: data.usage?.input_tokens,
        outputTokens: data.usage?.output_tokens,
        totalTokens: data.usage ? (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0) : undefined,
      },
      model: this.meta.model,
    };
  }

  async *stream(messages: AIChatMessage[], opts: AIRequestOptions = {}): AsyncGenerator<AIStreamEvent> {
    const { system, messages: api } = toAnthropicMessages(messages);
    const body: Record<string, unknown> = {
      model: opts.model ?? this.meta.model,
      max_tokens: opts.maxTokens ?? this.defaultMaxTokens,
      messages: api,
      stream: true,
    };
    if (system) body.system = system;
    const tools = toTools(opts.tools);
    if (tools?.length) body.tools = tools;
    if (opts.temperature != null) body.temperature = opts.temperature;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      let json: unknown = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = text;
      }
      classifyHttpError(res.status, this.meta.provider, this.meta.model, errorMessageOf(json ?? text));
    }

    yield* streamAnthropic(res.body!, { model: this.meta.model });
  }
}

/** Anthropic SSE parser -> neutral AIStreamEvent. */
async function* streamAnthropic(stream: ReadableStream<Uint8Array>, meta: { model: string }): AsyncGenerator<AIStreamEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // Accumulates text + tool_use per content block index.
  const tools: Array<{ id: string; name: string; args: string }> = [];
  let usage: { input?: number; output?: number } | undefined;
  let doneEmitted = false;

  const dataLines = async function* () {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, idx).trim();
        buffer = buffer.slice(idx + 1);
        if (line.startsWith("data:")) {
          const d = line.slice(5).trim();
          if (d) yield d;
        }
      }
    }
    const tail = buffer.trim();
    if (tail.startsWith("data:")) {
      const d = tail.slice(5).trim();
      if (d) yield d;
    }
  };

  for await (const data of dataLines()) {
    let ev: AnthropicStreamEvent;
    try {
      ev = JSON.parse(data) as AnthropicStreamEvent;
    } catch {
      continue;
    }
    if (!ev || typeof ev !== "object" || typeof ev.type !== "string") continue;
    switch (ev.type) {
      case "message_start": {
        const usageStart = ev?.message?.usage;
        usage = { input: usageStart?.input_tokens, output: usageStart?.output_tokens };
        break;
      }
      case "message_delta": {
        const u = usage ?? {};
        usage = { ...u, output: ev?.usage?.output_tokens ?? u.output };
        if (ev?.delta?.stop_reason === "tool_use") {
          // Model wants to call tools; emit the accumulated drafts now.
          for (const t of tools) {
            let args: Record<string, unknown> = {};
            if (t.args) {
              try {
                args = JSON.parse(t.args) as Record<string, unknown>;
              } catch {
                args = { _raw: t.args };
              }
            }
            yield { type: "toolDraft", call: { id: t.id, name: t.name, arguments: args } };
          }
          tools.length = 0;
        }
        break;
      }
      case "message_stop": {
        const calls: AIToolCall[] = [];
        for (const t of tools) {
          let args: Record<string, unknown> = {};
          if (t.args) {
            try {
              args = JSON.parse(t.args) as Record<string, unknown>;
            } catch {
              args = { _raw: t.args };
            }
          }
          const call: AIToolCall = { id: t.id, name: t.name, arguments: args };
          calls.push(call);
          yield { type: "toolDraft", call };
        }
        yield {
          type: "done",
          toolCalls: calls,
          usage: usage ? { inputTokens: usage.input, outputTokens: usage.output, totalTokens: (usage.input ?? 0) + (usage.output ?? 0) } : undefined,
          model: meta.model,
        };
        doneEmitted = true;
        return;
      }
      case "content_block_start": {
        const cb = ev?.content_block;
        const blockIndex = ev.index ?? tools.length;
        if (cb?.type === "tool_use") {
          tools[blockIndex] = { id: cb.id ?? "", name: cb.name ?? "", args: "" };
        }
        break;
      }
      case "content_block_delta": {
        const d = ev?.delta;
        if (d?.type === "text_delta" && typeof d.text === "string") {
          yield { type: "text", text: d.text };
        } else if (d?.type === "input_json_delta" && typeof d.partial_json === "string") {
          const t = tools[ev.index ?? -1];
          if (t) t.args += d.partial_json;
        }
        break;
      }
      default:
        break;
    }
  }

  // Stream ended without message_stop — emit whatever we have.
  if (!doneEmitted) {
    const calls: AIToolCall[] = [];
    for (const t of tools) {
      let args: Record<string, unknown> = {};
      if (t.args) {
        try {
          args = JSON.parse(t.args) as Record<string, unknown>;
        } catch {
          args = { _raw: t.args };
        }
      }
      const call: AIToolCall = { id: t.id, name: t.name, arguments: args };
      calls.push(call);
      yield { type: "toolDraft", call };
    }
    yield {
      type: "done",
      toolCalls: calls,
      usage: usage ? { inputTokens: usage.input, outputTokens: usage.output, totalTokens: (usage.input ?? 0) + (usage.output ?? 0) } : undefined,
      model: meta.model,
    };
  }
}
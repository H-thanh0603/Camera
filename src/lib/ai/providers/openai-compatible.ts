/**
 * OpenAI-compatible adapter (/chat/completions + tool calling + SSE streaming).
 * Powers: openai, openrouter, tokenrouter, deepseek, and gemini (the Google
 * endpoint mirrors OpenAI's schema). A single code path, but capabilities and
 * model/baseUrl always come from config (never hard-coded).
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

interface OpenAIProviderDeps {
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  capabilities?: Partial<AICapabilities>;
  defaultTimeoutMs?: number;
}

type OpenAIMessage = Record<string, unknown>;

function toOpenAIMessages(messages: AIChatMessage[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({ role: "tool", content: m.content, tool_call_id: m.toolCallId });
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: m.content ?? "",
        tool_calls: m.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
        })),
      });
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

function fromToolCalls(toolCalls: unknown): AIToolCall[] {
  if (!Array.isArray(toolCalls)) return [];
  return toolCalls.flatMap((tc) => {
    const fn = (tc as { function?: { name?: unknown; arguments?: unknown } })?.function;
    if (!fn?.name) return [];
    let args: Record<string, unknown> = {};
    if (typeof fn.arguments === "string" && fn.arguments) {
      try {
        args = JSON.parse(fn.arguments) as Record<string, unknown>;
      } catch {
        args = { _raw: fn.arguments };
      }
    }
    return [{ id: (tc as { id?: string }).id || newToolCallId(), name: fn.name as string, arguments: args }];
  });
}

/** Stream SSE `data:` lines from a response body. */
async function* sseData(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data) yield data;
      }
    }
  }
  const tail = buffer.trim();
  if (tail.startsWith("data:")) {
    const data = tail.slice(5).trim();
    if (data) yield data;
  }
}

interface AccTool {
  id: string;
  name: string;
  arguments: string;
}

function accumulateToolCalls(acc: AccTool[], chunk: unknown[]): AccTool[] {
  for (const frag of chunk as Array<{
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>) {
    const i = frag.index ?? 0;
    const cur = acc[i] ?? { id: "", name: "", arguments: "" };
    if (frag.id) cur.id = frag.id;
    if (frag.function?.name) cur.name += frag.function.name;
    if (frag.function?.arguments) cur.arguments += frag.function.arguments;
    acc[i] = cur;
  }
  return acc;
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly meta: AIProviderMeta;
  private apiKey: string;
  private baseUrl: string;
  private defaultTimeoutMs: number;

  constructor(deps: OpenAIProviderDeps) {
    const caps: AICapabilities = {
      chat: true,
      streaming: true,
      toolCalls: true,
      structuredOutput: true,
      vision: false,
      reasoning: false,
      ...(deps.capabilities ?? {}),
    };
    this.meta = { provider: deps.name, model: deps.model, capabilities: caps };
    this.apiKey = deps.apiKey;
    this.baseUrl = deps.baseUrl.replace(/\/+$/, "");
    this.defaultTimeoutMs = deps.defaultTimeoutMs ?? 30_000;
  }

  private headers(extra?: Record<string, string>) {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
      ...(this.meta.provider === "openrouter"
        ? { "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL || "https://luminaoptics.vn" }
        : {}),
      ...(extra ?? {}),
    };
  }
async chat(messages: AIChatMessage[], opts: AIRequestOptions = {}): Promise<AIChatResult> {
    const tools = opts.tools?.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    const body: Record<string, unknown> = {
      model: opts.model ?? this.meta.model,
      messages: toOpenAIMessages(messages),
      stream: false,
    };
    if (tools?.length) body.tools = tools;
    if (opts.temperature != null) body.temperature = opts.temperature;
    if (opts.maxTokens != null) body.max_tokens = opts.maxTokens;

    const { status, json } = await rawRequest(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(opts.extraHeaders),
      body: JSON.stringify(body),
      timeoutMs: opts.timeoutMs ?? this.defaultTimeoutMs,
      signal: opts.signal,
    });
    if (status !== 200) classifyHttpError(status, this.meta.provider, this.meta.model, errorMessageOf(json));

    const data = json as {
      choices?: Array<{ message?: { content?: string | null; tool_calls?: unknown }; finish_reason?: string }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
    };
    const choice = data.choices?.[0];
    const usage = data.usage;
    return {
      content: choice?.message?.content ?? "",
      toolCalls: fromToolCalls(choice?.message?.tool_calls),
      finishReason: choice?.finish_reason,
      usage: {
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      },
      model: this.meta.model,
    };
  }
async *stream(messages: AIChatMessage[], opts: AIRequestOptions = {}): AsyncGenerator<AIStreamEvent> {
    const tools = opts.tools?.map((t) => ({
      type: "function",
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
    const body: Record<string, unknown> = {
      model: opts.model ?? this.meta.model,
      messages: toOpenAIMessages(messages),
      stream: true,
      stream_options: { include_usage: true },
    };
    if (tools?.length) body.tools = tools;
    if (opts.temperature != null) body.temperature = opts.temperature;
    if (opts.maxTokens != null) body.max_tokens = opts.maxTokens;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: this.headers(opts.extraHeaders),
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

    let acc: AccTool[] = [];
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    interface StreamChoiceDelta {
      content?: unknown;
      tool_calls?: unknown[];
    }

    interface StreamChunk {
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      choices?: { delta?: StreamChoiceDelta }[];
    }

    for await (const data of sseData(res.body!)) {
      if (data === "[DONE]") break;
      let chunk: StreamChunk;
      try {
        chunk = JSON.parse(data) as StreamChunk;
      } catch {
        continue;
      }
      if (chunk.usage) usage = chunk.usage;
      const choice = chunk.choices?.[0];
      if (!choice) continue;
      const delta = choice.delta ?? {};
      if (typeof delta.content === "string" && delta.content) yield { type: "text", text: delta.content };
      if (Array.isArray(delta.tool_calls) && delta.tool_calls.length) {
        acc = accumulateToolCalls(acc, delta.tool_calls);
      }
    }

    const toolCalls = acc
      .filter((t) => t.name)
      .map((t): AIToolCall => {
        let args: Record<string, unknown> = {};
        if (t.arguments) {
          try {
            args = JSON.parse(t.arguments) as Record<string, unknown>;
          } catch {
            args = { _raw: t.arguments };
          }
        }
        return { id: t.id || newToolCallId(), name: t.name, arguments: args };
      });

    yield {
      type: "done",
      toolCalls,
      usage: {
        inputTokens: usage?.prompt_tokens,
        outputTokens: usage?.completion_tokens,
        totalTokens: usage?.total_tokens,
      },
      model: this.meta.model,
    };
  }
}
/**
 * AgentRuntime — provider-independent agent loop.
 * Drives the tool-calling loop the same way for any model:
 *   model turn -> tool calls -> execute -> feed results -> model turn -> done.
 * The commerce agent logic (tools + prompt) never imports a vendor SDK.
 */

import type { AIProvider, AIChatMessage, AIRequestOptions, AIToolCall, AIUsage } from "../types";
import { ToolExecutor, type ToolContext } from "./executor";
import { fencedResult } from "./fencing";
import { AIError, isAIError } from "../errors";

/** Minimal structured logger the app can adapt to src/lib/server/logger. */
export interface AgentLogger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}

export interface AgentRuntimeConfig {
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
  requestId: string;
  logger?: AgentLogger;
  signal?: AbortSignal;
}

export interface AgentRunResult {
  text: string;
  iterations: number;
  usage?: AIUsage;
  finished: boolean;
}

export type AgentStreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; call: AIToolCall }
  | { type: "tool_result"; call: AIToolCall }
  | { type: "tool_error"; call: AIToolCall; message: string }
  | { type: "max_iterations" }
  | { type: "done" }
  | { type: "error"; kind: string; message: string };

function sumUsage(a: AIUsage | undefined, b: AIUsage | undefined): AIUsage | undefined {
  if (!a && !b) return undefined;
  const merge = (x?: number, y?: number) => (x == null || y == null ? x ?? y : x + y);
  return {
    inputTokens: merge(a?.inputTokens, b?.inputTokens),
    outputTokens: merge(a?.outputTokens, b?.outputTokens),
    totalTokens: merge(a?.totalTokens, b?.totalTokens),
  };
}

export function userSafeError(e: AIError): string {
  switch (e.kind) {
    case "auth":
      return "Không xác thực được với nhà cung cấp AI. Vui lòng kiểm tra cấu hình API key.";
    case "rate_limited":
      return "Dịch vụ AI tạm quá tải. Thử lại sau ít phút.";
    case "timeout":
      return "AI phản hồi quá chậm, vui lòng thử lại.";
    case "capability_missing":
      return "Model đang cấu hình chưa hỗ trợ tính năng này.";
    case "model_not_found":
      return "Model đang cấu hình không khả dụng. Vui lòng kiểm tra AI_MODEL.";
    case "unavailable":
      return "Dịch vụ AI tạm không khả dụng. Thử lại sau.";
    case "aborted":
      return "Yêu cầu đã bị hủy.";
    default:
      return "Có lỗi xảy ra với trợ lý. Vui lòng thử lại.";
  }
}

export class AgentRuntime {
  constructor(
    private provider: AIProvider,
    private executor: ToolExecutor,
    private cfg: AgentRuntimeConfig,
  ) {}

  private opts(): AIRequestOptions {
    const o: AIRequestOptions = {
      temperature: this.cfg.temperature,
      maxTokens: this.cfg.maxTokens,
      signal: this.cfg.signal,
    };
    if (this.provider.meta.capabilities.toolCalls) o.tools = this.executor.specs();
    return o;
  }

  private log(level: keyof AgentLogger, msg: string, meta?: Record<string, unknown>) {
    this.cfg.logger?.[level](msg, { requestId: this.cfg.requestId, ...meta });
  }

  private async executeCalls(calls: AIToolCall[], msgs: AIChatMessage[]): Promise<void> {
    const ctx: ToolContext = { requestId: this.cfg.requestId };
    for (const call of calls) {
      const t0 = Date.now();
      const outcome = await this.executor.dispatch(call.name, call.arguments, ctx);
      this.log("debug", "tool.dispatch", {
        tool: call.name,
        ok: outcome.ok,
        kind: outcome.ok ? undefined : outcome.kind,
        ms: Date.now() - t0,
      });
      msgs.push({
        role: "tool",
        toolCallId: call.id,
        name: call.name,
        content: outcome.ok ? fencedResult(call.name, outcome.value) : outcome.message,
      });
    }
  }

  /** Non-streaming run — returns the final assistant text. */
  async run(messages: AIChatMessage[]): Promise<AgentRunResult> {
    const msgs: AIChatMessage[] = [...messages];
    let usage: AIUsage | undefined;
    const maxIterations = this.cfg.maxIterations ?? 6;

    for (let i = 0; i < maxIterations; i++) {
      const t0 = Date.now();
      const res = await this.provider.chat(msgs, this.opts());
      usage = sumUsage(usage, res.usage);
      this.log("info", "agent.model_turn", {
        provider: this.provider.meta.provider,
        model: this.provider.meta.model,
        iteration: i + 1,
        toolCalls: res.toolCalls.length,
        ms: Date.now() - t0,
      });

      if (res.toolCalls.length === 0) {
        return { text: res.content, iterations: i + 1, usage, finished: true };
      }
      msgs.push({ role: "assistant", content: res.content || "", toolCalls: res.toolCalls });
      await this.executeCalls(res.toolCalls, msgs);
    }
    return {
      text: "Tôi cần thêm thông tin hoặc đã đạt giới hạn bước xử lý. Vui lòng hỏi cụ thể hơn.",
      iterations: maxIterations,
      usage,
      finished: false,
    };
  }
/** Streaming run — yields text deltas + tool lifecycle events. */
  async *streamRun(messages: AIChatMessage[]): AsyncGenerator<AgentStreamEvent> {
    const msgs: AIChatMessage[] = [...messages];
    const maxIterations = this.cfg.maxIterations ?? 6;
    try {
      for (let i = 0; i < maxIterations; i++) {
        const t0 = Date.now();
        let textBuf = "";
        let toolCalls: AIToolCall[] = [];
        let usage: AIUsage | undefined;
        for await (const ev of this.provider.stream(msgs, this.opts())) {
          if (ev.type === "text") {
            textBuf += ev.text;
            yield { type: "text", text: ev.text };
          } else if (ev.type === "done") {
            toolCalls = ev.toolCalls ?? [];
            usage = ev.usage;
          }
        }
        this.log("info", "agent.model_turn", {
          provider: this.provider.meta.provider,
          model: this.provider.meta.model,
          iteration: i + 1,
          toolCalls: toolCalls.length,
          ms: Date.now() - t0,
          usage,
        });

        if (toolCalls.length === 0) {
          yield { type: "done" };
          return;
        }

        msgs.push({ role: "assistant", content: textBuf || "", toolCalls });
        for (const call of toolCalls) {
          yield { type: "tool_call", call };
          const outcome = await this.executor.dispatch(call.name, call.arguments, { requestId: this.cfg.requestId });
          msgs.push({
            role: "tool",
            toolCallId: call.id,
            name: call.name,
            content: outcome.ok ? fencedResult(call.name, outcome.value) : outcome.message,
          });
          if (outcome.ok) yield { type: "tool_result", call };
          else yield { type: "tool_error", call, message: outcome.message };
        }
      }
      yield { type: "max_iterations" };
    } catch (err) {
      if (isAIError(err)) {
        this.log("error", "agent.failed", {
          provider: this.provider.meta.provider,
          model: this.provider.meta.model,
          kind: err.kind,
        });
        yield { type: "error", kind: err.kind, message: userSafeError(err) };
      } else {
        throw err;
      }
    }
  }
}
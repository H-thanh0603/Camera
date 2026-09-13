/**
 * Provider fallback runner.
 *
 * Tries an ordered list of providers for a single agent task. Fallback happens
 * before any output is committed: if the provider fails on the very first model
 * call (auth, rate limit, unavailable, bad model), the next provider is tried.
 * Once text has started streaming we commit to that provider (a half-sent reply
 * cannot be retracted). The chain length is finite — no retry loops possible.
 */

import type { AIProvider, AIChatMessage } from "./types";
import { AIError, isAIError } from "./errors";
import { AgentRuntime, type AgentLogger, type AgentStreamEvent, type AgentRunResult } from "./agent/runtime";
import type { ToolExecutor } from "./agent/executor";

export interface FallbackRuntimeInput {
  providers: AIProvider[];
  executor: ToolExecutor;
  requestId: string;
  logger?: AgentLogger;
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

interface Attempt {
  provider: AIProvider;
  runtime: AgentRuntime;
}

function buildAttempts(input: FallbackRuntimeInput): Attempt[] {
  return input.providers.map((provider) => ({
    provider,
    runtime: new AgentRuntime(provider, input.executor, {
      requestId: input.requestId,
      logger: input.logger,
      maxIterations: input.maxIterations,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      signal: input.signal,
    }),
  }));
}

function isTransient(e: AIError): boolean {
  return ["auth", "rate_limited", "timeout", "unavailable", "model_not_found"].includes(e.kind);
}

/** Non-streaming: try providers in order; last error wins if all fail. */
export async function runWithFallback(
  input: FallbackRuntimeInput,
  messages: AIChatMessage[],
): Promise<AgentRunResult> {
  const attempts = buildAttempts(input);
  if (attempts.length === 0) throw new Error("Không có provider AI nào được cấu hình.");
  let last: AIError | null = null;
  for (const att of attempts) {
    try {
      const res = await att.runtime.run(messages);
      input.logger?.info("agent.fallback.used", {
        requestId: input.requestId,
        provider: att.provider.meta.provider,
        model: att.provider.meta.model,
      });
      return res;
    } catch (err) {
      if (!isAIError(err)) throw err;
      last = err;
      if (!isTransient(err)) throw err; // non-transient: do not try fallbacks for auth misuse
      input.logger?.warn("agent.fallback.failed", {
        requestId: input.requestId,
        provider: att.provider.meta.provider,
        model: att.provider.meta.model,
        kind: err.kind,
      });
    }
  }
  throw last ?? new AIError("unavailable", "Tất cả provider đều không khả dụng.");
}

/** Streaming: first provider that yields any event is committed. */
export async function* streamWithFallback(
  input: FallbackRuntimeInput,
  messages: AIChatMessage[],
): AsyncGenerator<AgentStreamEvent> {
  const attempts = buildAttempts(input);
  if (attempts.length === 0) throw new Error("Không có provider AI nào được cấu hình.");

  for (let idx = 0; idx < attempts.length; idx++) {
    const att = attempts[idx]!;
    const gen = att.runtime.streamRun(messages);
    let emittedAny = false;

    while (true) {
      let result: IteratorResult<AgentStreamEvent>;
      try {
        result = await gen.next();
      } catch {
        // Provider failed already logged; try next provider.
        input.logger?.warn("agent.fallback.failed", {
          requestId: input.requestId,
          provider: att.provider.meta.provider,
          model: att.provider.meta.model,
        });
        break; // try next provider
      }
      if (result.done) return; // this provider completed the task

      const ev = result.value;
      // A provider that fails on its very first model call yields an error event.
      const canFallBack =
        ev.type === "error" &&
        !emittedAny &&
        ["auth", "rate_limited", "timeout", "unavailable", "model_not_found"].includes(ev.kind) &&
        idx < attempts.length - 1;
      if (canFallBack) {
        input.logger?.warn("agent.fallback.failed", {
          requestId: input.requestId,
          provider: att.provider.meta.provider,
          model: att.provider.meta.model,
          kind: ev.kind,
        });
        break; // discard this provider, try next
      }
      if (!emittedAny) {
        emittedAny = true;
        input.logger?.info("agent.fallback.used", {
          requestId: input.requestId,
          provider: att.provider.meta.provider,
          model: att.provider.meta.model,
        });
      }
      yield ev;
    }
  }
  // Exhausted all providers without a usable reply.
  yield {
    type: "error",
    kind: "unavailable",
    message: "Tất cả nhà cung cấp AI đều không khả dụng. Vui lòng thử lại sau.",
  };
}
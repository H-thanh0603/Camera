/**
 * ToolExecutor — dispatches model tool calls to registered commerce tools.
 * Mirrors the Commerce Agents executor: a shared dispatch with a failure
 * ladder (invalid args -> domain error -> system error) so the model sees a
 * typed, safe outcome instead of raw exceptions, and nothing internal leaks.
 */

import { z } from "zod";
import { toJsonSchema, sanitizeToolArgs } from "../schema";
import type { AIToolSpec } from "../types";

/** A call context handed to every tool (never carries credentials). */
export interface ToolContext {
  requestId: string;
}

export interface CommerceTool<S extends z.ZodType = z.ZodType, R = unknown> {
  name: string;
  description: string;
  input: S;
  run(input: z.output<S>, ctx: ToolContext): Promise<R> | R;
}

/** Throw from a tool's run() for predictable, user-safe outcomes. */
export class ToolRunError extends Error {
  constructor(
    public kind: "not_found" | "unavailable" | "invalid",
    message: string,
  ) {
    super(message);
    this.name = "ToolRunError";
  }
}

export type ToolOutcome =
  | { ok: true; value: unknown }
  | { ok: false; kind: "invalid" | "not_found" | "unavailable" | "error"; message: string };

const USER_SAFE_FALLBACK = "Thao tác không hoàn tất được, vui lòng thử lại.";

function safeMessageFor(err: ToolRunError): string {
  // Domain messages are constructed by our tools and safe to relay.
  return err.message || USER_SAFE_FALLBACK;
}

export class ToolExecutor {
  private byName: Map<string, CommerceTool>;
  private list: CommerceTool[];

  constructor(tools: CommerceTool[]) {
    this.list = tools;
    this.byName = new Map(tools.map((t) => [t.name, t]));
  }

  /** Provider-neutral tool specs (JSON Schema params) for LLM calls. */
  specs(): AIToolSpec[] {
    return this.list.map((t) => ({ name: t.name, description: t.description, parameters: toJsonSchema(t.input) }));
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  names(): string[] {
    return this.list.map((t) => t.name);
  }

  async dispatch(name: string, rawArgs: unknown, ctx: ToolContext): Promise<ToolOutcome> {
    const tool = this.byName.get(name);
    if (!tool) {
      return { ok: false, kind: "error", message: `Không nhận diện được công cụ "${name}".` };
    }
    const parsed = tool.input.safeParse(sanitizeToolArgs(rawArgs));
    if (!parsed.success) {
      return {
        ok: false,
        kind: "invalid",
        message: `Tham số không hợp lệ cho ${name}: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
      };
    }
    try {
      const value = await tool.run(parsed.data as never, ctx);
      return { ok: true, value };
    } catch (err) {
      if (err instanceof ToolRunError) {
        return { ok: false, kind: err.kind, message: safeMessageFor(err) };
      }
      // Never leak internal error text to the model.
      return { ok: false, kind: "error", message: USER_SAFE_FALLBACK };
    }
  }
}
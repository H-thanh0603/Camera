/**
 * ToolExecutor — dispatches model tool calls to registered commerce tools.
 * Mirrors the Commerce Agents executor: a shared dispatch with a failure
 * ladder (invalid args -> domain error -> system error) so the model sees a
 * typed, safe outcome instead of raw exceptions, and nothing internal leaks.
 */

import { z } from "zod";
import { toJsonSchema, sanitizeToolArgs } from "../schema";
import type { AIToolSpec } from "../types";
import type { ToolPermission, ToolPolicy } from "./permissions";
import { GUEST_POLICY } from "./permissions";

/** A call context handed to every tool (never carries credentials). */
export interface ToolContext {
  requestId: string;
  /** Duyệt hành động nhạy cảm thay cho user — inject bởi route qua session store. */
  approvedActions?: Set<string>;
  /** Session chat hiện tại (write tools lưu action/price watch theo session). */
  rawSid?: string;
  /** Write tools gọi khi soạn hành động chờ duyệt (lưu DB). */
  persistAction?: (action: { actionKey: string; tool: string; summary: string; data: Record<string, unknown> }) => Promise<void>;
}

export interface CommerceTool<S extends z.ZodType = z.ZodType, R = unknown> {
  name: string;
  description: string;
  input: S;
  /**
   * Quyền tool cần (read mặc định). "cart"/"delegate" là hành động ghi —
   * executor yêu cầu user approval trước khi run thật (xem requiresApproval).
   */
  permission?: ToolPermission;
  /**
   * Với tool ghi: tạo payload hành động chờ duyệt. Không có hàm này thì
   * tool ghi chạy trực tiếp (không dùng — mọi tool ghi PHẢI prepare).
   */
  prepareAction?: (input: z.output<S>, ctx: ToolContext) => {
    /** Key duy nhất xác định hành động — user duyệt key này qua endpoint. */
    actionKey: string;
    /** Mô tả hiển thị cho user trước khi duyệt. */
    summary: string;
    /** Payload lưu server-side, chỉ dùng khi đã duyệt. */
    data: Record<string, unknown>;
  };
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
  private policy: ToolPolicy;

  constructor(tools: CommerceTool[], policy: ToolPolicy = GUEST_POLICY) {
    this.list = tools.filter((t) => policy.allowed(t.permission));
    this.policy = policy;
    this.byName = new Map(this.list.map((t) => [t.name, t]));
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

  /** Tool có phải hành động cần duyệt không (theo khai báo permission). */
  needsApproval(name: string): boolean {
    const tool = this.byName.get(name);
    return Boolean(tool?.prepareAction);
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
      // Tool ghi phải có chuẩn bị hành động; caller duyệt rồi mới cho chạy.
      if (tool.prepareAction) {
        const action = tool.prepareAction(parsed.data as never, ctx);
        if (!ctx.approvedActions?.has(action.actionKey)) {
          return {
            ok: true,
            value: {
              action_required: action.actionKey,
              summary: action.summary,
              note: "Hành động chờ khách duyệt. Nói ngắn gọn những gì sắp làm và đợi khách bấm duyệt — không gọi lại tool này cho đến khi được duyệt.",
            },
          };
        }
      }
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
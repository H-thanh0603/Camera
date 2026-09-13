/**
 * Provider-agnostic AI error hierarchy, mapped from underlying transport/sdk
 * failures so the agent layer never depends on a vendor's error classes.
 * Compatible with the app's ApiError convention (message + optional status).
 */
import type { ModelCapability } from "./types";

export type AIErrorKind =
  | "auth"
  | "rate_limited"
  | "timeout"
  | "unavailable"
  | "bad_request"
  | "model_not_found"
  | "capability_missing"
  | "invalid_output"
  | "tool_execution"
  | "configuration"
  | "aborted";

/** Base class -> module is importable by pure logic + tests (schemas/errors). */
export class AIError extends Error {
  readonly kind: AIErrorKind;
  readonly status: number;
  /** Provider/model that produced the failure (never a secret). */
  readonly provider?: string;
  readonly model?: string;
  /** True when the failure is transient and a fallback may help. */
  readonly retryable: boolean;

  constructor(
    kind: AIErrorKind,
    message: string,
    opts: { status?: number; provider?: string; model?: string; retryable?: boolean; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "AIError";
    this.kind = kind;
    this.status = opts.status ?? 500;
    this.provider = opts.provider;
    this.model = opts.model;
    this.retryable = opts.retryable ?? false;
  }
}

export class ConfigurationError extends AIError {
  constructor(message: string) {
    super("configuration", message, { status: 503 });
    this.name = "ConfigurationError";
  }
}

export class AuthError extends AIError {
  constructor(provider?: string, message = "API key không hợp lệ hoặc thiếu quyền truy cập provider.", opts: { status?: number; model?: string } = {}) {
    super("auth", message, { status: opts.status ?? 401, provider, model: opts.model, retryable: false });
    this.name = "AuthError";
  }
}

export class RateLimitError extends AIError {
  constructor(provider?: string, message = "Provider đang giới hạn tốc độ. Thử lại sau.", opts: { retryAfterSeconds?: number; model?: string } = {}) {
    super("rate_limited", message, { status: 429, provider, model: opts.model, retryable: true });
    this.name = "RateLimitError";
    (this as { retryAfterSeconds?: number }).retryAfterSeconds = opts.retryAfterSeconds;
  }
}

export class TimeoutError extends AIError {
  constructor(provider?: string, opts: { model?: string } = {}) {
    super("timeout", "Provider không phản hồi đúng hạn.", { status: 504, provider, model: opts.model, retryable: true });
    this.name = "TimeoutError";
  }
}

export class ProviderUnavailableError extends AIError {
  constructor(provider?: string, opts: { status?: number; message?: string; model?: string } = {}) {
    super("unavailable", opts.message ?? "Provider tạm không khả dụng.", {
      status: opts.status ?? 503,
      provider,
      model: opts.model,
      retryable: true,
    });
    this.name = "ProviderUnavailableError";
  }
}

export class ModelNotFoundError extends AIError {
  constructor(provider?: string, model?: string) {
    super("model_not_found", `Model không tồn tại hoặc không dùng được${model ? `: ${model}` : ""}.`, {
      status: 400,
      provider,
      model,
      retryable: false,
    });
    this.name = "ModelNotFoundError";
  }
}

export class CapabilityError extends AIError {
  constructor(capability: ModelCapability, provider?: string, model?: string) {
    super("capability_missing", `Provider/model không hỗ trợ: ${capability}.`, {
      status: 501,
      provider,
      model,
      retryable: false,
    });
    this.name = "CapabilityError";
  }
  capability!: ModelCapability;
}

export class InvalidOutputError extends AIError {
  constructor(message = "Model trả về dữ liệu không hợp lệ.", cause?: unknown) {
    super("invalid_output", message, { status: 502, retryable: false, cause });
    this.name = "InvalidOutputError";
  }
}

export class ToolExecutionError extends AIError {
  /** Internal: tool name. Do not forward raw error text to end user. */
  constructor(toolName: string, message = `Thao tác ${toolName} thất bại.`) {
    super("tool_execution", message, { status: 500 });
    this.name = "ToolExecutionError";
  }
}

export class AbortedError extends AIError {
  constructor() {
    super("aborted", "Yêu cầu đã bị hủy.", { status: 499 });
    this.name = "AbortedError";
  }
}

/** Convenience narrowing guard. */
export function isAIError(e: unknown): e is AIError {
  return e instanceof AIError;
}
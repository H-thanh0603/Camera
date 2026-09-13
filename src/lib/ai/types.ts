/**
 * Provider-agnostic AI core — types.
 *
 * The rest of the application talks to this abstraction, never to a specific
 * LLM SDK. Adapters (providers/*) translate these neutral types into each
 * vendor's wire format and back. This mirrors the Commerce Agents concept of a
 * single executable contract (tool contracts, events, capabilities) that stays
 * the same no matter which model runs it.
 */

/** Feature a model may or may not support. Unknown → assume off, handle gracefully. */
export type ModelCapability =
  | "chat"
  | "streaming"
  | "toolCalls"
  | "structuredOutput"
  | "vision"
  | "reasoning";

export type AICapabilities = Record<ModelCapability, boolean>;

export const DEFAULT_CAPABILITIES: AICapabilities = {
  chat: true,
  streaming: true,
  toolCalls: true,
  structuredOutput: true,
  vision: false,
  reasoning: false,
};

export interface AIProviderMeta {
  /** Canonical provider name (from AI_PROVIDER): "anthropic", "openrouter", ... */
  provider: string;
  /** Model identifier, e.g. "anthropic/claude-sonnet-4", "deepseek-chat". */
  model: string;
  capabilities: AICapabilities;
}

/* ---------- Messages ---------- */

export interface AIToolCall {
  /** Provider-assigned call id — used to feed the result back. */
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AIChatRole = "system" | "user" | "assistant" | "tool";

export interface AIChatMessage {
  role: AIChatRole;
  content: string;
  /** Assistant messages may carry tool calls they intend to run. */
  toolCalls?: AIToolCall[];
  /** Tool messages reference the tool_call_id they answer. */
  toolCallId?: string;
  /** Tool message: name of the tool that produced the content. */
  name?: string;
}

/* ---------- Request / result ---------- */

export interface AIRequestOptions {
  temperature?: number;
  maxTokens?: number;
  /** Abort the upstream request (client disconnect, timeout). */
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Extra provider-scoped overrides (per-call model swap etc.). */
  model?: string;
  /** Headers merged on top of the configured ones (e.g. org headers). */
  extraHeaders?: Record<string, string>;
  /** Tools the model may call this turn (provider-agnostic contract). */
  tools?: AIToolSpec[];
}

/** Provider-agnostic tool definition handed through request options. */
export interface AIToolSpec {
  name: string;
  description: string;
  /** JSON Schema for parameters. */
  parameters: Record<string, unknown>;
}

export interface AIUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface AIChatResult {
  content: string;
  toolCalls: AIToolCall[];
  usage?: AIUsage;
  finishReason?: string;
  model?: string;
}

export type AIStreamEvent =
  | { type: "text"; text: string }
  | { type: "toolDraft"; call: AIToolCall }
  | { type: "done"; toolCalls: AIToolCall[]; usage?: AIUsage; model?: string };

/* ---------- Structured output ---------- */

export interface AIJsonSchema {
  /** Tool name used to coerce the model (provider-agnostic). */
  name: string;
  description?: string;
  /** JSON Schema (draft 2020-12 compatible subset) for the output. */
  schema: Record<string, unknown>;
}

export interface StructuredOutputRequest<T> {
  /** Conversation (role + content) the model should respond to. */
  messages: AIChatMessage[];
  schema: AIJsonSchema;
  /** Parses + validates raw model output into T (e.g. zod.safeParse). */
  validator: (data: unknown) => T;
  model?: string;
  signal?: AbortSignal;
}

/** Interface implemented by every provider adapter. */
export interface AIProvider {
  readonly meta: AIProviderMeta;
  chat(messages: AIChatMessage[], opts?: AIRequestOptions): Promise<AIChatResult>;
  /** Stream text + tool drafts. Throws AIError subclasses on failure. */
  stream(messages: AIChatMessage[], opts?: AIRequestOptions): AsyncIterable<AIStreamEvent>;
}
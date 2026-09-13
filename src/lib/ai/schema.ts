/**
 * JSON-schema helpers: turn a zod tool contract into a provider-neutral
 * JSON Schema, and guard/serialize tool outputs fed back to the model.
 */

import { z } from "zod";
import type { AIToolCall } from "./types";

/** JSON Schema type a provider adapter can hand to its tool/function API. */
export type JsonSchema = Record<string, unknown>;

/**
 * zod v4 -> JSON Schema subset usable as both OpenAI `functions[].parameters`
 * and Anthropic `tools[].input_schema`. Strips the `$schema` meta so we don't
 * forward a draft marker some gateways reject.
 */
export function toJsonSchema(schema: z.ZodType<unknown>): JsonSchema {
  const js = z.toJSONSchema(schema) as Record<string, unknown>;
  const { $schema, ...rest } = js;
  void $schema;
  return rest;
}

/** Clamp + sanitize a parsed tool input before handing it to any tool. */
export function sanitizeToolArgs(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
    // Never forward keys that look like credentials/do-not-call directives.
    if (/passw|secret|token|api[_-]?key|credential/i.test(k)) continue;
    out[k] = v;
  }
  return out;
}

/**
 * Render a tool result to text the model reads as *data* — always JSON, so the
 * model never mistakes it for instructions. Truncates long payloads.
 */
export function serializeToolResult(value: unknown, maxChars = 6_000): string {
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch {
    text = `[unserializable ${typeof value}]`;
  }
  if (text.length > maxChars) {
    const cut = text.slice(0, maxChars);
    return `${cut}…[truncated ${text.length - maxChars} chars]`;
  }
  return text;
}

/** Deterministic, stable id for a tool call created by our layer. */
export function newToolCallId(suffix = ""): string {
  const rand =
    typeof crypto !== "undefined" && "getRandomValues" in crypto
      ? crypto.getRandomValues(new Uint8Array(8))
      : undefined;
  const part = rand ? Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("") : Math.random().toString(16).slice(2);
  return `call_${part}${suffix}`;
}

/** Assign stable ids to provider tool calls missing them (Anthropic has them; some don't). */
export function ensureToolCallIds(calls: AIToolCall[]): AIToolCall[] {
  return calls.map((c) => (c.id ? c : { ...c, id: newToolCallId() }));
}
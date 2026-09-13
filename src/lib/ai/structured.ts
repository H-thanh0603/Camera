/**
 * Provider-agnostic structured output.
 *
 * Strategy — independent of SDK:
 *   1. If the provider supports tool calling, hand it a single "output" tool
 *      whose schema is the target JSON shape and ask the model to call it.
 *      Parsing tool arguments is schema-agnostic, so this is the most
 *      portable path across Anthropic / OpenAI / OpenRouter / Gemini / DeepSeek.
 *   2. Metrics if that fails (provider answered in text instead), re-ask for
 *      pure JSON and parse the content.
 *   3. Validates with the caller's zod validator; retries the JSON path once.
 */

import type { AIProvider, AIRequestOptions, StructuredOutputRequest } from "./types";
import { InvalidOutputError, CapabilityError } from "./errors";

async function firstToolCallJson<T>(
  provider: AIProvider,
  req: StructuredOutputRequest<T>,
  opts: AIRequestOptions,
): Promise<T | null> {
  const call = await provider.chat(
    [
      ...req.messages,
      {
        role: "user",
        content:
          `Respond by calling the tool \`${req.schema.name}\` with a single argument object ` +
          `matching the request. Do not explain; do not call any other tool.`,
      },
    ],
    {
      ...opts,
      tools: [{ name: req.schema.name, description: req.schema.description ?? "", parameters: req.schema.schema }],
    },
  );
  const match = call.toolCalls.find((tc) => tc.name === req.schema.name);
  if (!match) return null;
  return req.validator(match.arguments);
}

async function plainJson<T>(
  provider: AIProvider,
  req: StructuredOutputRequest<T>,
  opts: AIRequestOptions,
): Promise<T | null> {
  const res = await provider.chat(
    [
      ...req.messages,
      { role: "user", content: `Respond with ONLY raw JSON matching this schema. ${JSON.stringify(req.schema.schema)}` },
    ],
    opts,
  );
  const text = (res.content ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!text) return null;
  try {
    return req.validator(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Attempts to fetch structured output; throws InvalidOutputError on failure. */
export async function generateStructured<T>(provider: AIProvider, req: StructuredOutputRequest<T>): Promise<T> {
  if (!provider.meta.capabilities.structuredOutput) {
    throw new CapabilityError("structuredOutput", provider.meta.provider, provider.meta.model);
  }
  const opts: AIRequestOptions = { model: req.model, signal: req.signal };

  if (provider.meta.capabilities.toolCalls) {
    const viaTool = await firstToolCallJson(provider, req, opts);
    if (viaTool !== null) return viaTool;
  }

  // Fall back to plain JSON (covers providers without tool calling).
  for (let attempt = 0; attempt < 2; attempt++) {
    const json = await plainJson(provider, req, opts);
    if (json !== null) return json;
  }
  throw new InvalidOutputError(`Không thể đọc dữ liệu có cấu trúc từ model (${provider.meta.provider}/${provider.meta.model}).`);
}
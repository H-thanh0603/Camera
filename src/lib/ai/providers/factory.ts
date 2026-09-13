/**
 * Provider factory — creates an AIProvider adapter from a provider name.
 * This is the ONLY place that knows concrete classes; the rest of the app
 * talks to AIProvider. Adding a provider = add a case here (or in the
 * OpenAI-compatible family).
 */

import type { AICapabilities, AIProvider } from "../types";
import { OpenAICompatibleProvider } from "./openai-compatible";
import { AnthropicProvider } from "./anthropic";
import { PROVIDER_PRESETS, type ProviderName } from "../config";

export interface CreateProviderInput {
  provider: ProviderName;
  apiKey: string;
  model: string;
  baseUrl?: string;
  timeoutMs?: number;
  capabilities?: Partial<AICapabilities>;
}

export function createProvider(input: CreateProviderInput): AIProvider {
  const preset = PROVIDER_PRESETS[input.provider];
  if (input.provider === "anthropic") {
    return new AnthropicProvider({
      apiKey: input.apiKey,
      model: input.model,
      defaultTimeoutMs: input.timeoutMs,
      capabilities: input.capabilities,
    });
  }
  // Everything else talks OpenAI-compatible /chat/completions.
  return new OpenAICompatibleProvider({
    name: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    baseUrl: input.baseUrl ?? preset.baseUrl!,
    defaultTimeoutMs: input.timeoutMs,
    capabilities: input.capabilities,
  });
}
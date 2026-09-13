/**
 * Public entry for the provider-agnostic commerce agent. Wire the configured
 * provider(s), the tool executor (seed or db data source) and expose helpers
 * that the API route uses. No Anthropic/OpenAI import here.
 */

import type { AIProvider, AIChatMessage } from "./types";
import { getAIConfig, PROVIDER_PRESETS, type AIConfig, type ProviderName } from "./config";
import { createProvider } from "./providers/factory";
import { ToolExecutor } from "./agent/executor";
import { createCommerceTools } from "./tools/commerce-tools";
import { compareProductsTool, recommendProductsTool } from "./tools/compare-recommend";
import type { CommerceDataSource } from "./tools/data-source";
import { fenceText } from "./agent/fencing";

/** Build the executor for a given data source (all commerce tools). */
export function buildExecutor(source: CommerceDataSource): ToolExecutor {
  return new ToolExecutor([
    ...createCommerceTools({ source }),
    compareProductsTool(source),
    recommendProductsTool(source),
  ]);
}

/** Build an ordered chain of providers: primary + configured fallbacks. */
export function buildProviderChain(config: AIConfig = getAIConfig()): AIProvider[] {
  const chain: AIProvider[] = [];
  if (!config.enabled) return chain;

  const primary = createProvider({
    provider: config.provider,
    apiKey: config.apiKey,
    model: config.model,
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    capabilities: config.capabilities,
  });
  chain.push(primary);

  for (const fb of config.fallbacks) {
    const name = fb.provider as ProviderName;
    const key = PROVIDER_PRESETS[name].envKey ? process.env[PROVIDER_PRESETS[name].envKey]?.trim() || process.env.AI_API_KEY?.trim() : "";
    if (!key) continue;
    chain.push(
      createProvider({
        provider: name,
        apiKey: key,
        model: fb.model,
        baseUrl: PROVIDER_PRESETS[name].baseUrl,
        timeoutMs: config.timeoutMs,
        capabilities: fb.capabilities,
      }),
    );
  }
  return chain;
}

/** Build the neutral message list from fresh + history turns. */
export function buildChatMessages(input: { message: string; history?: { role: "user" | "assistant"; content: string }[]; system: string }): AIChatMessage[] {
  const out: AIChatMessage[] = [{ role: "system", content: input.system }];
  const history = (input.history ?? []).slice(-20);
  for (const h of history) {
    out.push({ role: h.role, content: h.role === "user" ? fenceText(h.content, 2000) : h.content.slice(0, 4000) });
  }
  out.push({ role: "user", content: fenceText(input.message, 2000) });
  return out;
}

export { getAIConfig } from "./config";
export type { AIConfig } from "./config";
export { streamWithFallback, runWithFallback } from "./fallback";
export { SHOPPING_ASSISTANT_SYSTEM_PROMPT, QUICK_PROMPTS } from "./agent/prompts";
export type { AgentLogger, AgentStreamEvent, AgentRuntimeConfig } from "./agent/runtime";
export type { AIProvider, AIChatMessage, AIToolCall } from "./types";
export type { ToolExecutor } from "./agent/executor";
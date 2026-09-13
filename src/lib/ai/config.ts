/**
 * AI configuration — read from environment lazily so the app never hard-codes
 * a provider/model, and so a missing API key cannot take down unrelated routes.
 *
 * Design (provider-agnostic):
 *   AI_PROVIDER=anthropic|openai|openrouter|tokenrouter|deepseek|gemini
 *   AI_MODEL=...
 *   AI_API_KEY=...                     (generic; provider-specific keys win)
 *   ANTHROPIC_API_KEY / OPENROUTER_API_KEY / ... (provider-specific override)
 *   AI_FALLBACK_PROVIDER / AI_FALLBACK_MODEL / ... (optional failover chain)
 *
 * All keys are evaluated here and kept server-side only.
 */

import type { AICapabilities, AIProviderMeta } from "./types";
import { DEFAULT_CAPABILITIES } from "./types";

export const SUPPORTED_PROVIDERS = [
  "anthropic",
  "openai",
  "openrouter",
  "tokenrouter",
  "deepseek",
  "gemini",
] as const;

export type ProviderName = (typeof SUPPORTED_PROVIDERS)[number];

/** Static per-provider knowledge for capability-aware switching. */
export interface ProviderPreset {
  /** OpenAI-compatible /chat/completions endpoint base (no trailing slash). */
  baseUrl?: string;
  envKey: string;
  defaultModel?: string;
  /** Suggested capability defaults; adapters can refine per-request. */
  capabilities?: Partial<AICapabilities>;
}

export const PROVIDER_PRESETS: Record<ProviderName, ProviderPreset> = {
  anthropic: { envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-sonnet-4-20250514", capabilities: { vision: true, reasoning: true } },
  openai: { envKey: "OPENAI_API_KEY", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", capabilities: { vision: true } },
  openrouter: { envKey: "OPENROUTER_API_KEY", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "anthropic/claude-sonnet-4", capabilities: { vision: true } },
  tokenrouter: { envKey: "TOKENROUTER_API_KEY", baseUrl: "https://tokenrouter.ai/api/v1", defaultModel: "anthropic/claude-sonnet-4" },
  deepseek: { envKey: "DEEPSEEK_API_KEY", baseUrl: "https://api.deepseek.com/v1", defaultModel: "deepseek-chat" },
  gemini: { envKey: "GOOGLE_API_KEY", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", defaultModel: "gemini-1.5-flash", capabilities: { vision: true } },
};

export interface AIConfig {
  enabled: boolean;
  provider: ProviderName;
  model: string;
  apiKey: string;
  baseUrl?: string;
  capabilities: AICapabilities;
  temperature?: number;
  maxTokens?: number;
  timeoutMs: number;
  /** Ordered fallback chain; first entry may be the primary itself. */
  fallbacks: AIProviderMeta[];
  maxIterations: number;
}

function readProviderMeta(provider: ProviderName, model: string, apiKey: string): { meta: AIProviderMeta; baseUrl?: string; key: string } {
  const preset = PROVIDER_PRESETS[provider];
  return {
    meta: {
      provider,
      model: model || preset.defaultModel || "unknown-model",
      capabilities: { ...DEFAULT_CAPABILITIES, ...(preset.capabilities ?? {}) },
    },
    baseUrl: preset.baseUrl,
    key: apiKey,
  };
}

/** Pick the api key for a provider: AI_API_KEY generic, then provider-specific. */
function apiKeyFor(provider: ProviderName, env: NodeJS.ProcessEnv): string {
  const preset = PROVIDER_PRESETS[provider];
  return env[preset.envKey]?.trim() || env.AI_API_KEY?.trim() || "";
}

function validProvider(raw: string | undefined): ProviderName | null {
  if (!raw) return null;
  const p = raw.trim().toLowerCase() as ProviderName;
  return SUPPORTED_PROVIDERS.includes(p) ? p : null;
}

/** Parse the optional `key=value;key=value` fallback list env. */
function parseFallbacks(raw: string | undefined): AIProviderMeta[] {
  if (!raw) return [];
  const out: AIProviderMeta[] = [];
  for (const entry of raw.split(";")) {
    const kv = new Map(
      entry
        .split(/[&,]/)
        .map((p) => p.trim().split("="))
        .filter((p) => p.length === 2)
        .map(([k, v]) => [k.trim(), v.trim()]),
    );
    const provider = validProvider(kv.get("provider"));
    if (!provider) continue;
    const preset = PROVIDER_PRESETS[provider];
    out.push({
      provider,
      model: kv.get("model") || preset.defaultModel || "unknown-model",
      capabilities: { ...DEFAULT_CAPABILITIES, ...(preset.capabilities ?? {}) },
    });
  }
  return out;
}

export interface BuildConfigOptions {
  env?: NodeJS.ProcessEnv;
}

/** Builds config WITHOUT throwing — returns disabled when not configured. */
export function getAIConfig(opts: BuildConfigOptions = {}): AIConfig {
  const env = opts.env ?? process.env as NodeJS.ProcessEnv;
  const provider = validProvider(env.AI_PROVIDER);
  const apiKey = provider ? apiKeyFor(provider, env) : "";
  const enabled = Boolean(provider && apiKey);
  if (!enabled || !provider) {
    return {
      enabled: false,
      provider: provider ?? "openai",
      model: env.AI_MODEL || PROVIDER_PRESETS.openai.defaultModel!,
      apiKey: "",
      capabilities: DEFAULT_CAPABILITIES,
      timeoutMs: Number(env.AI_TIMEOUT_MS || 30_000),
      fallbacks: parseFallbacks(env.AI_FALLBACKS),
      maxIterations: Number(env.AI_MAX_ITERATIONS || 6),
    };
  }
  const { meta, baseUrl } = readProviderMeta(provider, env.AI_MODEL || "", apiKey);
  return {
    enabled,
    provider,
    model: meta.model,
    apiKey,
    baseUrl,
    capabilities: meta.capabilities,
    temperature: env.AI_TEMPERATURE ? Number(env.AI_TEMPERATURE) : undefined,
    maxTokens: env.AI_MAX_TOKENS ? Number(env.AI_MAX_TOKENS) : undefined,
    timeoutMs: Number(env.AI_TIMEOUT_MS || 30_000),
    fallbacks: parseFallbacks(env.AI_FALLBACKS),
    maxIterations: Number(env.AI_MAX_ITERATIONS || 6),
  };
}
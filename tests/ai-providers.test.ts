import { describe, expect, it } from "vitest";
import { createProvider } from "@/lib/ai/providers/factory";
import { OpenAICompatibleProvider } from "@/lib/ai/providers/openai-compatible";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { getAIConfig, PROVIDER_PRESETS, SUPPORTED_PROVIDERS } from "@/lib/ai/config";
import { createProvider as createNamed } from "@/lib/ai/providers/factory";

const ENV = {
  AI_PROVIDER: "openrouter",
  AI_MODEL: "anthropic/claude-sonnet-4",
  AI_API_KEY: "sk-generic",
  OPENROUTER_API_KEY: "sk-or-specific",
  AI_FALLBACKS: "provider=deepseek&model=deepseek-chat;provider=openai&model=gpt-4o-mini",
  AI_MAX_ITERATIONS: "5",
} as unknown as NodeJS.ProcessEnv;

describe("getAIConfig", () => {
  it("đọc provider/model từ env và ưu tiên key riêng của provider", () => {
    const cfg = getAIConfig({ env: ENV });
    expect(cfg.enabled).toBe(true);
    expect(cfg.provider).toBe("openrouter");
    expect(cfg.model).toBe("anthropic/claude-sonnet-4");
    expect(cfg.apiKey).toBe("sk-or-specific");
    expect(cfg.baseUrl).toBe("https://openrouter.ai/api/v1");
  });

  it("parse chuỗi fallback thành danh sách meta có thứ tự", () => {
    const cfg = getAIConfig({ env: ENV });
    expect(cfg.fallbacks).toHaveLength(2);
    expect(cfg.fallbacks[0]).toMatchObject({ provider: "deepseek", model: "deepseek-chat" });
    expect(cfg.fallbacks[1]).toMatchObject({ provider: "openai", model: "gpt-4o-mini" });
    expect(cfg.maxIterations).toBe(5);
  });

  it("disabled khi thiếu API key (app không crash)", () => {
    const cfg = getAIConfig({ env: { AI_PROVIDER: "openai" } as unknown as NodeJS.ProcessEnv });
    expect(cfg.enabled).toBe(false);
  });

  it("disabled khi provider không hỗ trợ", () => {
    const cfg = getAIConfig({ env: { AI_PROVIDER: "nope", AI_API_KEY: "x" } as unknown as NodeJS.ProcessEnv });
    expect(cfg.enabled).toBe(false);
  });

  it("mọi provider hỗ trợ đều có preset baseUrl/envKey (trừ anthropic dùng Messages API)", () => {
    for (const p of SUPPORTED_PROVIDERS) {
      expect(PROVIDER_PRESETS[p].envKey).toBeTruthy();
    }
    expect(PROVIDER_PRESETS.anthropic.baseUrl).toBeUndefined();
  });
});

describe("factory", () => {
  it("tạo OpenAI-compatible adapter cho openai/openrouter/deepseek/tokenrouter/gemini", () => {
    for (const p of ["openai", "openrouter", "deepseek", "tokenrouter", "gemini"] as const) {
      const provider = createProvider({
        provider: p,
        apiKey: "k",
        model: "m",
      });
      expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
      expect(provider.meta.provider).toBe(p);
      expect(provider.meta.model).toBe("m");
    }
  });

  it("tạo Anthropic adapter riêng cho anthropic", () => {
    const provider = createNamed({ provider: "anthropic", apiKey: "k", model: "claude-x" });
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.meta.provider).toBe("anthropic");
  });
});
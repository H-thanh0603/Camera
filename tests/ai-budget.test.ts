import { describe, expect, it, beforeEach } from "vitest";
import { __resetBudget, addBudgetUsage, getBudgetUsage } from "@/lib/ai/budget";
import { getAIConfig } from "@/lib/ai/config";

describe("token budget (kill-switch chi phí)", () => {
  beforeEach(() => {
    __resetBudget();
  });

  it("không cap (0) → không bao giờ block", async () => {
    await addBudgetUsage(1_000_000);
    const check = await getBudgetUsage(0);
    expect(check.capped).toBe(false);
    expect(check.blocked).toBe(false);
  });

  it("vượt cap → blocked; dưới cap → cho qua", async () => {
    await addBudgetUsage(900);
    let check = await getBudgetUsage(1_000);
    expect(check.blocked).toBe(false);
    expect(check.usedPercent).toBe(90);

    await addBudgetUsage(200);
    check = await getBudgetUsage(1_000);
    expect(check.used).toBe(1_100);
    expect(check.blocked).toBe(true);
  });

  it("delta âm/0 bị bỏ qua", async () => {
    const total = await addBudgetUsage(-5);
    expect(total).toBe(0);
    const zero = await addBudgetUsage(0);
    expect(zero).toBe(0);
  });

  it("config đọc AI_MONTHLY_TOKEN_CAP, sai/âm → 0 (không giới hạn)", () => {
    expect(getAIConfig({ env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "k", AI_MONTHLY_TOKEN_CAP: "2000000" } as unknown as NodeJS.ProcessEnv }).monthlyTokenCap).toBe(2_000_000);
    expect(getAIConfig({ env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "k", AI_MONTHLY_TOKEN_CAP: "abc" } as unknown as NodeJS.ProcessEnv }).monthlyTokenCap).toBe(0);
    expect(getAIConfig({ env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "k", AI_MONTHLY_TOKEN_CAP: "-1" } as unknown as NodeJS.ProcessEnv }).monthlyTokenCap).toBe(0);
    expect(getAIConfig({ env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv }).monthlyTokenCap).toBe(0);
  });

  it("maxTokens mặc định 1024/turn khi không đặt env", () => {
    const cfg = getAIConfig({ env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "k" } as unknown as NodeJS.ProcessEnv });
    expect(cfg.maxTokens).toBe(1024);
    const overridden = getAIConfig({ env: { AI_PROVIDER: "openai", OPENAI_API_KEY: "k", AI_MAX_TOKENS: "2048" } as unknown as NodeJS.ProcessEnv });
    expect(overridden.maxTokens).toBe(2048);
  });
});

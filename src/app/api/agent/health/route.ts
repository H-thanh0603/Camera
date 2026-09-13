/**
 * GET /api/agent/health — trạng thái trợ lý AI cho uptime-monitor/ops.
 *
 * Không gọi LLM (không tốn token): báo cấu hình provider, chain fallback và
 * ngân sách tháng. `status: "unconfigured"` là trạng thái deployed-but-off,
 * khác với lỗi hệ thống — monitor chỉ cần quan tâm HTTP 200 + status field.
 */

import { NextResponse } from "next/server";
import { getAIConfig, buildProviderChain } from "@/lib/ai";
import { getBudgetUsage } from "@/lib/ai/budget";
import { isRedisConfigured } from "@/lib/server/rate-limit-redis";

export const runtime = "nodejs";

export async function GET() {
  const config = getAIConfig();
  const providers = config.enabled ? buildProviderChain(config) : [];
  const budget = config.monthlyTokenCap > 0 ? await getBudgetUsage(config.monthlyTokenCap) : null;

  return NextResponse.json(
    {
      status: !config.enabled ? "unconfigured" : providers.length === 0 ? "no_provider" : budget?.blocked ? "budget_exhausted" : "ok",
      provider: config.enabled ? config.provider : null,
      model: config.enabled ? config.model : null,
      fallbackCount: Math.max(0, providers.length - 1),
      maxIterations: config.maxIterations,
      monthlyTokenCap: config.monthlyTokenCap || null,
      tokensUsedThisMonth: budget?.used ?? null,
      tokenCapPercent: budget?.usedPercent ?? null,
      redisConfigured: isRedisConfigured(),
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

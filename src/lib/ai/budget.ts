/**
 * Token budget — đếm token tiêu thụ bởi agent theo tháng, kèm ngưỡng cut-off
 * (AI_MONTHLY_TOKEN_CAP) để bot quét web không đốt hết credit trong một đêm.
 *
 * Storage: Upstash Redis khi có cấu hình (chuẩn hoá multi-instance), fallback
 * in-memory một process (fail-open — mất đếm khi restart, chấp nhận được vì
 * rate-limit/turn-cap đã chặn phần lớn rủi ro).
 */

import { getRedisClient } from "@/lib/edge-rate-limit";
import { logger } from "@/lib/server/logger";

interface BudgetWindow {
  tokens: number;
}

const RESET_MS = 86_400_000; // ghi lại để quan sát nếu cần debug

function monthKey(date = new Date()): string {
  return `lumina:ai-budget:${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Fallback in-memory: { "2026-09": { tokens: 12345 } } */
const memory = new Map<string, BudgetWindow>();
let usedFallback = false;

function warnFallbackOnce(reason: string) {
  if (usedFallback) return;
  usedFallback = true;
  logger.warn("ai_budget.memory_fallback", { reason });
}

export interface BudgetCheck {
  /** Cap đã đặt hay chưa (chưa đặt = không cắt). */
  capped: boolean;
  /** Tổng token tháng hiện tại đã dùng. */
  used: number;
  /** Vượt cap → chặn yêu cầu mới. */
  blocked: boolean;
  /** Đã dùng bao nhiêu phần trăm cap (log/alert). */
  usedPercent: number;
}

/** Đọc tổng token tháng (không tăng). */
export async function getBudgetUsage(cap: number): Promise<BudgetCheck> {
  const capped = cap > 0;
  let used = 0;
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(monthKey());
      used = typeof raw === "number" ? raw : Number(raw ?? 0) || 0;
    } catch (err) {
      warnFallbackOnce(`redis_error: ${String(err)}`);
      used = memory.get(monthKey())?.tokens ?? 0;
    }
  } else {
    warnFallbackOnce("no_redis_configured");
    used = memory.get(monthKey())?.tokens ?? 0;
  }
  return {
    capped,
    used,
    blocked: capped && used >= cap,
    usedPercent: capped ? Math.round((used / cap) * 100) : 0,
  };
}

/**
 * Cộng dồn token sau một request hoàn tất (fail-safe: lỗi storage không phá
 * request). Trả về tổng mới để log.
 */
export async function addBudgetUsage(delta: number): Promise<number> {
  if (delta <= 0) return 0;
  const key = monthKey();
  const redis = getRedisClient();
  if (redis) {
    try {
      // TTL 40 ngày: key tháng cũ tự dọn, không rò rỉ vĩnh viễn.
      const total = await redis.incrby(key, Math.round(delta));
      if (total === Math.round(delta)) await redis.expire(key, 40 * RESET_MS / 1000);
      return total;
    } catch (err) {
      warnFallbackOnce(`redis_error: ${String(err)}`);
    }
  }
  const cur = memory.get(key) ?? { tokens: 0 };
  cur.tokens += Math.round(delta);
  memory.set(key, cur);
  return cur.tokens;
}

/** Reset state module (test). */
export function __resetBudget(): void {
  memory.clear();
  usedFallback = false;
}

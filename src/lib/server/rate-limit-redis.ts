import { NextResponse } from "next/server";
import { getEdgeRateLimiter, getRedisClient, type AsyncRateLimiter } from "@/lib/edge-rate-limit";
import type { RateLimitOptions } from "@/lib/utils/rate-limit";
import { logger } from "./logger";

/**
 * Rate limit cho route handler (Node runtime): Upstash Redis sliding-window
 * khi có cấu hình, fallback in-memory + warn khi chưa cấu hình / Redis lỗi.
 * Middleware (Edge) dùng getEdgeRateLimiter trực tiếp.
 */

export type { AsyncRateLimiter };

export function getRequestLimiter(options: RateLimitOptions): AsyncRateLimiter {
  return getEdgeRateLimiter(options, (reason) => {
    // Production mà rớt xuống memory là sự cố bảo mật (bypass đa instance) —
    // log error để alerting bắt, không chỉ warn.
    if (process.env.NODE_ENV === "production") logger.error(reason, {});
    else logger.warn(reason, {});
  });
}

/** true khi Redis được cấu hình — dùng cho /api/health báo cáo. */
export function isRedisConfigured(): boolean {
  return getRedisClient() !== null;
}

/**
 * Limiter chung cho admin mutations (30/phút/IP): session admin bị đánh cắp
 * hoặc tab độc hại không thể farm R2/kho/coupon không giới hạn. Route import
 * (CSV) và stock dùng budget riêng chặt hơn qua tham số.
 */
const adminLimiter = getRequestLimiter({ windowMs: 60_000, max: 30 });
const adminImportLimiter = getRequestLimiter({ windowMs: 60_000, max: 5 });

/**
 * Gate chuẩn cho admin mutation: fail-closed prod + 429 khi quá nhịp.
 * Trả NextResponse khi phải chặn, ngược lại null (route đi tiếp).
 */
export async function adminRateLimit(
  request: { headers: Headers },
  key = "admin",
  strict = false,
): Promise<NextResponse | null> {
  const { getClientIp } = await import("./client-ip");
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const limiter = strict ? adminImportLimiter : adminLimiter;
  const limit = await limiter.check(`admin:${key}:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều thao tác quản trị. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  return null;
}

/**
 * Gate fail-closed cho route nhạy cảm (login, agent chat, upload) ở production:
 * thiếu Redis nghĩa là rate-limit/budget chỉ đếm trên memory từng instance —
 * attacker xoay IP hoặc traffic phân tán là bypass. Thiếu Redis → 503 thay vì
 * fail-open. Non-production trả null (cho phép chạy dev không Redis).
 * Trả về NextResponse 503 khi phải chặn, ngược lại null.
 */
export async function redisRequiredResponse(): Promise<NextResponse | null> {
  if (process.env.NODE_ENV !== "production") return null;
  if (isRedisConfigured()) return null;
  logger.error("ratelimit.redis_required_blocked", {});
  return NextResponse.json(
    { error: "Dịch vụ tạm bảo trì (thiếu rate-limit tập trung). Vui lòng thử lại sau." },
    { status: 503 },
  );
}

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

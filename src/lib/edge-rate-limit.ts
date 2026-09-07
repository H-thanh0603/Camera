import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import {
  createRateLimiter,
  type RateLimitOptions,
  type RateLimitResult,
} from "@/lib/utils/rate-limit";

/**
 * Rate limit dùng được ở Edge middleware (không import node-only deps).
 * Upstash Redis sliding-window khi có cấu hình, fallback in-memory
 * (fail-open) khi chưa cấu hình hoặc Redis lỗi.
 */

export interface AsyncRateLimiter {
  check: (key: string) => Promise<RateLimitResult>;
}

let redisClient: Redis | null | undefined;
let warned = false;

export function getRedisClient(): Redis | null {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  redisClient = url && token ? new Redis({ url, token }) : null;
  return redisClient;
}

/** Reset cache module (test). */
export function __resetRateLimitCache(): void {
  redisClient = undefined;
  warned = false;
}

export function getEdgeRateLimiter(
  options: RateLimitOptions,
  onFallback?: (reason: string) => void,
): AsyncRateLimiter {
  const fallback = createRateLimiter(options);
  const redis = getRedisClient();
  if (!redis) {
    if (!warned) {
      warned = true;
      onFallback?.("ratelimit.memory_fallback");
    }
    return { check: async (key) => fallback.check(key) };
  }
  const windowSeconds = Math.max(1, Math.round(options.windowMs / 1000));
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(options.max, `${windowSeconds} s`),
    prefix: "lumina:ratelimit",
  });
  return {
    check: async (key) => {
      try {
        const res = await limiter.limit(key);
        return {
          allowed: res.success,
          remaining: res.remaining,
          retryAfterSeconds: Math.max(1, Math.ceil(res.reset / 1000 - Date.now() / 1000)),
        };
      } catch (error) {
        if (!warned) {
          warned = true;
          onFallback?.(`ratelimit.redis_error_fallback: ${String(error)}`);
        }
        return fallback.check(key);
      }
    },
  };
}

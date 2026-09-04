/**
 * Rate limiter — fixed window, thuần hàm để unit test.
 * LƯU Ý SẢN XUẤT: bản in-memory này chỉ hợp cho 1 instance server (demo/dev).
 * Khi deploy đa instance, thay store bằng Redis/Upstash — giữ nguyên interface.
 */

export interface RateLimitOptions {
  /** Độ dài cửa sổ (ms). */
  windowMs: number;
  /** Số request tối đa trong 1 cửa sổ. */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Giây cần chờ trước khi thử lại (chỉ có ý nghĩa khi bị chặn). */
  retryAfterSeconds: number;
}

export interface RateLimiter {
  check: (key: string, now?: number) => RateLimitResult;
  /** Xóa toàn bộ state (dùng trong test hoặc khi cần reset thủ công). */
  reset: () => void;
}

export function createRateLimiter(options: RateLimitOptions): RateLimiter {
  const { windowMs, max } = options;
  const hits = new Map<string, { windowStart: number; count: number }>();

  return {
    check(key, now = Date.now()) {
      const entry = hits.get(key);

      if (!entry || now - entry.windowStart >= windowMs) {
        hits.set(key, { windowStart: now, count: 1 });
        return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
      }

      if (entry.count < max) {
        entry.count += 1;
        return { allowed: true, remaining: max - entry.count, retryAfterSeconds: 0 };
      }

      const retryAfterSeconds = Math.max(1, Math.ceil((entry.windowStart + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfterSeconds };
    },
    reset() {
      hits.clear();
    },
  };
}

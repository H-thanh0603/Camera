import { getRedisClient } from "@/lib/edge-rate-limit";

/**
 * Khóa brute-force theo TÀI KHOẢN (bổ sung cho rate-limit theo IP).
 * Rate-limit IP bị bypass khi attacker xoay IP; lockout per-email chặn
 * credential stuffing nhắm vào 1 tài khoản (đặc biệt admin).
 *
 * Quy tắc: 10 lần sai / 15 phút / email → khóa 15 phút.
 * Storage Redis (đúng đa instance). Production thiếu Redis đã bị chặn ở
 * route (redisRequiredResponse) nên ở đây fallback memory là an toàn.
 */

const MAX_FAILS = 10;
const WINDOW_S = 15 * 60;

const memory = new Map<string, { count: number; resetAt: number }>();

function key(email: string): string {
  return `lumina:loginfail:${email.trim().toLowerCase().slice(0, 160)}`;
}

export async function isAccountLocked(email: string): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  const k = key(email);
  const redis = getRedisClient();
  if (redis) {
    try {
      const raw = await redis.get(k);
      const count = typeof raw === "number" ? raw : Number(raw ?? 0) || 0;
      if (count >= MAX_FAILS) {
        const ttl = await redis.ttl(k);
        return { locked: true, retryAfterSeconds: ttl > 0 ? ttl : WINDOW_S };
      }
      return { locked: false, retryAfterSeconds: 0 };
    } catch {
      // rớt xuống memory
    }
  }
  const entry = memory.get(k);
  if (entry && entry.resetAt > Date.now() && entry.count >= MAX_FAILS) {
    return { locked: true, retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - Date.now()) / 1000)) };
  }
  if (entry && entry.resetAt <= Date.now()) memory.delete(k);
  return { locked: false, retryAfterSeconds: 0 };
}

export async function recordLoginFail(email: string): Promise<void> {
  const k = key(email);
  const redis = getRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, WINDOW_S);
      return;
    } catch {
      // rớt xuống memory
    }
  }
  const now = Date.now();
  const entry = memory.get(k);
  if (!entry || entry.resetAt <= now) {
    memory.set(k, { count: 1, resetAt: now + WINDOW_S * 1000 });
  } else {
    entry.count += 1;
  }
}

export async function clearLoginFails(email: string): Promise<void> {
  const k = key(email);
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(k);
    } catch {
      // bỏ qua
    }
  }
  memory.delete(k);
}

/** Reset state module (test). */
export function __resetLoginAttempts(): void {
  memory.clear();
}

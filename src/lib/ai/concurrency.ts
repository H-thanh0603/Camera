/**
 * Concurrency gate — giới hạn số stream /api/agent/chat đang mở đồng thời.
 *
 * Rate-limit đếm tần suất POST nhưng một IP vẫn có thể mở nhiều stream song
 * song trong cùng cửa sổ 60s; mỗi stream giữ 1 connection + LLM call tới
 * 120s. Module này đếm active theo IP (Redis INCR/DECR khi có cấu hình để
 * đúng đa instance, fallback in-memory), chặn vượt AI_MAX_CONCURRENT_STREAMS.
 */

import { getRedisClient } from "@/lib/edge-rate-limit";
import { logger } from "@/lib/server/logger";

const KEY_PREFIX = "lumina:agent-streams";
const IP_KEY_MAX = 60; // IP đã hash/đóng khung ở caller

const memory = new Map<string, number>();
let warned = false;

function warnOnce(reason: string) {
  if (warned) return;
  warned = true;
  logger.warn("agent_streams.memory_fallback", { reason });
}

function ipKey(ip: string): string {
  return `${KEY_PREFIX}:${ip.slice(0, IP_KEY_MAX)}`;
}

export interface ConcurrencyCheck {
  allowed: boolean;
  active: number;
}

/** Kiểm tra + giữ chỗ trước khi mở stream. Trả về handle để giải phóng (release). */
export async function acquireStream(ip: string, max: number): Promise<ConcurrencyCheck & { release: () => Promise<void> }> {
  const key = ipKey(ip);
  const redis = getRedisClient();
  let active: number;
  if (redis) {
    try {
      active = await redis.incr(key);
      if (active === 1) await redis.expire(key, 180); // TTL 3 phút tự dọn nếu process chết giữa chừng
    } catch (err) {
      warnOnce(`redis_error: ${String(err)}`);
      active = (memory.get(key) ?? 0) + 1;
      memory.set(key, active);
    }
  } else {
    warnOnce("no_redis_configured");
    active = (memory.get(key) ?? 0) + 1;
    memory.set(key, active);
  }

  let released = false;
  const release = async () => {
    if (released) return; // idempotent: cancel() và close() có thể cùng chạy
    released = true;
    if (redis) {
      try {
        const left = await redis.decr(key);
        if (left <= 0) await redis.del(key);
        return;
      } catch (err) {
        warnOnce(`redis_error: ${String(err)}`);
      }
    }
    const left = (memory.get(key) ?? 1) - 1;
    if (left <= 0) memory.delete(key);
    else memory.set(key, left);
  };

  if (active > max) {
    await release(); // không giữ chỗ khi bị từ chối
    return { allowed: false, active: active - 1, release };
  }
  return { allowed: true, active, release };
}

/** Reset state module (test). */
export function __resetStreams(): void {
  memory.clear();
  warned = false;
}

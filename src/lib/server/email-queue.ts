import { getRedisClient } from "@/lib/edge-rate-limit";
import { logger } from "./logger";
import { sendEmail, type SendEmailInput } from "./email";

/**
 * Phase 2.4 — Email queue trên Upstash Redis (REST, serverless-friendly).
 * Không dùng BullMQ (cần TCP persistent, Upstash REST không hỗ trợ).
 *
 * Cấu trúc:
 * - `lumina:queue:email:pending` (list) — job sẵn sàng gửi
 * - `lumina:queue:email:delayed` (zset score=runAt) — retry backoff
 * - `lumina:queue:email:dead` (list) — quá max attempts, xem tay
 *
 * Chưa cấu hình Redis → enqueue trả {queued:false}, caller fallback
 * gửi inline (hành vi cũ). Enqueue không bao giờ throw.
 */

export const EMAIL_MAX_ATTEMPTS = 3;
export const EMAIL_BACKOFF_BASE_MS = 5000;

export interface EmailJob extends SendEmailInput {
  id: string;
  kind: string;
  attempts: number;
  createdAt: string;
}

const PENDING = "lumina:queue:email:pending";
const DELAYED = "lumina:queue:email:delayed";
const DEAD = "lumina:queue:email:dead";

/** Interface Redis tối thiểu — prod dùng @upstash/redis, test dùng fake. */
export interface QueueRedis {
  lpush(key: string, value: string): Promise<unknown>;
  rpop(key: string): Promise<string | null>;
  zadd(key: string, score: number, member: string): Promise<unknown>;
  zrangebyscore(key: string, min: number, max: number): Promise<string[]>;
  zrem(key: string, member: string): Promise<unknown>;
  llen(key: string): Promise<number>;
  zcard(key: string): Promise<number>;
}

export function backoffDelayMs(attempt: number): number {
  return EMAIL_BACKOFF_BASE_MS * 2 ** Math.max(0, attempt - 1);
}

export async function enqueueEmail(
  redis: QueueRedis | null | undefined,
  job: Omit<EmailJob, "id" | "attempts" | "createdAt">,
): Promise<{ queued: boolean; id?: string }> {
  if (!redis) return { queued: false };
  const full: EmailJob = {
    ...job,
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
    attempts: 0,
    createdAt: new Date().toISOString(),
  };
  try {
    await redis.lpush(PENDING, JSON.stringify(full));
    return { queued: true, id: full.id };
  } catch (error) {
    logger.error("email.enqueue_failed", { error: String(error) });
    return { queued: false };
  }
}

export interface QueueDepths {
  pending: number;
  delayed: number;
  dead: number;
}

export async function emailQueueDepths(redis: QueueRedis | null | undefined): Promise<QueueDepths> {
  if (!redis) return { pending: 0, delayed: 0, dead: 0 };
  const [pending, delayed, dead] = await Promise.all([
    redis.llen(PENDING),
    redis.zcard(DELAYED),
    redis.llen(DEAD),
  ]);
  return { pending, delayed, dead };
}

/**
 * Xử lý 1 job: gửi mail, fail → re-queue delayed backoff, hết lượt → dead.
 * Trả "sent" | "retry" | "dead" | "empty". Không throw.
 */
export async function processOneEmailJob(
  redis: QueueRedis,
  send: (input: SendEmailInput) => Promise<{ sent: boolean }> = sendEmail,
  now: number = Date.now(),
): Promise<"sent" | "retry" | "dead" | "empty"> {
  // Đưa delayed đã tới hạn về pending
  try {
    const due = await redis.zrangebyscore(DELAYED, 0, now);
    for (const member of due) {
      await redis.zrem(DELAYED, member);
      await redis.lpush(PENDING, member);
    }
  } catch (error) {
    logger.error("email.delayed_promote_failed", { error: String(error) });
    return "empty";
  }
  let raw: string | null;
  try {
    raw = await redis.rpop(PENDING);
  } catch (error) {
    logger.error("email.pop_failed", { error: String(error) });
    return "empty";
  }
  if (!raw) return "empty";
  let job: EmailJob;
  try {
    job = JSON.parse(raw) as EmailJob;
    if (!job.to || !job.subject) throw new Error("job thiếu trường");
  } catch {
    logger.error("email.job_malformed", {});
    return "empty";
  }
  let sent = false;
  try {
    sent = (await send({ to: job.to, subject: job.subject, html: job.html })).sent;
  } catch (error) {
    logger.error("email.job_error", { jobId: job.id, error: String(error) });
  }
  if (sent) return "sent";
  const attempts = job.attempts + 1;
  if (attempts >= EMAIL_MAX_ATTEMPTS) {
    try {
      await redis.lpush(DEAD, JSON.stringify({ ...job, attempts }));
    } catch (error) {
      logger.error("email.dead_failed", { jobId: job.id, error: String(error) });
    }
    logger.error("email.job_dead", { jobId: job.id, kind: job.kind });
    return "dead";
  }
  try {
    await redis.zadd(DELAYED, now + backoffDelayMs(attempts), JSON.stringify({ ...job, attempts }));
  } catch (error) {
    logger.error("email.retry_failed", { jobId: job.id, error: String(error) });
  }
  return "retry";
}

/** Redis prod (null khi chưa cấu hình UPSTASH_*) — adapt sang QueueRedis. */
export function getQueueRedis(): QueueRedis | null {
  const redis = getRedisClient();
  if (!redis) return null;
  return {
    lpush: (key, value) => redis.lpush(key, value),
    rpop: async (key) => (await redis.rpop<string>(key)) ?? null,
    zadd: (key, score, member) => redis.zadd(key, { score, member }),
    zrangebyscore: (key, min, max) => redis.zrange<string[]>(key, min, max, { byScore: true }),
    zrem: (key, member) => redis.zrem(key, member),
    llen: (key) => redis.llen(key),
    zcard: (key) => redis.zcard(key),
  };
}

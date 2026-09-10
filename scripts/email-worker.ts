/**
 * Email worker — tiến trình nền chạy bằng tsx:
 *   npx tsx scripts/email-worker.ts
 * Prod: chạy như service riêng (systemd/docker/VPS) hoặc cron mỗi phút
 * với EMAIL_WORKER_MAX_JOBS (chế độ batch, thoát sau N job).
 * Không có UPSTASH_* → thoát 0 (không crash deploy thiếu Redis).
 */
import { emailQueueDepths, getQueueRedis, processOneEmailJob } from "../src/lib/server/email-queue";
import { dispatchDueOutbox, outboxDepths } from "../src/lib/server/email-outbox";

const POLL_MS = Number(process.env.EMAIL_WORKER_POLL_MS ?? 2000);
const MAX_JOBS = process.env.EMAIL_WORKER_MAX_JOBS ? Number(process.env.EMAIL_WORKER_MAX_JOBS) : Infinity;
const IDLE_EXIT_MS = process.env.EMAIL_WORKER_IDLE_EXIT_MS ? Number(process.env.EMAIL_WORKER_IDLE_EXIT_MS) : null;

async function main(): Promise<void> {
  const redis = getQueueRedis();
  let done = 0;
  let idleSince: number | null = null;
  let stopped = false;
  process.on("SIGTERM", () => { stopped = true; });
  process.on("SIGINT", () => { stopped = true; });
  console.log(`email-worker: started (redis: ${redis ? "upstash" : "none — chỉ quét DB outbox"})`);
  while (!stopped && done < MAX_JOBS) {
    // 1. Outbox DB trước (bền vững, luôn có) — claim có điều kiện nên
    // worker song song không gửi trùng.
    let progressed = false;
    try {
      const out = await dispatchDueOutbox(20);
      if (out.dispatched > 0) {
        done += out.dispatched;
        progressed = true;
        console.log(`email-worker: outbox sent=${out.sent} retry=${out.retry} dead=${out.dead}`, await outboxDepths());
      }
    } catch (e) {
      console.error("email-worker: outbox lỗi", e);
    }
    // 2. Redis fast-lane (nếu có cấu hình)
    if (redis) {
      const res = await processOneEmailJob(redis);
      if (res !== "empty") {
        progressed = true;
        done++;
        if (done % 10 === 0) console.log(`email-worker: ${done} jobs`, await emailQueueDepths(redis));
      }
    }
    if (!progressed) {
      if (IDLE_EXIT_MS != null) {
        if (idleSince == null) idleSince = Date.now();
        if (Date.now() - idleSince >= IDLE_EXIT_MS) break;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    idleSince = null;
  }
  console.log(`email-worker: stopped after ${done} jobs`);
  process.exit(0);
}

main().catch((e) => {
  console.error("email-worker: fatal", e);
  process.exit(1);
});

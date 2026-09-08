/**
 * Email worker — tiến trình nền chạy bằng tsx:
 *   npx tsx scripts/email-worker.ts
 * Prod: chạy như service riêng (systemd/docker/VPS) hoặc cron mỗi phút
 * với EMAIL_WORKER_MAX_JOBS (chế độ batch, thoát sau N job).
 * Không có UPSTASH_* → thoát 0 (không crash deploy thiếu Redis).
 */
import { emailQueueDepths, getQueueRedis, processOneEmailJob } from "../src/lib/server/email-queue";

const POLL_MS = Number(process.env.EMAIL_WORKER_POLL_MS ?? 2000);
const MAX_JOBS = process.env.EMAIL_WORKER_MAX_JOBS ? Number(process.env.EMAIL_WORKER_MAX_JOBS) : Infinity;
const IDLE_EXIT_MS = process.env.EMAIL_WORKER_IDLE_EXIT_MS ? Number(process.env.EMAIL_WORKER_IDLE_EXIT_MS) : null;

async function main(): Promise<void> {
  const redis = getQueueRedis();
  if (!redis) {
    console.log("email-worker: Redis chưa cấu hình, thoát (không gửi queue).");
    process.exit(0);
  }
  let done = 0;
  let idleSince: number | null = null;
  let stopped = false;
  process.on("SIGTERM", () => { stopped = true; });
  process.on("SIGINT", () => { stopped = true; });
  console.log("email-worker: started");
  while (!stopped && done < MAX_JOBS) {
    const res = await processOneEmailJob(redis);
    if (res === "empty") {
      if (IDLE_EXIT_MS != null) {
        if (idleSince == null) idleSince = Date.now();
        if (Date.now() - idleSince >= IDLE_EXIT_MS) break;
      }
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }
    idleSince = null;
    done++;
    if (done % 10 === 0) console.log(`email-worker: ${done} jobs`, await emailQueueDepths(redis));
  }
  console.log(`email-worker: stopped after ${done} jobs`);
  process.exit(0);
}

main().catch((e) => {
  console.error("email-worker: fatal", e);
  process.exit(1);
});

import { createHash } from "node:crypto";
import { prisma } from "./prisma";

/**
 * Cron lock chống chạy trùng worker (2 container / cron overlap / chạy tay
 * cùng lúc). Dùng pg_advisory_lock trên Postgres; SQLite dev (không có hàm
 * này) thì bỏ qua lock — dev không chạy song song.
 *
 * Dùng:
 *   const release = await acquireCronLock("email-worker");
 *   if (!release) { console.log("skip: locked"); process.exit(0); }
 *   try { ... } finally { await release(); }
 */
export function lockKey(name: string): bigint {
  const digest = createHash("sha256").update(`lumina:cron:${name}`, "utf8").digest();
  return digest.readBigInt64BE(0);
}

export async function acquireCronLock(name: string): Promise<(() => Promise<void>) | null> {
  const url = process.env.DATABASE_URL ?? "";
  if (!/^postgres(ql)?:/.test(url)) return async () => undefined; // SQLite dev: không lock
  try {
    const rows = (await prisma.$queryRaw`SELECT pg_try_advisory_lock(${lockKey(name)}) AS locked`) as {
      locked: boolean;
    }[];
    if (!rows[0]?.locked) return null;
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      try {
        await prisma.$queryRaw`SELECT pg_advisory_unlock(${lockKey(name)})`;
      } catch {
        // bỏ qua — lock tự nhả khi session đóng
      }
    };
  } catch {
    return null; // DB lạ/không hỗ trợ → cho chạy (fail-open ở worker ít rủi ro hơn crash)
  }
}

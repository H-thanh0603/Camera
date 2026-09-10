import { prisma } from "./prisma";
import { logger } from "./logger";
import { hashId } from "./scrub";
import { sendEmail, type SendEmailInput } from "./email";

/**
 * Email outbox bền vững (DB) — chống mất mail khi thiếu Redis / Resend lỗi.
 * Quy ước: caller ghi outbox TRONG tx nghiệp vụ (atomic với đặt hàng,
 * reset password…), rồi dispatch best-effort (fire-and-forget, không chặn
 * response). Worker (`scripts/email-worker.ts`) quét job tới hạn định kỳ.
 */

export const OUTBOX_MAX_ATTEMPTS = 5;

export interface OutboxInput extends SendEmailInput {
  kind: string;
}

/** Writer tối thiểu — cả PrismaClient lẫn tx interactive đều thỏa. */
interface OutboxWriter {
  emailOutbox: {
    create(args: { data: { kind: string; to: string; subject: string; html: string } }): Promise<{ id: string }>;
  };
}

export function outboxBackoffMs(attempt: number): number {
  return Math.min(60_000 * 2 ** Math.max(0, attempt), 6 * 3600_000);
}

/** Ghi job mail — truyền tx khi đang trong transaction nghiệp vụ. */
export async function saveOutboxEmail(input: OutboxInput, db: OutboxWriter = prisma): Promise<string> {
  const row = await db.emailOutbox.create({
    data: { kind: input.kind, to: input.to, subject: input.subject, html: input.html },
  });
  return row.id;
}

export interface OutboxDispatchResult {
  dispatched: number;
  sent: number;
  retry: number;
  dead: number;
}

/**
 * Dispatch job tới hạn (claim có điều kiện → worker song song không gửi trùng).
 * Không throw — lỗi ghi log, job ở lại outbox để lần quét sau xử lý.
 */
export async function dispatchDueOutbox(
  limit = 20,
  send: (input: SendEmailInput) => Promise<{ sent: boolean }> = sendEmail,
): Promise<OutboxDispatchResult> {
  const res: OutboxDispatchResult = { dispatched: 0, sent: 0, retry: 0, dead: 0 };
  const now = new Date();
  const due = await prisma.emailOutbox.findMany({
    where: { sentAt: null, nextRunAt: { lte: now }, attempts: { lt: OUTBOX_MAX_ATTEMPTS } },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });
  for (const job of due) {
    // Claim: chỉ bên đầu tiên đổi được nextRunAt mới thắng.
    const claimAt = new Date(now.getTime() + outboxBackoffMs(job.attempts));
    const claimed = await prisma.emailOutbox.updateMany({
      where: { id: job.id, sentAt: null, nextRunAt: job.nextRunAt },
      data: { nextRunAt: claimAt },
    });
    if (claimed.count === 0) continue; // thua race — bên khác đang gửi
    res.dispatched += 1;
    let sent = false;
    let error = "";
    try {
      sent = (await send({ to: job.to, subject: job.subject, html: job.html })).sent;
    } catch (e) {
      error = String(e).slice(0, 300);
    }
    if (sent) {
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: { sentAt: new Date(), lastError: null },
      });
      res.sent += 1;
      continue;
    }
    const attempts = job.attempts + 1;
    if (attempts >= OUTBOX_MAX_ATTEMPTS) {
      // Hết lượt nhưng GIỮ row (dead) để operator xem/tái gửi tay.
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: { attempts, lastError: error || "send failed" },
      });
      logger.error("email.outbox_dead", { jobId: job.id, kind: job.kind, toHash: hashId(job.to) });
      res.dead += 1;
    } else {
      await prisma.emailOutbox.update({
        where: { id: job.id },
        data: { attempts, nextRunAt: new Date(Date.now() + outboxBackoffMs(attempts)), lastError: error || "send failed" },
      });
      res.retry += 1;
    }
  }
  return res;
}

/**
 * Ghi outbox + dispatch best-effort (không await, không throw).
 * Dùng cho flow ngoài tx (reset password, reward, kit-share).
 */
export function queueOutboxEmail(mail: OutboxInput): void {
  void (async () => {
    const id = await saveOutboxEmail(mail);
    await dispatchOutboxSoon(id);
  })().catch((error) => logger.error("email.queue_failed", { error: String(error) }));
}

/** Dispatch đúng 1 job vừa tạo (inline best-effort sau commit). */
export async function dispatchOutboxSoon(id: string): Promise<void> {
  try {
    const job = await prisma.emailOutbox.findUnique({ where: { id } });
    if (!job || job.sentAt) return;
    await dispatchDueOutbox(1);
  } catch (error) {
    logger.error("email.outbox_soon_failed", { error: String(error) });
  }
}

export async function outboxDepths(): Promise<{ pending: number; dead: number }> {
  const [pending, dead] = await Promise.all([
    prisma.emailOutbox.count({ where: { sentAt: null, attempts: { lt: OUTBOX_MAX_ATTEMPTS } } }),
    prisma.emailOutbox.count({ where: { sentAt: null, attempts: { gte: OUTBOX_MAX_ATTEMPTS } } }),
  ]);
  return { pending, dead };
}

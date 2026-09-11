import { describe, expect, it } from "vitest";
import { OUTBOX_MAX_ATTEMPTS, dispatchDueOutbox, outboxDepths, saveOutboxEmail } from "@/lib/server/email-outbox";
import { prisma } from "@/lib/server/prisma";

async function cleanup() {
  await prisma.emailOutbox.deleteMany({ where: { to: { startsWith: "outbox-test-" } } });
}

describe("email outbox", () => {
  it("gửi thành công → đánh dấu sent", async () => {
    await cleanup();
    const id = await saveOutboxEmail({ kind: "test", to: "outbox-test-a@t.vn", subject: "s", html: "<p>x</p>" });
    // Đưa job về quá khứ để dispatchDueOutbox (lte: now) tìm thấy
    await prisma.emailOutbox.update({ where: { id }, data: { nextRunAt: new Date(0) } });
    const res = await dispatchDueOutbox(10, async () => ({ sent: true }));
    expect(res.sent).toBeGreaterThanOrEqual(1);
    const row = await prisma.emailOutbox.findUnique({ where: { id } });
    expect(row?.sentAt).not.toBeNull();
    await cleanup();
  });

  it("gửi fail → retry backoff, đủ 5 lần → dead nhưng giữ row", async () => {
    await cleanup();
    const id = await saveOutboxEmail({ kind: "test", to: "outbox-test-b@t.vn", subject: "s", html: "<p>x</p>" });
    for (let i = 0; i < OUTBOX_MAX_ATTEMPTS; i++) {
      // Đưa về quá khứ để mô phỏng tới hạn retry ngay (không chờ backoff thật)
      await prisma.emailOutbox.update({ where: { id }, data: { nextRunAt: new Date(0) } });
      await dispatchDueOutbox(10, async () => ({ sent: false }));
    }
    const row = await prisma.emailOutbox.findUnique({ where: { id } });
    expect(row?.sentAt).toBeNull();
    expect(row?.attempts).toBe(OUTBOX_MAX_ATTEMPTS);
    const depths = await outboxDepths();
    expect(depths.dead).toBeGreaterThanOrEqual(1);
    // Job dead không được dispatch nữa
    const res = await dispatchDueOutbox(10, async () => ({ sent: true }));
    expect((await prisma.emailOutbox.findUnique({ where: { id } }))?.sentAt).toBeNull();
    expect(res.dispatched).toBe(0);
    await cleanup();
  });
});

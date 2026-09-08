/**
 * Nhắc vệ sinh sensor định kỳ — chạy cron mỗi ngày:
 *   DATABASE_URL=... npx tsx scripts/sensor-reminder.ts
 * Đơn có body máy ảnh, trạng thái delivered/paid, trên 180 ngày,
 * chưa từng nhắc cho đơn đó (AuditLog sensor.reminder).
 * Không spam: mỗi đơn nhắc đúng 1 lần.
 */
import { prisma } from "../src/lib/server/prisma";
import { enqueueEmail, getQueueRedis } from "../src/lib/server/email-queue";
import { sendEmail } from "../src/lib/server/email";
import { logger } from "../src/lib/server/logger";

const REMIND_AFTER_DAYS = 180;

async function main(): Promise<void> {
  const cutoff = new Date(Date.now() - REMIND_AFTER_DAYS * 24 * 3600 * 1000);
  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["delivered", "paid"] },
      createdAt: { lt: cutoff },
    },
    include: { lines: { select: { productId: true, name: true } }, user: { select: { email: true, name: true } } },
    take: 200,
  });

  let reminded = 0;
  for (const order of orders) {
    // Xác minh category body qua catalogue (tránh đoán theo id)
    const { getProductById } = await import("../src/lib/repositories/product-repository");
    const boughtCamera = order.lines
      .map((l) => getProductById(l.productId))
      .find((p) => p?.category === "camera");
    if (!boughtCamera) continue;

    const already = await prisma.auditLog.findFirst({
      where: { action: "sensor.reminder", targetId: order.id },
    });
    if (already) continue;

    const contact = order.contact as unknown as { email?: string; fullName?: string };
    const to = order.user?.email ?? contact.email;
    if (!to) continue;
    const name = order.user?.name ?? contact.fullName ?? "bạn";

    const mail = {
      kind: "sensor-reminder",
      to,
      subject: "Đã 6 tháng — vệ sinh sensor miễn phí tại Lumina",
      html: `<div style="font-family:sans-serif;max-width:560px"><h2>Chào ${name},</h2><p>Chiếc ${boughtCamera.name} (đơn ${order.number}) của bạn đã đồng hành 6 tháng — đã đến lúc vệ sinh sensor và cân chỉnh collimator miễn phí.</p><p>Đặt lịch tại cửa hàng hoặc liên hệ concierge để gửi máy.</p></div>`,
    };
    const { queued } = await enqueueEmail(getQueueRedis(), mail);
    if (!queued) await sendEmail(mail);
    await prisma.auditLog.create({
      data: { userId: order.userId, action: "sensor.reminder", targetType: "Order", targetId: order.id, meta: { orderNumber: order.number } },
    });
    reminded++;
  }
  logger.info("sensor.reminder_run", { reminded });
  console.log(`sensor-reminder: ${reminded} mails`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

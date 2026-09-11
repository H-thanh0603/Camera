/**
 * Đối soát đơn kẹt `pending` quá lâu (webhook fail / mất mạng / khách bỏ dở).
 * Read-only mặc định: liệt kê đơn pending > STALE_MINUTES để operator xử lý.
 * --expire: chuyển đơn quá EXPIRE_MINUTES về `cancelled` + hoàn kho (dùng completeCancel).
 *
 * Dùng: npx tsx scripts/payment-reconcile.ts [--stale 30] [--expire] [--expire-minutes 120]
 * Cron gợi ý: mỗi 15 phút (xem scripts/backup.cron.example).
 */
import { prisma } from "../src/lib/server/prisma";

const args = process.argv.slice(2);
const val = (flag: string): string | undefined => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const STALE_MINUTES = Number(val("--stale")) || 30;
const EXPIRE_MINUTES = Number(val("--expire-minutes")) || 120;
const SHOULD_EXPIRE = args.includes("--expire");

async function main(): Promise<void> {
  const staleCutoff = new Date(Date.now() - STALE_MINUTES * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: "pending", createdAt: { lt: staleCutoff } },
    select: { id: true, number: true, createdAt: true, totalAmount: true, payment: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
   
  console.log(JSON.stringify({ event: "payment.reconcile_scan", staleMinutes: STALE_MINUTES, count: stale.length }));
  for (const o of stale) {
     
    console.log(
      JSON.stringify({
        event: "payment.stale_pending",
        number: o.number,
        ageMinutes: Math.round((Date.now() - o.createdAt.getTime()) / 60_000),
        total: o.totalAmount,
        payment: o.payment,
      }),
    );
  }

  if (SHOULD_EXPIRE) {
    const expireCutoff = new Date(Date.now() - EXPIRE_MINUTES * 60_000);
    const expired = stale.filter((o) => o.createdAt < expireCutoff);
    const { completeCancel } = await import("../src/lib/server/cancel-order");
    let cancelled = 0;
    for (const o of expired) {
      try {
        await completeCancel(o.id);
        cancelled += 1;
         
        console.log(JSON.stringify({ event: "payment.expired_cancelled", number: o.number }));
      } catch {
        // Đơn đã chuyển trạng thái (đã paid / đã cancel) → bỏ qua
      }
    }
     
    console.log(JSON.stringify({ event: "payment.reconcile_expire_done", cancelled }));
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
   
  console.error(JSON.stringify({ event: "payment.reconcile_failed", error: String(e) }));
  await prisma.$disconnect();
  process.exit(1);
});

/**
 * Kiểm tra PriceWatch — chạy cron mỗi giờ (thêm vào backup.cron.example):
 *   0 * * * * cd /srv/lumina && DATABASE_URL="$DATABASE_URL" npx tsx scripts/price-watch-check.ts
 *
 * Với mỗi watch active: nếu giá DB hiện tại ≤ targetPrice → gửi email qua
 * email outbox (bền vững, worker lo phần gửi), đánh dấu triggered để
 * không báo trùng.
 */
import { prisma } from "../src/lib/server/prisma";
import { saveOutboxEmail } from "../src/lib/server/email-outbox";
import { dbGetProductById } from "../src/lib/server/product-db";
import { acquireCronLock } from "../src/lib/server/cron-lock";
import { logger } from "../src/lib/server/logger";

function priceDropEmail(productName: string, currentPrice: number, startPrice: number, targetPrice: number): string {
  const vnd = (n: number) => n.toLocaleString("vi-VN");
  return `<div style="font-family:sans-serif;max-width:480px">
  <h2 style="color:#c9a227">Giá đã về ngưỡng bạn chờ 💛</h2>
  <p><strong>${productName}</strong> hiện <strong>${vnd(currentPrice)}₫</strong>
  (lúc bạn theo dõi: ${vnd(startPrice)}₫, ngưỡng của bạn: ${vnd(targetPrice)}₫).</p>
  <p><a href="/" style="background:#c9a227;color:#111;padding:10px 18px;border-radius:8px;text-decoration:none">Xem sản phẩm trên Lumina</a></p>
  <p style="color:#888;font-size:12px">Nhiệm vụ theo dõi đã hoàn tất và tự huỷ.</p>
</div>`;
}

async function main(): Promise<void> {
  const release = await acquireCronLock("price-watch-check");
  if (!release) {
    console.log("price-watch-check: skip (worker khác đang giữ lock)");
    process.exit(0);
  }
  try {
    const watches = await prisma.priceWatch.findMany({ where: { status: "active" }, take: 500 });
    let triggered = 0;
    for (const w of watches) {
      const product = await dbGetProductById(w.productId);
      if (!product || product.price > w.targetPrice) continue;
      // Claim TRƯỚC khi gửi mail: 2 worker/cron overlap thì chỉ 1 thắng
      // (count==0 → bỏ qua), không gửi mail trùng.
      const claimed = await prisma.priceWatch.updateMany({
        where: { id: w.id, status: "active" },
        data: { status: "triggered", triggeredAt: new Date() },
      });
      if (claimed.count === 0) continue;
      await saveOutboxEmail({
        kind: "price_watch",
        to: w.email,
        subject: `Giảm giá: ${product.name} về ${product.price.toLocaleString("vi-VN")}₫`,
        html: priceDropEmail(product.name, product.price, w.startPrice, w.targetPrice),
      });
      triggered++;
    }
    logger.info("price_watch.checked", { watched: watches.length, triggered });
  } finally {
    await release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    logger.error("price_watch.failed", { error: String(e) });
    process.exit(1);
  });

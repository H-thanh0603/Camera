import { prisma } from "./prisma";
import { CANCELLABLE_STATUSES } from "./order-status";
import { couponCodeOfTotals, releaseCouponUsage } from "./coupons";

/**
 * Hủy đơn — core dùng chung cho route (đã authorize) và test.
 * Claim có điều kiện trong transaction: N request song song hoặc đua với
 * admin-shipped thì chỉ 1 bên thắng (count==0 → CancelConflict),
 * không bao giờ hoàn kho 2 lần.
 */

export class CancelConflict extends Error {
  constructor(message = "Đơn hàng không còn ở trạng thái có thể hủy.") {
    super(message);
    this.name = "CancelConflict";
  }
}

export async function completeCancel(orderId: string): Promise<void> {
  let coupon: string | null = null;
  await prisma.$transaction(async (tx) => {
    // Claim TRƯỚC: thua → throw trong tx → rollback trắng, không hoàn kho.
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: { in: CANCELLABLE_STATUSES } },
      data: { status: "cancelled" },
    });
    if (claim.count === 0) throw new CancelConflict();
    const order = await tx.order.findUnique({ where: { id: orderId } });
    coupon = couponCodeOfTotals(order?.totals);
    const lines = await tx.orderLine.findMany({ where: { orderId } });
    for (const l of lines) {
      if (l.variantId) {
        await tx.productVariant.updateMany({
          where: { id: l.variantId },
          data: { stock: { increment: l.quantity } },
        });
      }
      await tx.product.updateMany({
        where: { id: l.productId },
        data: { stock: { increment: l.quantity } },
      });
    }
  });
  // Hoàn lượt coupon NGOÀI tx (không ảnh hưởng claim; floor 0 nên idempotent)
  if (coupon) await releaseCouponUsage(coupon);
}

import { prisma } from "./prisma";
import { CANCELLABLE_STATUSES } from "./order-status";
import { couponCodeOfTotals, releaseCouponUsage } from "./coupons";

/**
 * Hủy/hoàn đơn — core dùng chung cho route (đã authorize) và test.
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

/**
 * Claim + hoàn kho + ghi ledger, chuyển đơn về `toStatus` (cancelled/refunded).
 * Dùng chung cho customer-cancel và admin refund (VNPay) — bù đắp giống nhau:
 * tồn kho về, lượt coupon hoàn (floor 0), StockMovement có balanceAfter.
 */
export async function compensateOrder(
  orderId: string,
  toStatus: "cancelled" | "refunded",
  options: { fromStatuses?: string[]; reasonPrefix?: string; actorId?: string | null } = {},
): Promise<{ number: string }> {
  const fromStatuses = options.fromStatuses ?? CANCELLABLE_STATUSES;
  const reasonPrefix = options.reasonPrefix ?? "Hủy đơn";
  let coupon: string | null = null;
  let orderNumber = orderId;
  await prisma.$transaction(async (tx) => {
    // Claim TRƯỚC: thua → throw trong tx → rollback trắng, không hoàn kho.
    const claim = await tx.order.updateMany({
      where: { id: orderId, status: { in: fromStatuses } },
      data: { status: toStatus },
    });
    if (claim.count === 0) throw new CancelConflict();
    const order = await tx.order.findUnique({ where: { id: orderId } });
    orderNumber = order?.number ?? orderId;
    coupon = couponCodeOfTotals(order?.totals);
    const lines = await tx.orderLine.findMany({ where: { orderId } });
    const movements: {
      productId: string;
      variantId: string | null;
      type: string;
      quantity: number;
      balanceAfter: number | null;
      reason: string;
      refOrderId: string;
      createdBy: string | null;
    }[] = [];
    for (const l of lines) {
      if (l.variantId) {
        await tx.productVariant.updateMany({
          where: { id: l.variantId },
          data: { stock: { increment: l.quantity } },
        });
        const vari = await tx.productVariant.findUnique({ where: { id: l.variantId }, select: { stock: true } });
        movements.push({
          productId: l.productId,
          variantId: l.variantId,
          type: "in",
          quantity: l.quantity,
          balanceAfter: vari?.stock ?? null,
          reason: `${reasonPrefix} ${orderNumber}`,
          refOrderId: orderId,
          createdBy: options.actorId ?? null,
        });
      }
      await tx.product.updateMany({
        where: { id: l.productId },
        data: { stock: { increment: l.quantity } },
      });
      const prod = await tx.product.findUnique({ where: { id: l.productId }, select: { stock: true } });
      movements.push({
        productId: l.productId,
        variantId: null,
        type: "in",
        quantity: l.quantity,
        balanceAfter: prod?.stock ?? null,
        reason: `${reasonPrefix} ${orderNumber}`,
        refOrderId: orderId,
        createdBy: options.actorId ?? null,
      });
    }
    if (movements.length > 0) await tx.stockMovement.createMany({ data: movements });
  });
  // Hoàn lượt coupon NGOÀI tx (không ảnh hưởng claim; floor 0 nên idempotent)
  if (coupon) await releaseCouponUsage(coupon);
  return { number: orderNumber };
}

export async function completeCancel(orderId: string): Promise<void> {
  await compensateOrder(orderId, "cancelled");
}

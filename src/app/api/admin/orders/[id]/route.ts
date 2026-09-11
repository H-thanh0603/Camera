import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { staffGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { isCarrier, isTrackingCode } from "@/lib/server/shipping";
import type { OrderStatus } from "@/lib/types";

/**
 * PATCH /api/admin/orders/:id — đổi trạng thái đơn + nhập vận đơn.
 * currentStep đồng bộ theo status (timeline 7 bước).
 * Hủy/hoàn tiền từ trạng thái còn hàng → hoàn stock; chuyển ngược chiều bị chặn.
 * trackingCode/carrier cập nhật độc lập (gửi riêng không cần status).
 */

const VALID: OrderStatus[] = ["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"];

const STATUS_TO_STEP: Partial<Record<OrderStatus, string>> = {
  pending: "confirmed",
  paid: "confirmed",
  processing: "processing",
  shipped: "shipped",
  delivered: "delivered",
  cancelled: "confirmed",
  refunded: "confirmed",
};

/** Trạng thái chỉ được đi tiến — hoặc rẽ sang cancelled/refunded một lần. */
const FORWARD: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled", "refunded"],
  processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
};

/** Hủy/hoàn tiền chỉ hoàn stock một lần — từ trạng thái chưa hủy. */
const RESTOCKABLE: OrderStatus[] = ["pending", "paid", "processing"];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await staffGuardResponse();
  if (denied) return denied;

  const { id } = await params;
  let body: { status?: string; trackingCode?: string | null; carrier?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id }, include: { lines: true } });
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn." }, { status: 404 });

  // Vận đơn cập nhật độc lập với trạng thái (chuỗi rỗng = xóa).
  if (body.trackingCode !== undefined || body.carrier !== undefined) {
    const trackingCode = body.trackingCode == null || body.trackingCode === "" ? null : body.trackingCode.trim();
    const carrier = body.carrier ?? order.carrier ?? "manual";
    if (trackingCode !== null && !isTrackingCode(trackingCode)) {
      return NextResponse.json({ error: "Mã vận đơn 4–64 ký tự (chữ/số/gạch nối)." }, { status: 422 });
    }
    if (!isCarrier(carrier)) {
      return NextResponse.json({ error: "Đơn vị vận chuyển không hợp lệ." }, { status: 422 });
    }
    await prisma.order.update({ where: { id }, data: { trackingCode, carrier } });
    await logAudit(await getSessionUser(), "order.tracking", "order", id, {
      number: order.number,
      trackingCode,
      carrier,
    });
    if (body.status === undefined) {
      return NextResponse.json({ ok: true, trackingCode, carrier });
    }
  }

  const status = body.status as OrderStatus | undefined;
  if (!status || !VALID.includes(status)) {
    return NextResponse.json({ error: "Trạng thái không hợp lệ." }, { status: 422 });
  }

  const from = order.status as OrderStatus;
  if (from !== status && !(FORWARD[from] ?? []).includes(status)) {
    return NextResponse.json(
      { error: `Không thể chuyển từ "${from}" sang "${status}" — trạng thái chỉ được đi tiến hoặc hủy một lần.` },
      { status: 422 },
    );
  }
  if (from === status) {
    return NextResponse.json({ ok: true, status, currentStep: order.currentStep });
  }

  const restock = (status === "cancelled" || status === "refunded") && RESTOCKABLE.includes(from);
  const currentStep = STATUS_TO_STEP[status] ?? order.currentStep;

  await prisma.$transaction(async (tx) => {
    // Claim chuyển trạng thái: where giữ status cũ — 2 PATCH song song
    // chỉ 1 bên thắng, bên thua không hoàn stock lần hai.
    const claim = await tx.order.updateMany({
      where: { id, status: from },
      data: { status, currentStep },
    });
    if (claim.count === 0) {
      throw new Error("ORDER_CONCURRENT_UPDATE");
    }
    if (restock) {
      for (const l of order.lines) {
        if (l.variantId) {
          await tx.productVariant.update({ where: { id: l.variantId }, data: { stock: { increment: l.quantity } } });
          await tx.product.update({ where: { id: l.productId }, data: { stock: { increment: l.quantity } } });
        } else {
          await tx.product.update({ where: { id: l.productId }, data: { stock: { increment: l.quantity } } });
        }
      }
    }
  });

  await logAudit(await getSessionUser(), "order.status", "order", id, {
    from,
    to: status,
    restocked: restock,
  });
  // Hủy/hoàn tiền → hoàn lượt coupon đã dùng (floor 0, idempotent)
  if (restock) {
    const { couponCodeOfTotals, releaseCouponUsage } = await import("@/lib/server/coupons");
    const coupon = couponCodeOfTotals(order.totals);
    if (coupon) await releaseCouponUsage(coupon);
  }
  return NextResponse.json({ ok: true, status, currentStep });
}

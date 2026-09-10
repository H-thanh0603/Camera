import type { Order, OrderStatus } from "@/lib/types";
import { prisma } from "./prisma";
import { getSessionUser } from "./session";

/**
 * Mapping dòng DB → domain Order. Contact/shipping/totals lưu Json —
 * shape khớp types.ts để UI không cần chuyển đổi.
 */

type OrderRow = {
  id: string;
  number: string;
  createdAt: Date;
  status: string;
  currentStep: string;
  contact: unknown;
  shipping: unknown;
  delivery: string;
  payment: string;
  totals: unknown;
  trackingCode: string | null;
  carrier: string | null;
  lines: {
    productId: string;
    variantId: string | null;
    name: string;
    variantName: string | null;
    unitPrice: number;
    quantity: number;
    image: string;
  }[];
};

export function dbOrderToDomain(order: OrderRow): Order {
  return {
    id: order.id,
    number: order.number,
    createdAt: order.createdAt.toISOString(),
    status: order.status as OrderStatus,
    currentStep: order.currentStep as Order["currentStep"],
    contact: order.contact as Order["contact"],
    shipping: order.shipping as Order["shipping"],
    delivery: order.delivery as Order["delivery"],
    payment: order.payment as Order["payment"],
    totals: order.totals as Order["totals"],
    ...(order.trackingCode ? { trackingCode: order.trackingCode } : {}),
    ...(order.carrier ? { carrier: order.carrier as Order["carrier"] } : {}),
    lines: order.lines.map((l) => ({
      productId: l.productId,
      variantId: l.variantId ?? undefined,
      name: l.name,
      variantName: l.variantName ?? undefined,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      image: l.image,
    })),
  };
}

const ORDER_INCLUDE = { lines: true } as const;

export async function getUserOrders(userId: string): Promise<Order[]> {
  const orders = await prisma.order.findMany({
    where: { userId },
    include: ORDER_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
  return orders.map(dbOrderToDomain);
}

export class OrderForbidden extends Error {
  constructor(message = "Bạn không có quyền xem đơn hàng này.") {
    super(message);
    this.name = "OrderForbidden";
  }
}

export async function getOwnOrder(id: string, guestToken?: string): Promise<Order | null> {
  const user = await getSessionUser();
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order) return null;
  // Đơn có chủ: phải đúng chủ sở hữu (session). Kể cả admin cũng đi đường admin API.
  if (order.userId) {
    if (order.userId !== user?.id) throw new OrderForbidden();
    return dbOrderToDomain(order);
  }
  // Đơn khách vãng lai: bắt buộc token khớp hash trong DB.
  const { verifyGuestToken } = await import("./guest-token");
  const row = order as unknown as { guestTokenHash?: string | null };
  // Đơn guest cũ (trước migration guestToken) chưa có hash → khóa thao tác
  // cho tới khi chủ đơn liên hệ concierge xác minh (fail-closed).
  if (!row.guestTokenHash || !verifyGuestToken(guestToken ?? "", row.guestTokenHash)) {
    throw new OrderForbidden();
  }
  return dbOrderToDomain(order);
}

/** Tra cứu đơn guest bằng mã đơn + token (trang theo dõi đơn không cần login). */
export async function getGuestOrderByNumber(orderNumber: string, guestToken: string): Promise<Order | null> {
  const { verifyGuestToken } = await import("./guest-token");
  const order = await prisma.order.findUnique({ where: { number: orderNumber }, include: ORDER_INCLUDE });
  if (!order || order.userId) return null;
  const row = order as unknown as { guestTokenHash?: string | null };
  if (!row.guestTokenHash || !verifyGuestToken(guestToken, row.guestTokenHash)) return null;
  return dbOrderToDomain(order);
}

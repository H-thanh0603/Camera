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

export async function getOwnOrder(id: string): Promise<Order | null> {
  const user = await getSessionUser();
  const order = await prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  if (!order) return null;
  // Guest order: sở hữu bằng kiến thức id; order có chủ thì phải đúng chủ sở hữu
  if (order.userId && order.userId !== user?.id) return null;
  return dbOrderToDomain(order);
}

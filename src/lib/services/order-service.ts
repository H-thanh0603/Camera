import type { CartLine, CartSnapshot, ContactInfo, Order, OrderStatus, ShippingInfo } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/repositories/storage-repository";

/**
 * OrderService — tạo và lưu đơn hàng.
 * LƯU Ý SẢN XUẤT: đây là mock repository phía client. Khi có backend,
 * placeOrder() phải gọi POST /orders để backend xác minh giá, stock,
 * payment và trả về Order thật — client không bao giờ được tin giá tự tính.
 */

const ORDERS_KEY = "orders";

export interface PlaceOrderDraft {
  contact: ContactInfo;
  shipping: ShippingInfo;
  delivery: "standard" | "express" | "pickup";
  payment: "bank_transfer" | "cod" | "card_on_delivery";
  snapshot: CartSnapshot;
}

export class OutOfStockError extends Error {
  constructor(public productName: string) {
    super(`"${productName}" vừa hết hàng. Vui lòng xóa khỏi đơn để tiếp tục.`);
    this.name = "OutOfStockError";
  }
}

function orderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1296)
    .toString(36)
    .toUpperCase()
    .padStart(2, "0");
  return `LUM-${stamp}${rand}`;
}

export async function placeOrder(draft: PlaceOrderDraft): Promise<Order> {
  // Giả lập độ trễ network + failure để UI xử lý loading/error thật.
  await new Promise((r) => setTimeout(r, 1200));
  if (Math.random() < 0.08) {
    throw new Error("NETWORK");
  }

  const outOfStock = draft.snapshot.lines.find((l) => l.maxQuantity <= 0 || l.product.availability === "out_of_stock");
  if (outOfStock) throw new OutOfStockError(outOfStock.product.name);

  const now = new Date().toISOString();
  const order: Order = {
    id: `order_${Date.now().toString(36)}`,
    number: orderNumber(),
    createdAt: now,
    status: draft.payment === "cod" ? "pending" : "paid",
    currentStep: "confirmed",
    contact: draft.contact,
    shipping: draft.shipping,
    delivery: draft.delivery,
    payment: draft.payment,
    lines: draft.snapshot.lines.map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      name: l.product.name,
      variantName: l.variant?.name,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      image: l.product.thumbnail.url,
    })),
    totals: draft.snapshot.totals,
  };

  const orders = loadJSON<Order[]>(ORDERS_KEY, []);
  saveJSON(ORDERS_KEY, [order, ...orders]);
  return order;
}

export function listOrders(): Order[] {
  return loadJSON<Order[]>(ORDERS_KEY, []);
}

export function getOrder(id: string): Order | undefined {
  return listOrders().find((o) => o.id === id);
}

export function cancelOrder(id: string): Order | undefined {
  const orders = listOrders();
  const target = orders.find((o) => o.id === id);
  if (!target) return undefined;
  const cancellable: OrderStatus[] = ["pending", "paid", "processing"];
  if (!cancellable.includes(target.status)) return undefined;
  const updated: Order = { ...target, status: "cancelled" };
  saveJSON(ORDERS_KEY, orders.map((o) => (o.id === id ? updated : o)));
  return updated;
}

export function clearOrders(): void {
  saveJSON(ORDERS_KEY, []);
}

/** Kiểm tra line còn hợp lệ khi đặt hàng (không tự tính lại tiền — backend sẽ verify). */
export function validateDraftLines(lines: CartLine[], resolveMax: (l: CartLine) => number): boolean {
  return lines.every((l) => resolveMax(l) > 0);
}

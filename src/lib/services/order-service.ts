import type { CartSnapshot, ContactInfo, Order, ShippingInfo } from "@/lib/types";
import { apiCancelOrder, apiListOrders, apiPlaceOrder } from "@/lib/api-client";

/**
 * OrderService (client) — giao tiếp với /api/orders.
 * Giá/stock được SERVER verify và tính lại; phản hồi chứa đơn hàng chuẩn
 * từ DB. Lỗi nghiệp vụ (422/409) mang message tiếng Việt từ server.
 */

export interface PlaceOrderDraft {
  contact: ContactInfo;
  shipping: ShippingInfo;
  delivery: "standard" | "express" | "pickup";
  payment: "bank_transfer" | "cod" | "card_on_delivery";
  snapshot: CartSnapshot;
}

export async function placeOrder(draft: PlaceOrderDraft, idempotencyKey?: string): Promise<Order> {
  return apiPlaceOrder({
    contact: draft.contact,
    shipping: draft.shipping,
    delivery: draft.delivery,
    payment: draft.payment,
    lines: draft.snapshot.lines.map((l) => ({
      productId: l.productId,
      variantId: l.variantId,
      quantity: l.quantity,
    })),
  }, idempotencyKey);
}

export function listOrders(): Promise<Order[]> {
  return apiListOrders();
}

export function cancelOrder(id: string): Promise<Order> {
  return apiCancelOrder(id);
}

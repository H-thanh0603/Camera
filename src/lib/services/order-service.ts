import type { CartSnapshot, ContactInfo, Order, PaymentMethod, ShippingInfo } from "@/lib/types";
import { apiCancelOrder, apiListOrders, apiPlaceOrder, newGuestToken } from "@/lib/api-client";

/**
 * OrderService (client) — giao tiếp với /api/orders.
 * Giá/stock được SERVER verify và tính lại; phản hồi chứa đơn hàng chuẩn
 * từ DB. Lỗi nghiệp vụ (422/409) mang message tiếng Việt từ server.
 */

export interface PlaceOrderDraft {
  contact: ContactInfo;
  shipping: ShippingInfo;
  delivery: "standard" | "express" | "pickup";
  payment: PaymentMethod;
  snapshot: CartSnapshot;
  couponCode?: string;
  /**
   * Token sở hữu đơn guest — checkout sinh 1 lần/intent (cùng idempotencyKey).
   * Bỏ trống và là guest → api-client tự sinh.
   */
  guestToken?: string;
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
    ...(draft.couponCode ? { couponCode: draft.couponCode } : {}),
    guestToken: draft.guestToken ?? newGuestToken(),
  }, idempotencyKey);
}

export function listOrders(): Promise<Order[]> {
  return apiListOrders();
}

export function cancelOrder(id: string): Promise<Order> {
  return apiCancelOrder(id);
}

import type { Coupon } from "@/lib/types";

/**
 * CouponService — logic giảm giá thuần hàm (dễ unit test).
 * Server verify lại từ DB trước khi áp dụng — client chỉ gửi mã.
 */

export interface CouponApplyResult {
  discount: number;
  reason?: string;
}

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
}

export function applyCouponToSubtotal(subtotal: number, coupon: Coupon | null): CouponApplyResult {
  if (!coupon) return { discount: 0 };
  if (!coupon.active) return { discount: 0, reason: "Mã giảm giá đã bị vô hiệu." };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return { discount: 0, reason: "Mã giảm giá đã hết hạn." };
  }
  if (subtotal < coupon.minSubtotal) {
    return { discount: 0, reason: `Đơn tối thiểu ${coupon.minSubtotal.toLocaleString("vi-VN")}₫ để dùng mã này.` };
  }
  const raw =
    coupon.kind === "percent"
      ? Math.floor((subtotal * Math.min(90, Math.max(1, coupon.value))) / 100)
      : Math.max(0, coupon.value);
  return { discount: Math.min(raw, subtotal) };
}

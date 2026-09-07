import type { Coupon } from "@/lib/types";
import { prisma } from "./prisma";
import { normalizeCouponCode } from "@/lib/services/coupon-service";

/**
 * Truy cập coupon từ DB — server-only.
 * Chuẩn hoá mã trước khi query để "lumina10" và "LUMINA10" như nhau.
 */

export async function getCouponByCode(rawCode: string): Promise<Coupon | null> {
  const code = normalizeCouponCode(rawCode);
  if (!code) return null;
  const row = await prisma.coupon.findUnique({ where: { code } });
  if (!row) return null;
  return {
    code: row.code,
    kind: row.kind as Coupon["kind"],
    value: row.value,
    minSubtotal: row.minSubtotal,
    active: row.active,
    expiresAt: row.expiresAt?.toISOString(),
  };
}

export async function incrementCouponUsage(code: string): Promise<void> {
  await prisma.coupon.updateMany({
    where: { code },
    data: { usedCount: { increment: 1 } },
  });
}

/**
 * Hoàn lượt coupon khi đơn bị hủy/hoàn tiền (không để maxUses cạn oan).
 * Floor 0 — không bao giờ âm.
 */
export async function releaseCouponUsage(code: string): Promise<void> {
  await prisma.coupon.updateMany({
    where: { code, usedCount: { gt: 0 } },
    data: { usedCount: { decrement: 1 } },
  });
}

/** Đọc mã coupon đã áp trên đơn (lưu trong totals snapshot khi đặt hàng). */
export function couponCodeOfTotals(totals: unknown): string | null {
  if (totals && typeof totals === "object" && "couponCode" in totals) {
    const code = (totals as { couponCode?: unknown }).couponCode;
    return typeof code === "string" && code ? code : null;
  }
  return null;
}

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

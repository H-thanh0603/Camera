import { NextResponse, type NextRequest } from "next/server";
import { getCouponByCode } from "@/lib/server/coupons";
import { applyCouponToSubtotal } from "@/lib/services/coupon-service";
import { couponValidateSchema, zodFieldErrors } from "@/lib/schemas";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

/**
 * POST /api/coupons/validate — preview giảm giá trước khi đặt hàng.
 * Body: { code, subtotal }. Không trừ lượt dùng — chỉ đặt hàng
 * thành công mới tăng usedCount. Giới hạn 30/phút/IP để chống enumerate mã.
 * Mọi mã không áp dụng được trả CÙNG một lỗi chung (M8): không phân biệt
 * tồn tại/vô hiệu/hết lượt/thiếu subtotal để attacker không dò được mã
 * và ngưỡng qua oracle status/message.
 */
const GENERIC_COUPON_ERROR = "Mã giảm giá không áp dụng được cho đơn này.";
const limiter = getRequestLimiter({ windowMs: 60_000, max: 30 });

export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const limit = await limiter.check(`coupon:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = couponValidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Mã giảm giá chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const coupon = await getCouponByCode(parsed.data.code);
  if (!coupon) return NextResponse.json({ error: GENERIC_COUPON_ERROR }, { status: 422 });
  if (coupon.kind === "percent" || coupon.kind === "fixed") {
    const { prisma } = await import("@/lib/server/prisma");
    const row = await prisma.coupon.findUnique({ where: { code: coupon.code } });
    if (!row?.active) return NextResponse.json({ error: GENERIC_COUPON_ERROR }, { status: 422 });
    if (row.maxUses != null && row.usedCount >= row.maxUses) {
      return NextResponse.json({ error: GENERIC_COUPON_ERROR }, { status: 422 });
    }
  }
  const { discount, reason } = applyCouponToSubtotal(parsed.data.subtotal, coupon);
  if (reason || discount <= 0) {
    return NextResponse.json({ error: GENERIC_COUPON_ERROR }, { status: 422 });
  }
  return NextResponse.json({ code: coupon.code, discount });
}

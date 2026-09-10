import { NextResponse, type NextRequest } from "next/server";
import { getGuestOrderByNumber } from "@/lib/server/order-mapper";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

/**
 * GET /api/orders/lookup?number=LUM-...&token=... — tra cứu đơn guest
 * không cần login. Token sai → 404 chung (không oracle tồn tại/không).
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

export async function GET(request: NextRequest) {
  const limit = await limiter.check(`lookup:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const number = request.nextUrl.searchParams.get("number")?.trim() ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!number || !token) {
    return NextResponse.json({ error: "Thiếu mã đơn hoặc token." }, { status: 422 });
  }
  const order = await getGuestOrderByNumber(number, token);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  return NextResponse.json({ order });
}

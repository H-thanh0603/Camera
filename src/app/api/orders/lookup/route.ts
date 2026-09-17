import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getGuestOrderByNumber } from "@/lib/server/order-mapper";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

const lookupSchema = z.object({
  number: z.string().trim().min(1).max(64),
  token: z.string().trim().min(1).max(128),
});

async function checkLimit(ip: string) {
  const limit = await limiter.check(`lookup:${ip}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  return null;
}

/**
 * POST /api/orders/lookup {number, token} — tra cứu đơn guest không cần
 * login. Token qua BODY (M13): không rò vào URL (history/logs/proxy).
 * Token sai → 404 chung (không oracle tồn tại/không).
 */
export async function POST(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const denied = await checkLimit(getClientIp(request.headers));
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Thiếu mã đơn hoặc token." }, { status: 422 });
  }
  const order = await getGuestOrderByNumber(parsed.data.number, parsed.data.token);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  return NextResponse.json({ order });
}

/**
 * GET legacy (?number=&token=) — giữ tương thích, log warn để theo dõi rồi
 * gỡ. Token trong URL rò vào history/logs/proxy (M13): client mới dùng POST.
 */
export async function GET(request: NextRequest) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const denied = await checkLimit(getClientIp(request.headers));
  if (denied) return denied;
  const number = request.nextUrl.searchParams.get("number")?.trim() ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  if (!number || !token) {
    return NextResponse.json({ error: "Thiếu mã đơn hoặc token." }, { status: 422 });
  }
  const order = await getGuestOrderByNumber(number, token);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  const { logger } = await import("@/lib/server/logger");
  logger.warn("order.lookup_legacy_get", {});
  return NextResponse.json({ order });
}

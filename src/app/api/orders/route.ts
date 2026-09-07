import { NextResponse, type NextRequest } from "next/server";
import { placeOrderServer, OrderValidationError } from "@/lib/server/place-order";
import { getUserOrders } from "@/lib/server/order-mapper";
import { getSessionUser } from "@/lib/server/session";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { logger } from "@/lib/server/logger";
import { placeOrderSchema, zodFieldErrors } from "@/lib/schemas";

/**
 * POST /api/orders — đặt hàng (server verify giá/stock, ghi DB).
 * GET  /api/orders — danh sách đơn của phiên hiện tại.
 */

const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const limit = await limiter.check(`order:${ip}`);
  if (!limit.allowed) {
    logger.warn("order.rate_limited", { ip, requestId });
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau một phút." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: Parameters<typeof placeOrderServer>[0];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const parsed = placeOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu đơn hàng chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }

  try {
    // Idempotency key: 1 nguồn duy nhất là header `Idempotency-Key`
    // (chuẩn HTTP). Field body `idempotencyKey` trong schema chỉ giữ để
    // tương thích client cũ — header luôn thắng khi cả hai tồn tại.
    const idempotencyKey = request.headers.get("idempotency-key") ?? parsed.data.idempotencyKey;
    const order = await placeOrderServer({ ...parsed.data, idempotencyKey });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    logger.error("order.place_failed", { error: String(error), requestId });
    return NextResponse.json({ error: "Không thể tạo đơn hàng. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ orders: [] });
  const orders = await getUserOrders(user.id);
  return NextResponse.json({ orders });
}

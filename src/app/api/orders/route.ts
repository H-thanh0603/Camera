import { NextResponse, type NextRequest } from "next/server";
import { placeOrderServer, OrderValidationError } from "@/lib/server/place-order";
import { getUserOrders } from "@/lib/server/order-mapper";
import { getSessionUser } from "@/lib/server/session";
import { createRateLimiter } from "@/lib/utils/rate-limit";

/**
 * POST /api/orders — đặt hàng (server verify giá/stock, ghi DB).
 * GET  /api/orders — danh sách đơn của phiên hiện tại.
 */

const limiter = createRateLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter.check(`order:${ip}`).allowed) {
    return NextResponse.json({ error: "Quá nhiều yêu cầu. Thử lại sau một phút." }, { status: 429 });
  }

  let body: Parameters<typeof placeOrderServer>[0];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  try {
    const idempotencyKey = request.headers.get("idempotency-key") ?? undefined;
    const order = await placeOrderServer({ ...body, idempotencyKey });
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error("[orders] place failed:", error);
    return NextResponse.json({ error: "Không thể tạo đơn hàng. Vui lòng thử lại." }, { status: 500 });
  }
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ orders: [] });
  const orders = await getUserOrders(user.id);
  return NextResponse.json({ orders });
}

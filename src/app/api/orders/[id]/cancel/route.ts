import { NextResponse, type NextRequest } from "next/server";
import { getOwnOrder } from "@/lib/server/order-mapper";
import { getSessionUser } from "@/lib/server/session";
import { CancelConflict, completeCancel } from "@/lib/server/cancel-order";
import { CANCELLABLE_STATUSES } from "@/lib/server/order-status";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { logAudit } from "@/lib/server/audit";
import { logger } from "@/lib/server/logger";

/** POST /api/orders/:id/cancel — hủy đơn (chỉ chủ sở hữu, ở trạng thái cho phép). */

const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limit = await limiter.check(`cancel:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  const { id } = await params;
  const order = await getOwnOrder(id);
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  if (!CANCELLABLE_STATUSES.includes(order.status)) {
    return NextResponse.json({ error: "Đơn hàng đang giao không thể hủy." }, { status: 409 });
  }

  try {
    await completeCancel(id);
  } catch (error) {
    if (error instanceof CancelConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const user = await getSessionUser();
  logger.info("order.cancelled", { orderId: id, userId: user?.id ?? "guest" });
  await logAudit(
    user ? { id: user.id, name: user.name, email: user.email } : null,
    "order.cancelled",
    "Order",
    id,
    { number: order.number },
  );
  return NextResponse.json({ order: { ...order, status: "cancelled" } });
}

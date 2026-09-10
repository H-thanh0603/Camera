import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getOwnOrder, OrderForbidden } from "@/lib/server/order-mapper";
import { getSessionUser } from "@/lib/server/session";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { isProduction } from "@/lib/server/env";
import { logAudit } from "@/lib/server/audit";
import { logger } from "@/lib/server/logger";

/**
 * POST /api/orders/:id/pay-demo — XÁC NHẬN THANH TOÁN DEMO.
 *
 * Chỉ bật khi PAYMENT_DEMO_MODE=true (mặc định cho đồ án). Đây là chỗ
 * duy nhất "giả lập" tiền: không có giao dịch thật, chỉ đánh dấu đơn
 * thành `paid` để demo luồng order tracking.
 *
 * SẢN XUẤT: thay bằng webhook của cổng thanh toán (VNPay/MoMo/Stripe) —
 * webhook verify chữ ký HMAC rồi mới chuyển trạng thái. Endpoint này bị chặn
 * 403 khi PAYMENT_DEMO_MODE=false và phải xóa hẳn trước khi mở traffic thật.
 * Response kèm header Deprecation để scanner/CI phát hiện còn sót demo.
 */

const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limit = await limiter.check(`paydemo:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  // Guard kép: env tập trung (throw ở prod nếu demo bật) + check trực tiếp.
  // Fail-closed: cấu hình sai → 403 chứ không bao giờ nhận tiền giả.
  try {
    if (isProduction() || process.env.PAYMENT_DEMO_MODE !== "true") {
      return NextResponse.json({ error: "Demo payment đang tắt." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Demo payment đang tắt." }, { status: 403 });
  }

  const { id } = await params;
  let order;
  try {
    order = await getOwnOrder(id, request.headers.get("x-guest-token") ?? undefined);
  } catch (error) {
    if (error instanceof OrderForbidden) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    throw error;
  }
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  if (order.status !== "pending") {
    return NextResponse.json({ error: "Đơn hàng không ở trạng thái chờ thanh toán." }, { status: 409 });
  }

  // Claim có điều kiện pending → paid: 2 request song song chỉ 1 bên thắng,
  // bên thua nhận 409 thay vì ghi đè trạng thái.
  const claimed = await prisma.order.updateMany({
    where: { id, status: "pending" },
    data: { status: "paid" },
  });
  if (claimed.count === 0) {
    return NextResponse.json({ error: "Đơn hàng không ở trạng thái chờ thanh toán." }, { status: 409 });
  }
  const user = await getSessionUser();
  logger.info("order.paid_demo", { orderId: id, userId: user?.id ?? "guest" });
  await logAudit(
    user ? { id: user.id, name: user.name, email: user.email } : null,
    "order.paid_demo",
    "Order",
    id,
    { number: order.number },
  );
  const res = NextResponse.json({ order: { ...order, status: "paid" as const } });
  res.headers.set("Deprecation", "true");
  res.headers.set("Sunset", "Sat, 01 Nov 2026 00:00:00 GMT");
  return res;
}

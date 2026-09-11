import { NextResponse, type NextRequest } from "next/server";
import { getOwnOrder, OrderForbidden } from "@/lib/server/order-mapper";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { getEnv } from "@/lib/server/env";
import { buildTxnRef, createVnpayPaymentUrl } from "@/lib/server/vnpay";
import { logger } from "@/lib/server/logger";

/**
 * POST /api/orders/:id/vnpay-url — tạo URL thanh toán VNPay cho đơn pending.
 * Chỉ đơn đặt bằng phương thức "vnpay". Thiếu keys → 503 fail-closed.
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

function vnpayConfig() {
  const env = getEnv();
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn";
  if (!env.VNPAY_TMN_CODE || !env.VNPAY_HASH_SECRET) return null;
  return {
    tmnCode: env.VNPAY_TMN_CODE,
    hashSecret: env.VNPAY_HASH_SECRET,
    payUrl: env.VNPAY_PAY_URL,
    returnUrl: env.VNPAY_RETURN_URL ?? `${siteUrl}/api/payments/vnpay-return`,
  };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limit = await limiter.check(`vnpayurl:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let config: ReturnType<typeof vnpayConfig>;
  try {
    config = vnpayConfig();
  } catch (error) {
    logger.error("payment.vnpay_env_invalid", { error: String(error) });
    return NextResponse.json({ error: "Kênh VNPay chưa được cấu hình." }, { status: 503 });
  }
  if (!config) {
    return NextResponse.json({ error: "Kênh VNPay chưa được cấu hình." }, { status: 503 });
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
  if (order.payment !== "vnpay") {
    return NextResponse.json({ error: "Đơn này không dùng phương thức VNPay." }, { status: 422 });
  }
  const total = (order.totals as { total?: number })?.total ?? 0;
  if (!Number.isInteger(total) || total <= 0) {
    return NextResponse.json({ error: "Tổng đơn hàng chưa hợp lệ." }, { status: 422 });
  }
  try {
    // TxnRef duy nhất mỗi lần bấm (cho phép thanh toán lại sau failed)
    const url = createVnpayPaymentUrl(config, {
      orderNumber: buildTxnRef(order.number),
      amountVnd: total,
      ipAddr: getClientIp(request.headers),
    });
    logger.info("payment.vnpay_url_created", { orderNumber: order.number });
    return NextResponse.json({ url });
  } catch (error) {
    logger.error("payment.vnpay_url_failed", { error: String(error) });
    return NextResponse.json({ error: "Không tạo được liên kết VNPay." }, { status: 500 });
  }
}

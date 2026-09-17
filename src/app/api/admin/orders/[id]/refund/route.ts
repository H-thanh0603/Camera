import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { getSessionUser } from "@/lib/server/session";
import { getEnv } from "@/lib/server/env";
import { getRequestLimiter, redisRequiredResponse } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { logAudit } from "@/lib/server/audit";
import { logger } from "@/lib/server/logger";
import { CancelConflict, compensateOrder } from "@/lib/server/cancel-order";
import {
  buildVnpayRefundParams,
  callVnpayRefund,
  verifyVnpayRefundResponse,
} from "@/lib/server/vnpay";

/**
 * POST /api/admin/orders/:id/refund — hoàn tiền VNPay full-amount.
 * Chỉ đơn `paid` + phương thức `vnpay` + có IPN thành công (lấy
 * transactionNo/payDate từ PaymentEvent.meta). Thành công (RspCode 00)
 * mới chuyển `paid → refunded` qua compensateOrder: hoàn tồn kho + lượt
 * coupon + StockMovement ledger trong cùng transaction (giống admin-PATCH
 * và customer-cancel). Thiếu keys → 503.
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 10 });

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const blocked = await redisRequiredResponse();
  if (blocked) return blocked;
  const denied = await adminGuardResponse();
  if (denied) return denied;
  const limit = await limiter.check(`vnpayrefund:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (error) {
    logger.error("payment.vnpay_env_invalid", { error: String(error) });
    return NextResponse.json({ error: "Kênh VNPay chưa được cấu hình." }, { status: 503 });
  }
  if (!env.VNPAY_TMN_CODE || !env.VNPAY_HASH_SECRET) {
    return NextResponse.json({ error: "Kênh VNPay chưa được cấu hình." }, { status: 503 });
  }
  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return NextResponse.json({ error: "Không tìm thấy đơn hàng." }, { status: 404 });
  if (order.status !== "paid") {
    return NextResponse.json({ error: "Chỉ hoàn tiền đơn đang ở trạng thái đã thanh toán." }, { status: 409 });
  }
  if (order.payment !== "vnpay") {
    return NextResponse.json({ error: "Đơn này không thanh toán qua VNPay." }, { status: 422 });
  }
  const total = (order.totals as { total?: number })?.total ?? 0;
  if (!Number.isInteger(total) || total <= 0) {
    return NextResponse.json({ error: "Tổng đơn hàng chưa hợp lệ." }, { status: 422 });
  }
  const paidEvent = await prisma.paymentEvent.findFirst({
    where: { provider: "vnpay", orderNumber: order.number, status: "paid" },
    orderBy: { createdAt: "desc" },
  });
  const meta = (paidEvent?.meta ?? {}) as { transactionNo?: string; payDate?: string; txnRef?: string };
  if (!paidEvent || !meta.transactionNo || !meta.payDate) {
    return NextResponse.json(
      { error: "Chưa có giao dịch VNPay thành công để hoàn (thiếu mã/ngày giao dịch gốc)." },
      { status: 422 },
    );
  }
  // M2: pre-claim refund TRƯỚC khi gọi gateway — 2 POST song song chỉ 1
  // bên insert được guard `refunding` (unique provider+eventId), bên thua
  // 409 ngay, không gọi VNPay 2 lần (double-spend race).
  // orderNumber hằng số ngoài closure (TS narrowing mất trong function lồng).
  const orderNumber = order.number;
  const { Prisma } = await import("@/generated/prisma/client");
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: "vnpay-refund",
        eventId: `refund:${orderNumber}`,
        orderNumber,
        status: "refunding",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json(
        { error: "Đơn đang được hoàn tiền (yêu cầu khác đang xử lý). Tải lại sau ít phút." },
        { status: 409 },
      );
    }
    throw e;
  }
  const actor = await getSessionUser();
  const siteUrl = env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn";
  const refund = buildVnpayRefundParams(
    {
      tmnCode: env.VNPAY_TMN_CODE,
      hashSecret: env.VNPAY_HASH_SECRET,
      payUrl: env.VNPAY_PAY_URL,
      returnUrl: env.VNPAY_RETURN_URL ?? `${siteUrl}/api/payments/vnpay-return`,
    },
    {
      txnRef: meta.txnRef ?? paidEvent.eventId.split(":")[0],
      amountVnd: total,
      transactionNo: meta.transactionNo,
      transactionDate: meta.payDate,
      createBy: actor?.email ?? "admin",
      ipAddr: getClientIp(request.headers),
    },
  );
  // Xóa guard pre-claim để cho thử lại khi gateway chưa trừ tiền.
  // (Giữ guard khi thành công — audit + chặn refund trùng.)
  async function releaseRefundGuard(): Promise<void> {
    await prisma.paymentEvent
      .deleteMany({ where: { provider: "vnpay-refund", eventId: `refund:${orderNumber}`, status: "refunding" } })
      .catch(() => undefined);
  }
  let resp: Record<string, string>;
  try {
    resp = await callVnpayRefund(env.VNPAY_API_URL, refund);
  } catch (error) {
    logger.error("payment.vnpay_refund_call_failed", { error: String(error) });
    await releaseRefundGuard();
    return NextResponse.json({ error: "Không gọi được API hoàn tiền VNPay." }, { status: 502 });
  }
  if (!verifyVnpayRefundResponse(resp, env.VNPAY_HASH_SECRET)) {
    logger.error("payment.vnpay_refund_bad_signature", { orderNumber: order.number });
    await releaseRefundGuard();
    return NextResponse.json({ error: "Chữ ký phản hồi hoàn tiền không hợp lệ." }, { status: 502 });
  }
  if (resp.vnp_ResponseCode !== "00") {
    logger.warn("payment.vnpay_refund_rejected", { orderNumber: order.number, code: resp.vnp_ResponseCode });
    await releaseRefundGuard();
    return NextResponse.json(
      { error: `VNPay từ chối hoàn tiền (${resp.vnp_ResponseCode}: ${resp.vnp_Message || "unknown"}).` },
      { status: 502 },
    );
  }
  // VNPay đã hoàn tiền thành công → bù đắp đơn: claim `paid → refunded`
  // (đua với PATCH admin / cancel khách: chỉ 1 bên thắng), hoàn tồn kho,
  // ghi ledger, hoàn lượt coupon. Thua claim → 409, không hoàn kho 2 lần.
  try {
    await compensateOrder(id, "refunded", {
      fromStatuses: ["paid"],
      reasonPrefix: "Hoàn tiền đơn",
      actorId: actor?.id ?? null,
    });
  } catch (error) {
    if (error instanceof CancelConflict) {
      return NextResponse.json({ error: "Đơn hàng đã đổi trạng thái, không hoàn được nữa." }, { status: 409 });
    }
    throw error;
  }
  await prisma.paymentEvent
    .updateMany({
      where: { provider: "vnpay-refund", eventId: `refund:${order.number}`, status: "refunding" },
      data: { status: "refunded" },
    })
    .catch(() => undefined);
  logger.info("payment.vnpay_refunded", { orderNumber: order.number });
  await logAudit(actor, "order.refunded_vnpay", "Order", id, {
    number: order.number,
    amount: total,
    transactionNo: meta.transactionNo,
    restocked: true,
  });
  return NextResponse.json({ ok: true, status: "refunded", transactionStatus: resp.vnp_TransactionStatus ?? "" });
}

import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/lib/server/env";
import { handlePaymentWebhook, PaymentWebhookError } from "@/lib/server/payments";
import { parseTxnRef, parseVnpayIpn } from "@/lib/server/vnpay";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";
import { logger } from "@/lib/server/logger";

/**
 * GET /api/payments/vnpay-ipn — server-to-server từ VNPay.
 * Verify HMAC-SHA512 → map về PaymentWebhookInput → tái dùng
 * handlePaymentWebhook (dedupe PaymentEvent + đối soát tiền + claim).
 * Trả RspCode đúng spec VNPay: 00 đã nhận, 97 sai checksum,
 * 01 không tìm đơn, 04 sai số tiền, 02 đơn đã xác nhận, 99 lỗi khác.
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 60 });

export async function GET(request: NextRequest) {
  const limit = await limiter.check(`vnpayipn:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json({ RspCode: "99", Message: "Unknown error" }, { status: 429 });
  }
  let secret: string | undefined;
  try {
    secret = getEnv().VNPAY_HASH_SECRET;
  } catch (error) {
    logger.error("payment.vnpay_env_invalid", { error: String(error) });
    return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
  }
  if (!secret) return NextResponse.json({ RspCode: "99", Message: "Unknown error" });

  const query: Record<string, string | undefined> = {};
  request.nextUrl.searchParams.forEach((value, key) => {
    query[key] = value;
  });
  const parsed = parseVnpayIpn(query, secret);
  if (!parsed.ok) {
    const code = parsed.code === "97" ? "97" : "04";
    return NextResponse.json({ RspCode: code, Message: parsed.message });
  }
  try {
    // Tách hậu tố retry để ra mã đơn gốc; eventId giữ full ref (dedupe từng lần thử).
    // Meta transactionNo/payDate lưu lại cho refund sau này.
    const orderNumber = parseTxnRef(parsed.txnRef);
    const outcome = await handlePaymentWebhook(
      {
        provider: "vnpay",
        eventId: `${parsed.txnRef}:${parsed.transactionNo || parsed.responseCode}`,
        orderNumber,
        amount: parsed.amountVnd,
        status: parsed.responseCode === "00" ? "paid" : "failed",
        timestamp: Math.floor(Date.now() / 1000),
      },
      {
        transactionNo: parsed.transactionNo,
        payDate: query.vnp_PayDate ?? "",
        txnRef: parsed.txnRef,
      },
    );
    // Đơn đã ở trạng thái cuối (không còn pending) → báo VNPay dừng retry
    if (outcome.deduped && outcome.status !== "pending") {
      return NextResponse.json({ RspCode: "02", Message: "Order already confirmed" });
    }
    return NextResponse.json({ RspCode: "00", Message: "Confirm Success" });
  } catch (error) {
    if (error instanceof PaymentWebhookError) {
      if (error.status === 404) return NextResponse.json({ RspCode: "01", Message: "Order not found" });
      if (error.status === 400) return NextResponse.json({ RspCode: "04", Message: "Invalid amount" });
      return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
    }
    logger.error("payment.vnpay_ipn_failed", { error: String(error) });
    return NextResponse.json({ RspCode: "99", Message: "Unknown error" });
  }
}

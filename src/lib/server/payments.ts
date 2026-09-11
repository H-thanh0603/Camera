import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentWebhookInput } from "@/lib/schemas";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { logAudit } from "./audit";

/**
 * Payment server — webhook có verify chữ ký, thay thế pay-demo ở production.
 * Luồng: cổng thanh toán (VNPay/MoMo/Stripe) → adapter map về
 * PaymentWebhookInput → POST /api/payments/webhook kèm chữ ký HMAC.
 */

export const WEBHOOK_MAX_SKEW_SECONDS = 300;

export function signWebhookPayload(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

/** So sánh chữ ký bằng timingSafeEqual — chống timing attack. */
export function verifyWebhookSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = signWebhookPayload(rawBody, secret);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export class PaymentWebhookError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "PaymentWebhookError";
  }
}

export interface WebhookOutcome {
  orderId: string;
  orderNumber: string;
  status: string;
  deduped: boolean;
}

/**
 * Xử lý sự kiện đã verify: dedupe theo (provider, eventId), đối soát số
 * tiền với totals server đã tính, chuyển pending → paid bằng claim có điều
 * kiện. Webhook "failed" giữ nguyên pending để khách thanh toán lại.
 */
export async function handlePaymentWebhook(input: PaymentWebhookInput): Promise<WebhookOutcome> {
  const skew = Math.abs(Date.now() / 1000 - input.timestamp);
  if (skew > WEBHOOK_MAX_SKEW_SECONDS) {
    throw new PaymentWebhookError("Webhook đã hết hạn (timestamp lệch quá 5 phút).", 400);
  }
  // Claim event TRƯỚC mọi xử lý: retry/replay cùng event → P2002 → deduped,
  // không bao giờ apply 2 lần dù race.
  try {
    await prisma.paymentEvent.create({
      data: {
        provider: input.provider,
        eventId: input.eventId,
        orderNumber: input.orderNumber,
        status: input.status,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const order = await prisma.order.findUnique({ where: { number: input.orderNumber } });
      logger.info("payment.webhook_deduped", { provider: input.provider, eventId: input.eventId });
      return {
        orderId: order?.id ?? "unknown",
        orderNumber: input.orderNumber,
        status: order?.status ?? "unknown",
        deduped: true,
      };
    }
    throw e;
  }

  const order = await prisma.order.findUnique({
    where: { number: input.orderNumber },
    include: { lines: true },
  });
  if (!order) throw new PaymentWebhookError("Không tìm thấy đơn hàng.", 404);

  const expected = (order.totals as { total?: number })?.total ?? 0;
  if (input.amount !== expected) {
    logger.error("payment.amount_mismatch", { orderNumber: input.orderNumber, expected, got: input.amount });
    throw new PaymentWebhookError("Số tiền webhook không khớp tổng đơn hàng.", 400);
  }
  if (order.status !== "pending") {
    return { orderId: order.id, orderNumber: order.number, status: order.status, deduped: true };
  }
  if (input.status === "failed") {
    await logAudit(null, "order.payment_failed_via_webhook", "Order", order.id, {
      number: order.number,
      provider: input.provider,
      eventId: input.eventId,
    });
    return { orderId: order.id, orderNumber: order.number, status: order.status, deduped: false };
  }
  // Claim chuyển trạng thái có điều kiện — thua race thì coi như deduped
  const claimed = await prisma.order.updateMany({
    where: { id: order.id, status: "pending" },
    data: { status: "paid" },
  });
  if (claimed.count === 0) {
    return { orderId: order.id, orderNumber: order.number, status: "paid", deduped: true };
  }
  logger.info("payment.webhook_applied", {
    orderNumber: order.number,
    status: "paid",
    provider: input.provider,
    eventId: input.eventId,
  });
  await logAudit(null, "order.paid_via_webhook", "Order", order.id, {
    number: order.number,
    provider: input.provider,
    eventId: input.eventId,
  });
  return { orderId: order.id, orderNumber: order.number, status: "paid", deduped: false };
}

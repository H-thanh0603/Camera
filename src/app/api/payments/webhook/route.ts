import { NextResponse, type NextRequest } from "next/server";
import { handlePaymentWebhook, PaymentWebhookError, verifyWebhookSignature } from "@/lib/server/payments";
import { getEnv } from "@/lib/server/env";
import { paymentWebhookSchema, zodFieldErrors } from "@/lib/schemas";
import { logger } from "@/lib/server/logger";

/**
 * POST /api/payments/webhook — nhận sự kiện từ cổng thanh toán.
 * Verify HMAC-SHA256(raw body) qua header `x-payment-signature` với
 * PAYMENT_WEBHOOK_SECRET. Không có secret cấu hình → 503 (chưa sẵn sàng).
 */
export async function POST(request: NextRequest) {
  let env: ReturnType<typeof getEnv>;
  try {
    env = getEnv();
  } catch (error) {
    logger.error("payment.webhook_env_invalid", { error: String(error) });
    return NextResponse.json({ error: "Cấu hình thanh toán chưa hợp lệ." }, { status: 500 });
  }
  if (!env.PAYMENT_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Kênh thanh toán chưa được cấu hình." }, { status: 503 });
  }
  const signature = request.headers.get("x-payment-signature") ?? "";
  if (!signature) return NextResponse.json({ error: "Thiếu chữ ký webhook." }, { status: 401 });

  const rawBody = await request.text();
  if (!verifyWebhookSignature(rawBody, signature, env.PAYMENT_WEBHOOK_SECRET)) {
    logger.warn("payment.webhook_bad_signature", {});
    return NextResponse.json({ error: "Chữ ký webhook không hợp lệ." }, { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Body không phải JSON." }, { status: 400 });
  }
  const parsed = paymentWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload webhook chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  try {
    const outcome = await handlePaymentWebhook(parsed.data);
    return NextResponse.json({ ok: true, ...outcome });
  } catch (error) {
    if (error instanceof PaymentWebhookError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error("payment.webhook_failed", { error: String(error) });
    return NextResponse.json({ error: "Xử lý webhook thất bại." }, { status: 500 });
  }
}

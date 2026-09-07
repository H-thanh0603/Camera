import { logger } from "./logger";
import { hashId } from "./scrub";
import { fetchWithTimeout } from "./fetch";

/**
 * Email giao dịch — Resend khi có RESEND_API_KEY, ngược lại chế độ log
 * (dev): ghi nội dung ra logger thay vì gửi thật.
 * Không bao giờ throw — email thất bại không được phá vỡ đặt hàng.
 */

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; mode: "resend" | "log" }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Lumina Optics <orders@lumina.vn>";
  if (!apiKey) {
    logger.info("email.log_mode", { toHash: hashId(input.to), subject: input.subject });
    return { sent: false, mode: "log" };
  }
  try {
    const res = await fetchWithTimeout("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: input.to, subject: input.subject, html: input.html }),
    });
    if (!res.ok) {
      logger.error("email.resend_failed", { status: res.status, toHash: hashId(input.to) });
      return { sent: false, mode: "resend" };
    }
    return { sent: true, mode: "resend" };
  } catch (error) {
    logger.error("email.send_error", { error: String(error), toHash: hashId(input.to) });
    return { sent: false, mode: "resend" };
  }
}

export function orderConfirmationHtml(orderNumber: string, total: number, name: string): string {
  const amount = total.toLocaleString("vi-VN");
  return `<div style="font-family:sans-serif;max-width:560px">
<h2>Cảm ơn ${name}, đơn hàng ${orderNumber} đã được ghi nhận</h2>
<p>Tổng giá trị: <strong>${amount}₫</strong></p>
<p>Concierge Lumina sẽ liên hệ xác nhận trong 30 phút. Theo dõi đơn tại tài khoản của bạn.</p>
</div>`;
}

export function passwordResetHtml(link: string): string {
  return `<div style="font-family:sans-serif;max-width:560px">
<h2>Đặt lại mật khẩu Lumina Optics</h2>
<p>Bấm link dưới để đặt mật khẩu mới (hết hạn sau 60 phút, dùng 1 lần):</p>
<p><a href="${link}">${link}</a></p>
<p>Nếu bạn không yêu cầu, bỏ qua email này.</p>
</div>`;
}

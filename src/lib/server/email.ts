import { logger } from "./logger";
import { hashId } from "./scrub";
import { fetchWithTimeout } from "./fetch";

/**
 * Email giao dịch — Resend khi có RESEND_API_KEY, ngược lại chế độ log
 * (dev): ghi nội dung ra logger thay vì gửi thật.
 * Không bao giờ throw — email thất bại không được phá vỡ đặt hàng.
 * Template: table-based + inline style (tương thích Gmail/Outlook),
 * brand dark luxury + gold của LUMINA Optics.
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

/** Escape nội dung user đưa vào HTML (tên, công ty) — chống HTML injection. */
export function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell(preheader: string, body: string): string {
  return `<!DOCTYPE html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background-color:#10141a;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeEmailHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#10141a;padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background-color:#1c2026;border-radius:12px;overflow:hidden;">
<tr><td style="padding:24px 28px 8px;text-align:center;">
<div style="color:#f2ca50;font-size:20px;font-weight:bold;letter-spacing:3px;">LUMINA OPTICS</div>
<div style="color:#99908c;font-size:11px;letter-spacing:2px;margin-top:4px;">PRECISION CINEMA APPARATUS</div>
</td></tr>
<tr><td style="padding:16px 28px 28px;color:#dfe2eb;font-size:15px;line-height:1.6;">
${body}
</td></tr>
<tr><td style="padding:0 28px 24px;color:#99908c;font-size:12px;line-height:1.6;border-top:1px solid #31353c;padding-top:16px;">
Lumina Optics — Quận 1 (HCM) • Hoàn Kiếm (HN) • Concierge: 8:00–21:00 mỗi ngày.<br>
Email tự động, vui lòng không trả lời. Cần hỗ trợ? Trả lời với mã đơn của bạn.
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function ctaButton(url: string, label: string): string {
  return `<p style="text-align:center;margin:24px 0 8px;"><a href="${url}" style="display:inline-block;background-color:#f2ca50;color:#3c2c00;font-weight:bold;font-size:14px;text-decoration:none;padding:12px 28px;border-radius:8px;letter-spacing:1px;">${label}</a></p>`;
}

export interface OrderLineInput {
  name: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
}

export function orderConfirmationHtml(
  orderNumber: string,
  total: number,
  name: string,
  invoice?: { companyName: string; taxCode: string } | null,
  lines: OrderLineInput[] = [],
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn",
): string {
  const safeName = escapeEmailHtml(name);
  const amount = total.toLocaleString("vi-VN");
  const rows = lines
    .map(
      (l) => `<tr>
<td style="padding:10px 0;border-bottom:1px solid #31353c;color:#dfe2eb;">${escapeEmailHtml(l.name)}${l.variantName ? ` — ${escapeEmailHtml(l.variantName)}` : ""} <span style="color:#99908c;">× ${l.quantity}</span></td>
<td align="right" style="padding:10px 0;border-bottom:1px solid #31353c;color:#f2ca50;font-weight:bold;white-space:nowrap;">${l.unitPrice.toLocaleString("vi-VN")}₫</td>
</tr>`,
    )
    .join("");
  return shell(
    `Đơn ${orderNumber} đã được ghi nhận — tổng ${amount}₫`,
    `<h1 style="color:#ffffff;font-size:22px;margin:0 0 12px;">Cảm ơn ${safeName}!</h1>
<p style="margin:0 0 12px;">Đơn hàng <strong style="color:#f2ca50;">${escapeEmailHtml(orderNumber)}</strong> đã được ghi nhận. Concierge Lumina sẽ liên hệ xác nhận trong 30 phút.</p>
${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0;">${rows}</table>` : ""}
<p style="margin:12px 0;">Tổng giá trị: <strong style="color:#f2ca50;font-size:18px;">${amount}₫</strong></p>
${invoice ? `<p style="margin:0 0 12px;">Hóa đơn VAT: <strong>${escapeEmailHtml(invoice.companyName)}</strong> (MST ${escapeEmailHtml(invoice.taxCode)}) — kế toán gửi hóa đơn điện tử qua email này.</p>` : ""}
${ctaButton(`${siteUrl}/account`, "THEO DÕI ĐƠN HÀNG")}`,
  );
}

export function passwordResetHtml(link: string): string {
  return shell(
    "Đặt lại mật khẩu Lumina Optics (hết hạn sau 60 phút)",
    `<h1 style="color:#ffffff;font-size:22px;margin:0 0 12px;">Đặt lại mật khẩu</h1>
<p style="margin:0 0 12px;">Bấm nút dưới để đặt mật khẩu mới (hết hạn sau 60 phút, dùng 1 lần):</p>
${ctaButton(link, "ĐẶT MẬT KHẨU MỚI")}
<p style="margin:12px 0 0;color:#99908c;font-size:13px;">Nếu bạn không yêu cầu, bỏ qua email này — tài khoản của bạn vẫn an toàn.</p>`,
  );
}

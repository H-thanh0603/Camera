import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { queueOutboxEmail } from "./email-outbox";
import { twoFactorOtpHtml } from "./email";
import { TwoFactorError } from "./two-factor";

/**
 * OTP email 6 số dùng chung nhiều purpose (mỗi purpose độc lập OTP riêng):
 * - "totp-bootstrap": lần bật 2FA đầu tiên qua challenge bootstrap (L4) —
 *   password đúng thôi chưa đủ enroll authenticator, attacker phải đọc được email.
 * - "account-delete": xác nhận xóa tài khoản OAuth (F7) — email nhập lại là
 *   thông tin public, không đủ làm yếu tố xác thực thứ hai.
 * DB chỉ lưu SHA-256(code+salt), TTL 10 phút, dùng 1 lần, tối đa 5 lần sai/OTP.
 * Rate gửi: caller (route) tự giới hạn bằng limiter của route.
 */

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(salt + code.trim(), "utf8").digest("hex");
}

/** Sinh OTP mới cho purpose, vô hiệu OTP cũ cùng user+purpose, gửi qua outbox. */
export async function sendEmailOtp(
  userId: string,
  email: string,
  purpose: string,
  subject: string,
  kind: string,
  intro?: string,
): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  await prisma.emailOtp.updateMany({
    where: { userId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.emailOtp.create({
    data: {
      codeHash: `${salt}:${hashOtp(code, salt)}`,
      userId,
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  queueOutboxEmail({
    kind,
    to: email,
    subject,
    html: twoFactorOtpHtml(code, intro),
  });
  logger.info("auth.email_otp_sent", { userId, purpose });
}

/** Verify OTP theo purpose: sai quá 5 lần hoặc hết hạn → lỗi; đúng → claim single-use. */
export async function verifyEmailOtp(userId: string, code: string, purpose: string): Promise<void> {
  const row = await prisma.emailOtp.findFirst({
    where: { userId, purpose, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    throw new TwoFactorError("Mã email không đúng hoặc đã hết hạn. Bấm gửi lại mã.", 422);
  }
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    throw new TwoFactorError("Sai quá nhiều lần. Bấm gửi lại mã mới.", 429);
  }
  const [salt, hash] = row.codeHash.split(":");
  let ok = false;
  if (salt && hash) {
    const a = Buffer.from(hashOtp(code, salt), "utf8");
    const b = Buffer.from(hash, "utf8");
    ok = a.length === b.length && timingSafeEqual(a, b);
  }
  if (!ok) {
    await prisma.emailOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw new TwoFactorError("Mã email không đúng.", 422);
  }
  const claimed = await prisma.emailOtp.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new TwoFactorError("Mã email đã được dùng. Bấm gửi lại mã.", 422);
  }
}

/* ----- Wrapper purpose "totp-bootstrap" (caller cũ: 2fa setup/confirm) ----- */

export async function sendBootstrapOtp(userId: string, email: string): Promise<void> {
  return sendEmailOtp(userId, email, "totp-bootstrap", "Mã xác nhận bật 2FA — Lumina Optics", "2fa-bootstrap-otp");
}

export async function verifyBootstrapOtp(userId: string, code: string): Promise<void> {
  return verifyEmailOtp(userId, code, "totp-bootstrap");
}

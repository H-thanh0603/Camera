import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "./prisma";
import { logger } from "./logger";
import { queueOutboxEmail } from "./email-outbox";
import { twoFactorOtpHtml } from "./email";
import { TwoFactorError } from "./two-factor";

/**
 * OTP email 6 số cho lần bật 2FA đầu tiên qua challenge bootstrap (L4):
 * password đúng thôi chưa đủ enroll authenticator — attacker phải đọc được
 * cả email. DB chỉ lưu SHA-256(code+salt), TTL 10 phút, dùng 1 lần, tối đa
 * 5 lần sai/OTP. Rate gửi: caller (route setup bootstrap) tự giới hạn bằng
 * limiter của route.
 */

const OTP_TTL_MS = 10 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

function hashOtp(code: string, salt: string): string {
  return createHash("sha256").update(salt + code.trim(), "utf8").digest("hex");
}

/** Sinh OTP mới, vô hiệu OTP cũ cùng user+purpose, gửi qua outbox. */
export async function sendBootstrapOtp(userId: string, email: string): Promise<void> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  await prisma.emailOtp.updateMany({
    where: { userId, purpose: "totp-bootstrap", usedAt: null },
    data: { usedAt: new Date() },
  });
  await prisma.emailOtp.create({
    data: {
      codeHash: `${salt}:${hashOtp(code, salt)}`,
      userId,
      purpose: "totp-bootstrap",
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  queueOutboxEmail({
    kind: "2fa-bootstrap-otp",
    to: email,
    subject: "Mã xác nhận bật 2FA — Lumina Optics",
    html: twoFactorOtpHtml(code),
  });
  logger.info("auth.bootstrap_otp_sent", { userId });
}

/** Verify OTP: sai quá 5 lần hoặc hết hạn → lỗi; đúng → claim single-use. */
export async function verifyBootstrapOtp(userId: string, code: string): Promise<void> {
  const row = await prisma.emailOtp.findFirst({
    where: { userId, purpose: "totp-bootstrap", usedAt: null, expiresAt: { gt: new Date() } },
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

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { hashPassword } from "./password";
import { passwordResetHtml, sendEmail } from "./email";
import { logger } from "./logger";

/**
 * Quên / đặt lại mật khẩu — token ngẫu nhiên, DB chỉ lưu SHA-256.
 * Chống enumerate: request luôn trả ok dù email không tồn tại.
 */

const RESET_TTL_MS = 60 * 60 * 1000; // 60 phút

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export class PasswordResetError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "PasswordResetError";
  }
}

export async function requestPasswordReset(email: string): Promise<{ ok: true }> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  // Banned: không gửi link (chống spam/toxic) nhưng vẫn trả ok chống enumerate
  if (user && !user.isBanned) {
    const token = randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: hashToken(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const link = `${site}/reset-password?token=${token}`;
    const mail = {
      kind: "password-reset",
      to: user.email,
      subject: "Đặt lại mật khẩu Lumina Optics",
      html: passwordResetHtml(link),
    };
    // Queue nhanh hơn inline; fallback inline nếu Redis chưa cấu hình
    const { enqueueEmail, getQueueRedis } = await import("./email-queue");
    const { queued } = await enqueueEmail(getQueueRedis(), mail);
    if (!queued) await sendEmail(mail);
    logger.info("auth.password_reset_requested", { userId: user.id });
  }
  return { ok: true };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<{ ok: true }> {
  if (newPassword.length < 8) {
    throw new PasswordResetError("Mật khẩu cần tối thiểu 8 ký tự.", 422);
  }
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new PasswordResetError("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", 400);
  }
  // Claim token có điều kiện trong tx: 2 request cùng token song song
  // thì chỉ 1 thắng (count==0 → lỗi), token không dùng được 2 lần.
  const claimed = await prisma.passwordResetToken.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) {
    throw new PasswordResetError("Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.", 400);
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(newPassword) } }),
    // Đăng xuất mọi phiên cũ sau khi đổi mật khẩu
    prisma.session.deleteMany({ where: { userId: row.userId } }),
  ]);
  logger.info("auth.password_reset_done", { userId: row.userId });
  return { ok: true };
}

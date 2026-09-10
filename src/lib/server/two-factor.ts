import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { createSession } from "./session";
import type { SessionUser } from "@/lib/types";
import {
  hashBackupCode,
  newBackupCodes,
  newTotpSecret,
  otpauthUrl,
  verifyTotp,
} from "./totp";

/**
 * 2FA TOTP cho tài khoản (bắt buộc về mặt vận hành cho admin — banner
 * cảnh báo trên dashboard khi chưa bật).
 * Luồng login: password đúng + totpEnabled → challenge 5 phút (không session)
 * → verify code → session. Backup code dùng 1 lần.
 */

export class TwoFactorError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "TwoFactorError";
  }
}

const CHALLENGE_TTL_MS = 5 * 60_000;

function hashChallenge(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function backupList(user: { totpBackupCodes: unknown }): string[] {
  return Array.isArray(user.totpBackupCodes) ? (user.totpBackupCodes as string[]) : [];
}

/** Bắt đầu bật 2FA: sinh secret mới (ghi đè secret chưa confirm), trả về để quét app. */
export async function startTotpSetup(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new TwoFactorError("Không tìm thấy tài khoản.", 404);
  if (user.totpEnabled) throw new TwoFactorError("Tài khoản đã bật 2FA.", 409);
  const secret = newTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: secret } });
  return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
}

/** Xác nhận bật 2FA bằng code từ app + nhận backup codes (trả 1 lần duy nhất). */
export async function confirmTotpSetup(userId: string, code: string): Promise<{ backupCodes: string[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpSecret) throw new TwoFactorError("Chưa bắt đầu thiết lập 2FA.", 409);
  if (user.totpEnabled) throw new TwoFactorError("Tài khoản đã bật 2FA.", 409);
  if (!verifyTotp(user.totpSecret, code)) {
    throw new TwoFactorError("Mã xác thực không đúng.", 422);
  }
  const backupCodes = newBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true, totpBackupCodes: backupCodes.map(hashBackupCode) },
  });
  await logAudit(user, "user.2fa_enabled", "User", userId, {});
  return { backupCodes };
}

/** Tắt 2FA bằng code hiện tại (mất máy thì admin khác revoke + reset tay). */
export async function disableTotp(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpEnabled || !user.totpSecret) throw new TwoFactorError("Tài khoản chưa bật 2FA.", 409);
  if (!verifyTotp(user.totpSecret, code)) {
    throw new TwoFactorError("Mã xác thực không đúng.", 422);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
  });
  await logAudit(user, "user.2fa_disabled", "User", userId, {});
}

/** Sau password đúng: tạo challenge 5 phút cho bước 2 (chưa tạo session). */
export async function createTotpChallenge(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.totpChallenge.create({
    data: { tokenHash: hashChallenge(token), userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  return token;
}

/**
 * Verify challenge + code → tạo session, trả user.
 * Backup code khớp → tiêu hủy code đó (dùng 1 lần).
 */
export async function verifyTotpChallenge(challengeToken: string, code: string): Promise<SessionUser> {
  const row = await prisma.totpChallenge.findUnique({
    where: { tokenHash: hashChallenge(challengeToken) },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new TwoFactorError("Phiên xác thực hết hạn. Đăng nhập lại.", 401);
  }
  const user = row.user;
  if (user.isBanned) throw new TwoFactorError("Tài khoản đã bị khóa.", 403);
  if (!user.totpEnabled || !user.totpSecret) {
    throw new TwoFactorError("Tài khoản chưa bật 2FA.", 409);
  }
  const normalized = code.trim().toUpperCase().replace(/\s/g, "");
  let ok = verifyTotp(user.totpSecret, normalized);
  let consumedBackup: string | null = null;
  if (!ok) {
    const hash = hashBackupCode(normalized);
    if (backupList(user).includes(hash)) {
      ok = true;
      consumedBackup = hash;
    }
  }
  if (!ok) throw new TwoFactorError("Mã xác thực không đúng.", 422);
  // Claim single-use trước mọi side-effect — 2 request song song 1 thắng.
  const claimed = await prisma.totpChallenge.updateMany({
    where: { id: row.id, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  if (claimed.count === 0) throw new TwoFactorError("Phiên xác thực đã được dùng.", 401);
  if (consumedBackup) {
    await prisma.user.update({
      where: { id: user.id },
      data: { totpBackupCodes: backupList(user).filter((h) => h !== consumedBackup) },
    });
  }
  await createSession(user.id);
  await logAudit({ id: user.id, name: user.name, email: user.email }, "user.2fa_verified", "User", user.id, {
    viaBackupCode: consumedBackup !== null,
  });
  return { id: user.id, name: user.name, email: user.email };
}

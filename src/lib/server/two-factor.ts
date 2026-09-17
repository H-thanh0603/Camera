import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { createSession, revokeUserSessions } from "./session";
import type { SessionUser } from "@/lib/types";
import { getRedisClient } from "@/lib/edge-rate-limit";
import {
  findBackupCodeMatch,
  hashBackupCode,
  newBackupCodes,
  newTotpSecret,
  otpauthUrl,
  verifyTotp,
  encryptTotpSecret,
  decryptTotpSecret,
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

/** Sai tối đa 10 lần/challenge — chống brute-force 6 số khi xoay IP (M4). */
const MAX_CHALLENGE_ATTEMPTS = 10;
const CHALLENGE_FAIL_WINDOW_S = 5 * 60;

function hashChallenge(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

const challengeFails = new Map<string, { count: number; resetAt: number }>();

function challengeKey(token: string): string {
  return `lumina:2fafail:${hashChallenge(token)}`;
}

/** true khi challenge đã quá số lần sai (lock tới hết TTL). */
async function isChallengeLocked(token: string): Promise<boolean> {
  const k = challengeKey(token);
  const redis = getRedisClient();
  if (redis) {
    try {
      const count = Number((await redis.get(k)) ?? 0) || 0;
      if (count >= MAX_CHALLENGE_ATTEMPTS) return true;
    } catch {
      // rớt xuống memory
    }
  }
  const entry = challengeFails.get(k);
  if (!entry) return false;
  if (entry.resetAt <= Date.now()) {
    challengeFails.delete(k);
    return false;
  }
  return entry.count >= MAX_CHALLENGE_ATTEMPTS;
}

async function recordChallengeFail(token: string): Promise<void> {
  const k = challengeKey(token);
  const redis = getRedisClient();
  if (redis) {
    try {
      const count = await redis.incr(k);
      if (count === 1) await redis.expire(k, CHALLENGE_FAIL_WINDOW_S);
    } catch {
      // rớt xuống memory
    }
  }
  const now = Date.now();
  const entry = challengeFails.get(k);
  if (!entry || entry.resetAt <= now) {
    challengeFails.set(k, { count: 1, resetAt: now + CHALLENGE_FAIL_WINDOW_S * 1000 });
  } else {
    entry.count += 1;
  }
}

async function clearChallengeFails(token: string): Promise<void> {
  const k = challengeKey(token);
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(k);
    } catch {
      // bỏ qua
    }
  }
  challengeFails.delete(k);
}

/** Reset state module (test). */
export function __resetChallengeFails(): void {
  challengeFails.clear();
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
  // Lưu encrypted-at-rest; plaintext chỉ trả về client đúng 1 lần để quét app.
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: encryptTotpSecret(secret) } });
  return { secret, otpauthUrl: otpauthUrl(secret, user.email) };
}

/** Xác nhận bật 2FA bằng code từ app + nhận backup codes (trả 1 lần duy nhất). */
export async function confirmTotpSetup(userId: string, code: string): Promise<{ backupCodes: string[] }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpSecret) throw new TwoFactorError("Chưa bắt đầu thiết lập 2FA.", 409);
  if (user.totpEnabled) throw new TwoFactorError("Tài khoản đã bật 2FA.", 409);
  if (!verifyTotp(decryptTotpSecret(user.totpSecret), code)) {
    throw new TwoFactorError("Mã xác thực không đúng.", 422);
  }
  const backupCodes = newBackupCodes();
  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: true, totpBackupCodes: backupCodes.map(hashBackupCode) },
  });
  // Bật 2FA = đổi mức bảo mật — phiên cũ (chưa qua 2FA) không còn tin được.
  await revokeUserSessions(userId);
  await logAudit(user, "user.2fa_enabled", "User", userId, {});
  return { backupCodes };
}

/** Tắt 2FA bằng code hiện tại (mất máy thì admin khác revoke + reset tay). */
export async function disableTotp(userId: string, code: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.totpEnabled || !user.totpSecret) throw new TwoFactorError("Tài khoản chưa bật 2FA.", 409);
  if (!verifyTotp(decryptTotpSecret(user.totpSecret), code)) {
    throw new TwoFactorError("Mã xác thực không đúng.", 422);
  }
  await prisma.user.update({
    where: { id: userId },
    data: { totpEnabled: false, totpSecret: null, totpBackupCodes: [] },
  });
  // Tắt 2FA = hạ mức bảo mật — đá mọi phiên, bắt login lại.
  await revokeUserSessions(userId);
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
 * Resolve challenge token hợp lệ (chưa dùng, chưa hết hạn) → user.
 * Dùng cho luồng bootstrap 2FA admin (setup/confirm bằng challenge thay vì
 * session — admin chưa bật 2FA không login được nên không có session).
 */
export async function resolveTotpChallenge(challengeToken: string): Promise<SessionUser> {
  const row = await prisma.totpChallenge.findUnique({
    where: { tokenHash: hashChallenge(challengeToken) },
    include: { user: true },
  });
  if (!row || row.usedAt || row.expiresAt < new Date()) {
    throw new TwoFactorError("Phiên xác thực hết hạn. Đăng nhập lại.", 401);
  }
  if (row.user.isBanned) throw new TwoFactorError("Tài khoản đã bị khóa.", 403);
  return { id: row.user.id, name: row.user.name, email: row.user.email };
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
  if (await isChallengeLocked(challengeToken)) {
    throw new TwoFactorError("Sai quá nhiều lần. Đăng nhập lại để nhận phiên mới.", 429);
  }
  const user = row.user;
  if (user.isBanned) throw new TwoFactorError("Tài khoản đã bị khóa.", 403);
  if (!user.totpEnabled || !user.totpSecret) {
    throw new TwoFactorError("Tài khoản chưa bật 2FA.", 409);
  }
  const normalized = code.trim().toUpperCase().replace(/\s/g, "");
  let ok = verifyTotp(decryptTotpSecret(user.totpSecret), normalized);
  let consumedBackup: string | null = null;
  if (!ok) {
    // Mã dự phòng mới (salt) + mã legacy (không salt, user giữ từ trước).
    consumedBackup = findBackupCodeMatch(normalized, backupList(user));
    if (consumedBackup) ok = true;
  }
  if (!ok) {
    await recordChallengeFail(challengeToken);
    throw new TwoFactorError("Mã xác thực không đúng.", 422);
  }
  await clearChallengeFails(challengeToken);
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

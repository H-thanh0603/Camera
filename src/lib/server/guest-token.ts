import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Guest order token — chống IDOR cho đơn khách vãng lai.
 * Raw token (64 hex chars) chỉ trả cho client ĐÚNG 1 lần lúc đặt hàng;
 * DB chỉ lưu SHA-256. Mọi thao tác sau (xem/hủy/thanh toán) phải gửi lại
 * token qua header `x-guest-token`.
 */

export function newGuestToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashGuestToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** So sánh token client gửi với hash trong DB — chống timing attack. */
export function verifyGuestToken(rawToken: string, storedHash: string | null): boolean {
  if (!rawToken || !storedHash) return false;
  const a = Buffer.from(hashGuestToken(rawToken.trim()), "utf8");
  const b = Buffer.from(storedHash, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

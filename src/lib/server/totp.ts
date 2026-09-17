import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * TOTP (RFC 6238, SHA-1, 30s, 6 số) tự triển khai — không thêm dependency.
 * Tương thích Google Authenticator / 1Password / Authy qua otpauth:// URL.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_MS = 30_000;
const DIGITS = 6;
const WINDOW_STEPS = 1; // chấp nhận lệch ±1 bước (±30s clock skew)

export function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Uint8Array {
  const clean = input.trim().replace(/=+$/, "").toUpperCase();
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("Secret không đúng base32.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** Secret mới: 20 byte ngẫu nhiên (160 bit, đúng RFC 4226). */
export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function otpauthUrl(secret: string, email: string, issuer = "Lumina Optics"): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(email)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function hotp(secretBytes: Uint8Array, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", secretBytes).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff);
  return String(code % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function totpCode(secret: string, nowMs: number = Date.now()): string {
  const counter = Math.floor(nowMs / STEP_MS);
  return hotp(base32Decode(secret), counter);
}

/** Verify với window ±1 bước. So sánh bằng timingSafeEqual. */
export function verifyTotp(secret: string, code: string, nowMs: number = Date.now()): boolean {
  const normalized = code.trim().replace(/\s/g, "");
  if (!/^\d{6}$/.test(normalized)) return false;
  let secretBytes: Uint8Array;
  try {
    secretBytes = base32Decode(secret);
  } catch {
    return false;
  }
  const counter = Math.floor(nowMs / STEP_MS);
  for (let d = -WINDOW_STEPS; d <= WINDOW_STEPS; d++) {
    const expected = hotp(secretBytes, counter + d);
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(normalized, "utf8");
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/* ---------- Mã hóa secret khi lưu (at-rest encryption) ---------- */

/**
 * Mã hóa secret 2FA khi lưu DB (AES-256-GCM). Thiếu TOTP_ENCRYPTION_KEY:
 * mọi route 2FA trả 503 (fail-closed) — không fallback plaintext.
 * Key: 32 byte thô hoặc hex 64 ký tự (openssl rand -hex 32).
 * Định dạng lưu: v2:<ivHex>:<tagHex>:<cipherHex> — bản plaintext cũ
 * (base32 không prefix) đọc được như cũ để migrate dần.
 */

const TOTP_ENC_PREFIX = "v2:";

function totpKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new TotpCryptoError("Chưa cấu hình TOTP_ENCRYPTION_KEY — không thể đọc/ghi secret 2FA.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, "hex");
  if (raw.length === 32) return Buffer.from(raw, "utf8");
  throw new TotpCryptoError("TOTP_ENCRYPTION_KEY phải là 32 byte hoặc hex 64 ký tự.");
}

export class TotpCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TotpCryptoError";
  }
}

export function encryptTotpSecret(plain: string): string {
  const key = totpKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${TOTP_ENC_PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/** Giải mã secret đã lưu; bản cũ plaintext (không prefix) trả nguyên văn. */
export function decryptTotpSecret(stored: string): string {
  if (!stored.startsWith(TOTP_ENC_PREFIX)) return stored;
  const key = totpKey();
  const [ivHex, tagHex, cipherHex] = stored.slice(TOTP_ENC_PREFIX.length).split(":");
  if (!ivHex || !tagHex || !cipherHex) throw new TotpCryptoError("Secret 2FA lưu sai định dạng.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(cipherHex, "hex")), decipher.final()]).toString("utf8");
  } catch {
    throw new TotpCryptoError("Giải mã secret 2FA thất bại (sai key?).");
  }
}

/* ---------- Backup codes (dùng 1 lần, DB chỉ lưu hash + salt) ----------
 *
 * Mã mới: 80 bit entropy (20 hex chars), hash SHA-256 với salt ngẫu nhiên
 * riêng từng mã — lộ DB không brute-force được (không gian 2^80, salt
 * chống rainbow table). Format lưu: `v1:<saltHex>:<hashHex>`.
 * Mã cũ (8 hex chars, SHA-256 không salt) vẫn verify được để không khóa
 * user đang giữ mã cũ — nhưng confirm mới luôn sinh mã v1.
 */

export function newBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const hex = randomBytes(10).toString("hex").toUpperCase();
    codes.push(`${hex.slice(0, 5)}-${hex.slice(5, 10)}-${hex.slice(10, 15)}-${hex.slice(15, 20)}`);
  }
  return codes;
}

/** Chuẩn hoá input user: hoa, bỏ gạch nối/khoảng trắng (nhập thiếu dấu vẫn đúng). */
export function normalizeBackupCode(code: string): string {
  return code.trim().toUpperCase().replace(/[-\s]/g, "");
}

/** Hash mã mới với salt riêng. */
export function hashBackupCode(code: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(salt + normalizeBackupCode(code), "utf8").digest("hex");
  return `v1:${salt}:${hash}`;
}

/** Hash legacy (mã 8 hex chars cũ, SHA-256 không salt) — chỉ để verify mã cũ. */
function hashLegacyBackupCode(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase(), "utf8").digest("hex");
}

/**
 * Tìm mã khớp trong danh sách đã hash. Trả về entry đã lưu (để xóa 1 lần)
 * hoặc null. Hỗ trợ cả mã v1 (salt) và mã legacy (không salt).
 */
export function findBackupCodeMatch(input: string, storedList: string[]): string | null {
  const normalized = normalizeBackupCode(input);
  if (!normalized) return null;
  const legacyHash = hashLegacyBackupCode(input);
  for (const stored of storedList) {
    if (typeof stored !== "string") continue;
    if (stored.startsWith("v1:")) {
      const [, salt, hash] = stored.split(":");
      if (!salt || !hash) continue;
      const candidate = createHash("sha256").update(salt + normalized, "utf8").digest("hex");
      const a = Buffer.from(candidate, "utf8");
      const b = Buffer.from(hash, "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) return stored;
    } else {
      const a = Buffer.from(legacyHash, "utf8");
      const b = Buffer.from(stored, "utf8");
      if (a.length === b.length && timingSafeEqual(a, b)) return stored;
    }
  }
  return null;
}

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing bằng scrypt (chuẩn Node crypto, không dependency ngoài).
 * Format lưu: scrypt$<saltHex>$<hashHex> — N=16384, r=8, p=1.
 * Khi chuyển sang backend riêng có thể đổi sang bcrypt/argon2 — chỉ đổi file này.
 */

const scryptAsync = promisify(scrypt) as (p: string | Buffer, s: string | Buffer, k: number) => Promise<Buffer>;

const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = await scryptAsync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  const expected = Buffer.from(hashHex, "hex");
  if (expected.length !== derived.length) return false;
  return timingSafeEqual(derived, expected);
}

/** Token phiên: random 32 bytes; DB chỉ lưu SHA-256 hash của token. */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

import { describe, expect, it, vi } from "vitest";
import {
  base32Decode,
  base32Encode,
  decryptTotpSecret,
  encryptTotpSecret,
  newTotpSecret,
  totpCode,
  verifyTotp,
} from "@/lib/server/totp";

// 2FA giờ lưu secret encrypted-at-rest — mọi test trong file cần key hợp lệ.
process.env.TOTP_ENCRYPTION_KEY = "a".repeat(64);

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { prisma } = await import("@/lib/server/prisma");
const { hashPassword } = await import("@/lib/server/password");
const { hashToken } = await import("@/lib/server/session");
const twofa = await import("@/lib/server/two-factor");

describe("TOTP primitives", () => {
  it("base32 round-trip", () => {
    const bytes = new Uint8Array([1, 2, 3, 250, 0, 255]);
    expect(base32Decode(base32Encode(bytes))).toEqual(bytes);
  });
  it("vector RFC 4226/6238: secret 12345678901234567890, counter 1 → 287082", () => {
    // Secret ASCII "12345678901234567890" = base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ
    const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
    expect(totpCode(secret, 59_000)).toBe("287082");
    expect(verifyTotp(secret, "287082", 59_000)).toBe(true);
    expect(verifyTotp(secret, "287083", 59_000)).toBe(false);
  });
  it("window ±1 bước: chấp nhận lệch 30s, từ chối lệch 90s", () => {
    const secret = newTotpSecret();
    const now = 1_000_000_000_000;
    const code = totpCode(secret, now);
    expect(verifyTotp(secret, code, now + 30_000)).toBe(true);
    expect(verifyTotp(secret, code, now - 30_000)).toBe(true);
    expect(verifyTotp(secret, code, now + 90_000)).toBe(false);
  });
});

describe("2FA setup → challenge → verify", () => {
  const EMAIL = "2fa-test@t.vn";

  it("full flow + backup code dùng 1 lần", async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: { email: EMAIL, name: "2fa", passwordHash: await hashPassword("matkhau-12345") },
    });
    const { secret } = await twofa.startTotpSetup(user.id);
    // Sai code → 422
    await expect(twofa.confirmTotpSetup(user.id, "000000")).rejects.toMatchObject({ status: 422 });
    const { backupCodes } = await twofa.confirmTotpSetup(user.id, totpCode(secret));
    expect(backupCodes).toHaveLength(8);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.totpEnabled).toBe(true);

    // Challenge + verify bằng TOTP
    const challenge = await twofa.createTotpChallenge(user.id);
    const me = await twofa.verifyTotpChallenge(challenge, totpCode(secret));
    expect(me.email).toBe(EMAIL);
    // Challenge dùng lại → 401
    await expect(twofa.verifyTotpChallenge(challenge, totpCode(secret))).rejects.toMatchObject({ status: 401 });

    // Backup code: dùng được 1 lần
    const challenge2 = await twofa.createTotpChallenge(user.id);
    await twofa.verifyTotpChallenge(challenge2, backupCodes[0]!);
    const remaining = (await prisma.user.findUnique({ where: { id: user.id } }))?.totpBackupCodes as string[];
    expect(remaining).toHaveLength(7);
    const challenge3 = await twofa.createTotpChallenge(user.id);
    await expect(twofa.verifyTotpChallenge(challenge3, backupCodes[0]!)).rejects.toMatchObject({ status: 422 });

    // Challenge hết hạn → 401
    const challenge4 = await twofa.createTotpChallenge(user.id);
    await prisma.totpChallenge.update({
      where: { tokenHash: (await import("node:crypto")).createHash("sha256").update(challenge4).digest("hex") },
      data: { expiresAt: new Date(0) },
    });
    await expect(twofa.verifyTotpChallenge(challenge4, totpCode(secret))).rejects.toMatchObject({ status: 401 });

    // Dọn rác
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.totpChallenge.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    expect(hashToken("x")).toHaveLength(64);
  });
});

describe("TOTP secret at-rest encryption", () => {
  const KEY = "a".repeat(64); // hex 64 ký tự = 32 byte
  const EMAIL = "2fa-enc-test@t.vn";

  it("lưu DB là ciphertext (v2:...), không chứa plaintext", async () => {
    process.env.TOTP_ENCRYPTION_KEY = KEY;
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: { email: EMAIL, name: "2fa-enc", passwordHash: await hashPassword("matkhau-12345") },
    });
    const { secret } = await twofa.startTotpSetup(user.id);
    const stored = (await prisma.user.findUnique({ where: { id: user.id } }))?.totpSecret ?? "";
    expect(stored.startsWith("v2:")).toBe(true);
    expect(stored).not.toContain(secret);
    // Round-trip: confirm bằng code sinh từ plaintext vẫn chạy được
    const { backupCodes } = await twofa.confirmTotpSetup(user.id, totpCode(secret));
    expect(backupCodes).toHaveLength(8);
    // Verify challenge dùng secret đã giải mã
    const challenge = await twofa.createTotpChallenge(user.id);
    const me = await twofa.verifyTotpChallenge(challenge, totpCode(secret));
    expect(me.email).toBe(EMAIL);
    await prisma.totpChallenge.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("sai key → giải mã fail, không trả plaintext", () => {
    process.env.TOTP_ENCRYPTION_KEY = KEY;
    const stored = encryptTotpSecret("GEZDGNBVGY3TQOJQ");
    process.env.TOTP_ENCRYPTION_KEY = "b".repeat(64);
    expect(() => decryptTotpSecret(stored)).toThrow();
    // Bản plaintext cũ (không prefix) đọc nguyên văn — backward compat
    expect(decryptTotpSecret("GEZDGNBVGY3TQOJQ")).toBe("GEZDGNBVGY3TQOJQ");
    delete process.env.TOTP_ENCRYPTION_KEY;
  });

  it("thiếu key → encrypt/decrypt throw (fail-closed)", () => {
    delete process.env.TOTP_ENCRYPTION_KEY;
    expect(() => encryptTotpSecret("X")).toThrow(/TOTP_ENCRYPTION_KEY/);
    expect(() => decryptTotpSecret("v2:00:00:00")).toThrow(/TOTP_ENCRYPTION_KEY/);
    process.env.TOTP_ENCRYPTION_KEY = KEY;
  });
});

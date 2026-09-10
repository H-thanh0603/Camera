import { describe, expect, it, vi } from "vitest";
import { base32Decode, base32Encode, newTotpSecret, totpCode, verifyTotp } from "@/lib/server/totp";

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

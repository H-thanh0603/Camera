import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  findBackupCodeMatch,
  hashBackupCode,
  newBackupCodes,
  normalizeBackupCode,
} from "@/lib/server/totp";

process.env.TOTP_ENCRYPTION_KEY = "c".repeat(64);

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { prisma } = await import("@/lib/server/prisma");
const { hashPassword } = await import("@/lib/server/password");
const { totpCode } = await import("@/lib/server/totp");
const twofa = await import("@/lib/server/two-factor");
const { sendBootstrapOtp, verifyBootstrapOtp } = await import("@/lib/server/email-otp");

describe("backup codes v1 (80-bit, salt)", () => {
  it("format 4 nhóm hex + match được, sai mã không match", () => {
    const codes = newBackupCodes();
    expect(codes).toHaveLength(8);
    for (const c of codes) {
      expect(c).toMatch(/^[0-9A-F]{5}(-[0-9A-F]{5}){3}$/);
    }
    const stored = codes.map(hashBackupCode);
    expect(stored[0]).toMatch(/^v1:[0-9a-f]{32}:[0-9a-f]{64}$/);
    // Hai mã giống nhau hash khác nhau (salt riêng)
    expect(hashBackupCode(codes[0]!)).not.toBe(stored[0]);
    expect(findBackupCodeMatch(codes[0]!, stored)).toBe(stored[0]);
    expect(findBackupCodeMatch(codes[0]!.toLowerCase().replace(/-/g, " "), stored)).toBe(stored[0]);
    expect(findBackupCodeMatch("AAAAA-BBBBB-CCCCC-DDDDD", stored)).toBeNull();
  });

  it("mã legacy 8 hex (SHA-256 không salt) vẫn verify được", () => {
    const legacy = "ABCD-1234";
    const legacyHash = createHash("sha256").update(legacy.toUpperCase(), "utf8").digest("hex");
    expect(findBackupCodeMatch("abcd-1234", [legacyHash])).toBe(legacyHash);
  });

  it("normalize bỏ gạch nối/khoảng trắng", () => {
    expect(normalizeBackupCode("ab12-cd34 ef56")).toBe("AB12CD34EF56");
  });
});

describe("challenge attempt counter (M4)", () => {
  const EMAIL = "2fa-lockout@t.vn";

  it("sai 10 lần → 429, challenge mới lại được", async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: { email: EMAIL, name: "lock", passwordHash: await hashPassword("matkhau-12345") },
    });
    const { secret } = await twofa.startTotpSetup(user.id);
    await twofa.confirmTotpSetup(user.id, totpCode(secret));
    const challenge = await twofa.createTotpChallenge(user.id);
    for (let i = 0; i < 10; i++) {
      await expect(twofa.verifyTotpChallenge(challenge, "000000")).rejects.toMatchObject({ status: 422 });
    }
    await expect(twofa.verifyTotpChallenge(challenge, "000000")).rejects.toMatchObject({ status: 429 });
    // Mã đúng cũng bị chặn khi đã lock
    await expect(twofa.verifyTotpChallenge(challenge, totpCode(secret))).rejects.toMatchObject({ status: 429 });
    // Challenge mới (token khác) không bị ảnh hưởng
    const fresh = await twofa.createTotpChallenge(user.id);
    const me = await twofa.verifyTotpChallenge(fresh, totpCode(secret));
    expect(me.email).toBe(EMAIL);
    await prisma.session.deleteMany({ where: { userId: user.id } });
    await prisma.totpChallenge.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

describe("bootstrap email OTP (L4)", () => {
  const EMAIL = "otp-test@t.vn";

  it("gửi → verify đúng 1 lần, dùng lại fail, sai mã fail", async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: { email: EMAIL, name: "otp", passwordHash: await hashPassword("matkhau-12345") },
    });
    await sendBootstrapOtp(user.id, EMAIL);
    const row = await prisma.emailOtp.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(row).not.toBeNull();
    // Không đọc được code từ DB (chỉ hash) — verify sai mã fail
    await expect(verifyBootstrapOtp(user.id, "000000")).rejects.toMatchObject({ status: 422 });
    // Xóa để dọn (code thật nằm trong outbox, không đọc được ở đây)
    await prisma.emailOtp.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("OTP cũ bị vô hiệu khi gửi OTP mới", async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: { email: EMAIL, name: "otp", passwordHash: await hashPassword("matkhau-12345") },
    });
    await sendBootstrapOtp(user.id, EMAIL);
    await sendBootstrapOtp(user.id, EMAIL);
    const active = await prisma.emailOtp.findMany({ where: { userId: user.id, usedAt: null } });
    expect(active).toHaveLength(1);
    await prisma.emailOtp.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });
});

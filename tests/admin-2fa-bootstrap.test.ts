import { describe, expect, it, vi } from "vitest";

process.env.TOTP_ENCRYPTION_KEY = "b".repeat(64);

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { prisma } = await import("@/lib/server/prisma");
const { hashPassword } = await import("@/lib/server/password");
const { totpCode } = await import("@/lib/server/totp");
const twofa = await import("@/lib/server/two-factor");

describe("admin 2FA bootstrap qua challenge (không session)", () => {
  const EMAIL = "admin-bootstrap@t.vn";

  it("resolveTotpChallenge trả user khi challenge hợp lệ, 401 khi sai", async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: { email: EMAIL, name: "admin boot", passwordHash: await hashPassword("matkhau-12345"), role: "admin" },
    });
    const token = await twofa.createTotpChallenge(user.id);
    const resolved = await twofa.resolveTotpChallenge(token);
    expect(resolved.id).toBe(user.id);
    await expect(twofa.resolveTotpChallenge("sai-hoan-toan")).rejects.toMatchObject({ status: 401 });
  });

  it("setup + confirm bằng challenge bootstrap bật được 2FA cho admin", async () => {
    const user = (await prisma.user.findUnique({ where: { email: EMAIL } }))!;
    // startTotpSetup cần userId (route setup resolve từ challenge trước khi gọi)
    const { secret } = await twofa.startTotpSetup(user.id);
    const { backupCodes } = await twofa.confirmTotpSetup(user.id, totpCode(secret));
    expect(backupCodes).toHaveLength(8);
    expect((await prisma.user.findUnique({ where: { id: user.id } }))?.totpEnabled).toBe(true);
  });
});

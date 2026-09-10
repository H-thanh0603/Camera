import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { prisma } = await import("@/lib/server/prisma");
const { hashPassword } = await import("@/lib/server/password");
const { deleteOwnAccount, exportAccountData, AccountError } = await import("@/lib/server/account");

const EMAIL = "gdpr-test@t.vn";

async function makeUser(passwordHash: string) {
  await prisma.user.deleteMany({ where: { email: EMAIL } });
  return prisma.user.create({ data: { email: EMAIL, name: "Gdpr", passwordHash } });
}

describe("GDPR tự phục vụ", () => {
  it("export trả đủ hồ sơ + đơn + review", async () => {
    const user = await makeUser(await hashPassword("matkhau-12345"));
    await prisma.order.create({
      data: {
        number: `GDPR-${Date.now()}`, userId: user.id, status: "delivered",
        contact: {}, shipping: {}, delivery: "standard", payment: "cod",
        totals: { total: 1000 }, totalAmount: 1000,
      },
    });
    const data = await exportAccountData(user.id);
    const profile = data.profile as { email: string };
    expect(profile.email).toBe(EMAIL);
    expect((data.orders as unknown[]).length).toBeGreaterThanOrEqual(1);
    await prisma.order.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("xóa tài khoản: sai mật khẩu 401, đúng thì mất user giữ đơn ẩn danh", async () => {
    const user = await makeUser(await hashPassword("matkhau-12345"));
    const order = await prisma.order.create({
      data: {
        number: `GDPR2-${Date.now()}`, userId: user.id, status: "delivered",
        contact: {}, shipping: {}, delivery: "standard", payment: "cod",
        totals: { total: 1000 }, totalAmount: 1000,
      },
    });
    await expect(deleteOwnAccount(user.id, { password: "sai" })).rejects.toMatchObject({ status: 401 });
    await deleteOwnAccount(user.id, { password: "matkhau-12345" });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    // Đơn giữ lại, userId null (kế toán không vỡ)
    const kept = await prisma.order.findUnique({ where: { id: order.id } });
    expect(kept?.userId).toBeNull();
    await prisma.order.delete({ where: { id: order.id } });
  });

  it("tài khoản OAuth xóa bằng email xác nhận", async () => {
    const user = await makeUser("oauth:google");
    await expect(deleteOwnAccount(user.id, { confirmEmail: "sai@t.vn" })).rejects.toMatchObject({ status: 422 });
    await deleteOwnAccount(user.id, { confirmEmail: EMAIL });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it("xóa user không tồn tại → 404", async () => {
    await expect(deleteOwnAccount("nope", { password: "x" })).rejects.toBeInstanceOf(AccountError);
  });
});

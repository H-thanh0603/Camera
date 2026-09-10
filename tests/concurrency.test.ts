import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createHash, randomBytes } from "node:crypto";

/**
 * Phase 0.6: concurrency acceptance trên dev.db.
 * - oversell: 2 đơn vét kho → 1 thắng, stock không âm
 * - coupon maxUses=1 → 1 thắng, usedCount=1
 * - idempotency: trùng key (tuần tự + song song) → 1 đơn duy nhất
 * - reset token: dùng 2 lần song song → 1 thắng
 * Dọn rác sau mỗi test. SQLite serialize writer → retry + timeout dài.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { prisma } = await import("@/lib/server/prisma");
const { placeOrderServer, OrderValidationError } = await import("@/lib/server/place-order");
const { PasswordResetError, resetPasswordWithToken } = await import("@/lib/server/password-reset");

const PID = "p-test-concurrency";
const CONTACT = { fullName: "Test User", email: "t@t.vn", phone: "0901234567" };
const SHIPPING = { address: "1 Test", ward: "P1", district: "Q1", city: "HCM" };

async function makeProduct(stock: number) {
  await prisma.product.upsert({
    where: { id: PID },
    update: { stock },
    create: {
      id: PID, sku: "TEST-CONC", slug: "test-concurrency", name: "SP test",
      brand: "Test", category: "camera", subcategory: "Test",
      description: "x", shortDescription: "x", price: 1000, stock,
      availability: "in_stock", images: [], thumbnail: { url: "", alt: "" },
      specifications: {}, rating: 0, reviewCount: 0, tags: [], badges: [],
    },
  });
}

function draft(qty: number, extra: Record<string, unknown> = {}) {
  return {
    contact: CONTACT, shipping: SHIPPING, delivery: "standard", payment: "cod",
    lines: [{ productId: PID, quantity: qty }],
    ...extra,
  } as Parameters<typeof placeOrderServer>[0];
}

async function cleanup() {
  await prisma.orderLine.deleteMany({ where: { productId: PID } });
  await prisma.order.deleteMany({ where: { lines: { none: {} } } });
  await prisma.coupon.deleteMany({ where: { code: { startsWith: "TST" } } });
  await prisma.product.deleteMany({ where: { id: PID } });
}

beforeAll(async () => cleanup());
afterEach(async () => cleanup());

async function stockOf(): Promise<number> {
  return (await prisma.product.findUnique({ where: { id: PID } }))?.stock ?? -1;
}

describe("concurrency", () => {
  it("oversell: 2 đơn qty2 trên kho 3 → 1 thắng, kho còn 1", { timeout: 60000 }, async () => {
    await makeProduct(3);
    const results = await Promise.allSettled([placeOrderServer(draft(2)), placeOrderServer(draft(2))]);
    const won = results.filter((r) => r.status === "fulfilled").length;
    const lost = results.filter((r) => r.status === "rejected" && r.reason instanceof OrderValidationError).length;
    expect(won).toBe(1);
    expect(lost).toBe(1);
    expect(await stockOf()).toBe(1);
  });

  it("coupon maxUses=1: 2 đơn song song → 1 thắng, usedCount=1", { timeout: 60000 }, async () => {
    await makeProduct(10);
    await prisma.coupon.create({
      data: { code: "TST1", kind: "percent", value: 10, minSubtotal: 0, maxUses: 1, active: true },
    });
    const results = await Promise.allSettled([
      placeOrderServer(draft(1, { couponCode: "TST1" })),
      placeOrderServer(draft(1, { couponCode: "TST1" })),
    ]);
    const won = results.filter((r) => r.status === "fulfilled").length;
    expect(won).toBe(1);
    expect((await prisma.coupon.findUnique({ where: { code: "TST1" } }))?.usedCount).toBe(1);
  });

  it("idempotency tuần tự: trùng key + token → cùng 1 đơn", { timeout: 30000 }, async () => {
    await makeProduct(10);
    const key = `tst-${Date.now()}`;
    const token = "a".repeat(32);
    const a = await placeOrderServer(draft(1, { idempotencyKey: key, guestToken: token }));
    const b = await placeOrderServer(draft(1, { idempotencyKey: key, guestToken: token }));
    expect(b.id).toBe(a.id);
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
  });

  it("idempotency: trùng key nhưng sai token → 403 (chống chiếm đơn)", { timeout: 30000 }, async () => {
    await makeProduct(10);
    const key = `tst-hijack-${Date.now()}`;
    await placeOrderServer(draft(1, { idempotencyKey: key, guestToken: "b".repeat(32) }));
    const { OrderForbidden } = await import("@/lib/server/order-mapper");
    await expect(placeOrderServer(draft(1, { idempotencyKey: key, guestToken: "c".repeat(32) }))).rejects.toBeInstanceOf(
      OrderForbidden,
    );
  });

  it("idempotency song song: 5 request cùng key → 1 đơn duy nhất", { timeout: 60000 }, async () => {
    await makeProduct(10);
    const key = `tst-conc-${Date.now()}`;
    const token = "d".repeat(32);
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => placeOrderServer(draft(1, { idempotencyKey: key, guestToken: token }))),
    );
    const ids = new Set(
      results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ id: string }>).value.id),
    );
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    expect(ids.size).toBe(1);
    // Kho chỉ trừ đúng 1 lần (tx thua rollback khi P2002)
    expect(await stockOf()).toBe(9);
  });

  it("reset token dùng 2 lần song song → 1 thắng", { timeout: 30000 }, async () => {
    const email = `conc-${Date.now()}@t.vn`;
    const { hashPassword } = await import("@/lib/server/password");
    const user = await prisma.user.create({
      data: { email, name: "Conc", passwordHash: await hashPassword("old-password-1") },
    });
    try {
      const raw = randomBytes(32).toString("hex");
      await prisma.passwordResetToken.create({
        data: {
          tokenHash: createHash("sha256").update(raw).digest("hex"),
          userId: user.id,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      const results = await Promise.allSettled([
        resetPasswordWithToken(raw, "new-password-1"),
        resetPasswordWithToken(raw, "new-password-2"),
      ]);
      const won = results.filter((r) => r.status === "fulfilled").length;
      const lost = results.filter((r) => r.status === "rejected" && r.reason instanceof PasswordResetError).length;
      expect(won).toBe(1);
      expect(lost).toBe(1);
    } finally {
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await prisma.session.deleteMany({ where: { userId: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
});

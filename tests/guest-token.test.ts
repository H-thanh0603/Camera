import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { hashGuestToken, newGuestToken, verifyGuestToken } = await import("@/lib/server/guest-token");
const { prisma } = await import("@/lib/server/prisma");
const { placeOrderServer } = await import("@/lib/server/place-order");
const { getGuestOrderByNumber, getOwnOrder, OrderForbidden } = await import("@/lib/server/order-mapper");

const PID = "p-test-guest-token";
const CONTACT = { fullName: "Guest User", email: "guest@t.vn", phone: "0901234567" };
const SHIPPING = { address: "1 Test", ward: "P1", district: "Q1", city: "HCM" };

describe("guest token crypto", () => {
  it("sinh token duy nhất, verify đúng/sai chuẩn", () => {
    const a = newGuestToken();
    const b = newGuestToken();
    expect(a).not.toBe(b);
    expect(a).toHaveLength(64);
    const hash = hashGuestToken(a);
    expect(verifyGuestToken(a, hash)).toBe(true);
    expect(verifyGuestToken(b, hash)).toBe(false);
    expect(verifyGuestToken("", hash)).toBe(false);
    expect(verifyGuestToken(a, null)).toBe(false);
  });
});

describe("guest order authorization", () => {
  it("không token → 403; đúng token → xem được; sai token → 403", async () => {
    await prisma.product.upsert({
      where: { id: PID },
      update: { stock: 5 },
      create: {
        id: PID, sku: "TEST-GUEST", slug: "test-guest-token", name: "SP test guest",
        brand: "Test", category: "camera", subcategory: "Test",
        description: "x", shortDescription: "x", price: 1000, stock: 5,
        availability: "in_stock", images: [], thumbnail: { url: "", alt: "" },
        specifications: {}, rating: 0, reviewCount: 0, tags: [], badges: [],
      },
    });
    const raw = newGuestToken();
    const order = await placeOrderServer({
      contact: CONTACT, shipping: SHIPPING, delivery: "standard", payment: "cod",
      lines: [{ productId: PID, quantity: 1 }],
      idempotencyKey: `guest-${Date.now()}`,
      guestToken: raw,
    });
    expect(order.guestToken).toBe(raw);

    // DB chỉ lưu hash, không lưu raw
    const row = await prisma.order.findUnique({ where: { id: order.id } });
    expect(row?.guestTokenHash).toBe(hashGuestToken(raw));
    expect(JSON.stringify(row)).not.toContain(raw);

    await expect(getOwnOrder(order.id)).rejects.toBeInstanceOf(OrderForbidden);
    await expect(getOwnOrder(order.id, "sai-token-00000000000000000000000000")).rejects.toBeInstanceOf(
      OrderForbidden,
    );
    const own = await getOwnOrder(order.id, raw);
    expect(own?.number).toBe(order.number);

    // Tra cứu bằng mã đơn + token
    expect((await getGuestOrderByNumber(order.number, raw))?.id).toBe(order.id);
    expect(await getGuestOrderByNumber(order.number, "sai")).toBeNull();

    // Dọn rác
    await prisma.orderLine.deleteMany({ where: { orderId: order.id } });
    await prisma.order.deleteMany({ where: { id: order.id } });
    await prisma.product.deleteMany({ where: { id: PID } });
  });
});

import { describe, expect, it, vi } from "vitest";
import { shippingSchema } from "@/lib/schemas";
import { isCarrier, isTrackingCode } from "@/lib/server/shipping";

const { currentToken } = vi.hoisted(() => ({ currentToken: { value: undefined as string | undefined } }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "lumina.session" && currentToken.value ? { value: currentToken.value } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
}));

const { prisma } = await import("@/lib/server/prisma");
const { hashToken } = await import("@/lib/server/session");
const { PATCH } = await import("@/app/api/admin/orders/[id]/route");

const BASE_SHIPPING = { address: "1 Test", ward: "P1", district: "Q1", city: "HCM" };

describe("VAT schema", () => {
  it("không VAT pass; thiếu 1 trường VAT lỗi; MST sai lỗi", () => {
    expect(shippingSchema.safeParse(BASE_SHIPPING).success).toBe(true);
    const partial = shippingSchema.safeParse({ ...BASE_SHIPPING, companyName: "Cty A" });
    expect(partial.success).toBe(false);
    const badTax = shippingSchema.safeParse({
      ...BASE_SHIPPING, companyName: "Cty A", taxCode: "123", companyAddress: "HCM",
    });
    expect(badTax.success).toBe(false);
    const ok = shippingSchema.safeParse({
      ...BASE_SHIPPING, companyName: "Cty A", taxCode: "0312345678", companyAddress: "HCM",
    });
    expect(ok.success).toBe(true);
    const branch = shippingSchema.safeParse({
      ...BASE_SHIPPING, companyName: "Cty A", taxCode: "0312345678-001", companyAddress: "HCM",
    });
    expect(branch.success).toBe(true);
  });
});

describe("shipping helpers", () => {
  it("tracking code + carrier validate đúng", () => {
    expect(isTrackingCode("GHN-ABC123")).toBe(true);
    expect(isTrackingCode("ab")).toBe(false);
    expect(isTrackingCode("ABC 123")).toBe(false);
    expect(isCarrier("ghn")).toBe(true);
    expect(isCarrier("ghtk")).toBe(true);
    expect(isCarrier("manual")).toBe(true);
    expect(isCarrier("dhl")).toBe(false);
  });
});

describe("admin tracking PATCH", () => {
  it("anonymous 403; admin lưu vận đơn ok; mã sai 422", async () => {
    const { randomBytes } = await import("node:crypto");
    const admin = await prisma.user.create({
      data: { email: `ship-admin-${Date.now()}@t.vn`, name: "Ship", passwordHash: "x", role: "admin" },
    });
    const raw = randomBytes(32).toString("hex");
    await prisma.session.create({
      data: { tokenHash: hashToken(raw), userId: admin.id, expiresAt: new Date(Date.now() + 3600_000) },
    });
    const order = await prisma.order.create({
      data: {
        number: `SHIP-${Date.now()}`, userId: null, status: "processing",
        contact: {}, shipping: {}, delivery: "standard", payment: "cod",
        totals: { total: 1000 }, totalAmount: 1000,
      },
    });
    const req = (body: unknown) =>
      new Request(`http://localhost/api/admin/orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }) as unknown as Parameters<typeof PATCH>[0];

    // Chưa login → 403
    currentToken.value = undefined;
    expect((await PATCH(req({ trackingCode: "GHN-1" }), { params: Promise.resolve({ id: order.id }) })).status).toBe(403);

    // Admin lưu vận đơn
    currentToken.value = raw;
    const okRes = await PATCH(req({ trackingCode: "GHN-ABC123", carrier: "ghn" }), {
      params: Promise.resolve({ id: order.id }),
    });
    expect(okRes.status).toBe(200);
    expect((await prisma.order.findUnique({ where: { id: order.id } }))?.trackingCode).toBe("GHN-ABC123");

    // Mã sai → 422
    const bad = await PATCH(req({ trackingCode: "!!" }), { params: Promise.resolve({ id: order.id }) });
    expect(bad.status).toBe(422);
    const badCarrier = await PATCH(req({ carrier: "dhl" }), { params: Promise.resolve({ id: order.id }) });
    expect(badCarrier.status).toBe(422);

    await prisma.order.delete({ where: { id: order.id } });
    await prisma.session.deleteMany({ where: { userId: admin.id } });
    await prisma.user.delete({ where: { id: admin.id } });
    currentToken.value = undefined;
  });
});

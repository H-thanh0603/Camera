import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/server/prisma";
import { CancelConflict, completeCancel } from "@/lib/server/cancel-order";

/**
 * Phase 0.2 acceptance: 20 cancel đồng thời 1 đơn → đúng 1 thắng,
 * stock hoàn đúng 1 lần. Dọn rác sau test.
 */
const PID = "p-test-cancel-race";

async function stockOf(): Promise<number> {
  const p = await prisma.product.findUnique({ where: { id: PID } });
  return p?.stock ?? -1;
}

async function makeOrder(): Promise<string> {
  await prisma.product.upsert({
    where: { id: PID },
    update: { stock: 100 },
    create: {
      id: PID,
      sku: "TEST-CANCEL",
      slug: "test-cancel-race",
      name: "SP test cancel",
      brand: "Test",
      category: "camera",
      subcategory: "Test",
      description: "x",
      shortDescription: "x",
      price: 1000,
      stock: 100,
      availability: "in_stock",
      images: [],
      thumbnail: { url: "", alt: "" },
      specifications: {},
      rating: 0,
      reviewCount: 0,
      tags: [],
      badges: [],
    },
  });
  const order = await prisma.order.create({
    data: {
      number: `TST-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      status: "pending",
      currentStep: "confirmed",
      contact: {},
      shipping: {},
      delivery: "standard",
      payment: "cod",
      totals: { total: 2000 },
      lines: {
        create: [{ productId: PID, name: "SP test", unitPrice: 1000, quantity: 2, image: "", sku: "TEST-CANCEL" }],
      },
    },
  });
  return order.id;
}

afterEach(async () => {
  await prisma.orderLine.deleteMany({ where: { productId: PID } });
  await prisma.order.deleteMany({ where: { lines: { none: {} } } });
  await prisma.product.deleteMany({ where: { id: PID } });
});

describe("completeCancel race", () => {
  // SQLite serialize writer transactions — cần timeout dài cho 20 tx song song
  it("20 cancel song song → 1 thắng, stock +2 đúng một lần", { timeout: 60000 }, async () => {
    const id = await makeOrder();
    // Retry khi SQLite socket-timeout (artifact single-writer của SQLite;
    // trên Postgres row-lock xếp hàng đúng). Claim idempotent theo status
    // nên retry request đã thắng cũng chỉ trả CancelConflict.
    const attempt = async (): Promise<void> => {
      let last: unknown;
      for (let i = 0; i < 15; i++) {
        try {
          await completeCancel(id);
          return;
        } catch (e) {
          if (e instanceof CancelConflict) throw e;
          last = e;
          await new Promise((r) => setTimeout(r, 50));
        }
      }
      throw last;
    };
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => attempt()));
    const won = results.filter((r) => r.status === "fulfilled").length;
    const lost = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof CancelConflict,
    ).length;
    expect(won).toBe(1);
    expect(lost).toBe(19);
    expect(await stockOf()).toBe(102);
    const order = await prisma.order.findUnique({ where: { id } });
    expect(order?.status).toBe("cancelled");
  });

  it("đơn đã shipped → CancelConflict, stock giữ nguyên", async () => {
    const id = await makeOrder();
    await prisma.order.update({ where: { id }, data: { status: "shipped" } });
    await expect(completeCancel(id)).rejects.toBeInstanceOf(CancelConflict);
    expect(await stockOf()).toBe(100);
  });
});

import { afterAll, describe, expect, it } from "vitest";
import { handlePaymentWebhook, signWebhookPayload, verifyWebhookSignature } from "@/lib/server/payments";

const { prisma } = await import("@/lib/server/prisma");

describe("payment webhook signature", () => {
  const secret = "test-secret-16-chars-min";
  const body = JSON.stringify({ provider: "vnpay", eventId: "e1", orderNumber: "LUM-1", amount: 1000, status: "paid", timestamp: 1 });

  it("verify đúng chữ ký tự tạo", () => {
    expect(verifyWebhookSignature(body, signWebhookPayload(body, secret), secret)).toBe(true);
  });

  it("từ chối body bị sửa", () => {
    const sig = signWebhookPayload(body, secret);
    expect(verifyWebhookSignature(body + " ", sig, secret)).toBe(false);
  });

  it("từ chối secret sai", () => {
    const sig = signWebhookPayload(body, secret);
    expect(verifyWebhookSignature(body, sig, "secret-khac-hoan-toan-123")).toBe(false);
  });

  it("từ chối chữ ký rỗng / rác", () => {
    expect(verifyWebhookSignature(body, "", secret)).toBe(false);
    expect(verifyWebhookSignature(body, "not-hex", secret)).toBe(false);
  });
});

describe("handlePaymentWebhook (dedupe + claim + đối soát)", () => {
  const NUMBER = "LUM-WH-TEST";
  const EVENT = (n: string) => `evt-${n}`;

  async function makeOrder(amount = 500_000): Promise<string> {
    await prisma.order.deleteMany({ where: { number: NUMBER } });
    await prisma.paymentEvent.deleteMany({ where: { orderNumber: NUMBER } });
    await prisma.product.deleteMany({ where: { id: "wh-test-p" } });
    await prisma.product.create({
      data: {
        id: "wh-test-p",
        sku: "WH-TEST-SKU",
        slug: "wh-test",
        name: "WH Test",
        brand: "b",
        category: "c",
        subcategory: "s",
        description: "d",
        shortDescription: "d",
        price: 100_000,
        stock: 5,
        images: [],
        thumbnail: {},
        specifications: {},
        tags: [],
        badges: [],
      },
    });
    const order = await prisma.order.create({
      data: {
        number: NUMBER,
        status: "pending",
        delivery: "standard",
        payment: "vnpay",
        totalAmount: amount,
        totals: { total: amount, subtotal: amount, shipping: 0 } as object,
        contact: {} as object,
        shipping: {} as object,
        lines: {
          create: [{ productId: "wh-test-p", name: "WH Test", unitPrice: 100_000, quantity: 5, image: "", sku: "WH-TEST-SKU" }],
        },
      },
    });
    return order.id;
  }

  it("webhook paid đúng tiền → pending→paid, không deduped", async () => {
    const orderId = await makeOrder();
    const out = await handlePaymentWebhook({
      provider: "vnpay", eventId: EVENT("1"), orderNumber: NUMBER, amount: 500_000, status: "paid", timestamp: Math.floor(Date.now() / 1000),
    });
    expect(out.deduped).toBe(false);
    expect(out.status).toBe("paid");
    expect((await prisma.order.findUnique({ where: { id: orderId } }))?.status).toBe("paid");
  });

  it("replay cùng eventId → deduped, không áp dụng lại", async () => {
    const out = await handlePaymentWebhook({
      provider: "vnpay", eventId: EVENT("1"), orderNumber: NUMBER, amount: 500_000, status: "paid", timestamp: Math.floor(Date.now() / 1000),
    });
    expect(out.deduped).toBe(true);
    expect(out.status).toBe("paid");
  });

  it("2 webhook song song cùng event → đúng 1 bên apply", async () => {
    await makeOrder();
    const input = (): Parameters<typeof handlePaymentWebhook>[0] => ({
      provider: "vnpay", eventId: EVENT("race"), orderNumber: NUMBER, amount: 500_000, status: "paid", timestamp: Math.floor(Date.now() / 1000),
    });
    const results = await Promise.allSettled([handlePaymentWebhook(input()), handlePaymentWebhook(input())]);
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok.length).toBeGreaterThanOrEqual(1);
    const deduped = ok.filter((r) => r.status === "fulfilled" && r.value.deduped).length;
    const applied = ok.filter((r) => r.status === "fulfilled" && !r.value.deduped).length;
    expect(applied).toBe(1);
    expect(deduped).toBe(ok.length - 1);
  });

  it("sai số tiền → 400, order giữ pending", async () => {
    await makeOrder();
    await expect(
      handlePaymentWebhook({
        provider: "vnpay", eventId: EVENT("2"), orderNumber: NUMBER, amount: 999_999, status: "paid", timestamp: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toMatchObject({ status: 400 });
    const order = await prisma.order.findUnique({ where: { number: NUMBER } });
    expect(order?.status).toBe("pending");
  });

  it("timestamp lệch quá 5 phút → 400", async () => {
    await makeOrder();
    await expect(
      handlePaymentWebhook({
        provider: "vnpay", eventId: EVENT("3"), orderNumber: NUMBER, amount: 500_000, status: "paid", timestamp: Math.floor(Date.now() / 1000) - 3600,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("webhook failed → order vẫn pending (cho khách thanh toán lại)", async () => {
    await makeOrder();
    const out = await handlePaymentWebhook({
      provider: "vnpay", eventId: EVENT("4"), orderNumber: NUMBER, amount: 500_000, status: "failed", timestamp: Math.floor(Date.now() / 1000),
    });
    expect(out.deduped).toBe(false);
    expect((await prisma.order.findUnique({ where: { number: NUMBER } }))?.status).toBe("pending");
  });

  it("không tìm đơn → 404", async () => {
    await prisma.paymentEvent.deleteMany({ where: { orderNumber: "LUM-KHONG-TON-TAI" } });
    await expect(
      handlePaymentWebhook({
        provider: "vnpay", eventId: EVENT("404"), orderNumber: "LUM-KHONG-TON-TAI", amount: 1, status: "paid", timestamp: Math.floor(Date.now() / 1000),
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("provider không khớp phương thức đơn → 400, không claim event", async () => {
    await makeOrder(); // payment = vnpay
    await expect(
      handlePaymentWebhook(
        {
          provider: "momo", eventId: EVENT("bind"), orderNumber: NUMBER, amount: 500_000, status: "paid", timestamp: Math.floor(Date.now() / 1000),
        },
        undefined,
        "momo",
      ),
    ).rejects.toMatchObject({ status: 400 });
    // Không claim — retry đúng cổng vẫn chạy được
    expect(await prisma.paymentEvent.findFirst({ where: { orderNumber: NUMBER, eventId: EVENT("bind") } })).toBeNull();
  });

  it("paid trùng vào đơn đã paid → deduped + audit overpaid_needs_refund", async () => {
    const orderId = await makeOrder();
    await handlePaymentWebhook({
      provider: "vnpay", eventId: EVENT("first"), orderNumber: NUMBER, amount: 500_000, status: "paid", timestamp: Math.floor(Date.now() / 1000),
    });
    const out = await handlePaymentWebhook({
      provider: "vnpay", eventId: EVENT("second"), orderNumber: NUMBER, amount: 500_000, status: "paid", timestamp: Math.floor(Date.now() / 1000),
    });
    expect(out.deduped).toBe(true);
    expect(out.status).toBe("paid");
    const audit = await prisma.auditLog.findFirst({
      where: { targetId: orderId, action: "order.overpaid_needs_refund" },
    });
    expect(audit).not.toBeNull();
  });

  it("IPN cho đơn đã hủy → không hồi sinh, deduped", async () => {
    await makeOrder();
    await prisma.order.update({ where: { number: NUMBER }, data: { status: "cancelled" } });
    const out = await handlePaymentWebhook({
      provider: "vnpay", eventId: EVENT("5"), orderNumber: NUMBER, amount: 500_000, status: "paid", timestamp: Math.floor(Date.now() / 1000),
    });
    expect(out.deduped).toBe(true);
    expect((await prisma.order.findUnique({ where: { number: NUMBER } }))?.status).toBe("cancelled");
  });

  afterAll(async () => {
    await prisma.paymentEvent.deleteMany({ where: { orderNumber: NUMBER } });
    await prisma.orderLine.deleteMany({ where: { order: { number: NUMBER } } });
    await prisma.order.deleteMany({ where: { number: NUMBER } });
    await prisma.product.deleteMany({ where: { id: "wh-test-p" } });
  });
});

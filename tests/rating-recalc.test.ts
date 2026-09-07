import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/server/prisma";
import { recalcProductRating } from "@/lib/server/ratings";

/**
 * Phase 0.1 acceptance: duyệt/unapprove lặp lại → rating/reviewCount hội tụ,
 * không phình (fix drift cũ dùng reviewCount đã cộng dồn làm seed).
 * Dùng SP + review rác trên dev.db, dọn sau mỗi test.
 */
const PID = "p-test-rating-drift";

afterEach(async () => {
  await prisma.review.deleteMany({ where: { productId: PID } });
  await prisma.product.deleteMany({ where: { id: PID } });
});

async function makeProduct() {
  await prisma.product.create({
    data: {
      id: PID,
      sku: "TEST-RATING",
      slug: "test-rating-drift",
      name: "SP test rating",
      brand: "Test",
      category: "camera",
      subcategory: "Test",
      description: "x",
      shortDescription: "x",
      price: 1000,
      stock: 10,
      availability: "in_stock",
      images: [],
      thumbnail: { url: "", alt: "" },
      specifications: {},
      rating: 4.5,
      reviewCount: 10,
      seedCount: 10,
      seedTotal: 45,
      tags: [],
      badges: [],
    },
  });
}

describe("recalcProductRating idempotent", () => {
  it("gọi 10 lần liên tiếp không đổi kết quả", async () => {
    await makeProduct();
    const r = await prisma.review.create({
      data: { productId: PID, author: "T", rating: 5, title: "t1234", body: "nội dung review đủ dài...", approved: true },
    });
    for (let i = 0; i < 10; i++) {
      await recalcProductRating(PID);
    }
    const p = await prisma.product.findUnique({ where: { id: PID } });
    // (45 + 5) / (10 + 1) = 4.545... → 4.5
    expect(p?.reviewCount).toBe(11);
    expect(p?.rating).toBe(4.5);
    await prisma.review.delete({ where: { id: r.id } });
  });

  it("approve → unapprove → approve hội tụ về cùng giá trị", async () => {
    await makeProduct();
    const r = await prisma.review.create({
      data: { productId: PID, author: "T", rating: 1, title: "t1234", body: "nội dung review đủ dài...", approved: false },
    });
    await prisma.review.update({ where: { id: r.id }, data: { approved: true } });
    await recalcProductRating(PID);
    const afterApprove = await prisma.product.findUnique({ where: { id: PID } });

    await prisma.review.update({ where: { id: r.id }, data: { approved: false } });
    await recalcProductRating(PID);
    const afterUnapprove = await prisma.product.findUnique({ where: { id: PID } });

    await prisma.review.update({ where: { id: r.id }, data: { approved: true } });
    await recalcProductRating(PID);
    const again = await prisma.product.findUnique({ where: { id: PID } });

    expect(afterUnapprove?.reviewCount).toBe(10);
    expect(afterUnapprove?.rating).toBe(4.5);
    expect(again?.reviewCount).toBe(afterApprove?.reviewCount);
    expect(again?.rating).toBe(afterApprove?.rating);
    await prisma.review.delete({ where: { id: r.id } });
  });
});

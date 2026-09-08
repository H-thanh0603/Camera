import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Review có ảnh + thưởng coupon: idempotency + điều kiện thưởng.
 * Dọn rác sau mỗi test.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));

const { prisma } = await import("@/lib/server/prisma");
const { grantPhotoReviewReward } = await import("@/app/api/admin/reviews/[id]/route");

const createdReviewIds: string[] = [];
const createdCouponCodes: string[] = [];

afterEach(async () => {
  if (createdCouponCodes.length) {
    await prisma.coupon.deleteMany({ where: { code: { in: createdCouponCodes } } });
    createdCouponCodes.length = 0;
  }
  if (createdReviewIds.length) {
    await prisma.review.deleteMany({ where: { id: { in: createdReviewIds } } });
    createdReviewIds.length = 0;
  }
});

async function makeReview(overrides: Record<string, unknown> = {}) {
  const r = await prisma.review.create({
    data: {
      productId: "p-lumina-x1",
      author: "Tester",
      rating: 5,
      title: "Tuyệt vời",
      body: "Nội dung đánh giá đủ dài để hợp lệ.",
      approved: true,
      verified: false,
      photos: [],
      ...overrides,
    },
  });
  createdReviewIds.push(r.id);
  return r;
}

describe("grantPhotoReviewReward", () => {
  it("không ảnh → không thưởng", async () => {
    const admin = await prisma.user.findUnique({ where: { email: "admin@lumina.vn" } });
    const r = await makeReview({ userId: admin?.id ?? null, photos: [] });
    expect(await grantPhotoReviewReward(r.id)).toBeNull();
  });

  it("guest (không userId) có ảnh → không thưởng", async () => {
    const r = await makeReview({ userId: null, photos: ["https://x/y.jpg"] });
    expect(await grantPhotoReviewReward(r.id)).toBeNull();
  });

  it("user + ảnh → coupon 5%/1 lượt/HSD 30 ngày + idempotent", async () => {
    const admin = await prisma.user.findUnique({ where: { email: "admin@lumina.vn" } });
    expect(admin).toBeTruthy();
    const r = await makeReview({ userId: admin!.id, photos: ["https://x/y.jpg"] });
    const code = await grantPhotoReviewReward(r.id);
    expect(code).toMatch(/^RVW-[0-9A-F]{8}$/);
    createdCouponCodes.push(code!);
    const coupon = await prisma.coupon.findUnique({ where: { code: code! } });
    expect(coupon).toMatchObject({ kind: "percent", value: 5, maxUses: 1, active: true });
    expect(coupon!.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);
    // Duyệt lại → không tạo trùng
    expect(await grantPhotoReviewReward(r.id)).toBe(code);
    expect(await prisma.coupon.count({ where: { code: code! } })).toBe(1);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/server/prisma";
import { couponCodeOfTotals, releaseCouponUsage } from "@/lib/server/coupons";

afterEach(async () => {
  await prisma.coupon.deleteMany({ where: { code: { startsWith: "TSTREL" } } });
});

describe("releaseCouponUsage", () => {
  it("hoàn lượt và floor 0", async () => {
    await prisma.coupon.create({
      data: { code: "TSTREL1", kind: "percent", value: 10, minSubtotal: 0, active: true, usedCount: 1 },
    });
    await releaseCouponUsage("TSTREL1");
    expect((await prisma.coupon.findUnique({ where: { code: "TSTREL1" } }))?.usedCount).toBe(0);
    await releaseCouponUsage("TSTREL1");
    expect((await prisma.coupon.findUnique({ where: { code: "TSTREL1" } }))?.usedCount).toBe(0);
  });

  it("couponCodeOfTotals đọc mã từ snapshot", () => {
    expect(couponCodeOfTotals({ total: 100, couponCode: "LUMINA10" })).toBe("LUMINA10");
    expect(couponCodeOfTotals({ total: 100 })).toBeNull();
    expect(couponCodeOfTotals(null)).toBeNull();
  });
});

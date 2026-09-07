import { describe, expect, it } from "vitest";
import { applyCouponToSubtotal, normalizeCouponCode } from "@/lib/services/coupon-service";

describe("coupon-service", () => {
  it("chuẩn hoá mã (lowercase, trim)", () => {
    expect(normalizeCouponCode("  lumina10 ")).toBe("LUMINA10");
  });

  it("percent tính đúng 10% subtotal", () => {
    const r = applyCouponToSubtotal(10_000_000, {
      code: "LUMINA10",
      kind: "percent",
      value: 10,
      minSubtotal: 5_000_000,
      active: true,
    });
    expect(r.discount).toBe(1_000_000);
  });

  it("từ chối khi chưa đạt minSubtotal", () => {
    const r = applyCouponToSubtotal(1_000_000, {
      code: "LUMINA10",
      kind: "percent",
      value: 10,
      minSubtotal: 5_000_000,
      active: true,
    });
    expect(r.discount).toBe(0);
    expect(r.reason).toBeTruthy();
  });

  it("fixed không vượt quá subtotal", () => {
    const r = applyCouponToSubtotal(200_000, {
      code: "FIX",
      kind: "fixed",
      value: 500_000,
      minSubtotal: 0,
      active: true,
    });
    expect(r.discount).toBe(200_000);
  });

  it("từ chối coupon hết hạn / inactive", () => {
    expect(
      applyCouponToSubtotal(10_000_000, {
        code: "OLD",
        kind: "percent",
        value: 10,
        minSubtotal: 0,
        active: false,
      }).discount,
    ).toBe(0);
    expect(
      applyCouponToSubtotal(10_000_000, {
        code: "EXP",
        kind: "percent",
        value: 10,
        minSubtotal: 0,
        active: true,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }).discount,
    ).toBe(0);
  });
});

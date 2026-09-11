import { describe, expect, it } from "vitest";
import { isSaleActive, saleDaysLeft } from "@/lib/utils/sale";

const FUTURE = "2026-12-31T23:59:59.000Z";
const PAST = "2026-01-01T00:00:00.000Z";
const NOW = "2026-09-11T00:00:00.000Z";

describe("isSaleActive", () => {
  it("có giá gạch + hạn tương lai → active", () => {
    expect(isSaleActive({ compareAtPrice: 100, saleEndsAt: FUTURE }, 80, NOW)).toBe(true);
  });

  it("hết hạn → false (ẩn visual KM)", () => {
    expect(isSaleActive({ compareAtPrice: 100, saleEndsAt: PAST }, 80, NOW)).toBe(false);
  });

  it("không hẹn ngày → legacy true", () => {
    expect(isSaleActive({ compareAtPrice: 100 }, 80, NOW)).toBe(true);
  });

  it("không có giá gạch / bằng giá → false", () => {
    expect(isSaleActive({}, 80, NOW)).toBe(false);
    expect(isSaleActive({ compareAtPrice: 80, saleEndsAt: FUTURE }, 80, NOW)).toBe(false);
  });

  it("ngày rác → fail-closed false", () => {
    expect(isSaleActive({ compareAtPrice: 100, saleEndsAt: "không-phải-ngày" }, 80, NOW)).toBe(false);
  });
});

describe("saleDaysLeft", () => {
  it("trả số ngày còn lại, null khi hết KM", () => {
    expect(saleDaysLeft({ compareAtPrice: 100, saleEndsAt: FUTURE }, 80, new Date(NOW).getTime())).toBeGreaterThan(100);
    expect(saleDaysLeft({ compareAtPrice: 100, saleEndsAt: PAST }, 80, new Date(NOW).getTime())).toBeNull();
    expect(saleDaysLeft({}, 80, new Date(NOW).getTime())).toBeNull();
  });
});

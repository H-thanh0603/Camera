import { describe, expect, it } from "vitest";
import { findRecommendations, scoreProduct, BUDGET_RANGES } from "@/lib/services/finder-service";
import { getProductById } from "@/lib/repositories/product-repository";
import type { FinderAnswers } from "@/lib/types";

const base: FinderAnswers = {
  budget: "100m_250m",
  experience: "professional",
  styles: ["portrait"],
  sensorPreference: "any",
  sizePreference: "balanced",
};

describe("scoreProduct", () => {
  const x1 = getProductById("p-lumina-x1")!; // 185tr, fullframe, portrait, performance
  const cooke = getProductById("p-cooke-ana-50")!; // lens — phải bị loại

  it("loại sản phẩm không phải máy ảnh", () => {
    expect(scoreProduct(cooke, base)).toBe(0);
  });

  it("thưởng cao khi đúng ngân sách + phong cách", () => {
    const score = scoreProduct(x1, { ...base, sizePreference: "performance" });
    expect(score).toBeGreaterThan(0.6);
  });

  it("phạt nặng khi vượt ngân sách", () => {
    const x2d = getProductById("p-hasselblad-x2d")!; // 245tr > 250m? -> trong range 100-250
    const cine = getProductById("p-lumina-cine-8k")!; // 360tr vượt range
    expect(scoreProduct(cine, base)).toBeLessThan(scoreProduct(x2d, base));
  });

  it("mọi điểm số nằm trong [0,1]", () => {
    for (const answer of [
      { budget: "under_100m" },
      { budget: "100m_250m" },
      { budget: "250m_400m" },
      { budget: "above_400m" },
    ] as const) {
      const score = scoreProduct(x1, { ...base, budget: answer.budget });
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("findRecommendations", () => {
  it("trả về tối đa 3 gợi ý kèm matchPercent giảm dần", () => {
    const recs = findRecommendations(base, 3);
    expect(recs.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < recs.length; i++) {
      expect(recs[i - 1]!.matchPercent).toBeGreaterThanOrEqual(recs[i]!.matchPercent);
    }
  });

  it("matchPercent là số nguyên 0..100", () => {
    for (const rec of findRecommendations(base)) {
      expect(Number.isInteger(rec.matchPercent)).toBe(true);
      expect(rec.matchPercent).toBeGreaterThan(0);
      expect(rec.matchPercent).toBeLessThanOrEqual(100);
    }
  });

  it("đưa ra lý do ('Why this camera') không rỗng", () => {
    for (const rec of findRecommendations(base)) {
      expect(rec.reasons.length).toBeGreaterThan(0);
    }
  });

  it("ghi nhận đúng nhãn ngân sách", () => {
    expect(BUDGET_RANGES.under_100m.label).toContain("Dưới 100");
  });
});

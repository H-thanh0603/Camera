import { describe, expect, it } from "vitest";
import { sanitizeProductJson, validateProductPayload, validateVariants } from "@/lib/server/product-validation";

const validPayload = {
  name: "Lumina X-1",
  slug: "lumina-x-1",
  brand: "Lumina",
  category: "camera",
  price: 100_000_000,
  sku: "LUM-X1",
};

describe("validateProductPayload saleEndsAt", () => {
  it("rỗng → null (không KM có hạn)", () => {
    const out = validateProductPayload({ ...validPayload });
    expect(out.error).toBeUndefined();
    expect(out.data?.saleEndsAt).toBeNull();
  });

  it("ngày hợp lệ → Date", () => {
    const out = validateProductPayload({ ...validPayload, saleEndsAt: "2026-12-31T23:59" });
    expect(out.error).toBeUndefined();
    expect(out.data?.saleEndsAt).toBeInstanceOf(Date);
  });

  it("ngày sai định dạng → 422", () => {
    const out = validateProductPayload({ ...validPayload, saleEndsAt: "không-phải-ngày" });
    expect(out.error).toBe("Ngày kết thúc KM không hợp lệ.");
  });
});

describe("sanitizeProductJson", () => {
  it("loại URL javascript:/data xấu, giữ https + relative", () => {
    const out = sanitizeProductJson({
      images: [
        { url: "javascript:alert(1)", alt: "x" },
        { url: "https://cdn.vn/a.jpg", alt: "ok" },
        { url: "/local/b.png", alt: "" },
      ],
      thumbnail: { url: "data:text/html,<script>", alt: "evil" },
    });
    expect(out.images).toHaveLength(2);
    expect(out.thumbnail).toEqual({ url: "", alt: "" });
  });

  it("specifications chỉ nhận string, giới hạn số lượng", () => {
    const specs = Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`k${i}`, `v${i}`]));
    const out = sanitizeProductJson({ specifications: { ...specs, evil: { nested: true }, n: 123 } });
    expect(Object.keys(out.specifications as object)).toHaveLength(30);
  });

  it("tags/badges là string list có cap", () => {
    const out = sanitizeProductJson({ tags: ["a", 123, "", "b"], badges: "not-array" });
    expect(out.tags).toEqual(["a", "b"]);
    expect(out.badges).toEqual([]);
  });
});

describe("validateVariants strict", () => {
  it("loại giá âm/0 và stock âm", () => {
    const out = validateVariants(
      {
        variants: [
          { id: "v1", sku: "S1", name: "ok", price: 100, stock: 5 },
          { id: "v2", sku: "S2", name: "neg-price", price: -50, stock: 5 },
          { id: "v3", sku: "S3", name: "neg-stock", price: 100, stock: -2 },
          { id: "v4", sku: "S4", name: "zero", price: 0, stock: 5 },
        ],
      },
      1000,
    );
    expect(out.map((v) => v.id)).toEqual(["v1"]);
  });
});

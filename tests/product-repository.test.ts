import { describe, expect, it } from "vitest";
import { queryProducts, getFacets, getProductBySlug } from "@/lib/repositories/product-repository";
import { search } from "@/lib/services/search-service";
import { parseCatalogParams, buildCatalogQuery } from "@/lib/utils/catalog-params";
import type { ProductQuery } from "@/lib/types";

describe("queryProducts (filter & sort)", () => {
  it("lọc theo category", () => {
    const result = queryProducts({ categories: ["camera"], pageSize: 100 });
    expect(result.items.every((p) => p.category === "camera")).toBe(true);
    expect(result.total).toBeGreaterThan(0);
  });

  it("lọc theo brand", () => {
    const result = queryProducts({ brands: ["Leica"], pageSize: 100 });
    expect(result.items.every((p) => p.brand === "Leica")).toBe(true);
  });

  it("lọc theo khoảng giá", () => {
    const result = queryProducts({ minPrice: 10_000_000, maxPrice: 60_000_000, pageSize: 100 });
    expect(result.items.every((p) => p.price >= 10_000_000 && p.price <= 60_000_000)).toBe(true);
  });

  it("lọc inStockOnly loại sản phẩm contact/pre_order", () => {
    const result = queryProducts({ inStockOnly: true, pageSize: 100 });
    expect(result.items.every((p) => ["in_stock", "low_stock"].includes(p.availability))).toBe(true);
  });

  it("sắp xếp price_asc / price_desc", () => {
    const asc = queryProducts({ sort: "price_asc", pageSize: 100 });
    for (let i = 1; i < asc.items.length; i++) {
      expect(asc.items[i - 1]!.price).toBeLessThanOrEqual(asc.items[i]!.price);
    }
    const desc = queryProducts({ sort: "price_desc", pageSize: 100 });
    for (let i = 1; i < desc.items.length; i++) {
      expect(desc.items[i - 1]!.price).toBeGreaterThanOrEqual(desc.items[i]!.price);
    }
  });

  it("phân trang đúng kích thước và tổng", () => {
    const page1 = queryProducts({ pageSize: 5, page: 1 });
    const page2 = queryProducts({ pageSize: 5, page: 2 });
    expect(page1.items).toHaveLength(5);
    expect(page1.total).toBe(page2.total);
    expect(page1.items[0]!.id).not.toBe(page2.items[0]!.id);
  });

  it("lọc theo tag", () => {
    const result = queryProducts({ tags: ["medium_format"], pageSize: 100 } satisfies ProductQuery);
    expect(result.items.every((p) => p.tags.includes("medium_format"))).toBe(true);
  });
});

describe("getFacets", () => {
  it("đếm brand/category và tính priceRange", () => {
    const facets = getFacets();
    expect(facets.brands.length).toBeGreaterThan(1);
    expect(facets.priceRange.max).toBeGreaterThan(facets.priceRange.min);
  });
});

describe("search", () => {
  it("tìm theo tên sản phẩm", () => {
    const result = search("Leica M11");
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.brands).toContain("Leica");
  });

  it("query rỗng trả về rỗng", () => {
    expect(search("").total).toBe(0);
    expect(search("   ").total).toBe(0);
  });

  it("không tìm thấy → total = 0", () => {
    expect(search("zzzzkhongcozzzz").products).toHaveLength(0);
  });

  it("getProductBySlug hoạt động", () => {
    expect(getProductBySlug("lumina-x1-monolith")?.brand).toBe("Lumina");
    expect(getProductBySlug("khong-ton-tai")).toBeUndefined();
  });
});

describe("catalog params (URL ↔ state)", () => {
  it("parse chuỗi query đa giá trị", () => {
    const parsed = parseCatalogParams({
      brand: "Leica,Sony",
      category: "camera",
      minPrice: "100000000",
      inStock: "1",
      page: "3",
    });
    expect(parsed.brands).toEqual(["Leica", "Sony"]);
    expect(parsed.categories).toEqual(["camera"]);
    expect(parsed.minPrice).toBe(100_000_000);
    expect(parsed.inStockOnly).toBe(true);
    expect(parsed.page).toBe(3);
  });

  it("bỏ qua sort không hợp lệ", () => {
    expect(parseCatalogParams({ sort: "hack'" }).sort).toBeUndefined();
    expect(parseCatalogParams({ sort: "price_asc" }).sort).toBe("price_asc");
  });

  it("buildCatalogQuery sinh URL giữ state", () => {
    const qs = buildCatalogQuery(
      { brands: ["Sony"], categories: ["camera"], page: 1 },
      {},
    );
    expect(qs).toContain("brand=Sony");
    expect(qs).toContain("category=camera");
    expect(qs).not.toContain("page=");
  });

  it("buildCatalogQuery reset page khi đổi filter", () => {
    const qs = buildCatalogQuery({ brands: ["Sony"], page: 4 }, { minPrice: 1_000_000 });
    expect(qs).not.toContain("page=");
    expect(qs).toContain("minPrice=1000000");
  });
});

import { describe, expect, it } from "vitest";
import { productResolveSchema } from "@/lib/schemas";
import { dbGetProductsByIds } from "@/lib/server/product-db";
import { getProductById, mergeCatalogProducts } from "@/lib/repositories/product-repository";

describe("productResolveSchema", () => {
  it("chấp nhận 1–50 ids", () => {
    expect(productResolveSchema.safeParse({ ids: ["a"] }).success).toBe(true);
    expect(productResolveSchema.safeParse({ ids: [] }).success).toBe(false);
    expect(productResolveSchema.safeParse({ ids: Array.from({ length: 51 }, (_, i) => `p${i}`) }).success).toBe(false);
    expect(productResolveSchema.safeParse({}).success).toBe(false);
  });
});

describe("dbGetProductsByIds (slim)", () => {
  it("trả đúng thứ tự, bỏ id lạ, mảng rỗng → []", async () => {
    const one = await dbGetProductsByIds([]);
    expect(one).toEqual([]);
    const two = await dbGetProductsByIds(["nope-1", "nope-2"]);
    expect(two).toEqual([]);
    // Lấy 2 id thật từ DB để verify thứ tự
    const { prisma } = await import("@/lib/server/prisma");
    const rows = await prisma.product.findMany({ select: { id: true }, take: 2 });
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const ids = rows.map((r) => r.id).reverse();
    const res = await dbGetProductsByIds([...ids, "nope-x"]);
    expect(res.map((p) => p.id)).toEqual(ids);
  });
  it("slim: đủ price/variants/thumbnail, không có images/description/specs", async () => {
    const { prisma } = await import("@/lib/server/prisma");
    const rows = await prisma.product.findMany({ select: { id: true }, take: 1 });
    const [p] = await dbGetProductsByIds(rows.map((r) => r.id));
    expect(p?.price).toBeGreaterThan(0);
    expect(Array.isArray(p?.variants)).toBe(true);
    expect(p?.thumbnail.url).toBeTruthy();
    expect(p).not.toHaveProperty("images");
    expect(p).not.toHaveProperty("description");
    expect(p).not.toHaveProperty("specifications");
  });
});

describe("mergeCatalogProducts", () => {
  it("upsert vào cache, seed fallback còn nguyên", () => {
    const before = getProductById("p-lumina-x1");
    expect(before).toBeDefined();
    mergeCatalogProducts([]);
    expect(getProductById("p-lumina-x1")?.price).toBe(before?.price);
    mergeCatalogProducts([{ ...before!, price: before!.price + 1000 }]);
    expect(getProductById("p-lumina-x1")?.price).toBe(before!.price + 1000);
    // Khôi phục để test khác không bị lệch
    mergeCatalogProducts([before!]);
  });
});

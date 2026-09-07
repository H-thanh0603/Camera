import { describe, expect, test } from "vitest";
import {
  SIMILARITY_THRESHOLD,
  buildOrderSql,
  buildRelevanceSql,
  buildTrigramTermSql,
  buildWhereSql,
  isPostgresDialect,
  splitTerms,
} from "@/lib/server/product-search-pg";
import { dbQueryProducts } from "@/lib/server/product-db";

describe("isPostgresDialect", () => {
  test("nhận diện postgres URL", () => {
    expect(isPostgresDialect("postgresql://u:p@host:5432/db")).toBe(true);
    expect(isPostgresDialect("postgres://u:p@host:5432/db")).toBe(true);
  });
  test("sqlite/file URL → false", () => {
    expect(isPostgresDialect("file:./dev.db")).toBe(false);
    expect(isPostgresDialect(undefined)).toBe(false);
    expect(isPostgresDialect("")).toBe(false);
  });
});

describe("splitTerms", () => {
  test("lowercase + tách multi-term", () => {
    expect(splitTerms("  Sony  Alpha ")).toEqual(["sony", "alpha"]);
    expect(splitTerms(undefined)).toEqual([]);
    expect(splitTerms("   ")).toEqual([]);
  });
});

describe("buildTrigramTermSql", () => {
  test("OR trên 4 cột với ILIKE + similarity", () => {
    const sql = buildTrigramTermSql("lumia");
    expect(sql.sql).toContain("ILIKE");
    expect(sql.sql).toContain("similarity");
    expect(sql.sql).toContain('"name"');
    expect(sql.sql).toContain('"brand"');
    expect(sql.sql).toContain('"subcategory"');
    expect(sql.sql).toContain('"tagString"');
    // Ngưỡng similarity đi qua param (an toàn), không inline
    expect(sql.values).toContain(SIMILARITY_THRESHOLD);
  });
  test("term nguy hiểm đi qua param, không interpolate", () => {
    const evil = `100%_x'y OR '1'='1`;
    const sql = buildTrigramTermSql(evil);
    // SQL text chỉ có placeholder, không chứa nguyên term
    expect(sql.sql).not.toContain(evil);
    expect(sql.values).toContain(evil);
  });
});

describe("buildWhereSql", () => {
  test("multi-term AND với nhau", () => {
    const sql = buildWhereSql({ q: "sony alpha" });
    const andCount = (sql.sql.match(/ AND /g) ?? []).length;
    expect(andCount).toBeGreaterThanOrEqual(2); // TRUE AND term1 AND term2
    expect(sql.values).toContain("sony");
    expect(sql.values).toContain("alpha");
  });
  test("filters kết hợp trigram", () => {
    const sql = buildWhereSql({ q: "leica", brands: ["Leica"], minPrice: 100, inStockOnly: true });
    expect(sql.sql).toContain('"brand" IN');
    expect(sql.sql).toContain('"price" >=');
    expect(sql.sql).toContain('"stock" > 0');
    expect(sql.values).toContain("Leica");
    expect(sql.values).toContain(100);
  });
  test("không filter không q → TRUE", () => {
    expect(buildWhereSql({}).sql).toContain("TRUE");
  });
});

describe("buildRelevanceSql / buildOrderSql", () => {
  test("relevance dùng GREATEST similarity", () => {
    const sql = buildRelevanceSql(["lumia"]);
    expect(sql.sql).toContain("GREATEST");
    expect(sql.sql).toContain("similarity");
  });
  test("featured + q → relevance trước", () => {
    expect(buildOrderSql("featured", ["x"]).sql).toContain("DESC");
    expect(buildOrderSql("featured", ["x"]).sql).toContain("GREATEST");
  });
  test("sort tường minh giữ nguyên, không relevance", () => {
    expect(buildOrderSql("price_asc", ["x"]).sql).toBe('"price" ASC');
    expect(buildOrderSql("best_selling", ["x"]).sql).toBe('"reviewCount" DESC');
    expect(buildOrderSql(undefined, []).sql).toContain('"rating" DESC');
  });
});

describe("SQLite regression (dialect file → nhánh contains cũ)", () => {
  test("q sony vẫn ra 1 SP, brands filter giữ nguyên", async () => {
    const r1 = await dbQueryProducts({ q: "sony", pageSize: 60 });
    expect(r1.total).toBe(1);
    const r2 = await dbQueryProducts({ brands: ["Sony", "Leica"], pageSize: 60 });
    expect(r2.total).toBe(4);
    const r3 = await dbQueryProducts({ tag: "cine", pageSize: 60 });
    expect(r3.total).toBe(2);
  });
});

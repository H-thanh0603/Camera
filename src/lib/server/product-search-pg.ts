import { Prisma } from "@prisma/client";
import type { ProductSearchParams } from "./product-db";

/**
 * Phase 2.2 — pg_trgm search builders (Postgres only, pure functions).
 * Runtime query + mapping nằm ở product-db.ts để tránh circular import
 * (module này chỉ export builders + constants, không import prisma).
 */

export const SIMILARITY_THRESHOLD = 0.2;

/** Cột tham gia trigram search — khớp 4 cột của bản SQLite contains. */
const TRIGRAM_COLUMNS = ["name", "brand", "subcategory", "tagString"] as const;

export function isPostgresDialect(url: string | undefined = process.env.DATABASE_URL): boolean {
  return (url ?? "").startsWith("postgres");
}

export function splitTerms(q: string | undefined): string[] {
  return (q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function columnRef(col: string): Prisma.Sql {
  // Tên cột nội bộ cố định — không từ user input nên inline an toàn
  return Prisma.raw(`"${col}"`);
}

/**
 * Match 1 term trên 1 cột: substring (ILIKE, giữ hành vi contains cũ)
 * HOẶC fuzzy (similarity > ngưỡng — chịu typo như "lumia"→"Lumina").
 * Term luôn đi qua param, không interpolate vào SQL.
 */
function termColumnSql(col: (typeof TRIGRAM_COLUMNS)[number], term: string): Prisma.Sql {
  const c = columnRef(col);
  return Prisma.sql`(${c} ILIKE '%' || ${term} || '%' OR similarity(${c}, ${term}) > ${SIMILARITY_THRESHOLD})`;
}

/** 1 term phải khớp ÍT NHẤT 1 cột; nhiều term AND với nhau (khớp SQLite). */
export function buildTrigramTermSql(term: string): Prisma.Sql {
  const parts = TRIGRAM_COLUMNS.map((c) => termColumnSql(c, term));
  return Prisma.sql`(${Prisma.join(parts, " OR ")})`;
}

/** Filters phi-search (brands/categories/price/rating/inStock/tag) dạng AND. */
export function buildFilterSql(params: ProductSearchParams): Prisma.Sql {
  const parts: Prisma.Sql[] = [];
  const brands = params.brands?.length ? params.brands : params.brand ? [params.brand] : [];
  if (brands.length) parts.push(Prisma.sql`"brand" IN (${Prisma.join(brands)})`);
  const categories = params.categories?.length ? params.categories : params.category ? [params.category] : [];
  if (categories.length) parts.push(Prisma.sql`"category" IN (${Prisma.join(categories)})`);
  if (params.minPrice != null) parts.push(Prisma.sql`"price" >= ${params.minPrice}`);
  if (params.maxPrice != null) parts.push(Prisma.sql`"price" <= ${params.maxPrice}`);
  if (params.minRating != null) parts.push(Prisma.sql`"rating" >= ${params.minRating}`);
  if (params.inStockOnly) {
    parts.push(Prisma.sql`("stock" > 0 OR "availability" IN ('in_stock', 'low_stock'))`);
  }
  if (params.tag) {
    parts.push(Prisma.sql`"tagString" LIKE '%|' || ${params.tag.trim().toLowerCase()} || '|%'`);
  }
  if (parts.length === 0) return Prisma.sql`TRUE`;
  return Prisma.sql`(${Prisma.join(parts, " AND ")})`;
}

export function buildWhereSql(params: ProductSearchParams): Prisma.Sql {
  const terms = splitTerms(params.q);
  const parts: Prisma.Sql[] = [buildFilterSql(params)];
  for (const t of terms) parts.push(buildTrigramTermSql(t));
  return Prisma.sql`(${Prisma.join(parts, " AND ")})`;
}

/** Điểm relevance = tổng max-similarity mỗi term (sort khi q + featured). */
export function buildRelevanceSql(terms: string[]): Prisma.Sql {
  const perTerm = terms.map((t) => {
    const sims = TRIGRAM_COLUMNS.map((c) => {
      const col = columnRef(c);
      return Prisma.sql`similarity(${col}, ${t})`;
    });
    return Prisma.sql`GREATEST(${Prisma.join(sims, ", ")})`;
  });
  return Prisma.sql`(${Prisma.join(perTerm, " + ")})`;
}

export function buildOrderSql(
  sort: ProductSearchParams["sort"],
  terms: string[],
): Prisma.Sql {
  switch (sort) {
    case "price_asc":
      return Prisma.sql`"price" ASC`;
    case "price_desc":
      return Prisma.sql`"price" DESC`;
    case "rating_desc":
      return Prisma.sql`"rating" DESC`;
    case "best_selling":
      return Prisma.sql`"reviewCount" DESC`;
    case "newest":
      return Prisma.sql`"createdAt" DESC`;
    default:
      // featured: có q → relevance trước rồi rating/reviewCount
      return terms.length
        ? Prisma.sql`${buildRelevanceSql(terms)} DESC, "rating" DESC, "reviewCount" DESC`
        : Prisma.sql`"rating" DESC, "reviewCount" DESC`;
  }
}

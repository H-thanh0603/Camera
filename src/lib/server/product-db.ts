import type { Product, SlimProduct } from "@/lib/types";
import { Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "./prisma";
import {
  buildOrderSql,
  buildWhereSql,
  isPostgresDialect,
  splitTerms,
} from "./product-search-pg";

/**
 * Server-side DB catalogue — nguồn chuẩn khi admin quản trị sản phẩm.
 * Mapping Prisma row → domain Product (Json fields giữ shape types.ts).
 */

const INCLUDE = { variants: true } as const;

type ApprovedReviewRow = { id: string; author: string; rating: number; date: Date; title: string; body: string; verified: boolean; photos: unknown };

type ProductRow = Prisma.ProductGetPayload<{ include: typeof INCLUDE }>;

export function dbProductToDomain(row: ProductRow, approvedReviews: ApprovedReviewRow[] = []): Product {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category as Product["category"],
    subcategory: row.subcategory,
    description: row.description,
    shortDescription: row.shortDescription,
    price: row.price,
    compareAtPrice: row.compareAtPrice ?? undefined,
    currency: "VND",
    stock: row.stock,
    availability: row.availability as Product["availability"],
    images: row.images as unknown as Product["images"],
    thumbnail: row.thumbnail as unknown as Product["thumbnail"],
    variants: row.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? undefined,
      stock: v.stock,
      availability: v.availability as Product["availability"],
      image: (v.image ?? undefined) as unknown as Product["thumbnail"] | undefined,
    })),
    specifications: row.specifications as unknown as Product["specifications"],
    rating: row.rating,
    reviewCount: row.reviewCount,
    tags: row.tags as unknown as Product["tags"],
    badges: row.badges as unknown as Product["badges"],
    monthlyFrom: row.monthlyFrom ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    highlights: (row.highlights ?? undefined) as unknown as Product["highlights"],
    inTheBox: (row.inTheBox ?? undefined) as unknown as Product["inTheBox"],
    compatibleWith: (row.compatibleWith ?? undefined) as unknown as Product["compatibleWith"],
    reviews: approvedReviews.length
      ? approvedReviews.map((r) => ({
          id: r.id,
          author: r.author,
          rating: r.rating as import("@/lib/types").Review["rating"],
          date: r.date.toISOString(),
          title: r.title,
          body: r.body,
          verified: r.verified,
          photos: (Array.isArray(r.photos) ? r.photos.filter((u): u is string => typeof u === "string") : undefined) as import("@/lib/types").Review["photos"],
        }))
      : undefined,
  };
}

/**
 * Chỉ slug + updatedAt cho sitemap/generateStaticParams — nhẹ hơn
 * dbAllProducts (không tải JSON spec/images/reviews).
 */
export async function dbProductRoutes(): Promise<{ slug: string; updatedAt: Date }[]> {
  return prisma.product.findMany({ select: { slug: true, updatedAt: true }, orderBy: { createdAt: "desc" } });
}

export async function dbAllProducts(): Promise<Product[]> {
  const [rows, reviews] = await Promise.all([
    prisma.product.findMany({ include: INCLUDE, orderBy: { createdAt: "desc" } }),
    prisma.review.findMany({ where: { approved: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const byProduct = new Map<string, ApprovedReviewRow[]>();
  for (const r of reviews) {
    const list = byProduct.get(r.productId) ?? [];
    list.push({ id: r.id, author: r.author, rating: r.rating, date: r.createdAt, title: r.title, body: r.body, verified: r.verified, photos: r.photos });
    byProduct.set(r.productId, list);
  }
  return rows.map((row) => dbProductToDomain(row, byProduct.get(row.id) ?? []));
}

export async function dbGetProductBySlug(slug: string): Promise<Product | null> {
  const row = await prisma.product.findUnique({ where: { slug }, include: INCLUDE });
  if (!row) return null;
  const reviews = await prisma.review.findMany({
    where: { productId: row.id, approved: true },
    orderBy: { createdAt: "desc" },
  });
  return dbProductToDomain(
    row,
    reviews.map((r) => ({ id: r.id, author: r.author, rating: r.rating, date: r.createdAt, title: r.title, body: r.body, verified: r.verified, photos: r.photos })),
  );
}

export async function dbGetProductById(id: string): Promise<Product | null> {
  const row = await prisma.product.findUnique({ where: { id }, include: INCLUDE });
  return row ? dbProductToDomain(row) : null;
}

/**
 * Resolve hàng loạt theo ids cho client cache (giỏ/wishlist/compare) —
 * bounded (tối đa 50), luôn slim (bỏ images[]/description/specs) vì cache
 * merge giữ lại trường nặng cũ. Giữ đúng thứ tự ids, bỏ id không tồn tại.
 */
export async function dbGetProductsByIds(ids: string[]): Promise<SlimProduct[]> {
  const unique = [...new Set(ids.filter(Boolean))].slice(0, 50);
  if (unique.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: unique } }, select: SLIM_SELECT });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return unique.flatMap((id) => {
    const row = byId.get(id);
    return row ? [dbProductToSlim(row)] : [];
  });
}

export interface ProductSearchParams {
  q?: string;
  brand?: string;
  brands?: string[];
  category?: string;
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  tag?: string;
  sort?: "featured" | "newest" | "price_asc" | "price_desc" | "rating_desc" | "best_selling";
  page?: number;
  pageSize?: number;
  /** slim: bỏ trường nặng (images[], description, specs…) cho overlay/cache. */
  slim?: boolean;
}

/** Cột slim — loại images/description/specs/highlights/inTheBox/compatibleWith. */
const SLIM_SELECT = {
  id: true,
  sku: true,
  slug: true,
  name: true,
  brand: true,
  category: true,
  subcategory: true,
  description: false,
  shortDescription: false,
  price: true,
  compareAtPrice: true,
  currency: true,
  stock: true,
  availability: true,
  thumbnail: true,
  rating: true,
  reviewCount: true,
  tags: true,
  badges: true,
  monthlyFrom: true,
  createdAt: true,
  updatedAt: true,
  variants: true,
} as const;

type SlimRow = Prisma.ProductGetPayload<{ select: typeof SLIM_SELECT }>;

export function dbProductToSlim(row: SlimRow): SlimProduct {
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category as SlimProduct["category"],
    subcategory: row.subcategory,
    price: row.price,
    compareAtPrice: row.compareAtPrice ?? undefined,
    currency: "VND",
    stock: row.stock,
    availability: row.availability as SlimProduct["availability"],
    thumbnail: row.thumbnail as unknown as SlimProduct["thumbnail"],
    rating: row.rating,
    reviewCount: row.reviewCount,
    tags: row.tags as unknown as SlimProduct["tags"],
    badges: row.badges as unknown as SlimProduct["badges"],
    monthlyFrom: row.monthlyFrom ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    variants: row.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      price: v.price,
      compareAtPrice: v.compareAtPrice ?? undefined,
      stock: v.stock,
      availability: v.availability as NonNullable<SlimProduct["variants"]>[number]["availability"],
      image: (v.image ?? undefined) as unknown as NonNullable<SlimProduct["variants"]>[number]["image"],
    })),
  };
}

/**
 * Điều kiện WHERE dùng chung cho listing + facets (semantics khớp
 * applyQuery client: brands/categories OR, tag ANY, search multi-term AND,
 * inStock = stock>0 hoặc availability in_stock/low_stock).
 */
function buildProductWhere(params: Pick<ProductSearchParams, "q" | "brand" | "brands" | "category" | "categories" | "minPrice" | "maxPrice" | "minRating" | "inStockOnly" | "tag">): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  const brands = params.brands?.length ? params.brands : params.brand ? [params.brand] : [];
  if (brands.length) where.brand = { in: brands };
  const categories = params.categories?.length ? params.categories : params.category ? [params.category] : [];
  if (categories.length) where.category = { in: categories };
  if (params.minPrice != null || params.maxPrice != null) {
    where.price = {
      ...(params.minPrice != null ? { gte: params.minPrice } : {}),
      ...(params.maxPrice != null ? { lte: params.maxPrice } : {}),
    };
  }
  if (params.minRating != null) where.rating = { gte: params.minRating };
  if (params.inStockOnly) {
    where.OR = [{ stock: { gt: 0 } }, { availability: { in: ["in_stock", "low_stock"] } }];
  }
  const and: Prisma.ProductWhereInput[] = [];
  if (params.tag) {
    and.push({ tagString: { contains: `|${params.tag.trim().toLowerCase()}|` } });
  }
  if (params.q) {
    for (const term of params.q.trim().toLowerCase().split(/\s+/).filter(Boolean)) {
      and.push({
        OR: [
          { name: { contains: term } },
          { brand: { contains: term } },
          { subcategory: { contains: term } },
          { tagString: { contains: term } },
        ],
      });
    }
  }
  if (and.length) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []), ...and];
  }
  return where;
}

/**
 * Tìm kiếm + phân trang server-side cho catalogue lớn.
 * Sort featured ≈ rating rồi reviewCount (xấp xỉ rating×reviewCount của
 * bản client — không có expression index nên dùng 2 cột có index).
 * Trên Postgres + có q: dùng pg_trgm (ILIKE + similarity, sort relevance).
 */
export function dbQueryProducts(params: ProductSearchParams & { slim: true }): Promise<{
  items: SlimProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;
export function dbQueryProducts(params: ProductSearchParams): Promise<{
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;
export async function dbQueryProducts(params: ProductSearchParams): Promise<{
  items: Product[] | SlimProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(60, Math.max(1, params.pageSize ?? 12));
  const terms = splitTerms(params.q);
  if (terms.length > 0 && isPostgresDialect()) {
    return dbQueryProductsPg(params, terms, page, pageSize);
  }
  const where = buildProductWhere(params);
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    params.sort === "price_asc"
      ? [{ price: "asc" }]
      : params.sort === "price_desc"
        ? [{ price: "desc" }]
        : params.sort === "rating_desc"
          ? [{ rating: "desc" }]
          : params.sort === "best_selling"
            ? [{ reviewCount: "desc" }]
            : params.sort === "newest"
              ? [{ createdAt: "desc" }]
              : [{ rating: "desc" }, { reviewCount: "desc" }];

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    params.slim
      ? prisma.product.findMany({ where, select: SLIM_SELECT, orderBy, skip: (page - 1) * pageSize, take: pageSize })
      : prisma.product.findMany({
          where,
          include: INCLUDE,
          orderBy,
          skip: (page - 1) * pageSize,
          take: pageSize,
        }),
  ]);
  return {
    items: params.slim
      ? (rows as SlimRow[]).map((row) => dbProductToSlim(row))
      : (rows as ProductRow[]).map((row) => dbProductToDomain(row)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Nhánh Postgres + trigram: raw COUNT + raw IDs (đúng thứ tự relevance),
 * rồi findMany INCLUDE theo ids và sắp lại — tái dùng mapping + variants.
 */
async function dbQueryProductsPg(
  params: ProductSearchParams,
  terms: string[],
  page: number,
  pageSize: number,
): Promise<{ items: Product[] | SlimProduct[]; total: number; page: number; pageSize: number; totalPages: number }> {
  const where = buildWhereSql(params);
  const order = buildOrderSql(params.sort, terms);
  const skip = (page - 1) * pageSize;
  const [countRows, idRows] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*) AS count FROM "Product" WHERE ${where}`,
    prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "Product" WHERE ${where} ORDER BY ${order} LIMIT ${pageSize} OFFSET ${skip}`,
  ]);
  const total = Number(countRows[0]?.count ?? BigInt(0));
  const ids = idRows.map((r) => r.id);
  if (ids.length === 0) {
    return { items: [], total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  if (params.slim) {
    const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: SLIM_SELECT });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const items = ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [dbProductToSlim(row)] : [];
    });
    return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
  }
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: INCLUDE });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const items = ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [dbProductToDomain(row)] : [];
  });
  return { items, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Facets server-side (bounded: groupBy + min/max, không tải rows).
 * Đếm theo brands/categories TRÊN tập đã lọc các điều kiện khác
 * (khớp semantics getFacets client).
 * Trên Postgres + có q: raw GROUP BY với cùng WHERE trigram.
 */
export async function dbFacets(params: Pick<ProductSearchParams, "q" | "minPrice" | "maxPrice" | "minRating" | "inStockOnly" | "tag">): Promise<{
  brands: { value: string; count: number }[];
  categories: { value: import("@/lib/types").Category; count: number }[];
  priceRange: { min: number; max: number };
}> {
  const terms = splitTerms(params.q);
  if (terms.length > 0 && isPostgresDialect()) {
    return dbFacetsPg(params);
  }
  const where = buildProductWhere(params);
  const [brandGroups, categoryGroups, agg] = await Promise.all([
    prisma.product.groupBy({ by: ["brand"], where, _count: { brand: true }, orderBy: { _count: { brand: "desc" } } }),
    prisma.product.groupBy({ by: ["category"], where, _count: { category: true } }),
    prisma.product.aggregate({ where, _min: { price: true }, _max: { price: true } }),
  ]);
  return {
    brands: brandGroups.map((g) => ({ value: g.brand, count: g._count.brand })),
    categories: categoryGroups.map((g) => ({
      value: g.category as import("@/lib/types").Category,
      count: g._count.category,
    })),
    priceRange: { min: agg._min.price ?? 0, max: agg._max.price ?? 0 },
  };
}

async function dbFacetsPg(params: ProductSearchParams): Promise<{
  brands: { value: string; count: number }[];
  categories: { value: import("@/lib/types").Category; count: number }[];
  priceRange: { min: number; max: number };
}> {
  const where = buildWhereSql(params);
  const [brandRows, categoryRows, aggRows] = await Promise.all([
    prisma.$queryRaw<{ value: string; count: number }[]>`SELECT "brand" AS value, COUNT(*)::int AS count FROM "Product" WHERE ${where} GROUP BY "brand" ORDER BY count DESC`,
    prisma.$queryRaw<{ value: string; count: number }[]>`SELECT "category" AS value, COUNT(*)::int AS count FROM "Product" WHERE ${where} GROUP BY "category"`,
    prisma.$queryRaw<{ min: number | null; max: number | null }[]>`SELECT MIN("price") AS min, MAX("price") AS max FROM "Product" WHERE ${where}`,
  ]);
  return {
    brands: brandRows.map((r) => ({ value: r.value, count: Number(r.count) })),
    categories: categoryRows.map((r) => ({
      value: r.value as import("@/lib/types").Category,
      count: Number(r.count),
    })),
    priceRange: { min: Number(aggRows[0]?.min ?? 0), max: Number(aggRows[0]?.max ?? 0) },
  };
}

/**
 * Wrapper cache cho listing/facets (60s, tag "catalog").
 * dbQueryProducts/dbFacets gốc giữ nguyên cho test + path cần tươi tuyệt đối.
 * Admin ghi (sản phẩm/review) gọi revalidateTag("catalog") để rớt cache ngay.
 */
export const CATALOG_TAG = "catalog";

export function cachedQueryProducts(params: ProductSearchParams & { slim: true }): Promise<{
  items: SlimProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;
export function cachedQueryProducts(params: ProductSearchParams): Promise<{
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}>;
export function cachedQueryProducts(params: ProductSearchParams): Promise<{
  items: Product[] | SlimProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const normalized = { ...params, page: params.page ?? 1, pageSize: params.pageSize ?? 12 };
  return unstable_cache(() => dbQueryProducts(params), ["products", JSON.stringify(normalized)], {
    revalidate: 60,
    tags: [CATALOG_TAG],
  })();
}

export function cachedFacets(
  params: Pick<ProductSearchParams, "q" | "minPrice" | "maxPrice" | "minRating" | "inStockOnly" | "tag">,
): Promise<{
  brands: { value: string; count: number }[];
  categories: { value: import("@/lib/types").Category; count: number }[];
  priceRange: { min: number; max: number };
}> {
  return unstable_cache(() => dbFacets(params), ["facets", JSON.stringify(params)], {
    revalidate: 60,
    tags: [CATALOG_TAG],
  })();
}

/**
 * Sản phẩm tương tự server-side (category match + brand bonus + giá gần),
 * bỏ dbAllProducts trên PDP.
 */
export async function dbSimilarProducts(
  product: { id: string; category: string; brand: string; price: number; tags: string[] },
  limit = 4,
): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: {
      id: { not: product.id },
      OR: [
        { category: product.category },
        { tagString: { contains: `|${product.tags[0]}|` } },
      ],
    },
    include: INCLUDE,
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
    take: 20,
  });
  // Sort: brand match + category match + price proximity
  return rows
    .map((r) => dbProductToDomain(r))
    .sort(
      (a, b) =>
        (b.brand === product.brand ? 1 : 0) +
        (b.category === product.category ? 1 : 0) -
        (a.brand === product.brand ? 1 : 0) -
        (a.category === product.category ? 1 : 0) ||
        Math.abs(a.price - product.price) - Math.abs(b.price - product.price),
    )
    .slice(0, limit);
}

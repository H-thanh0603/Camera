/**
 * DB-backed CommerceDataSource — reads the live Prisma catalogue server-side.
 * Used by the `/api/agent/chat` route so the shopping agent sees fresh prices,
 * stock, ratings and admin-managed products. Import only from server code.
 */

import {
  dbQueryProducts,
  dbGetProductById,
  dbGetProductBySlug,
  dbGetProductsByIds,
  dbSimilarProducts,
} from "@/lib/server/product-db";
import { findRecommendations } from "@/lib/services/finder-service";
import type { Category, FinderAnswers, FinderRecommendation, Product } from "@/lib/types";
import type { CommerceDataSource, ProductRef, SearchProductsParams, SimilarProductSeed } from "./data-source";

export const dbCommerceSource: CommerceDataSource = {
  name: "db",

  async searchProducts(params: SearchProductsParams): Promise<Product[]> {
    const res = await dbQueryProducts({
      q: params.q,
      brand: params.brand,
      category: params.category as string | undefined,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRating: params.minRating,
      inStockOnly: params.inStockOnly,
      sort: params.sort,
      page: 1,
      pageSize: Math.min(60, params.limit ?? 10),
    });
    return res.items as Product[];
  },

  async getProduct(ref: ProductRef): Promise<Product | null> {
    if (ref.id) return dbGetProductById(ref.id);
    if (ref.slug) return dbGetProductBySlug(ref.slug);
    return null;
  },

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    const slim = await dbGetProductsByIds(ids.slice(0, 8));
    // Promote slim rows to full domain products for spec-rich comparisons.
    const out: Product[] = [];
    for (const s of slim) {
      const full = await dbGetProductById(s.id);
      if (full) out.push(full);
    }
    return out;
  },

  async getSimilar(seed: SimilarProductSeed, limit = 4): Promise<Product[]> {
    return dbSimilarProducts(seed, limit);
  },

  async listCategories(): Promise<Category[]> {
    const distinct = await dbQueryProducts({ pageSize: 1 });
    void distinct;
    const rows = await import("@/lib/server/prisma").then((m) =>
      m.prisma.product.findMany({ select: { category: true }, distinct: ["category"] }),
    );
    return rows.map((r) => r.category as Category);
  },

  async finder(answers: FinderAnswers, limit = 3): Promise<FinderRecommendation[]> {
    return findRecommendations(answers, limit);
  },
};

/** Lazy singleton — only touches Prisma when first used (server side). */
let cached: CommerceDataSource | null = null;
export function getDbCommerceSource(): CommerceDataSource {
  if (!cached) cached = dbCommerceSource;
  return cached;
}
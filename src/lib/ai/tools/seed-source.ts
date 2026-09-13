/**
 * Seed-backed CommerceDataSource — reads the in-memory client-safe catalogue.
 * Used by unit tests and any non-server context; keeps agent/tools testable
 * without a database.
 */

import {
  queryProducts,
  getProductById,
  getProductBySlug,
  getProductsByIds,
  getCatalog,
} from "@/lib/repositories/product-repository";
import { findRecommendations } from "@/lib/services/finder-service";
import type { Category, FinderAnswers, FinderRecommendation, Product, ProductQuery } from "@/lib/types";
import type { CommerceDataSource, ProductRef, SearchProductsParams, SimilarProductSeed } from "./data-source";

function similarOf(catalog: Product[], seed: SimilarProductSeed, limit: number): Product[] {
  return catalog
    .filter((p) => p.id !== seed.id)
    .filter((p) => p.category === seed.category || p.tags.some((t) => seed.tags.includes(t)))
    .sort(
      (a, b) =>
        (b.brand === seed.brand ? 1 : 0) +
        (b.category === seed.category ? 1 : 0) -
        (a.brand === seed.brand ? 1 : 0) -
        (a.category === seed.category ? 1 : 0) ||
        Math.abs(a.price - seed.price) - Math.abs(b.price - seed.price),
    )
    .slice(0, limit);
}

export const seedCommerceSource: CommerceDataSource = {
  name: "seed",

  async searchProducts(params: SearchProductsParams): Promise<Product[]> {
    const q: ProductQuery = {
      brands: params.brand ? [params.brand] : undefined,
      categories: params.category ? ([params.category] as Category[]) : undefined,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      minRating: params.minRating,
      inStockOnly: params.inStockOnly,
      search: params.q,
      sort: params.sort ?? "featured",
      page: 1,
      pageSize: Math.min(60, params.limit ?? 10),
    };
    return queryProducts(q).items;
  },

  async getProduct(ref: ProductRef): Promise<Product | null> {
    if (ref.id) return getProductById(ref.id) ?? null;
    if (ref.slug) return getProductBySlug(ref.slug) ?? null;
    return null;
  },

  async getProductsByIds(ids: string[]): Promise<Product[]> {
    return getProductsByIds(ids.slice(0, 8));
  },

  async getSimilar(seed: SimilarProductSeed, limit = 4): Promise<Product[]> {
    return similarOf(getCatalog(), seed, limit);
  },

  async listCategories(): Promise<Category[]> {
    return [...new Set(getCatalog().map((p) => p.category))] as Category[];
  },

  async finder(answers: FinderAnswers, limit = 3): Promise<FinderRecommendation[]> {
    return findRecommendations(answers, limit);
  },
};
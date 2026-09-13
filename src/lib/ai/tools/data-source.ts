/**
 * CommerceDataSource — the shopping agent's "backend". The tools read through
 * this interface (mirroring the Commerce Agents backend concept: the domain
 * methods a host exposes to the agent). Two implementations:
 *   - seed-source: in-memory seed catalogue (client-safe, testable)
 *   - db-source:   live Prisma DB (server-only, used by the API route)
 * Switching engines never touches the agent/tool/provider logic.
 */

import type { FinderAnswers, FinderRecommendation, Product, Category } from "@/lib/types";

export interface SearchProductsParams {
  q?: string;
  category?: Category | string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  minRating?: number;
  sort?: "featured" | "price_asc" | "price_desc" | "rating_desc" | "best_selling";
  limit?: number;
}

export interface ProductRef {
  id?: string;
  slug?: string;
}

export interface SimilarProductSeed {
  id: string;
  category: string;
  brand: string;
  price: number;
  tags: string[];
}

export interface CommerceDataSource {
  /** "db" | "seed" — used in logs/observability. */
  readonly name: string;
  searchProducts(params: SearchProductsParams): Promise<Product[]>;
  getProduct(ref: ProductRef, opts?: { withReviews?: boolean }): Promise<Product | null>;
  getProductsByIds(ids: string[]): Promise<Product[]>;
  getSimilar(product: SimilarProductSeed, limit?: number): Promise<Product[]>;
  listCategories(): Promise<Category[]>;
  finder(answers: FinderAnswers, limit?: number): Promise<FinderRecommendation[]>;
}
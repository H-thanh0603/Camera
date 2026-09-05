import type { Category, Product } from "@/lib/types";
import { getCatalog } from "@/lib/repositories/product-repository";

/**
 * SearchService — tìm kiếm phía client trên catalogue seed.
 * Khi chuyển sang backend, thay bằng gọi API search (đã debounce ở UI).
 */

export interface SearchResult {
  products: Product[];
  brands: string[];
  categories: Category[];
  total: number;
}

/** Chuẩn hoá so sánh không dấu: "may anh" khớp "Máy Ảnh". */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

function relevance(p: Product, q: string): number {
  const name = normalize(p.name);
  const brand = normalize(p.brand);
  const query = normalize(q);
  let score = 0;
  if (name.includes(query)) score += 5;
  if (name.startsWith(query)) score += 3;
  if (brand.includes(query)) score += 4;
  if (normalize(p.subcategory).includes(query)) score += 2;
  if (p.tags.some((t) => normalize(t).includes(query))) score += 1;
  return score;
}

export function search(query: string, limit = 6): SearchResult {
  const trimmed = query.trim();
  if (!trimmed) return { products: [], brands: [], categories: [], total: 0 };

  const matched = getCatalog().map((p) => ({ p, s: relevance(p, trimmed) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s);

  return {
    products: matched.slice(0, limit).map(({ p }) => p),
    brands: [...new Set(matched.map(({ p }) => p.brand))].slice(0, 3),
    categories: [...new Set(matched.map(({ p }) => p.category))].slice(0, 3),
    total: matched.length,
  };
}

export const POPULAR_SEARCHES = ["Lumina X-1", "Leica M11", "Anamorphic", "Medium format", "Ống kính 50mm"];

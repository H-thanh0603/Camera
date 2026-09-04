import type { SortOption } from "@/lib/types";

/** Parser dùng chung giữa server page và client controls — thuần hàm, không import client. */

export interface CatalogParsed {
  brands?: string[];
  categories?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStockOnly?: boolean;
  search?: string;
  tag?: string;
  sort?: SortOption;
  page: number;
}

const VALID_SORTS: SortOption[] = ["featured", "newest", "price_asc", "price_desc", "best_selling", "rating_desc"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function toList(value: string | string[] | undefined): string[] | undefined {
  const raw = first(value);
  if (!raw) return undefined;
  const list = raw.split(",").map((v) => v.trim()).filter(Boolean);
  return list.length ? list : undefined;
}

function toNumber(value: string | string[] | undefined): number | undefined {
  const raw = first(value);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function parseCatalogParams(params: Record<string, string | string[] | undefined>): CatalogParsed {
  const sortRaw = first(params.sort);
  return {
    brands: toList(params.brand),
    categories: toList(params.category),
    minPrice: toNumber(params.minPrice),
    maxPrice: toNumber(params.maxPrice),
    minRating: toNumber(params.minRating),
    inStockOnly: first(params.inStock) === "1",
    search: first(params.search) || undefined,
    tag: first(params.tag) || undefined,
    sort: sortRaw && (VALID_SORTS as string[]).includes(sortRaw) ? (sortRaw as SortOption) : undefined,
    page: Math.max(1, toNumber(params.page) ?? 1),
  };
}

/** Merge filter state hiện tại thành URL query string (không có page khi reset). */
export function buildCatalogQuery(current: CatalogParsed, updates: Partial<CatalogParsed>): string {
  const merged: Record<string, string | undefined> = {
    brand: (updates.brands ?? current.brands)?.join(","),
    category: (updates.categories ?? current.categories)?.join(","),
    minPrice: (updates.minPrice ?? current.minPrice)?.toString(),
    maxPrice: (updates.maxPrice ?? current.maxPrice)?.toString(),
    minRating: (updates.minRating ?? current.minRating)?.toString(),
    inStock: (updates.inStockOnly ?? current.inStockOnly) ? "1" : undefined,
    search: updates.search ?? current.search,
    tag: updates.tag ?? current.tag,
    sort: updates.sort ?? current.sort,
    page: updates.page !== undefined ? String(updates.page) : undefined,
  };
  // Reset page khi thay đổi filter (trừ khi updates chỉ định page rõ ràng)
  if (!("page" in updates) && Object.keys(updates).some((k) => k !== "page")) {
    merged.page = undefined;
  }
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value !== undefined && value !== "") sp.set(key, value);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "?";
}

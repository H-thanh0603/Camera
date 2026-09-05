import type {
  Category,
  Facets,
  Paginated,
  Product,
  ProductQuery,
  SortOption,
} from "@/lib/types";
import { products as seedProducts } from "@/lib/data/products";

/**
 * ProductRepository (client-safe) — đọc catalogue từ một cache module.
 * Cache khởi tạo bằng seed snapshot (khớp SSR/hydration), sau đó được
 * StoreProvider làm mới từ GET /api/products/snapshot (dữ liệu DB mà
 * admin quản trị). Server pages KHÔNG dùng file này — chúng đọc DB trực
 * tiếp qua src/lib/server/product-db.ts.
 */

let catalog: Product[] = seedProducts;
let byId = new Map(catalog.map((p) => [p.id, p]));
let bySlug = new Map(catalog.map((p) => [p.slug, p]));

/** Thay thế catalogue cache (dùng sau khi fetch snapshot từ DB). */
export function setCatalogProducts(products: Product[]): void {
  catalog = products;
  byId = new Map(products.map((p) => [p.id, p]));
  bySlug = new Map(products.map((p) => [p.slug, p]));
}

export function getCatalog(): Product[] {
  return catalog;
}

function matchesQuery(p: Product, q: ProductQuery): boolean {
  if (q.brands?.length && !q.brands.includes(p.brand)) return false;
  if (q.categories?.length && !q.categories.includes(p.category)) return false;
  if (q.minPrice !== undefined && p.price < q.minPrice) return false;
  if (q.maxPrice !== undefined && p.price > q.maxPrice) return false;
  if (q.minRating !== undefined && p.rating < q.minRating) return false;
  if (q.inStockOnly && p.stock <= 0 && p.availability !== "in_stock" && p.availability !== "low_stock")
    return false;
  if (q.tags?.length && !q.tags.some((t) => p.tags.includes(t))) return false;
  if (q.search) {
    const hay = `${p.name} ${p.brand} ${p.subcategory} ${p.tags.join(" ")}`.toLowerCase();
    const terms = q.search.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.every((t) => hay.includes(t))) return false;
  }
  return true;
}

const SORTERS: Record<SortOption, (a: Product, b: Product) => number> = {
  featured: (a, b) => b.rating * b.reviewCount - a.rating * a.reviewCount,
  newest: (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt),
  price_asc: (a, b) => a.price - b.price,
  price_desc: (a, b) => b.price - a.price,
  best_selling: (a, b) => b.reviewCount - a.reviewCount,
  rating_desc: (a, b) => b.rating - a.rating,
};

/** Filter + sort + paginate thuần trên một danh sách — dùng chung client/server. */
export function applyQuery(products: Product[], query: ProductQuery = {}): Paginated<Product> {
  const filtered = products.filter((p) => matchesQuery(p, query));
  const sort: SortOption = query.sort ?? "featured";
  const sorted = [...filtered].sort(SORTERS[sort] ?? SORTERS.featured);

  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize ?? 9;
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const items = sorted.slice((page - 1) * pageSize, page * pageSize);

  return { items, total, page, pageSize, totalPages };
}

export function queryProducts(query: ProductQuery = {}): Paginated<Product> {
  return applyQuery(catalog, query);
}

export function getProductById(id: string): Product | undefined {
  return byId.get(id);
}

export function getProductBySlug(slug: string): Product | undefined {
  return bySlug.get(slug);
}

export function getProductsByIds(ids: string[]): Product[] {
  return ids.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
}

export function getFacets(query: ProductQuery = {}, list: Product[] = catalog): Facets {
  const filtered = list.filter((p) => matchesQuery(p, { ...query, brands: undefined, categories: undefined }));
  const brandCount = new Map<string, number>();
  const categoryCount = new Map<Category, number>();
  for (const p of filtered) {
    brandCount.set(p.brand, (brandCount.get(p.brand) ?? 0) + 1);
    categoryCount.set(p.category, (categoryCount.get(p.category) ?? 0) + 1);
  }
  const prices = filtered.map((p) => p.price);
  return {
    brands: [...brandCount.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count),
    categories: [...categoryCount.entries()].map(([value, count]) => ({ value, count })),
    priceRange: {
      min: prices.length ? Math.min(...prices) : 0,
      max: prices.length ? Math.max(...prices) : 0,
    },
  };
}

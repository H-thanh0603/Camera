/**
 * Commerce tools for the Lumina shopping agent. Every tool is:
 *   - provider-independent (zod contract, JSON args),
 *   - backed by the injected CommerceDataSource (seed | db),
 *   - read-only (no order/cart/checkout writes — those stay in the web app),
 *   - output-fenced to neutralise prompt-injection from product data.
 */

import { z } from "zod";
import type { Product } from "@/lib/types";
import type { CommerceTool } from "../agent/executor";
import { ToolRunError } from "../agent/executor";
import { fenceProduct } from "../agent/fencing";
import type { CommerceDataSource, SearchProductsParams } from "./data-source";

const CATEGORIES = ["camera", "lens", "lighting", "tripod", "storage", "battery", "bag", "accessory"] as const;

const productRefSchema = z
  .object({
    slug: z.string().min(1).max(200).optional(),
    id: z.string().min(1).max(80).optional(),
  })
  .refine((o) => o.slug || o.id, { message: "Cần cung cấp slug hoặc id." });

const searchSchema = z.object({
  query: z.string().min(1).max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  brand: z.string().min(1).max(80).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  inStockOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

const topSchema = z.object({
  category: z.enum(CATEGORIES).optional(),
  limit: z.number().int().min(1).max(12).default(5),
});

const emptySchema = z.object({});

export interface CommerceToolsDeps {
  source: CommerceDataSource;
}

function slim(p: Product) {
  return fenceProduct(p);
}

function requireRefFound(p: Product | null, label: string): Product {
  if (!p) throw new ToolRunError("not_found", `Không tìm thấy sản phẩm "${label}".`);
  return p;
}

/** Shared resolve by slug-or-id against the active data source. */
export function productResolver(source: CommerceDataSource) {
  return async (params: { slug?: string; id?: string }): Promise<Product> => {
    const p = await source.getProduct(params.id ? { id: params.id } : { slug: params.slug });
    return requireRefFound(p, params.slug ?? params.id ?? "");
  };
}
export function createCommerceTools(deps: CommerceToolsDeps): CommerceTool[] {
  const resolveProduct = productResolver(deps.source);

  const searchProducts: CommerceTool<typeof searchSchema, unknown> = {
    name: "search_products",
    description:
      "Tìm sản phẩm trong kho theo từ khóa/category/brand/giá. Trả danh sách gọn (tên, giá, tồn kho, rating).",
    input: searchSchema,
    run: async (args) => {
      const params: SearchProductsParams = {
        q: args.query,
        category: args.category,
        brand: args.brand,
        minPrice: args.minPrice,
        maxPrice: args.maxPrice,
        inStockOnly: args.inStockOnly,
        sort: "featured",
        limit: args.limit ?? 8,
      };
      const items = await deps.source.searchProducts(params);
      if (items.length === 0) {
        return { products: [], note: "Không có sản phẩm khớp. Thử bỏ bớt bộ lọc." };
      }
      return { products: items.map(slim), total: items.length };
    },
  };

  const getProductDetails: CommerceTool<typeof productRefSchema, unknown> = {
    name: "get_product_details",
    description:
      "Lấy chi tiết 1 sản phẩm theo slug hoặc id: thông số, giá, tồn kho, rating, highlight.",
    input: productRefSchema,
    run: async (args) => {
      const p = await resolveProduct(args);
      return { product: slim(p), specifications: p.specifications ?? {}, highlights: (p.highlights ?? []).slice(0, 6) };
    },
  };

  const getProductAvailability: CommerceTool<typeof productRefSchema, unknown> = {
    name: "get_product_availability",
    description: "Kiểm tra tình trạng còn hàng và các biến thể của 1 sản phẩm theo slug hoặc id.",
    input: productRefSchema,
    run: async (args) => {
      const p = await resolveProduct(args);
      return {
        id: p.id,
        name: p.name,
        availability: p.availability,
        stock: p.stock,
        variants: (p.variants ?? []).map((v) => ({ name: v.name, stock: v.stock, availability: v.availability })),
      };
    },
  };

  const getProductPrice: CommerceTool<typeof productRefSchema, unknown> = {
    name: "get_product_price",
    description: "Lấy giá hiện tại (và giá so sánh / sale) của 1 sản phẩm theo slug hoặc id.",
    input: productRefSchema,
    run: async (args) => {
      const p = await resolveProduct(args);
      return {
        id: p.id,
        name: p.name,
        priceVND: p.price,
        currency: p.currency,
        compareAtPriceVND: p.compareAtPrice ?? undefined,
        saleEndsAt: p.saleEndsAt ?? undefined,
        variants: (p.variants ?? []).map((v) => ({ name: v.name, priceVND: v.price, compareAtPriceVND: v.compareAtPrice ?? undefined })),
      };
    },
  };

  const listCategories: CommerceTool<typeof emptySchema, unknown> = {
    name: "list_categories",
    description: "Liệt kê các danh mục sản phẩm có trong cửa hàng.",
    input: emptySchema,
    run: async () => {
      const cats = await deps.source.listCategories();
      return { categories: cats };
    },
  };

  const getTopProducts: CommerceTool<typeof topSchema, unknown> = {
    name: "get_top_products",
    description: "Liệt kê sản phẩm nổi bật (mặc định máy ảnh) trong một category, có thể giới hạn số lượng.",
    input: topSchema,
    run: async (args) => {
      const items = await deps.source.searchProducts({
        category: args.category ?? "camera",
        sort: "featured",
        limit: args.limit ?? 5,
      });
      return { products: items.map(slim), total: items.length };
    },
  };

  return [
    searchProducts,
    getProductDetails,
    getProductAvailability,
    getProductPrice,
    listCategories,
    getTopProducts,
  ];
}

export const categoriesList = CATEGORIES;
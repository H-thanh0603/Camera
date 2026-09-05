import type { Product } from "@/lib/types";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Server-side DB catalogue — nguồn chuẩn khi admin quản trị sản phẩm.
 * Mapping Prisma row → domain Product (Json fields giữ shape types.ts).
 */

const INCLUDE = { variants: true } as const;

type ApprovedReviewRow = { id: string; author: string; rating: number; date: Date; title: string; body: string; verified: boolean };

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
        }))
      : undefined,
  };
}

export async function dbAllProducts(): Promise<Product[]> {
  const [rows, reviews] = await Promise.all([
    prisma.product.findMany({ include: INCLUDE, orderBy: { createdAt: "desc" } }),
    prisma.review.findMany({ where: { approved: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const byProduct = new Map<string, ApprovedReviewRow[]>();
  for (const r of reviews) {
    const list = byProduct.get(r.productId) ?? [];
    list.push({ id: r.id, author: r.author, rating: r.rating, date: r.createdAt, title: r.title, body: r.body, verified: r.verified });
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
    reviews.map((r) => ({ id: r.id, author: r.author, rating: r.rating, date: r.createdAt, title: r.title, body: r.body, verified: r.verified })),
  );
}

export async function dbGetProductById(id: string): Promise<Product | null> {
  const row = await prisma.product.findUnique({ where: { id }, include: INCLUDE });
  return row ? dbProductToDomain(row) : null;
}

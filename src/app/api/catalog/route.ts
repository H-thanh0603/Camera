import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";

/**
 * GET /api/catalog — catalogue machine-readable cho AI agent / so sánh giá.
 * Read-only, slim payload (không description dài, không specs, không images[]).
 * Dùng chung với llms.txt để agent discover mà không cần scrape HTML.
 * Phân trang: ?page=1&pageSize=100 (tối đa 200) — catalogue lên hàng nghìn
 * SP không còn trả full 1 response.
 */
export const revalidate = 300;

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 200;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(params.get("pageSize")) || DEFAULT_PAGE_SIZE));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://luminaoptics.vn";
  const [total, rows] = await Promise.all([
    prisma.product.count(),
    prisma.product.findMany({
      select: {
      id: true,
      slug: true,
      name: true,
      brand: true,
      category: true,
      price: true,
      compareAtPrice: true,
      saleEndsAt: true,
      currency: true,
      stock: true,
      availability: true,
      rating: true,
      reviewCount: true,
      shortDescription: true,
      thumbnail: true,
      updatedAt: true,
    },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const products = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    url: `${siteUrl}/products/${p.slug}`,
    name: p.name,
    brand: p.brand,
    category: p.category,
    price: p.price,
    currency: p.currency,
    compareAtPrice: p.compareAtPrice ?? undefined,
    saleEndsAt: p.saleEndsAt ? p.saleEndsAt.toISOString() : undefined,
    stock: p.stock,
    availability: p.availability,
    rating: p.rating,
    reviewCount: p.reviewCount,
    shortDescription: p.shortDescription,
    thumbnail: p.thumbnail,
    updatedAt: p.updatedAt.toISOString(),
  }));

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      count: total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      products,
    },
    { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } },
  );
}

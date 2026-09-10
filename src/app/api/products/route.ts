import { NextResponse, type NextRequest } from "next/server";
import { cachedQueryProducts } from "@/lib/server/product-db";
import { productQuerySchema, zodFieldErrors } from "@/lib/schemas";

/**
 * GET /api/products — catalogue phân trang + tìm kiếm server-side.
 * Query: ?q=&brand(s)=&category(ies)=&tag=&minPrice=&maxPrice=&minRating=
 *   &inStockOnly=1&sort=&page=&pageSize=
 * Trên Postgres + có q: pg_trgm (ILIKE + similarity>0.2, sort relevance
 * khi sort=featured). SQLite: contains cũ.
 * Client cache (cart/wishlist/compare) làm mới qua POST /api/products/resolve
 * theo ids — không còn endpoint full-catalog (snapshot đã xóa).
 */
export async function GET(request: NextRequest) {
  const query = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = productQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tham số tìm kiếm chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const result = await cachedQueryProducts(parsed.data);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}

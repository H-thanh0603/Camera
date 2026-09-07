import { NextResponse, type NextRequest } from "next/server";
import { dbQueryProducts } from "@/lib/server/product-db";
import { productQuerySchema, zodFieldErrors } from "@/lib/schemas";

/**
 * GET /api/products — catalogue phân trang + tìm kiếm server-side.
 * Query: ?q=&brand(s)=&category(ies)=&tag=&minPrice=&maxPrice=&minRating=
 *   &inStockOnly=1&sort=&page=&pageSize=
 * Giữ /api/products/snapshot cho client cache cũ (cart/wishlist resolve);
 * listing/search dùng endpoint này để không tải toàn bộ về client.
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
  const result = await dbQueryProducts(parsed.data);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  });
}

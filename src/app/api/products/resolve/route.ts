import { NextResponse, type NextRequest } from "next/server";
import { dbGetProductsByIds } from "@/lib/server/product-db";
import { productResolveSchema, zodFieldErrors } from "@/lib/schemas";
import { getRequestLimiter } from "@/lib/server/rate-limit-redis";
import { getClientIp } from "@/lib/server/client-ip";

/**
 * POST /api/products/resolve — làm mới giá/stock cho đúng các sản phẩm
 * client đang giữ (giỏ/wishlist/compare/recent), bounded 50 ids.
 * Thay thế /api/products/snapshot (đã xóa): không còn endpoint nào tải
 * toàn bộ catalogue về client — catalogue nghìn SKU vẫn nhẹ.
 */
const limiter = getRequestLimiter({ windowMs: 60_000, max: 30 });

export async function POST(request: NextRequest) {
  const limit = await limiter.check(`resolve:${getClientIp(request.headers)}`);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Quá nhiều yêu cầu. Thử lại sau." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const parsed = productResolveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Danh sách sản phẩm chưa hợp lệ.", fieldErrors: zodFieldErrors(parsed.error) },
      { status: 422 },
    );
  }
  const products = await dbGetProductsByIds(parsed.data.ids);
  return NextResponse.json(
    { products },
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}

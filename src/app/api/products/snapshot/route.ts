import { NextResponse } from "next/server";
import { dbAllProducts } from "@/lib/server/product-db";

/**
 * GET /api/products/snapshot — catalogue đầy đủ cho client cache.
 * Client khởi tạo bằng seed snapshot (khớp SSR), rồi refresh từ đây để
 * giá/stock khớp DB mà admin quản trị. Khi catalogue lên hàng nghìn SP,
 * thay bằng endpoint phân trang/tìm kiếm server-side.
 *
 * revalidate 60s: chỉnh sửa của admin hiển thị trên client trong ~1 phút.
 */
export const revalidate = 60;

export async function GET() {
  const products = await dbAllProducts();
  return NextResponse.json({ products });
}

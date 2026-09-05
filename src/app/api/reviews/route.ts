import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/session";
import { createRateLimiter } from "@/lib/utils/rate-limit";
import { dbGetProductById } from "@/lib/server/product-db";

/**
 * POST /api/reviews — gửi đánh giá.
 * Review lưu với approved=false; chỉ moderator/backend duyệt mới hiển thị
 * công khai. verified=false mặc định — chỉ backend đối chiếu lịch sử đơn
 * hàng mới đánh dấu "đã mua".
 */

const limiter = createRateLimiter({ windowMs: 60_000, max: 5 });

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!limiter.check(`review:${ip}`).allowed) {
    return NextResponse.json({ error: "Quá nhiều đánh giá. Thử lại sau một phút." }, { status: 429 });
  }

  let body: { productId?: string; author?: string; rating?: number; title?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }

  const productId = body.productId ?? "";
  const author = (body.author ?? "").trim();
  const title = (body.title ?? "").trim();
  const reviewBody = (body.body ?? "").trim();
  const rating = body.rating;

  const fieldErrors: Record<string, string> = {};
  if (Object.keys(fieldErrors).length === 0) {
    const product = await dbGetProductById(productId);
    if (!product) fieldErrors.productId = "Sản phẩm không tồn tại.";
  }
  if (author.length < 2) fieldErrors.author = "Vui lòng nhập tên của bạn.";
  if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) fieldErrors.rating = "Vui lòng chọn số sao từ 1 đến 5.";
  if (title.length < 4) fieldErrors.title = "Tiêu đề cần tối thiểu 4 ký tự.";
  if (reviewBody.length < 20) fieldErrors.body = "Nội dung cần tối thiểu 20 ký tự.";
  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json({ error: "Đánh giá chưa hợp lệ.", fieldErrors }, { status: 422 });
  }

  const user = await getSessionUser();

  await prisma.review.create({
    data: {
      productId,
      userId: user?.id ?? null,
      author,
      rating: rating as number,
      title,
      body: reviewBody,
      approved: false,
      verified: false,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

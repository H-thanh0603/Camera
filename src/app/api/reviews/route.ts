import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/server/prisma";
import { getSessionUser } from "@/lib/server/session";
import { createRateLimiter } from "@/lib/utils/rate-limit";
import { dbGetProductById } from "@/lib/server/product-db";
import { reviewSchema, zodFieldErrors } from "@/lib/schemas";

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

  const fieldErrors: Record<string, string> = {};
  const parsed = reviewSchema.safeParse({ author: body.author, rating: body.rating, title: body.title, body: body.body });
  if (!parsed.success) {
    return NextResponse.json({ error: "Đánh giá chưa hợp lệ.", fieldErrors: { ...fieldErrors, ...zodFieldErrors(parsed.error) } }, { status: 422 });
  }

  const productId = body.productId ?? "";
  const product = await dbGetProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Sản phẩm không tồn tại.", fieldErrors: { productId: "Sản phẩm không tồn tại." } }, { status: 422 });
  }

  const user = await getSessionUser();

  await prisma.review.create({
    data: {
      productId,
      userId: user?.id ?? null,
      author: parsed.data.author,
      rating: parsed.data.rating,
      title: parsed.data.title,
      body: parsed.data.body,
      approved: false,
      verified: false,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

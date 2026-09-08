import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { recalcProductRating } from "@/lib/server/ratings";
import { grantPhotoReviewReward } from "@/lib/server/review-reward";

/**
 * PATCH  /api/admin/reviews/:id — { approved: true | false } duyệt/hủy duyệt.
 * Duyệt xong cập nhật lại rating/reviewCount của sản phẩm từ review đã duyệt.
 * DELETE — xóa review (spam).
 */

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const { id } = await params;
  let body: { approved?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  if (typeof body.approved !== "boolean") {
    return NextResponse.json({ error: "Thiếu trường approved." }, { status: 422 });
  }

  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "Không tìm thấy review." }, { status: 404 });

  await prisma.review.update({ where: { id }, data: { approved: body.approved } });
  await recalcProductRating(review.productId);
  // Thưởng review có ảnh: coupon 5% dùng 1 lần, gửi mail nếu reviewer đăng nhập
  let rewardCode: string | null = null;
  if (body.approved) {
    rewardCode = await grantPhotoReviewReward(review.id);
  }
  revalidatePath("/", "layout");
  await logAudit(await getSessionUser(), body.approved ? "review.approve" : "review.unapprove", "review", id, { productId: review.productId });
  return NextResponse.json({ ok: true, rewardCode });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuardResponse();
  if (denied) return denied;

  const { id } = await params;
  const review = await prisma.review.findUnique({ where: { id } });
  if (!review) return NextResponse.json({ error: "Không tìm thấy review." }, { status: 404 });

  await prisma.review.delete({ where: { id } });
  await recalcProductRating(review.productId);
  revalidatePath("/", "layout");
  await logAudit(await getSessionUser(), "review.delete", "review", id, { productId: review.productId });
  return NextResponse.json({ ok: true });
}

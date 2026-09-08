import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/server/prisma";
import { adminGuardResponse } from "@/lib/server/admin";
import { logAudit } from "@/lib/server/audit";
import { getSessionUser } from "@/lib/server/session";
import { recalcProductRating } from "@/lib/server/ratings";
import { randomBytes } from "node:crypto";

/**
 * Thưởng review có ảnh được duyệt: tạo coupon 5%/1 lượt/HSD 30 ngày,
 * gửi qua email queue nếu reviewer có tài khoản. Idempotent nhờ
 * review.rewardCode (duyệt lại không tạo trùng). Chỉ user đăng nhập
 * được thưởng — chống spam guest.
 */
export async function grantPhotoReviewReward(reviewId: string): Promise<string | null> {
  const { prisma: db } = await import("@/lib/server/prisma");
  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review || !review.approved || review.rewardCode) return review?.rewardCode ?? null;
  const photos = Array.isArray(review.photos) ? review.photos : [];
  if (photos.length === 0 || !review.userId) return null;
  const user = await db.user.findUnique({ where: { id: review.userId } });
  if (!user) return null;

  const code = `RVW-${randomBytes(4).toString("hex").toUpperCase()}`;
  try {
    await db.coupon.create({
      data: {
        code,
        kind: "percent",
        value: 5,
        minSubtotal: 0,
        maxUses: 1,
        active: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
  } catch {
    return null; // code trùng hy hữu — bỏ qua, admin duyệt lại sau
  }
  await db.review.update({ where: { id: reviewId }, data: { rewardCode: code } });

  const { enqueueEmail, getQueueRedis } = await import("@/lib/server/email-queue");
  const { sendEmail } = await import("@/lib/server/email");
  const mail = {
    kind: "review-reward",
    to: user.email,
    subject: "Cảm ơn review có ảnh — tặng bạn mã giảm 5%",
    html: `<div style="font-family:sans-serif;max-width:560px"><h2>Cảm ơn ${user.name}!</h2><p>Review có ảnh của bạn đã được duyệt. Mã giảm giá 5% (1 lần, HSD 30 ngày):</p><p style="font-size:24px;font-weight:bold;letter-spacing:2px">${code}</p></div>`,
  };
  const { queued } = await enqueueEmail(getQueueRedis(), mail);
  if (!queued) await sendEmail(mail);
  return code;
}

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

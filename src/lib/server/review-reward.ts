import { prisma } from "@/lib/server/prisma";
import { randomBytes } from "node:crypto";

/**
 * Thưởng review có ảnh được duyệt: tạo coupon 5%/1 lượt/HSD 30 ngày,
 * gửi qua email queue nếu reviewer có tài khoản. Idempotent nhờ
 * review.rewardCode (duyệt lại không tạo trùng). Chỉ user đăng nhập
 * được thưởng — chống spam guest.
 */
export async function grantPhotoReviewReward(reviewId: string): Promise<string | null> {
    const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || !review.approved || review.rewardCode) return review?.rewardCode ?? null;
  const photos = Array.isArray(review.photos) ? review.photos : [];
  if (photos.length === 0 || !review.userId) return null;
  const user = await prisma.user.findUnique({ where: { id: review.userId } });
  if (!user) return null;

  const code = `RVW-${randomBytes(4).toString("hex").toUpperCase()}`;
  try {
    await prisma.coupon.create({
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
  await prisma.review.update({ where: { id: reviewId }, data: { rewardCode: code } });

  const { queueOutboxEmail } = await import("@/lib/server/email-outbox");
  queueOutboxEmail({
    kind: "review-reward",
    to: user.email,
    subject: "Cảm ơn review có ảnh — tặng bạn mã giảm 5%",
    html: `<div style="font-family:sans-serif;max-width:560px"><h2>Cảm ơn ${user.name}!</h2><p>Review có ảnh của bạn đã được duyệt. Mã giảm giá 5% (1 lần, HSD 30 ngày):</p><p style="font-size:24px;font-weight:bold;letter-spacing:2px">${code}</p></div>`,
  });
  return code;
}


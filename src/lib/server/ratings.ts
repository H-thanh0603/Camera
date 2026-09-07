import { prisma } from "./prisma";

/**
 * Tính lại rating từ seed BẤT BIẾN + aggregate review đã duyệt.
 * Idempotent: gọi N lần liên tiếp cho cùng tập approved cho cùng kết quả
 * (fix lỗi drift cũ dùng reviewCount đã cộng dồn làm seed).
 */
export async function recalcProductRating(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;
  const approved = await prisma.review.findMany({ where: { productId, approved: true } });
  const totalCount = product.seedCount + approved.length;
  const totalScore = product.seedTotal + approved.reduce((sum, r) => sum + r.rating, 0);
  const rating = totalCount > 0 ? totalScore / totalCount : 0;
  await prisma.product.update({
    where: { id: productId },
    data: { rating: Math.round(rating * 10) / 10, reviewCount: totalCount },
  });
}

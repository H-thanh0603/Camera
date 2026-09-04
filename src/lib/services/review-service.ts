import type { Review } from "@/lib/types";
import { loadJSON, saveJSON } from "@/lib/repositories/storage-repository";
import { minLength } from "@/lib/utils/validation";

/**
 * ReviewService — gửi và đọc đánh giá sản phẩm.
 * Mock phía client: review do người dùng gửi lưu localStorage và được đánh
 * dấu "chờ kiểm duyệt". Khi có backend: POST /products/:id/reviews — review
 * mới sẽ nằm ở trạng thái pending cho tới khi moderator duyệt, và mọi
 * review hiển thị công khai phải đến từ API (chống spam/review ảo).
 */

export interface ReviewDraft {
  author: string;
  rating: number;
  title: string;
  body: string;
}

export type ReviewSubmitResult =
  | { ok: true; review: Review }
  | { ok: false; fieldErrors: Partial<Record<keyof ReviewDraft, string>> };

const KEY_PREFIX = "reviews.";

function validateDraft(draft: ReviewDraft): Partial<Record<keyof ReviewDraft, string>> {
  const errors: Partial<Record<keyof ReviewDraft, string>> = {};
  if (!Number.isInteger(draft.rating) || draft.rating < 1 || draft.rating > 5) {
    errors.rating = "Vui lòng chọn số sao từ 1 đến 5.";
  }
  if (draft.author.trim().length < 2) errors.author = "Vui lòng nhập tên của bạn.";
  if (draft.title.trim().length < 4) errors.title = "Tiêu đề cần tối thiểu 4 ký tự.";
  if (draft.body.trim().length < 20) errors.body = "Nội dung cần tối thiểu 20 ký tự.";
  return errors;
}

function localReviews(productId: string): Review[] {
  return loadJSON<Review[]>(KEY_PREFIX + productId, []);
}

export function getProductReviews(productId: string, seedReviews: Review[] = []): Review[] {
  // Review local (chờ duyệt) hiển thị sau, có cờ riêng — không trộn vào điểm trung bình
  return [...seedReviews, ...localReviews(productId)];
}

export function countPendingReviews(productId: string): number {
  return localReviews(productId).length;
}

export async function submitReview(productId: string, draft: ReviewDraft): Promise<ReviewSubmitResult> {
  const fieldErrors = validateDraft(draft);
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, fieldErrors };
  }

  // Giả lập network để UI xử lý loading/error thật
  await new Promise((r) => setTimeout(r, 800));
  if (Math.random() < 0.05) {
    throw new Error("NETWORK");
  }

  const review: Review = {
    id: `r_${Date.now().toString(36)}`,
    author: draft.author.trim(),
    rating: draft.rating as Review["rating"],
    date: new Date().toISOString(),
    title: draft.title.trim(),
    body: draft.body.trim(),
    verified: false, // chỉ backend mới xác thực được đơn hàng đã mua
  };

  saveJSON(KEY_PREFIX + productId, [review, ...localReviews(productId)]);
  return { ok: true, review };
}

// Re-export để form tái dùng chuẩn validation chung
export const minBodyLength = minLength("Nội dung", 20);

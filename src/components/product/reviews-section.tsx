"use client";

import { useState } from "react";
import type { Product, Review } from "@/lib/types";
import { getProductReviews, submitReview, type ReviewDraft } from "@/lib/services/review-service";
import { formatDate, cn } from "@/lib/utils/format";
import { RatingStars } from "@/components/ui/rating-stars";
import { EmptyState, Spinner } from "@/components/ui/states";
import { useStore } from "@/state/store";

/**
 * ReviewsSection — hiển thị đánh giá + form gửi review.
 * Review người dùng gửi qua mock được đánh dấu "chờ kiểm duyệt" (trung thực
 * với trạng thái client-only), không cộng vào điểm trung bình seed.
 */
export function ReviewsSection({ product }: { product: Product }) {
  const { user } = useStore();
  const [reviews, setReviews] = useState<Review[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<ReviewDraft>({ author: "", rating: 0, title: "", body: "" });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof ReviewDraft, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const [submittedOk, setSubmittedOk] = useState(false);

  const allReviews = reviews ?? getProductReviews(product.id, product.reviews ?? []);
  const seedCount = (product.reviews ?? []).length;
  const localReviews = allReviews.slice(seedCount);

  const setField = (key: keyof ReviewDraft, value: string | number) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitFailed(false);
    try {
      const result = await submitReview(product.id, draft);
      if (result.ok) {
        setReviews(getProductReviews(product.id, product.reviews ?? []));
        setSubmittedOk(true);
        setShowForm(false);
        setDraft({ author: "", rating: 0, title: "", body: "" });
      } else {
        setFieldErrors(result.fieldErrors);
      }
    } catch {
      setSubmitFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="flex flex-col gap-space-md" aria-label="Đánh giá của khách hàng">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <h2 className="font-headline-md text-headline-md text-on-surface">Đánh Giá Từ Chủ Nhân ({product.reviewCount})</h2>
        <div className="flex items-center gap-space-md">
          <span className="flex items-center gap-space-xs">
            <RatingStars rating={product.rating} />
            <span className="font-telemetry-data text-telemetry-data text-primary">{product.rating.toFixed(1)}/5</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setShowForm((v) => !v);
              setSubmittedOk(false);
            }}
            className="rounded-lg bg-primary px-space-md py-space-2xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim"
            aria-expanded={showForm}
          >
            {showForm ? "Đóng form" : "Viết đánh giá"}
          </button>
        </div>
      </div>

      {submittedOk && (
        <p className="rounded-lg bg-surface-container-low p-space-sm font-body-sm text-body-sm text-primary" role="status">
          Cảm ơn bạn! Đánh giá đã được ghi nhận và đang chờ kiểm duyệt — sẽ hiển thị công khai sau khi duyệt.
        </p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-space-sm rounded-xl bg-surface-container p-space-lg">
          <fieldset className="flex items-center gap-space-xs">
            <legend className="sr-only">Số sao đánh giá</legend>
            <span className="mr-space-xs font-telemetry-xs text-telemetry-xs uppercase text-outline">Đánh giá của bạn:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setField("rating", star)}
                aria-label={`${star} sao`}
                aria-pressed={draft.rating === star}
                className="p-space-2xs"
              >
                <span
                  className={cn("material-symbols-outlined text-[24px]", draft.rating >= star ? "text-primary" : "text-outline")}
                  aria-hidden="true"
                >
                  {draft.rating >= star ? "star" : "star_border"}
                </span>
              </button>
            ))}
            {fieldErrors.rating && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{fieldErrors.rating}</p>}
          </fieldset>

          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="review-title" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Tiêu đề</label>
            <input
              id="review-title"
              value={draft.title}
              onChange={(e) => setField("title", e.target.value)}
              aria-invalid={Boolean(fieldErrors.title)}
              className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none", fieldErrors.title ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")}
            />
            {fieldErrors.title && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{fieldErrors.title}</p>}
          </div>

          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="review-body" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">Nội dung (tối thiểu 20 ký tự)</label>
            <textarea
              id="review-body"
              rows={4}
              value={draft.body}
              onChange={(e) => setField("body", e.target.value)}
              aria-invalid={Boolean(fieldErrors.body)}
              className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none resize-y", fieldErrors.body ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")}
            />
            {fieldErrors.body && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{fieldErrors.body}</p>}
          </div>

          <div className="flex flex-col gap-space-2xs">
            <label htmlFor="review-author" className="font-telemetry-xs text-telemetry-xs uppercase text-outline">
              Tên của bạn {user && `(đang đăng nhập: ${user.name})`}
            </label>
            <input
              id="review-author"
              value={draft.author}
              onChange={(e) => setField("author", e.target.value)}
              placeholder={user ? user.name : "VD: Nguyễn V. A."}
              aria-invalid={Boolean(fieldErrors.author)}
              className={cn("rounded-lg bg-surface-container-low px-space-sm py-space-xs font-body-md text-body-md text-on-surface outline-none", fieldErrors.author ? "ring-1 ring-error" : "focus:ring-1 focus:ring-primary")}
            />
            {fieldErrors.author && <p className="font-telemetry-xs text-telemetry-xs text-error" role="alert">{fieldErrors.author}</p>}
          </div>

          {submitFailed && (
            <div className="flex items-center justify-between gap-space-sm rounded-lg border border-error/40 bg-error-container/20 p-space-sm" role="alert">
              <p className="font-body-sm text-body-sm text-error">Không gửi được do lỗi mạng. Vui lòng thử lại.</p>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="shrink-0 rounded-lg bg-surface-container-high px-space-sm py-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-on-surface">
                Thử lại
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex w-fit items-center justify-center gap-space-xs rounded-lg bg-primary px-space-lg py-space-xs font-headline-sm text-telemetry-data uppercase text-on-primary transition-colors hover:bg-primary-fixed-dim disabled:opacity-60"
          >
            {submitting && <Spinner className="border-on-primary border-t-transparent" />}
            Gửi đánh giá
          </button>
        </form>
      )}

      {allReviews.length === 0 ? (
        <EmptyState
          icon="rate_review"
          title="Chưa có đánh giá chi tiết"
          description={`Trở thành chủ nhân đầu tiên chia sẻ trải nghiệm về ${product.name}.`}
        />
      ) : (
        <div className="grid grid-cols-1 gap-space-md md:grid-cols-2">
          {allReviews.map((review) => (
            <article key={review.id} className="flex flex-col gap-space-xs rounded-xl bg-surface-container p-space-lg">
              <div className="flex items-center justify-between">
                <RatingStars rating={review.rating} size={14} />
                <span className="font-telemetry-xs text-telemetry-xs text-outline">{formatDate(review.date)}</span>
              </div>
              <h3 className="font-headline-sm text-headline-sm text-on-surface">{review.title}</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant">{review.body}</p>
              <footer className="flex items-center gap-space-xs pt-space-2xs font-telemetry-xs text-telemetry-xs uppercase text-outline">
                <span className="text-on-surface">{review.author}</span>
                {review.verified ? (
                  <span className="flex items-center gap-space-2xs text-primary">
                    <span className="material-symbols-outlined text-[12px]" aria-hidden="true">verified</span> ĐÃ MUA TẠI LUMINA
                  </span>
                ) : (
                  <span className="text-tertiary">CHỜ KIỂM DUYỆT</span>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      {localReviews.length > 0 && (
        <p className="font-telemetry-xs text-telemetry-xs uppercase text-outline">
          {localReviews.length} đánh giá của bạn đang chờ kiểm duyệt (chưa tính vào điểm trung bình).
        </p>
      )}
    </section>
  );
}
